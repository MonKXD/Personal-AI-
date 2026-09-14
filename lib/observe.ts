import "server-only";

/**
 * Minimal error reporting — no SDK, no account. Every unexpected error goes
 * out as one structured JSON line (greppable in Vercel logs with context) and,
 * if ERROR_WEBHOOK_URL is set, a compact message to that webhook (Slack or
 * Discord incoming-webhook URLs both work). Same-signature errors are muted
 * for a minute per instance so a hot loop can't spam the channel.
 */

const recent = new Map<string, number>();
const MUTE_MS = 60_000;

type Ctx = Record<string, string | number | boolean | null | undefined>;

export function reportError(err: unknown, ctx: Ctx = {}): void {
  const e = err instanceof Error ? err : new Error(String(err));
  const sig = `${ctx.where ?? "?"}:${e.message}`.slice(0, 200);

  // Sentry when configured (no DSN → import resolves but init was inert).
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    void import("@sentry/nextjs")
      .then((S) => S.captureException(e, { extra: ctx as Record<string, unknown> }))
      .catch(() => {});
  }

  console.error(
    JSON.stringify({
      level: "error",
      message: e.message,
      stack: e.stack?.split("\n").slice(0, 6).join("\n"),
      ...ctx,
      at: new Date().toISOString(),
    }),
  );

  const url = process.env.ERROR_WEBHOOK_URL?.trim();
  if (!url) return;

  const now = Date.now();
  const last = recent.get(sig) ?? 0;
  if (now - last < MUTE_MS) return;
  recent.set(sig, now);
  if (recent.size > 200) recent.clear();

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "personal-ai";
  const lines = [
    `:rotating_light: *${site}* error`,
    ctx.where ? `\`${ctx.where}\`` : null,
    "```",
    e.message.slice(0, 500),
    "```",
    Object.entries(ctx)
      .filter(([k]) => k !== "where")
      .map(([k, v]) => `${k}=${v}`)
      .join("  "),
  ]
    .filter(Boolean)
    .join("\n");

  // Fire and forget — reporting must never block or throw into the request.
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: lines, content: lines }),
  }).catch(() => {});
}
