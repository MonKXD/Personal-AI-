import { v1, v1json, OPTIONS } from "@/lib/api-v1";
import { deleteWebhook } from "@/lib/db/queries";

export const runtime = "nodejs";
export { OPTIONS };

/** DELETE /api/v1/webhooks/{id} — unregister a delivery target. */
export const DELETE = v1(async (actor, _req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await deleteWebhook(actor.userId, id);
  return v1json({ ok: true });
});
