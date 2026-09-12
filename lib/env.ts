import { z } from "zod";

/**
 * Central, validated environment access.
 *
 * - `getEnv()` (server only) validates lazily and throws a readable error the
 *   first time it is called without the required vars set.
 * - `publicEnv` exposes only NEXT_PUBLIC_* values and never throws at import
 *   time, so `next build` succeeds before Supabase is configured.
 *
 * See docs/14-SETUP.md §2 and .env.example for the full list.
 */

/** Empty / whitespace-only env values are treated as unset, so `.default()` wins.
 * (Vercel and shells commonly leave a var defined-but-blank.) */
const blankToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

/** A trimmed string with a fallback, resilient to blank/whitespace values. */
const strWithDefault = (fallback: string) =>
  z.preprocess(blankToUndef, z.string().trim().default(fallback));

/** A URL string with a fallback, resilient to blank values. */
const urlWithDefault = (fallback: string) =>
  z.preprocess(blankToUndef, z.string().trim().url().default(fallback));

/** An optional secret/string — blank is treated as unset. */
const optStr = (min = 1) =>
  z.preprocess(blankToUndef, z.string().trim().min(min).optional());

const serverSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optStr(20),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optStr(20),
    NEXT_PUBLIC_SITE_URL: urlWithDefault("http://localhost:3000"),

    SUPABASE_SERVICE_ROLE_KEY: optStr(20),
    DATABASE_URL: optStr(1),
    DATABASE_URL_UNPOOLED: optStr(1),

    // ---- AI providers ----
    // Which stack to use. "auto" = gemini if GOOGLE_API_KEY, else anthropic if
    // ANTHROPIC_API_KEY, else deterministic fixtures. Force fixtures with DRY_RUN=1.
    // Tolerant of stray whitespace/quotes/case; any unrecognised value → "auto".
    AI_PROVIDER: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(["auto", "gemini", "anthropic", "ollama", "fixture"]))
      .catch("auto"),

    // Google Gemini — free tier, multimodal, HTTP only.
    GOOGLE_API_KEY: optStr(10),
    // "lite" = fast, available on new keys, and no hidden "thinking" tokens
    // (the full flash-3.x models are reasoning models and can return empty
    // output under a tight token budget). Plenty for OCR/extraction.
    GEMINI_MODEL: strWithDefault("gemini-flash-lite-latest"),
    GEMINI_EMBED_MODEL: strWithDefault("gemini-embedding-001"),

    // Anthropic — paid.
    ANTHROPIC_API_KEY: optStr(10),
    ANTHROPIC_MODEL: strWithDefault("claude-sonnet-5"),

    // Chat fallback: any OpenAI-compatible endpoint (OpenRouter, Groq, …).
    // Used only when the primary chat model is rate-limited. Unset = disabled.
    FALLBACK_AI_BASE_URL: urlWithDefault("https://openrouter.ai/api/v1"),
    FALLBACK_AI_KEY: optStr(10),
    FALLBACK_AI_MODEL: strWithDefault("meta-llama/llama-3.3-70b-instruct:free"),

    // Ollama — local, free, private. Not available on Vercel.
    OLLAMA_BASE_URL: urlWithDefault("http://localhost:11434"),
    OLLAMA_VISION_MODEL: strWithDefault("llama3.2-vision"),
    OLLAMA_CHAT_MODEL: strWithDefault("llama3.1"),
    OLLAMA_EMBED_MODEL: strWithDefault("bge-m3"),

    // Dedicated embeddings override (wins over AI_PROVIDER when set).
    EMBEDDING_PROVIDER: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(["voyage", "openai"]))
      .optional()
      .catch(undefined),
    EMBEDDING_MODEL: optStr(1),
    EMBEDDING_API_KEY: optStr(10),
    EMBEDDING_DIMS: z.coerce.number().int().positive().catch(1024),

    DRY_RUN: z
      .string()
      .trim()
      .pipe(z.enum(["0", "1"]))
      .catch("0")
      .transform((v) => v === "1"),

    // ---- App behaviour ----
    APP_TZ: strWithDefault("Asia/Kolkata"),
    DAILY_CAPTURE_LIMIT: z.coerce.number().int().positive().catch(15),
    /** Max chat questions per user per rolling hour (cheap abuse guard). */
    CHAT_HOURLY_LIMIT: z.coerce.number().int().positive().catch(40),
    /** Hard cap on total registered users. A brand-new sign-up past this is
     * refused; anyone who already has an account always gets in. 0 = no cap. */
    MAX_USERS: z.coerce.number().int().nonnegative().catch(10),
    /** Shared ceiling on Gemini API calls per IST day across ALL users (free-
     * tier safety net). Past this, new captures/questions get a friendly
     * "back tomorrow" instead of a hard failure. 0 = disabled. */
    DAILY_AI_CALL_BUDGET: z.coerce.number().int().nonnegative().catch(800),
    /** When "1", only allow-listed emails (+ OWNER_EMAIL) can sign up. Default
     * is open sign-ups; the allowlist table is then ignored at the door. */
    INVITE_ONLY: z
      .string()
      .trim()
      .pipe(z.enum(["0", "1"]))
      .catch("0")
      .transform((v) => v === "1"),
    /** Email that unlocks the /settings/access admin surface. */
    OWNER_EMAIL: optStr(3),
    /** Public read-only demo account (seeded by `npm run seed:demo`). All three
     * must be set for the "open the demo" button to appear/work. */
    DEMO_USER_ID: optStr(10),
    DEMO_USER_EMAIL: optStr(3),
    DEMO_USER_PASSWORD: optStr(8),
    /** Shared secret for /api/cron/* endpoints (Vercel Cron sends it as a bearer). */
    CRON_SECRET: optStr(8),

    // ---- Email (Resend) ----
    RESEND_API_KEY: optStr(10),
    EMAIL_FROM: strWithDefault("Personal AI <onboarding@resend.dev>"),

    /** Optional Slack/Discord incoming-webhook URL — unexpected server errors
     * get a compact message posted here (see lib/observe.ts). Unset = logs only. */
    ERROR_WEBHOOK_URL: optStr(10),

    /** Web Push (VAPID). Generate with `npx web-push generate-vapid-keys`.
     * Unset = the push toggle is hidden and sends are no-ops. */
    VAPID_PUBLIC_KEY: optStr(20),
    VAPID_PRIVATE_KEY: optStr(20),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: optStr(20),
    VAPID_SUBJECT: strWithDefault("mailto:owner@personal-ai.app"),

    /** Telegram capture bot (@BotFather). All three optional — unset = the
     * bot webhook 200s silently and the Settings "Connect Telegram" row is
     * hidden. TELEGRAM_WEBHOOK_SECRET is the `secret_token` passed to
     * setWebhook; when unset the header check is skipped (dev only). */
    TELEGRAM_BOT_TOKEN: optStr(20),
    TELEGRAM_BOT_USERNAME: optStr(3),
    TELEGRAM_WEBHOOK_SECRET: optStr(8),

    /** Calling assistant (Twilio Voice + ConversationRelay, 0017). All optional
     * — unset = /api/calls returns 501 and the Calls page shows a setup note.
     * CONVERSATION_RELAY_WS_URL is a WebSocket handler you host separately
     * (Vercel serverless can't hold a persistent WS connection) — see
     * docs/modules/calling-assistant.md. */
    TWILIO_ACCOUNT_SID: optStr(10),
    TWILIO_AUTH_TOKEN: optStr(10),
    TWILIO_PHONE_NUMBER: optStr(6),
    CONVERSATION_RELAY_WS_URL: optStr(5),
    /** Shared secret the ConversationRelay WS handler sends as a bearer token
     * when it reports a call's transcript/summary back to
     * /api/calls/[id]/complete. Unset = that endpoint refuses all requests. */
    CONVERSATION_RELAY_CALLBACK_SECRET: optStr(16),

    /** WhatsApp triage (Baileys listener, external process, 0017). Shared
     * secret the listener sends as a bearer token to /api/whatsapp/sync.
     * Unset = the sync endpoint refuses all requests. */
    WHATSAPP_SYNC_WEBHOOK_SECRET: optStr(16),
  })
  .refine(
    (e) =>
      !!(e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? e.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      message:
        "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY).",
      path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    },
  );

export type Env = z.infer<typeof serverSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables:\n${detail}\n` +
        `Copy .env.example to .env.local and fill it in (see docs/14-SETUP.md).`,
    );
  }
  cached = parsed.data;
  return cached;
}

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const isSupabaseConfigured =
  publicEnv.supabaseUrl.length > 0 && publicEnv.supabaseKey.length > 0;
