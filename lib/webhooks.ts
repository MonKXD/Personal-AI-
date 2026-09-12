import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { webhooksForEvent, recordWebhookResult } from "@/lib/db/queries";
import { reportError } from "@/lib/observe";

/**
 * Outbound webhooks. Fire-and-forget: `dispatch()` never throws to its caller,
 * so a broken endpoint can't break the pipeline or a cron run.
 */

export type WebhookEvent =
  | "capture.completed"
  | "memory.created"
  | "action_item.due_soon"
  | "digest.weekly";

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

function sign(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

async function deliver(hook: { id: string; url: string; secret: string }, body: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 800));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(hook.url, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "content-type": "application/json",
          "user-agent": "Personal AI-Webhook/1.0",
          "x-personal-ai-signature": sign(hook.secret, body),
        },
        body,
      });
      clearTimeout(timer);
      await recordWebhookResult(hook.id, res.status, res.ok);
      if (res.ok) return;
    } catch {
      clearTimeout(timer);
      if (attempt === 1) await recordWebhookResult(hook.id, 0, false).catch(() => {});
    }
  }
}

/** Send `event` to every active hook of `userId` subscribed to it. */
export async function dispatchWebhooks(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const hooks = await webhooksForEvent(userId, event);
    if (hooks.length === 0) return;
    const body = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    await Promise.allSettled(hooks.map((h) => deliver(h, body)));
  } catch (e) {
    reportError(e, { where: "dispatchWebhooks", event });
  }
}
