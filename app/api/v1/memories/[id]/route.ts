import { v1, v1json, OPTIONS } from "@/lib/api-v1";
import { HttpError } from "@/lib/http";
import { getMemoryDetail } from "@/lib/db/queries";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";
export { OPTIONS };

/** GET /api/v1/memories/{id} — one memory, full text + entities + deadlines. */
export const GET = v1(async (actor, _req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const d = await getMemoryDetail(actor.userId, id);
  if (!d) throw new HttpError(404, "not_found", "Memory not found.");
  const m = d.memory;
  return v1json({
    id: m.id,
    type: m.type,
    title: m.title,
    summary: m.summary,
    text: m.correctedText ?? m.text,
    captured_at: m.capturedAt,
    folder_id: m.folderId ?? null,
    source_url: d.capture.sourceUrl ?? null,
    share_url: m.shareId ? `${publicEnv.siteUrl.replace(/\/$/, "")}/m/${m.shareId}` : null,
    tags: d.tags,
    entities: d.entities.map((e) => ({
      kind: e.kind,
      value: e.valueText,
      normalized: e.valueNorm ?? null,
      at: e.tsValue ?? null,
    })),
    action_items: d.actionItems.map((a) => ({
      id: a.id,
      title: a.title,
      due_at: a.dueAt,
      status: a.status,
    })),
  });
});
