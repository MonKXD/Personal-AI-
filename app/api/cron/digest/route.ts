import { NextResponse, type NextRequest } from "next/server";
import { reportError } from "@/lib/observe";
import { getEnv } from "@/lib/env";
import {
  listUsersForWeeklyDigest,
  listMemoriesBetween,
  addNotification,
  claimReminderSlot,
  releaseReminderSlot,
} from "@/lib/db/queries";
import { buildDigest } from "@/lib/pipeline/digest";
import { sendWeeklyDigestEmail } from "@/lib/email";
import { startOfUtcWeekForTz } from "@/lib/time";
import type { MemoryType } from "@/lib/memory-types";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Vercel Cron — weekly digest. Auth: `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(req: NextRequest) {
  const secret = getEnv().CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error_code: "unauthorized" }, { status: 401 });
    }
  }

  const recipients = await listUsersForWeeklyDigest();
  const now = new Date();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of recipients) {
    try {
      const weekStart = startOfUtcWeekForTz(now, r.tz);
      const items = await listMemoriesBetween(r.userId, weekStart, now);
      if (items.length === 0) {
        skipped++;
        continue;
      }

      const dedupeKey = `${r.userId}:${weekStart.toISOString().slice(0, 10)}`;
      const claimed = await claimReminderSlot(dedupeKey, "weekly_digest");
      if (!claimed) {
        skipped++;
        continue;
      }

      const digest = buildDigest(
        items.map((m) => ({ id: m.id, type: m.type as MemoryType, title: m.title })),
        "this week",
      );
      await addNotification({
        userId: r.userId,
        kind: "weekly_digest",
        title: "Your weekly recap",
        body: digest.sentence,
        href: "/today",
        dedupeKey: `digest:${dedupeKey}`,
      }).catch(() => {});
      void import("@/lib/webhooks").then(({ dispatchWebhooks }) =>
        dispatchWebhooks(r.userId, "digest.weekly", {
          week_of: weekStart.toISOString().slice(0, 10),
          summary: digest.sentence,
          count: items.length,
        }),
      );
      const ok = await sendWeeklyDigestEmail(r.email, digest);
      // Only keep the claim on a real send — a no-op (e.g. RESEND_API_KEY not
      // configured yet) releases it so next run retries instead of skipping
      // forever.
      if (ok) {
        sent++;
      } else {
        await releaseReminderSlot(dedupeKey, "weekly_digest");
        skipped++;
      }
    } catch (e) {
      // One recipient's transient DB/network hiccup shouldn't sink the batch.
      reportError(e, { where: "cron/digest", userId: r.userId });
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    recipients: recipients.length,
    sent,
    skipped,
    failed,
    at: now.toISOString(),
  });
}
