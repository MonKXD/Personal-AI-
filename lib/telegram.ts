import "server-only";

const API = "https://api.telegram.org";

export function telegramEnabled(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

function token(): string {
  return process.env.TELEGRAM_BOT_TOKEN ?? "";
}

export async function tgSend(chatId: string | number, text: string): Promise<void> {
  if (!token()) return;
  await fetch(`${API}/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  }).catch(() => {});
}

/** Resolve a Telegram file_id to downloadable bytes. */
export async function tgDownloadFile(fileId: string): Promise<{ blob: Blob; name: string } | null> {
  if (!token()) return null;
  const meta = await fetch(`${API}/bot${token()}/getFile?file_id=${encodeURIComponent(fileId)}`)
    .then((r) => r.json())
    .catch(() => null);
  const path = meta?.result?.file_path as string | undefined;
  if (!path) return null;
  const res = await fetch(`${API}/file/bot${token()}/${path}`);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  const ext = (path.split(".").pop() || "jpg").toLowerCase();
  const type =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "pdf" ? "application/pdf" : "image/jpeg";
  return { blob: new Blob([buf], { type }), name: `telegram.${ext}` };
}

/** Bot API secret-token header check (set via setWebhook). */
export function telegramSecretOk(req: Request): boolean {
  const want = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!want) return true; // not configured → don't block (dev)
  return req.headers.get("x-telegram-bot-api-secret-token") === want;
}

async function callBot(method: string, body?: Record<string, unknown>) {
  const res = await fetch(`${API}/bot${token()}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => ({ ok: false, description: "non-JSON reply" }));
}

/** Point the bot at our webhook. `siteUrl` is the public origin. Uses
 * TELEGRAM_WEBHOOK_SECRET as the `secret_token` when set. */
export async function tgSetWebhook(siteUrl: string): Promise<unknown> {
  if (!token()) return { ok: false, description: "TELEGRAM_BOT_TOKEN not set" };
  return callBot("setWebhook", {
    url: `${siteUrl.replace(/\/$/, "")}/api/telegram/webhook`,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
    allowed_updates: ["message", "edited_message"],
    drop_pending_updates: true,
  });
}

/** Current webhook registration (url, pending count, last error). */
export async function tgWebhookInfo(): Promise<unknown> {
  if (!token()) return { ok: false, description: "TELEGRAM_BOT_TOKEN not set" };
  return callBot("getWebhookInfo");
}
