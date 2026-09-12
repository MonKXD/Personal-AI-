import { NextResponse } from "next/server";
import { handle, HttpError, requireApiUser } from "@/lib/http";
import { isOwner } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { telegramEnabled, tgSetWebhook, tgWebhookInfo } from "@/lib/telegram";

export const runtime = "nodejs";

/**
 * Owner-only Telegram bot activation helper. The bot token never leaves the
 * server — this calls Telegram's setWebhook / getWebhookInfo using the
 * TELEGRAM_* env vars in place.
 *
 *   GET  /api/telegram/register  → current webhook registration
 *   POST /api/telegram/register  → (re)point the bot at /api/telegram/webhook
 */
async function assertOwner(write = false) {
  const user = await requireApiUser(write ? { write: true } : undefined);
  if (!isOwner(user)) throw new HttpError(403, "forbidden", "Owner only.");
}

export const GET = handle(async () => {
  await assertOwner();
  if (!telegramEnabled()) {
    throw new HttpError(409, "not_configured", "Set TELEGRAM_BOT_TOKEN first.");
  }
  return NextResponse.json({ configured: true, info: await tgWebhookInfo() });
});

export const POST = handle(async () => {
  await assertOwner(true);
  if (!telegramEnabled()) {
    throw new HttpError(409, "not_configured", "Set TELEGRAM_BOT_TOKEN first.");
  }
  const result = await tgSetWebhook(publicEnv.siteUrl);
  return NextResponse.json({ set: result, info: await tgWebhookInfo() });
});
