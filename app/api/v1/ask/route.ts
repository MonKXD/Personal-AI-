import { z } from "zod";
import { v1, v1json, OPTIONS } from "@/lib/api-v1";
import { HttpError } from "@/lib/http";
import { answerQuestion } from "@/lib/chat/answer";
import { aiBudgetExceeded, AI_BUDGET_MESSAGE } from "@/lib/ai/usage";

export const runtime = "nodejs";
export const maxDuration = 45;
export { OPTIONS };

const schema = z.object({ question: z.string().trim().min(2).max(1000) });

/**
 * POST /api/v1/ask  { "question": "…" }
 * → { answer, no_memory, citations: [{ memory_id, title, type, snippet }] }
 * Non-streaming. Costs against the shared daily AI budget.
 */
export const POST = v1(async (actor, req) => {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, "bad_request", "Pass a `question` string.");
  if (await aiBudgetExceeded()) throw new HttpError(429, "ai_budget_reached", AI_BUDGET_MESSAGE);

  const r = await answerQuestion(actor.userId, parsed.data.question);
  return v1json({
    answer: r.answer,
    no_memory: r.noMemory,
    citations: r.citations.map((c) => ({
      memory_id: c.memoryId,
      title: c.title,
      type: c.type,
      snippet: c.snippet,
    })),
    used_filters: r.usedFilters,
  });
});
