import "server-only";

import webpush from "web-push";
import { listPushSubscriptions, dropPushEndpoints } from "@/lib/db/queries";
import { reportError } from "@/lib/observe";

/**
 * Web Push sender. Inert unless VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are set.
 * Endpoints that return 404/410 (unsubscribed) are pruned.
 */

let ready = false;
function configure(): boolean {
  if (ready) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:owner@personal-ai.app",
    pub,
    priv,
  );
  ready = true;
  return true;
}

export function pushEnabled(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendPush(
  userId: string,
  payload: { title: string; body?: string; url?: string; tag?: string },
): Promise<void> {
  if (!configure()) return;
  const subs = await listPushSubscriptions(userId);
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 * 12 },
        );
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);
        else reportError(e, { where: "sendPush", userId });
      }
    }),
  );
  if (dead.length) await dropPushEndpoints(dead).catch(() => {});
}
