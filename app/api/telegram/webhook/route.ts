import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { reportError } from "@/lib/observe";
import { tgSend, tgDownloadFile, telegramSecretOk, telegramEnabled } from "@/lib/telegram";
import {
  getOrCreateFolder,
  redeemTelegramCode,
  userIdForTelegramChat,
} from "@/lib/db/queries";
import {
  createCaptureFromUrl,
  createCaptureFromText,
  createCaptureFromServerBytes,
} from "@/lib/pipeline/create-capture";

export const runtime = "nodejs";
export const maxDuration = 30;

const URL_RE = /\bhttps?:\/\/[^\s]+/i;

/** Telegram Bot API webhook. Set it with:
 *   setWebhook url=<site>/api/telegram/webhook secret_token=<TELEGRAM_WEBHOOK_SECRET>
 */
export async function POST(req: Request) {
  if (!telegramEnabled()) return NextResponse.json({ ok: true });
  if (!telegramSecretOk(req)) return new NextResponse("forbidden", { status: 403 });

  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = (update.message ?? update.edited_message) as Record<string, unknown> | undefined;
  const chat = msg?.chat as { id: number } | undefined;
  if (!msg || !chat) return NextResponse.json({ ok: true });
  const chatId = String(chat.id);
  const text = typeof msg.text === "string" ? msg.text.trim() : "";

  try {
    // /start <code> — link this chat to an account
    if (text.startsWith("/start")) {
      const code = text.split(/\s+/)[1];
      if (!code) {
        await tgSend(chatId, "Open MirrorMind → Settings → Telegram and tap Connect to link this chat.");
        return NextResponse.json({ ok: true });
      }
      const linked = await redeemTelegramCode(code, chatId);
      await tgSend(
        chatId,
        linked
          ? "Linked ✅ Send me a photo, a link, or a note and I'll save it to your memory."
          : "That link code is invalid or expired. Get a fresh one from MirrorMind → Settings → Telegram.",
      );
      return NextResponse.json({ ok: true });
    }

    const userId = await userIdForTelegramChat(chatId);
    if (!userId) {
      await tgSend(chatId, "This chat isn't linked yet. MirrorMind → Settings → Telegram → Connect.");
      return NextResponse.json({ ok: true });
    }
    const asUser = { id: userId } as unknown as User;

    // Everything the bot captures is auto-filed into one folder.
    const folderId = await getOrCreateFolder(userId, "From Telegram", {
      emoji: "✈️",
    }).catch(() => null);

    // photo / document
    const photos = msg.photo as { file_id: string }[] | undefined;
    const doc = msg.document as { file_id: string; mime_type?: string } | undefined;
    const fileId = photos?.length
      ? photos[photos.length - 1].file_id
      : doc && /^(image\/|application\/pdf)/.test(doc.mime_type ?? "")
        ? doc.file_id
        : null;

    if (fileId) {
      const f = await tgDownloadFile(fileId);
      if (!f) throw new Error("telegram file download failed");
      const r = await createCaptureFromServerBytes(asUser, f.blob, {
        source: "telegram",
        folderId,
      });
      await tgSend(chatId, r.deduped ? "Already saved that one." : "Got it — reading it now. 📸");
      return NextResponse.json({ ok: true });
    }

    if (!text) {
      await tgSend(chatId, "Send a photo, a link, or some text and I'll remember it.");
      return NextResponse.json({ ok: true });
    }

    const urlMatch = text.match(URL_RE);
    if (urlMatch) {
      const r = await createCaptureFromUrl(userId, urlMatch[0], folderId);
      await tgSend(chatId, r.deduped ? "Already saved that link." : "Saving that page — one sec. 🔗");
      return NextResponse.json({ ok: true });
    }

    const r = await createCaptureFromText(userId, { text, source: "telegram", folderId });
    await tgSend(chatId, r.deduped ? "Already saved that note." : "Noted. 📝");
    return NextResponse.json({ ok: true });
  } catch (e) {
    reportError(e, { where: "telegram webhook", chatId });
    await tgSend(chatId, "Something went wrong saving that. Try again in a bit.");
    return NextResponse.json({ ok: true });
  }
}
