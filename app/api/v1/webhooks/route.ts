import { z } from "zod";
import { v1, v1json, OPTIONS } from "@/lib/api-v1";
import { HttpError } from "@/lib/http";
import { createWebhook, listWebhooks } from "@/lib/db/queries";

export const runtime = "nodejs";
export { OPTIONS };

const EVENTS = [
  "capture.completed",
  "memory.created",
  "action_item.due_soon",
  "digest.weekly",
  "*",
] as const;

/** GET /api/v1/webhooks — list this account's webhooks. */
export const GET = v1(async (actor) => {
  const rows = await listWebhooks(actor.userId);
  return v1json({
    items: rows.map((h) => ({
      id: h.id,
      url: h.url,
      events: h.events,
      active: h.active,
      last_status: h.lastStatus,
      last_delivery_at: h.lastDeliveryAt,
    })),
  });
});

const createSchema = z.object({
  url: z.string().url().max(1000),
  events: z.array(z.enum(EVENTS)).min(1).default(["*"]),
});

/**
 * POST /api/v1/webhooks  { url, events? }
 * Registers a delivery target — used by Zapier REST Hooks and anything else
 * that wants instant events. Returns { id, secret } (the HMAC signing secret).
 */
export const POST = v1(async (actor, req) => {
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, "bad_request", "Pass a valid `url`.");
  const { newWebhookSecret } = await import("@/lib/webhooks");
  const secret = newWebhookSecret();
  const id = await createWebhook(actor.userId, parsed.data.url, secret, parsed.data.events);
  return v1json({ id, url: parsed.data.url, events: parsed.data.events, secret }, 201);
});
