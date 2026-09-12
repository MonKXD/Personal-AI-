import { NextResponse, type NextRequest } from "next/server";
import { reportError } from "@/lib/observe";
import { getEnv } from "@/lib/env";
import {
  listUsersForReminders,
  listActionItems,
  addNotification,
  claimReminderSlot,
  releaseReminderSlot,
} from "@/lib/db/queries";
import { sendReminderEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 120;

const DUE_WINDOW_MS = 24 * 3600_000;

/** Vercel Cron — due-soon action item reminders. Auth: `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(req: NextRequest) {
  const secret = getEnv().CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error_code: "unauthorized" }, { status: 401 });
    }
  }

  const recipients = await listUsersForReminders();
  const now = Date.now();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of recipients) {
    try {
      const items = await listActionItems(r.userId, { status: "open" });
      const dueSoon = items.filter(
        (a) => a.dueAt && a.dueAt.getTime() >= now && a.dueAt.getTime() - now <= DUE_WINDOW_MS,
      );

      // In-app notification (deduped by the item id, independent of email).
      for (const item of dueSoon) {
        await addNotification({
          userId: r.userId,
          kind: "due_soon",
          title: `Due soon: ${item.title}`,
          body: `From "${item.memoryTitle}"`,
          href: `/memory/${item.memoryId}`,
          dedupeKey: `due:${item.id}`,
        }).catch(() => {});
      }

      if (dueSoon.length) {
        const { dispatchWebhooks } = await import("@/lib/webhooks");
        const { sendPush } = await import("@/lib/push");
        for (const item of dueSoon) {
          void dispatchWebhooks(r.userId, "action_item.due_soon", {
            id: item.id,
            title: item.title,
            due_at: item.dueAt?.toISOString() ?? null,
            memory_id: item.memoryId,
            memory_title: item.memoryTitle,
          });
          void sendPush(r.userId, {
            title: `Due soon: ${item.title}`,
            body: `From "${item.memoryTitle}"`,
            url: `/memory/${item.memoryId}`,
            tag: `due:${item.id}`,
          });
        }
      }

      for (const item of dueSoon) {
        const claimed = await claimReminderSlot(item.id, "due_soon");
        if (!claimed) {
          skipped++;
          continue;
        }
        const ok = await sendReminderEmail(r.email, {
          title: item.title,
          dueAt: item.dueAt!.toISOString(),
          memoryTitle: item.memoryTitle,
          memoryId: item.memoryId,
        });
        // Only keep the claim on a real send — a no-op (e.g. RESEND_API_KEY
        // not configured yet) releases it so tomorrow's run retries instead
        // of skipping forever.
        if (ok) {
          sent++;
        } else {
          await releaseReminderSlot(item.id, "due_soon");
          skipped++;
        }
      }
    } catch (e) {
      // One recipient's transient DB/network hiccup shouldn't sink the batch.
      reportError(e, { where: "cron/reminders", userId: r.userId });
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    recipients: recipients.length,
    sent,
    skipped,
    failed,
    at: new Date(now).toISOString(),
  });
}
