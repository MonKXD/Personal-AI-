import { v1, v1json, OPTIONS } from "@/lib/api-v1";
import { listActionItems } from "@/lib/db/queries";

export const runtime = "nodejs";
export { OPTIONS };

/** GET /api/v1/action-items?status=open|done|dismissed (default open). */
export const GET = v1(async (actor, req) => {
  const s = new URL(req.url).searchParams.get("status");
  const status = s === "done" || s === "dismissed" ? s : "open";
  const rows = await listActionItems(actor.userId, { status });
  return v1json({
    items: rows.map((a) => ({
      id: a.id,
      title: a.title,
      due_at: a.dueAt,
      status: a.status,
      memory_id: a.memoryId,
      memory_title: a.memoryTitle,
    })),
  });
});
