import { v1, v1json, OPTIONS } from "@/lib/api-v1";
import { HttpError } from "@/lib/http";
import { getCapture } from "@/lib/db/queries";

export const runtime = "nodejs";
export { OPTIONS };

/** GET /api/v1/captures/{id} — processing status + the memory id once ready. */
export const GET = v1(async (actor, _req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const row = await getCapture(actor.userId, id);
  if (!row) throw new HttpError(404, "not_found", "Capture not found.");
  return v1json({
    id: row.id,
    status: row.status,
    error_code: row.errorCode ?? null,
    memory_id: row.memoryId ?? null,
    captured_at: row.capturedAt,
    updated_at: row.updatedAt,
  });
});
