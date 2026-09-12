import "server-only";

import { getDeadlineExtractor } from "@/lib/ai";
import { DEADLINE_CONFIDENCE_THRESHOLD, computeDeadlinePriority } from "@/lib/ai/types";
import { getEnv } from "@/lib/env";
import { insertDeadline } from "@/lib/db/queries";
import { newId } from "@/lib/ids";
import { reportError } from "@/lib/observe";

export { computeDeadlinePriority };
export type DeadlinePriority = ReturnType<typeof computeDeadlinePriority>;

/**
 * Shared extraction step for every deadline source (WhatsApp triage, the
 * calling assistant's post-call summary). One Claude/Gemini call; only
 * writes a row when confidence clears DEADLINE_CONFIDENCE_THRESHOLD — a
 * false positive here erodes trust in the whole deadline list faster than a
 * missed one. See docs/modules/deadline-engine.md.
 *
 * Best-effort: extraction failures are logged and swallowed so a flaky AI
 * call never breaks the caller's own write (a WhatsApp sync, a call summary).
 */
export async function extractDeadline(
  text: string,
  context: { userId: string; source: "whatsapp" | "call"; sourceRefId: string },
): Promise<{ id: string; title: string; dueAt: Date } | null> {
  if (!text.trim()) return null;
  try {
    const env = getEnv();
    const now = new Date();
    const result = await getDeadlineExtractor().extract({
      text,
      now: now.toISOString(),
      timezone: env.APP_TZ,
    });
    if (!result.found || !result.dueDate || result.confidence < DEADLINE_CONFIDENCE_THRESHOLD) {
      return null;
    }
    const dueAt = new Date(result.dueDate);
    if (Number.isNaN(dueAt.getTime())) return null;

    const id = newId();
    await insertDeadline({
      id,
      userId: context.userId,
      title: result.title?.trim() || "Untitled deadline",
      dueAt,
      status: "pending",
      source: context.source,
      sourceRefId: context.sourceRefId,
      confidence: result.confidence,
    });
    return { id, title: result.title?.trim() || "Untitled deadline", dueAt };
  } catch (e) {
    reportError(e, { where: "extractDeadline", source: context.source });
    return null;
  }
}
