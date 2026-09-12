# 15 — Build Log

What is actually built vs. still spec. Newest entry on top. Pairs with [Tracker](07-TRACKER.md) and the decision log in [Memory](08-MEMORY.md) §3.

---

## 2026-09-12 — Four new modules: deadlines, finance, calling, WhatsApp (0017)

Adapted from a set of module specs written for a different personal-agent
concept (Firebase/Firestore, single-user daily-life-management app) onto
this app's actual stack (Postgres + Drizzle + RLS + Next.js App Router).
Full detail per module in `docs/modules/*.md`. Migration:
`db/migrations/0017_deadlines_finance_calls_whatsapp.sql`.

- **Deadline engine (fully built, no external creds needed).**
  `deadlines` table (source-agnostic; sits alongside the existing
  `action_items`, which stays capture-only). `lib/deadlines.ts`
  `extractDeadline()` — shared step for non-manual sources, one Gemini call,
  only writes above a 0.6 confidence threshold. `computeDeadlinePriority()`
  computed on read, never stored. `GET/POST /api/deadlines`,
  `PATCH /api/deadlines/[id]`. `/deadlines` page: add-manual, mark-done,
  priority-colored due dates, source tags.
- **Finance tracking (fully built, no external creds needed).** New
  `finance_transactions` / `finance_statement_batches` tables alongside the
  existing manual expense flow. `lib/finance/parse-statement.ts`: CSV parsed
  directly (header-detection heuristic), PDF text extracted via the
  already-installed `mupdf` then normalized into rows by one Gemini call.
  Categorization batched (60 rows/call) via a new `FinanceCategorizer`
  adapter. Dedupe via a unique index so re-uploading a statement no-ops on
  already-seen rows. `/api/finance/{transactions,statements,summary}`,
  `/finance` page (manual entry, upload, month category breakdown, table).
- **Calling assistant (partially built).** Real: `lib/twilio.ts` (plain
  `fetch` REST calls, no vendor SDK) places outbound calls and builds the
  ConversationRelay TwiML; `/api/twilio/voice` validates
  `X-Twilio-Signature`; `/api/calls` + `/api/calls/[id]/complete` (bearer-
  secret callback) log the call and feed dated extracted tasks into the
  deadline engine (source `"call"`). **Not built** (by design, and not
  possible from Vercel serverless): the actual ConversationRelay WebSocket
  handler that runs the live conversation — that's a separate always-on
  process you host and point `CONVERSATION_RELAY_WS_URL` at. Unconfigured →
  `POST /api/calls` returns a 501 with setup instructions, not a fake call.
  `/calls` page: place-call form, call log.
- **WhatsApp triage (partially built).** Real: `POST /api/whatsapp/sync`
  (bearer-secret auth — the caller is a standalone process, not a browser)
  categorizes each message (`important`/`deadline`/`routine`/`promotional`/
  `filtered`, one Gemini call with chat/sender/recent-context), applies
  per-chat mute/always-flag overrides first, and feeds `deadline`-category
  messages into the deadline engine (source `"whatsapp"`).
  `whatsapp_messages` / `whatsapp_filter_rules` tables,
  `/api/whatsapp/{messages,filters}`, `/whatsapp` page (category tabs,
  reason tooltip, one-click mute). **Not built** (by design): the passive
  Baileys listener process itself — deliberately kept out of this repo's own
  `package.json`/build (a large, telephony-specific dependency tree with no
  reason to ship with the Next.js app); run it as its own small project per
  docs/modules/whatsapp-triage.md.
- **AI adapters**: `lib/ai/types.ts` gained `DeadlineExtractor`,
  `FinanceCategorizer`, `StatementTextParser`, `WhatsappCategorizer`
  interfaces + zod schemas; Gemini implementations in `lib/ai/gemini.ts`,
  deterministic offline fixtures in `lib/ai/fixtures.ts`, factories in
  `lib/ai/index.ts`. Same constraint as the existing audio/document
  extractors: only Gemini (or `DRY_RUN=1` fixtures) is wired — add
  Anthropic/Ollama later if needed.
- **Nav**: `/deadlines`, `/finance`, `/calls`, `/whatsapp` added to
  `components/app/app-nav.tsx`.
- **Gates**: `npm run typecheck && npm run lint && npm run build` all green
  (build shows all new routes); `npm test` (41 tests, unchanged) still green.
  Not independently verified against a real Twilio account, a real WhatsApp
  linked device, or a real bank statement PDF — the Gemini-backed paths
  (deadline extraction, WhatsApp categorization, CSV parsing) only need
  `GOOGLE_API_KEY` (already used elsewhere in this app) to be genuinely live;
  the Twilio and Baileys paths need those services' own credentials/hosting
  before they do anything beyond returning their documented "not configured"
  responses.

---

## 2026-09-10 — Server-side PDF page-1 thumbnails

- **`feat(pipeline)` (`5aabdff`)** — captures with no browser to render
  page 1 (the Telegram bot, the share target, the public API) left their
  PDFs as a generic document icon everywhere. The pipeline now rasterises
  page 1 server-side, so those memories get a real preview on the Timeline
  / Today / detail page / chat citations, exactly like a browser upload.
  Closes the "Real PDF thumbnails" follow-up carried since the P6
  document-capture work.
  - `lib/pipeline/pdf-render.ts` — `renderPdfFirstPage(buf)` via **`mupdf`**
    (WASM, no native binaries, safe on the Vercel Node runtime). Renders
    page 0 at scale 2 → PNG; best-effort (null on failure).
  - `lib/pipeline/run.ts` — new step 1c: for `isPdf && displayKey ===
    originalKey`, render → `processImage()` (sharp) makes `display.jpg` +
    `thumb.jpg` → `updateCaptureDerivedKeys`. Wrapped so a failure never
    fails the capture; `buf` stays the raw PDF for Gemini extraction.
  - `next.config.ts` — `mupdf` added to `serverExternalPackages`.
  - **No render-site changes** — every thumbnail check already gates on
    `isImageThumbUrl(url)` (URL ends `.jpg`/`.png`/…), not the mime.
  - Verified E2E on live prod: 2-page test PDF uploaded via the
    no-client-thumbnail path (`source: telegram`) → pipeline
    `queued→extracting→embedding→ready` in ~16 s → capture
    `display_key`/`thumb_key` now point at `display.jpg`/`thumb.jpg`,
    signed thumb URL `HEAD` = `200 image/jpeg`. Cleaned up. Gate green
    (typecheck/lint/build 38 routes, audit 29/29, 41 tests).

---

## 2026-09-10 — Telegram captures auto-filed into a folder

- **`feat(telegram)` (`ed8db81`)** — everything the bot saves (photo, PDF,
  link, note) now lands in a dedicated top-level **"From Telegram"** folder,
  created on first use with a ✈️ emoji. Nothing bespoke downstream — it's a
  normal `folders` row, so it shows on `/folders`, in the folder tree, its
  count updates, and it leaves the Unfiled math, like any user folder.
  - `lib/db/queries.ts` — `getOrCreateFolder(userId, name, {emoji, color})`:
    case-insensitive find-by-name at top level or create; race-safe via the
    `(user_id, coalesce(parent_id,''), lower(name))` unique index (insert
    `onConflictDoNothing` then re-read the winner).
  - `lib/pipeline/create-capture.ts` — threaded an optional `folderId`
    through `createCaptureFromText` / `createCaptureFromUrl`
    (`createCaptureFromServerBytes` already had it via `finishCaptureUpload`).
    `run.ts` already copies `capture.folderId` onto the new memory.
  - `app/api/telegram/webhook/route.ts` — resolves the folder once per
    message, passes it to all three capture calls. Other callers of the
    changed functions are unaffected (`folderId` optional / defaults null).
  - Verified E2E on live prod: no folder → note sent → "From Telegram" ✈️
    auto-created → memory filed in it → second message reused the same
    folder (no dup) → folder count correct. Cleaned up. Gate green
    (typecheck/lint/build, audit 29/29, 41 tests).
- **Clarification** (asked "why don't Telegram files show in Timeline /
  Today?"): they do — `listMemories` (Timeline) and `listMemoriesBetween`
  (Today) have no source filter; text / links / photos all render, and
  photos get a server-generated thumbnail. The only gap is document
  **previews**: a Telegram PDF/DOCX/PPTX shows an icon tile, not a page-1
  image, because server-side PDF rasterisation isn't built (browser uploads
  render page 1 client-side). Still a deferred follow-up.

---

## 2026-09-10 — Open-original link for document captures

- **`feat(memory)` (`30359ab`)** — uploaded PDF / Word / PowerPoint
  captures kept their original file in the private `captures` bucket
  (`{userId}/{captureId}/original.<ext>`) but there was no way to open it
  from the app; the memory detail page only rendered an icon tile (or a
  page-1 preview for browser uploads). Added an **"Open PDF / Word /
  PowerPoint"** pill link on `/memory/[id]`, signing `originalKey` (the
  real file, not the maybe-rendered `displayKey`) — shown under the left
  panel in both the icon-tile and thumbnail cases, so it covers
  Telegram-uploaded PDFs (which never get a page-1 render). Verified on
  live prod (owner session): link renders `target=_blank`, `HEAD` → `200
  application/pdf`. Build clean, 38 routes.
- Context (answering "where do Telegram PDFs go?"): the Telegram webhook
  routes a PDF through `createCaptureFromServerBytes` → Storage → the same
  pipeline; `runPipeline`'s `isPdf` branch hands it to Gemini's vision
  extractor (`mediaType: application/pdf`, reads all pages natively) →
  classified, entities/deadlines pulled, chunked + embedded → a `memories`
  row visible on Timeline / detail / Chat like any capture. Two known
  limits: Telegram Bot API caps bot file downloads at **20 MB** (bigger
  PDFs fail to download — use the web uploader); Telegram PDFs get **no
  page-1 thumbnail** (only browser uploads render one client-side — a
  server-side rasteriser is still a deferred follow-up).

---

## 2026-09-09 — Web Push activated

- **Web Push is LIVE on prod.** Set the four VAPID vars in Vercel
  Production (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` /
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_SUBJECT = mailto:owner`) from the
  keypair generated in the Web Push slice (`562c045`), redeployed
  (`b0qm7g3bb`). Verified against live prod with an authed owner session:
  server `pushEnabled()` true → Settings → Preferences now renders the
  **Push notifications** row; the client `PushToggle` passed its `!VAPID`
  guard and reached a real state (showed "blocked" only because the
  headless browser denies notifications — on a real device it shows the
  on/off switch), so `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is inlined;
  `/api/push/subscribe` reachable + auth-gated; `sw.js` push /
  notificationclick listeners in place. `sendPush()` now delivers for
  due-soon action items (`cron/reminders`) and the weekly digest
  (`cron/digest`).
- **Minor, not push-specific:** `POST /api/push/subscribe` (and other
  routes doing `schema.parse()` inside `handle()`) returns `500` rather
  than `400` for a malformed body — `handle()` doesn't special-case
  `ZodError`. Real browser subscription payloads parse fine. Left as-is
  (codebase-wide pattern).

---

## 2026-09-09 — Telegram activated + reskin glow cleanup

- **Telegram capture bot is LIVE on prod.** Owner created the bot via
  @BotFather and set `TELEGRAM_BOT_TOKEN` / `_BOT_USERNAME` /
  `_WEBHOOK_SECRET` in Vercel. New helper `POST /api/telegram/register`
  (`1a44abf`, owner-only) calls `setWebhook` server-side so the token never
  transits the client — hit once, Telegram replied "Webhook was set".
  `getWebhookInfo`: our URL, `allowed_updates:[message,edited_message]`, 0
  pending, no `last_error`. **Full E2E verified** against live prod by
  replaying the exact webhook payloads (with the real secret): `/start
  <code>` links the chat + clears the one-time code; a text message → a
  `source=telegram` capture that ran through the pipeline to a memory; a
  URL message → a `source=url` capture (`queued→extracting→embedding`); a
  non-readable URL is handled gracefully; a wrong `secret_token` header →
  403; an unlinked chat makes no capture. Test rows cleaned up.
  - `8b00c67` — the register route returned 500 (not 401) to
    unauthenticated callers; wrapped both handlers in `handle()` →
    401/403/409 JSON. Verified live.
- **Reskin glow cleanup** (`0df5007`) — five app components
  (onboarding-flow, splash-screen, capture-panel, processing-card,
  **mobile-tab-bar**) still carried `rgba(154,141,255,…)` bright-violet
  glows from the pre-reskin palette, and the mobile capture FAB's ring
  used `rgba(16,15,22,.96)` = the old dark ground, which read near-black
  on the cream light theme. Swapped to `color-mix(var(--primary)…)` /
  `var(--color-background)`. No functional change.
- **Bug sweep + live walkthrough** — `typecheck` + `lint` + `build` (38
  routes) + 41 tests + ownership audit 29/29 all green. Authed owner
  walkthrough on the dev server: landing, timeline, chat, settings,
  folders, graph, today, memory detail, capture — all render on the new
  design, **zero console errors**. Accent picker confirmed gone, theme
  toggle segmented, new logo in the nav. No stale old-palette values
  remain anywhere in the codebase.

---

## 2026-09-09 — New logo + walkthrough restore (reskin follow-ups)

- **New brand mark** (`3ae220d`) — from `MirrorMind Logo Final.dc.html`: a
  radial violet sphere (`#8b7ee0 → #4a3f8f → #221c48`) split into two "mind"
  hemispheres (cream `#f6f1e7` left, teal `#3f8f82` right) with a faint
  divider, a specular highlight, and a small teal orbit ring. Replaces the
  conic-gradient orb. `components/brand/logo.tsx` `Orb` is now inline SVG
  with the same `size`/`glow`/`className` API — every call site (nav,
  footer, splash, offline, auth, share, 404) unchanged. `public/favicon.svg`
  + `scripts/assets/icon-src.svg` rewritten; `public/icon-{192,512}.png`,
  `icon-maskable-512.png`, `apple-icon.png` and `extension/icons/icon-{16,
  32,48,128}.png` regenerated from the master via `sharp`. Verified live on
  prod: the in-app `Orb` (landing header + `/offline`) renders the new SVG
  mark, `<link rel=icon>` → the new `favicon.svg`, all PNGs serve the new
  art at correct dimensions, no console errors.
- **Animated walkthrough restored** (`977292d`) — the scroll-scrubbed
  capture→read→recall demo (`FeatureWalkthrough`; autoplay loop on mobile,
  static under reduced-motion) was dropped in reskin slices 3–4 because the
  design handoff omitted it. Restored from `2464f18`, restyled to the new
  tokens (grape/teal hexes → `#4a3f8f`/`#3f8f82`/`#a3432f`, `font-mono` →
  Sora, brand-grad shadow → `color-mix`), re-added as a `#walkthrough`
  section after the static 3-step. Hero "See how it works" now targets it.

---

## 2026-09-09 — Full UI reskin (Claude Design handoff)

Recreated `MirrorMind.dc.html` across marketing + app. Built on
`redesign/bricolage-sora` in 12 verified slices, merged to `main` (`1065a69`)
as one deploy — live on prod, verified.

- **Type** — Familjen Grotesk / DM Sans → **Bricolage Grotesque** (display)
  + **Sora** (body). `next/font` swap; `--font-display` / `--font-body`.
- **Palette** — light is now primary: cream `#f6f1e7` ground, ink `#211f2e`,
  violet `#4a3f8f` primary, teal `#3f8f82` companion, hairline borders,
  `--radius:1rem`, soft low shadows, 3-bloom warm aurora (`bg-cosmic`).
  `.dark` retuned to a matching warm-dark. `defaultTheme` `dark → light`.
- **Primitives** — button = solid violet pill (`rounded-full`, white text,
  token shadow); card `rounded-xl`; input `rounded-md`; badge = pill w/
  `--tint-violet`/`--tint-teal` fills; dialog `bg-popover` (was hardcoded).
- **Landing** — orbital hero (`HeroOrbit`: floating `AskPreview` card in two
  `orbit-a/b` rings + `bloom-pulse`); 4 floating capture-type pills;
  "How it becomes memory" 3-step; teal-tint pull-quote. Dropped: standalone
  problem section, `FeatureWalkthrough` (file deleted), use-cases section.
  Kept Features grid + FAQ + CTA, restyled.
- **App shell** — 268px **white** sidebar (`bg-card`), brand tagline
  "Your memory, cited", grouped brand/New-capture/search up top, nav
  scrolls, status+user pinned; active nav = `--tint-violet` pill + dark
  violet text.
- **Screens** — capture: pill mode toggle + dashed dropzone (violet / teal
  for voice) + white tip cards + Gemini caveat line. timeline: segmented
  range track + solid-violet type pills + white memory cards. chat: whole
  shell in one white `rounded-2xl` card, pill composer + circular send.
  folders / today / graph / memory-detail / settings sub-pages → white
  `bg-card` + shadow.
- **Accent picker removed** — `lib/accent.ts` deleted; `accent` dropped from
  `prefsSchema` / `savePrefs` / `upsertPrefs` / `Prefs` / `getPrefs` and
  the app-layout `<style>` override. `profile_prefs.accent` column left in
  place, unused (no migration).
- **Verified** — authed dev walkthrough (landing, sign-in, capture,
  timeline, settings) clean, no console errors; gate green every slice
  (typecheck + lint + build 37 pages + audit 29/29 + 41 tests); prod
  deploy `o61g25mqk` Ready, live HTML carries the new fonts + `#f6f1e7`.
- **Follow-ups** — `rounded-2xl` on a handful of non-primitive app panels
  (27px vs the mockup's ~18–20px) left as-is; some app eyebrow labels
  still `font-body` uppercase rather than the mockup's exact spec — both
  cosmetic, safe to tighten later.

---

## 2026-09-09 — Production activation + launch hardening

Owner set the env vars in Vercel and redeployed Production; verified live.

- **Sentry** — `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` set. Client SDK
  confirmed initialised on the live deployment; server/edge `Sentry.init`
  now `enabled` (DSN present). `reportError()` forwards to
  `captureException()`. Source-map upload still skipped (no
  `SENTRY_AUTH_TOKEN`).
- **AI chat fallback** — `FALLBACK_AI_KEY` set (OpenRouter). `_BASE_URL` /
  `_MODEL` left unset → defaults: `https://openrouter.ai/api/v1`,
  `meta-llama/llama-3.3-70b-instruct:free`. Wiring re-verified: chat route
  `getChatModel()` → `case "gemini"` → `withFallback(GeminiChatModel)` →
  (key present) `FallbackChatModel(gemini, OpenAICompatChatModel)`, covering
  both the `streamAnswer` and `.answer` paths. Env-snapshot check: key
  added before the redeploy that's now aliased. Not smoke-tested against a
  real Gemini 429 (would need to force a rate-limit).
- **Supabase auth hardening** — "Allow anonymous sign-ins" turned **off**
  (verified: `signInAnonymously()` now returns `anonymous_provider_disabled`);
  Site URL set to `https://mirror-mindai.vercel.app` + redirect URLs.
  Sign-in re-verified end to end against live prod: `admin.generateLink`
  → `verifyOtp(token_hash)` → `@supabase/ssr` cookies → `/settings` `307`
  without a cookie, `200` with one, `/api/notifications` `200` — the Site
  URL change didn't break the callback flow.
- **Storage sweep** — `npm run sweep:orphans -- --apply`: **0 orphaned**
  (9 objects, all referenced by live captures). The earlier "~32" estimate
  was stale — storage-cleanup-on-delete (`c6e75f7`) has kept the bucket
  clean since it shipped, no backlog ever accumulated.
- **Still dark (owner's choice, no effect on the app):** Web Push (no
  `VAPID_*`), Telegram bot (no `TELEGRAM_*` + no `setWebhook`), Zapier (no
  `zapier push`). No launch blockers remain.
- **End-to-end smoke on live prod** — as the owner, via a real magic-link
  SSR session: built a JPEG flyer with distinct facts →
  `POST /api/captures/begin` → `uploadToSignedUrl` (bytes straight to
  Storage) → `POST /api/captures` finish → polled to `ready` in **~18 s**
  (`extracting → embedding → ready`) → `POST /api/chat` streamed a correct
  answer (date / time / room / what-to-bring all right) citing the exact
  new memory, `no_memory:false` → `DELETE /api/memories/{id}` `204`
  (storage object removed too). Exercised auth guard, direct-to-Storage
  upload, Gemini vision extract, chunk + embed, pgvector retrieval, cited
  answer, and delete-with-cleanup — all on the aliased deployment. Owner's
  timeline left untouched.
- **Bug found + fixed: `DAILY_AI_CALL_BUDGET` guard was inert** (`355a9c3`).
  `tzOffsetMs()` (`lib/time.ts`) differenced a whole-second `asIfUtc`
  against `at.getTime()`, leaking the caller's milliseconds into the
  offset. `startOfUtcDayForTz()` then returned e.g. `18:30:00.559Z`
  instead of `18:30:00.000Z`, so every `recordAiCalls()` computed a
  slightly different bucket, the `ai_call_log` upsert PK never collided
  (**160 rows of `calls:1`** instead of one summed row), and
  `getAiCallsInBucket()` always read ~0 — the whole free-tier budget net
  never counted. Fix: round the offset to the whole minute (every real tz
  offset is whole-minute). Added `lib/time.test.ts` (4 cases: ms-immune
  offset, second/ms-zeroed bucket, bucket key stable within a day, week
  start clean). Existing 160 `ai_call_log` rows collapsed out-of-band to
  one row per day (177 calls preserved: 5 today / 2 / 170). Verified live:
  one chat call bumps today's single row 5→7, no new row. Also silently
  de-fuzzes `startOfUtcWeekForTz` (digest window) and the daily
  capture-cap `>=` compare (already tolerant). `npm test` 41 (was 37);
  audit 29/29; build clean.

## 2026-09-08 — Integrations round (4)

- **AI chat fallback** (`8f2c845`) — `FallbackChatModel` (`lib/ai/fallback.ts`)
  wraps the primary chat model; on a retriable error (429 / 5xx / quota /
  overloaded) it retries once against any OpenAI-compatible endpoint
  (`OpenAICompatChatModel`, `lib/ai/openai-compat.ts`). Streaming falls back
  only if nothing was emitted yet. **Chat only — embeddings never fall
  back** (dimension mismatch). Env: `FALLBACK_AI_KEY` (+ `_BASE_URL` default
  OpenRouter, `_MODEL` default free Llama-3.3-70B). Unset = primary only.
- **Web Push** (`562c045`) — migration **0015** (`push_subscriptions`).
  `web-push` + VAPID; `public/sw.js` gains `push` / `notificationclick`
  listeners; `POST/DELETE /api/push/subscribe`; `lib/push.ts` `sendPush()`
  (inert without VAPID, prunes 404/410 endpoints). Settings → **PushToggle**
  (hidden unless `pushEnabled()`). Owner activates by adding the 4 `VAPID_*`
  vars in Vercel.
- **Zapier integration** (`0b8394c`) — `zapier/` CLI app (`zapier-platform-core`
  16.4). Custom API-key auth → Bearer; triggers `new_memory` (poll),
  `deadline` (poll), `instant_event` (REST hook backed by
  `GET/POST/DELETE /api/v1/webhooks`, added this slice); actions
  `create_capture`, `ask`. `zapier push` is an owner step (needs a Zapier
  account).
- **Telegram capture bot** (`8b4986e`) — migration **0016** (`telegram_links`,
  one chat per account, one-time 15-min `link_code`). `lib/telegram.ts`
  (send / file download / `secret_token` header check); `POST
  /api/telegram/webhook` — `/start <code>` links the chat, then a photo,
  PDF, link, or note DM'd to the bot becomes a capture (`source:"telegram"`).
  Settings → **Telegram** Connect (deep link) / Disconnect, gated on
  `TELEGRAM_BOT_TOKEN`. Env: `TELEGRAM_BOT_TOKEN` / `_BOT_USERNAME` /
  `_WEBHOOK_SECRET` (all optional; webhook 200s silently when unset). Owner
  step: create the bot with @BotFather, set the 3 vars, then `setWebhook`
  with the secret. 0016 applied + verified (columns, code redeem valid /
  expired / wrong, chat-id uniqueness, unlink). Audit 29/29; 37 tests;
  typecheck + lint + build clean.

## 2026-09-08 — Feature round (4)

- **Pinned shelf + folder colour/emoji** (`52e4fe1`) — migration **0014**
  (`memories.pinned_at`, `folders.color/emoji`). Pin from MemoryActions →
  a "Pinned" section on Timeline. `FolderStyleDialog` (8 swatches + emoji)
  from the folder-tree menu; tree + folders-page cards tint accordingly.
- **Related-memory graph** (`9399347`) — `/graph` route + "Graph" nav.
  `graphData()` (≤250 nodes + memory_links edges); hand-rolled canvas
  force layout (repulsion + springs + gravity + damping), nodes coloured
  by type / sized by degree, hover labels, click → memory. Reduced-motion
  renders a pre-settled static layout.
- **Markdown + Anki export** (`4888369`) — `GET /api/export?format=md|anki`.
  `lib/export.ts`: `buildMarkdownZip` (fflate; one `.md`/memory with YAML
  frontmatter, Obsidian-ready), `buildAnkiTsv` (`#separator:tab`,
  definition cards + summary cards, `mirrormind::<type>` tags). Settings →
  Your data has JSON / Markdown / Anki buttons.
- **Light theme wired** (`45dd43e`) — ~450 hardcoded `white/black`-opacity
  utilities across 47 files migrated to tokens; `.light` palette completed
  (`--type-*`); `theme-provider` `defaultTheme:"dark"` + `enableSystem`;
  Settings → **ThemeToggle** (System/Light/Dark). Built CSS verified
  (`.light` tokens resolve live). Modal/lightbox scrims kept `bg-black/60`.

## 2026-09-08 — Pre-deploy hardening (4)

- **Storage cleanup on delete** (`c6e75f7`) — `softDeleteMemory` only set
  `deleted_at`; files stayed in the bucket forever. `DELETE /api/memories/[id]`
  now removes the capture's objects via `after()` (`captureKeysForMemory`
  + `removeStorageObjects`, both best-effort). `npm run sweep:orphans`
  (dry-run) + `--apply` for pre-existing orphans (~32 on the owner account,
  left for the owner to apply).
- **Sentry** (`4624e2a`) — `@sentry/nextjs`, `instrumentation*.ts` +
  `sentry.{server,edge}.config.ts`, each `Sentry.init({ enabled: !!dsn })`
  so it's **fully inert without `SENTRY_DSN`**; build plugin skips
  source-map upload without `SENTRY_AUTH_TOKEN`. `reportError()` also
  `captureException()` when a DSN is set. Turn on = add the two DSN vars
  in Vercel.
- **In-app "Report a problem"** (`bb34770`) — migration **0013**
  (`feedback`), `POST /api/feedback` → row + a bell notification to the
  owner (`ownerUserId()`), `FeedbackDialog` in the user menu (sends the
  current path), owner-only `/settings/feedback` list.
- **Legal review** (`163695f`) — Privacy now states the real free-tier
  caveat (Google may use free-tier prompts/responses + human review),
  immediate deletion, the ownership audit; Terms state "free beta, no
  warranty/SLA, access may be revoked". Contact = in-app feedback.

## 2026-09-07 — Browser extension ("Save to MirrorMind")

- `extension/` — MV3, plain JS, Chrome + Firefox. Toolbar popup ("Save
  this page" / type a note), context menus (link / selection / page).
  Talks to `POST /api/v1/captures` with a personal token stored in
  `chrome.storage.sync`; options page has a "Test connection" (`GET
  /api/v1/me`). Desktop notification + badge on each save.
- `config.js` shared API client (loaded via `importScripts` in the SW and
  `<script>` in the pages). Icons resized from `public/icon-512.png` via
  `sharp` (16/32/48/128). `extension/README.md` — load-unpacked steps.
- `extension/**` added to the ESLint ignore list (its own globals).
- Verified vs the **live** API: `POST /api/v1/captures {url}` →
  `{id, status:"queued"}` → polled to `extracting` (pipeline picked it up).
  typecheck + lint + build clean.

## 2026-09-07 — Outbound webhooks — slice B

- Migration **0012** — `webhooks` (url, secret, `events` jsonb, active,
  `failure_count`, `last_status`, `last_delivery_at`). Queries:
  `createWebhook` / `listWebhooks` / `deleteWebhook` / `webhooksForEvent`
  (matches `["*"]` too) / `recordWebhookResult` (resets on 2xx, +1 on
  failure, auto-`active=false` at 15).
- `lib/webhooks.ts` — `dispatchWebhooks(userId, event, data)`:
  fire-and-forget (never throws), `Promise.allSettled` over matching hooks,
  2 attempts, 8s timeout, `X-MirrorMind-Signature: sha256=HMAC(secret,body)`.
  `newWebhookSecret()` → `whsec_…`.
- Emitters: pipeline `run.ts` step 8 → `capture.completed` + `memory.created`;
  `cron/reminders` → `action_item.due_soon` per due item; `cron/digest` →
  `digest.weekly`. All `void import(...)` so they never block.
- Settings → **Webhooks** (URL + event checkboxes, per-hook signing secret
  shown, delivery status); hidden for the demo.
- Verified vs a local receiver: 0012 applied; event matching (subscribed
  vs not); real POST delivered with a **valid HMAC signature**; failure
  count increments then resets on success. Audit 29/29; 37 tests; build
  clean. docs/16-API.md updated with the webhook contract.

## 2026-09-07 — Public REST API (`/api/v1`) — slice A

Token-auth HTTP API for scripts / Shortcuts / Zapier-style tools. Full
reference: **docs/16-API.md**.

- Migration **0011** — `api_tokens` (id, user_id, name, `token_hash`
  unique, prefix, last_used_at, revoked_at). `lib/api-tokens.ts`
  (`mm_<43 b64url>`, SHA-256 stored, shown once). Queries: `createApiToken`
  / `listApiTokens` / `revokeApiToken` / `resolveApiToken` (touches
  last_used).
- `lib/api-v1.ts` — `requireToken` (Bearer), `v1()` wrapper (OPTIONS
  preflight, `HttpError`→JSON, CORS `*` — safe, no cookies), 120 req/min
  in-memory limiter per token.
- Routes: `GET /me`, `POST /captures` (`{url}` or `{text,title}`),
  `GET /captures/{id}`, `GET /memories` (q / type / since / cursor),
  `GET /memories/{id}` (full text + entities + deadlines + share_url),
  `POST /ask` (non-streaming, AI-budget-gated), `GET /action-items`.
- `lib/chat/answer.ts` — non-streaming `answerQuestion()` extracted from
  the chat route (retrieval + rerank + answer), used by `/ask`.
- `createCaptureFromUrl` / new `createCaptureFromText` now take `userId`
  (not `User`); `/api/captures/url` updated. Settings → **API** section
  (create/revoke keys, token shown once); hidden for the demo.
- Verified: 0011 applied; token mint → resolve → revoke round-trips;
  live curl vs local — `/me` 200, no-token 401, `/memories` returns real
  data, OPTIONS 204. Ownership audit 29/29; 37 tests pass; build clean.
- Slice B (webhooks) next.

## 2026-09-07 — URL / web-page capture

Paste a link → MirrorMind fetches it, pulls the readable text, and remembers
it like any other capture.

- `lib/pipeline/web-fetch.ts` — `fetchReadable(url)`: **SSRF-guarded** (every
  hop's hostname is DNS-resolved; private / loopback / link-local / CGNAT /
  cloud-metadata addresses rejected), http/https only, ≤3 redirects, 12s
  timeout, 3 MB cap, `@mozilla/readability` + `linkedom` with a
  strip-tags fallback, text capped at 40k.
- Migration **0010** — `captures.source_url`. New `createCaptureFromUrl`
  stores the page text as a `text/plain` object (`source: "url"`); the
  pipeline's office-text branch now also handles `text/plain`
  (`sourceKind: "web"`). `DOCUMENT_TEXT_SYSTEM` broadened to web pages;
  prompt version → `document_text_v3`.
- `POST /api/captures/url` (write-guarded, `maxDuration 30`). Capture panel
  gets a **Link** mode (URL field + Save); memory detail shows the source
  link on the icon tile.
- Verified: 0010 applied; Wikipedia article → 40k chars extracted; SSRF
  guard blocks 169.254.169.254 / localhost / 127.0.0.1 / 10.x / ftp://.
  Ownership audit 29/29; 37 vitests pass; build clean.

## 2026-09-07 — Public share link for one memory

- Migration **0009** — `memories.share_id` (partial-unique). `setMemoryShare`
  (owner-scoped toggle, mints the id) + `getSharedMemory` (public, no user
  filter, null on revoke/delete).
- `POST` / `DELETE /api/memories/<id>/share` (both `write:true`) → the URL.
- `GET /m/<share_id>` — top-level public route (root layout only): type
  badge, title, captured date, summary, evidence image, full text, a
  "Remembered with MirrorMind →" footer. `generateMetadata` sets OG/Twitter
  from the memory; `robots: noindex`.
- `MemoryActions` → "Share public link" / "Revoke public link" (copies the
  URL on enable). `shared` derived from `memory.shareId`.
- Verified vs the real DB: 0009 applied; share on → `getSharedMemory` hit;
  foreign owner can't toggle; revoke → 404. Ownership audit 29/29.

## 2026-09-07 — Calendar feed (.ics)

- Migration **0008** — `profile_prefs.calendar_token` (unguessable, 52 chars,
  partial-unique). `getOrCreateCalendarToken` / `userIdForCalendarToken`.
- `lib/ics.ts` — minimal RFC 5545 builder: one all-day `VEVENT` per action
  item with a due date, `-P1D` `VALARM`, done items get `✓` + no alarm,
  dismissed skipped. CRLF, 75-octet line folding, text escaping.
- `GET /api/calendar/<token>` — public (token *is* the auth), `text/calendar`,
  30-min cache, `PT6H` refresh hint.
- Settings › **Calendar** — the `webcal://` URL with copy + "Add to Apple/
  Google Calendar" buttons. Hidden for the demo account.
- Verified against the real DB: 0008 applied; the demo's two due items
  render as valid VEVENTs (Exam Form → Sep 10, project abstract → Sep 11).

## 2026-09-07 — Retrieval eval harness

`npm run eval` — measures whether MirrorMind actually retrieves the right
memory for a question, the thing chat quality rests on.

- `scripts/eval-retrieval.ts` + `scripts/eval/cases.json` (23 cases against
  the seeded demo corpus; expected memories matched by title substring so a
  re-seed can't break them). Mirrors the chat route exactly:
  `parseQuery` → real Gemini query embedding → `searchChunks` (3×k) →
  `rerank` (sim + recency + type-match, ≤2 chunks/memory) → dedup to an
  ordered memory list.
- Metrics: `recall@1/3/5`, `MRR`. With `--chat`: also runs the answer model
  for citation-F1 and no-memory (decline) accuracy. Per-metric thresholds;
  exits non-zero on regression (CI-safe). `--json` for machine output.
  A free-tier 429 wall during `--chat` degrades to "chat metrics skipped",
  not a failure.
- First run: **recall@1/3/5 = 1.00, MRR = 1.00, citation-F1 = 0.98,
  no-memory accuracy = 1.00** on the demo corpus. Small corpus, so the
  headroom is limited — it catches *broken* retrieval (bad embeddings,
  query-parser / rerank / `searchChunks` bugs), not fine ranking drift;
  expanding the corpus is the follow-up.
- `.github/workflows/eval.yml` — weekly + `workflow_dispatch`, not per-push
  (spends real quota). Needs repo secrets `DATABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_API_KEY`,
  `EVAL_USER_ID`; skips cleanly if unset.

## 2026-09-07 — Open sign-ups + Members admin, camera & auth fixes

- **Live camera never showed a feed** (`1729d98`) — `startCamera()` acquired
  the `MediaStream` but the `<video>` only mounts once `camState === "on"`,
  so `videoRef.current` was `null` at acquire time and the stream was never
  attached → black viewfinder, "camera won't turn on", upload-only. Fixed:
  attach from a `useEffect` after the `<video>` mounts; guard
  `navigator.mediaDevices` (undefined on plain http:// / LAN-IP); classify
  the `getUserMedia` DOMException into an actionable toast + `console.warn`
  (the old `catch {}` swallowed it); retry once with `video:true` on
  `OverconstrainedError`.
- **`stillAllowed()` locked out open-signup + demo users** (`919f5d0`) —
  `requireUser()` consulted `allowed_emails` on every request regardless of
  `INVITE_ONLY`, so any address not in the (partial) table — including the
  seeded demo — was signed out to `/sign-in?error=not_invited` on its first
  authed page load. Fixed: gate the check on `getEnv().INVITE_ONLY`; always
  exempt the owner and the demo user.
- **Open sign-ups + Members admin** (`52f847b`) — the app is now open: anyone
  with the link signs in until `MAX_USERS` (10) seats are full; no invite
  list at the door (`INVITE_ONLY` stays as a dormant switch, set `0`
  explicitly on Vercel). *Settings › Access* → *Settings › Members*
  (owner-only): a seat counter ("N of 10 seats used" → amber "sign-ups
  closed" at capacity), every member with join date, and a **Remove** button
  that runs the full account teardown (`listUserObjectKeys` → storage
  remove → `deleteAllUserData` → `admin.auth.admin.deleteUser`), freeing a
  seat. Owner and demo can't be removed; demo never counts toward a seat.
  New `listMembers()` query + `removeMember` action; `InviteForm` deleted
  (the `allowed_emails` table + `isEmailAllowed` stay for `INVITE_ONLY=1`).
- **Vercel env set** (owner-side, now done): `INVITE_ONLY=0`, `MAX_USERS=10`,
  `DAILY_AI_CALL_BUDGET=800`, `DAILY_CAPTURE_LIMIT` 50→15, and the three
  `DEMO_USER_*` vars — all on Production + Preview; redeployed.
- **Vercel Web Analytics: live and collecting.** Project API shows
  `webAnalytics.enabledAt` set (2026-09-06) and `hasData: true`;
  `/_vercel/insights/script.js` serves 200 in production. The `<Analytics/>`
  component (`@vercel/analytics`, free tier) has been in the root layout
  since the redesign slice-5 commit. Dashboard: vercel.com → mirror-mind_ai
  → Analytics.
- **Vercel Speed Insights: not available.** `POST /speed-insights/toggle`
  returns `402 — Speed Insights Plus is available on pro and enterprise
  plans`; the account is on the **Hobby (free)** plan with no free tier for
  it. Wired up `@vercel/speed-insights` + `<SpeedInsights/>` to try, hit the
  paywall, reverted (nothing committed). `speedInsights.hasData` stays
  `false`. Revisit only if the project moves to Pro.
- **Camera fix confirmed working** by the user on their laptop (couldn't be
  tested from here — every automated browser blocks camera at the sandbox
  level).
- Verified against live prod with a minted owner session: `/settings/access`
  → 200, "2 of 10 seats used", owner=`you` / demo=`demo` both un-removable,
  real member has a Remove button; non-owner (demo) → 404 on the same URL.
  Demo one-click sign-in works end to end (8 seeded memories, 3 folders).

## 2026-09-07 — "Quietly expressive" redesign (5 slices)

Aesthetic from `scratchpad/redesign-directions.html`, shipped as a **warm
dark** theme (the concept's own dark mode) — the app hardcodes white-on-dark
in ~240 spots, so a true light flip is deferred to its own project. The
`.light` paper palette is written into globals.css, just not wired up.

- **Slice 1 — foundation** (`8bae760`): token layer retuned — warm ink
  ground `#100f16`, grape primary `#9a8dff`, soft-orange highlighter
  (changed/due only), teal, 14px radii, faint body dot-grid, drifting
  blooms, softened motion tokens. Familjen Grotesk (display) + Space Mono
  (data) replace Space Grotesk. Brand mark redrawn (grape disc + warm
  facet), wordmark token-coloured. Cosmic-black/neon hardcodes retuned
  across button, processing-card, tab-bar, chat/capture/onboarding/splash,
  site-header, manifest.
- **Slice 2 — motion** (`1048196`): `app/(app)/template.tsx` route rise+fade;
  `AmbientBlooms` behind app + marketing; notification bell wobbles on a
  rising unread count; memory cards get hover shadow + press-down. All
  reduced-motion safe.
- **Slice 3 — landing** (`2464f18`): `FeatureWalkthrough` — 6 steps, desktop
  scroll-scrubs the frame (sticky viewport), mobile silent 3.5s loop w/
  tap-to-pause, reduced-motion stacks all six. Landing rewritten (new hero,
  the problem, walkthrough, feature grid, use-cases, privacy, pricing
  teaser, real FAQ). Pricing → 3-tier comparison table, Free live, Pro/Teams
  "coming soon".
- **Slice 4 — personalisation** (`8b2270a`): accent picker — 6 hues
  (migration 0007 `profile_prefs.accent`), signed-in layout injects a
  `<style>` overriding `--primary`/`--ring`/`--violet*`/`--accent*`/
  `--brand-grad`. Settings swatch row + `router.refresh()` on save.
  *Deferred: folder colour+emoji, pinned shelf, cover-crop, display name.*
- **Demo account** (`5d0cdec`): `npm run seed:demo` seeds a read-only demo
  user (8 student memories, 3 folders, real embeddings). `requireApiUser({
  write: true })` / `assertCanMutate` reject it (403) across every mutating
  route + the capture pipeline + savePrefs; chat stays open. "Open the demo"
  link on sign-in (`signInAsDemo`). Excluded from MAX_USERS + digest emails.
  Env: `DEMO_USER_ID` / `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`.
- **Slice 5 — extras** (`b5b18f2`): Vercel Analytics; `PrivacyNote` (free-AI
  -tier honesty line) in Settings + capture panel; onboarding ends on a
  "first capture" slide → `/capture`; global shortcuts (`c`, `/`, `g t/f/y/c`);
  gentle "N captured in the last 7 days" on Today. *Deferred: seeded
  read-only demo account.*

All slices: typecheck + lint + build clean; 0007 applied + verified;
ownership audit 29/29. Dev note: a long-running dev server may hold a stale
`spaceGrotesk` Turbopack chunk — restart `npm run dev` (prod build is clean).

## 2026-09-07 — Free-tier safeguards (10-user cap, shared AI budget)

Groundwork for opening MirrorMind to a small public group on free tiers
only. No new spend; degrade gracefully instead of erroring at a quota wall.

- **`MAX_USERS` seat cap** (default 10, `0` = off). A brand-new email is
  turned away once that many accounts exist; anyone who already has an
  account always gets in. Enforced in `sendMagicLink` (`app/(auth)/actions.ts`,
  via `seatAvailableFor` → `countProfiles` / `emailHasProfile`) and, for
  OAuth where the email isn't known until after the exchange, in
  `app/auth/callback/route.ts` (fresh-signup detection via `user.created_at`
  + `countProfilesExcluding`, then sign-out + `admin.deleteUser` + redirect
  `?error=at_capacity`). Both paths fail **open** on a DB error. New
  `at_capacity` copy in the sign-in form.
- **Shared daily AI-call budget** — migration **0006** (`ai_call_log`: one
  `bucket_start` (IST day) row, `calls` counter, RLS on / no policy).
  `lib/ai/usage.ts`: `recordAiCalls()` fire-and-forget increment, wired into
  `postWithRetry` in `lib/ai/gemini.ts` so *every* successful Gemini call
  (extraction, each embedding, chat answer, folder-suggest) counts;
  `aiBudgetExceeded()` checks `DAILY_AI_CALL_BUDGET` (default 800, `0` = off)
  and **fails open**. Checked before a new capture (`beginCaptureUpload` /
  `createCaptureFromServerBytes`) and before a new chat answer
  (`app/api/chat/route.ts`) → friendly 429 `ai_budget_reached` instead of a
  mid-request failure.
- **`DAILY_CAPTURE_LIMIT` default 50 → 15** — keeps 10 users comfortably
  inside Gemini's ~1k req/day. `.env.example` + local updated; any Vercel
  override must be changed there too.
- Verified against the real DB: 0006 applied, upsert-increment returns 6
  for two +3 calls, `profiles` count = 1/10. Ownership audit still 29/29;
  typecheck + lint + build clean.
- **Still owner-side (Supabase dashboard):** disable Anonymous sign-ins;
  set Site URL to `https://mirror-mindai.vercel.app`. Set `MAX_USERS`,
  `DAILY_AI_CALL_BUDGET`, `DAILY_CAPTURE_LIMIT=15` in Vercel env.

## 2026-09-07 — Chat/search depth, PDF thumbnails, notifications, conflicts

- **Full-text search** — memory search (Timeline `q`, Cmd+K) now also
  matches the extracted body (`correctedText ?? text`), not just
  title + summary. ILIKE for now; a `tsvector` index is the follow-up.
- **Expandable citations** — tap a chat citation chip to see the exact
  chunk snippet it came from, with an "Open memory →" link.
- **Personal starter prompts** — the chat empty-state chips are built
  from your recent memories ("When is my next class in <timetable>?",
  "Summarize <doc>", …), deterministic, no extra AI call; generic
  fallback for a near-empty account.
- **PDF page-1 thumbnails** — `lib/pdf-thumb.ts` renders page 1 in the
  *uploader's own browser* (lazy `pdfjs-dist`, pinned 6.1.200; the CVE
  concern was server-side use on untrusted files, which this avoids). A
  second signed slot (`thumb.jpg`) carries it; `finishCaptureUpload`
  points display/thumb at it. New `isImageThumbUrl()` type-guard (checks
  the signed URL's extension) replaces the `mime==="image/*"` checks
  across all render sites — correct for photos, PDFs-with-thumb, and
  icon-fallback for audio/docx/pptx/un-rendered PDFs, no per-format flag.
- **In-app notification centre** — migration 0005 (`notifications` +
  RLS + a partial-unique dedupe index). Bell + unread badge in the
  sidebar / mobile header; dropdown lists recent items, opening marks
  read. Writers: `cron/reminders` ("Due soon: …", deduped by item id,
  independent of Resend), `cron/digest` ("Your weekly recap"), and the
  pipeline ("may need a review" on `ocr_confidence = low`). Verified
  against the real DB; ownership audit still 29/29.
- **Conflict-aware answers** — `ANSWER_SYSTEM` now tells the model to
  reconcile blocks that disagree on the same value and take the later
  `captured_at`, naming what changed. Verified vs real Gemini (May vs
  Aug timetable → picks the Aug one and says so).

### Not done — need a decision or a dedicated effort

- **Responsive polish** on the signed-in screens — needs eyes on each at
  ~375px (I can only fix blind).
- **Light mode** — the design is deliberately dark-only (docs/15 stack
  table). A real light theme is a full token + per-screen audit, and
  runs against the current design intent — a product call, not a quick
  win.
- **Teams / shared spaces** (P5) — multi-tenancy, a sharing model,
  roles/invites, per-space isolation. Its own project, not a feature to
  bolt on.

---

## 2026-09-07 — Hardening for open sign-ups

- **Cross-tenant ownership audit** — `scripts/audit-ownership.ts`
  (`npm run audit:ownership`). The app's DB connection is service-role and
  bypasses RLS, so isolation rests entirely on every query carrying
  `eq(userId, …)`. The script seeds a throwaway user B, then runs 29 checks
  as user A against B's ids: no read returns B's data, no write as A mutates
  B's rows, B's rows survive the attempts. B is created + deleted (cascades)
  by the script. It immediately caught one: `folderSubtreeIds(A, <B's
  folder>)` echoed the root id back instead of returning `[]` — a latent
  leak of another user's folder structure (not reachable via its one
  pre-validating caller, but real for any future caller). Fixed; all 29 pass.
- **Error reporting** — `lib/observe.ts` `reportError(err, ctx)`: one
  structured JSON line per unexpected error (route / user / captureId, for
  grep in Vercel logs) plus, when `ERROR_WEBHOOK_URL` is set, a compact
  Slack/Discord message. Same-signature errors muted 60s/instance. No SDK,
  no account. Wired into `handle()` (5xx only), the pipeline catch, the
  chat stream error path, and both cron routes.
- **CI** — `.github/workflows/ci.yml` runs typecheck + lint + vitest + build
  on every push to `main` and every PR. The repo had none; only Vercel's
  own build ran on push. First run green (1m39s).
- **Deferred** — Playwright E2E. Without a CI job that has DB/auth secrets
  it adds little over the checked-in DB smoke scripts (`test:pipeline`,
  `test:chat`, `test:documents`, `audit:ownership`) plus the new CI.

---

## 2026-09-07 — Folders (replaces Collections)

Single-home, nestable folders. A memory has at most one folder
(`memories.folder_id` NULL = **Unfiled** — always present). Nest via
`parent_id`, capped at 4 levels. Deleting a folder never destroys
anything: `ON DELETE SET NULL` sends its memories to Unfiled and its
subfolders to top level. Migration **0004** (applied). RLS on `folders`.

Retires the many-to-many `collections` from 0002/0003: all
collections components / API routes / queries / api-client wrappers
deleted, `CollectionsBar` gone from the Timeline. The
`collections` / `collection_memories` tables are left in place (no
data was in them) until a cleanup migration.

- **Phase 1** — schema, `folders` CRUD queries (cycle + depth guards),
  `/api/folders` + `/api/folders/[id]` + `PATCH /api/memories/folder`
  (bulk), `/folders` page: folder tree with create/rename/delete/new-
  subfolder, an Unfiled bucket, breadcrumbs, subfolder cards, and the
  folder's memories with an "include subfolders" toggle. New "Folders"
  nav item (alongside Timeline).
- **Phase 2** — filing UI: "Move to folder" on the memory detail
  (single-select tree, inline new-folder); a "Folder" dropdown in the
  capture panel (defaults to Unfiled, remembers last choice), threaded
  `uploadCapture → POST /api/captures → captures.folder_id →` pipeline
  copies it onto the memory.
- **Phase 3** — bulk move: a "Select" toggle on the Timeline turns the
  grid multi-select (count bar with Select all / Move / Done); "Move"
  reuses `FolderPickerDialog` with every selected id.
- **Phase 4** — AI folder suggestion, never auto-applied.
  `lib/pipeline/folder-suggest.ts` makes one Gemini JSON call that picks
  the best-fit folder path (or null); gated on provider=gemini, ≥2
  folders, confidence ≥ 0.55. For a memory saved with no capture-time
  folder, the guess lands in `memories.suggested_folder_id`; the memory
  detail shows *"Suggested folder: College › Physics [Move here]
  [Dismiss]"*. Verified against real Gemini — a physics lab report →
  the "Physics Lab Reports" leaf, a budget → "Personal Finance", a
  recipe → "Recipes", a dentist reminder → no guess.

Design decisions (from the user): exactly one folder per memory;
nesting; manual filing + AI suggestion; explicit Unfiled bucket; no
chat/search folder-scoping yet; Folders sits alongside Timeline, not
replacing it. Verified against the real DB: nesting, depth cap,
dup-name reject, subtree filter, cycle guard, delete fallback, and the
capture→folder→memory path.

---

## 2026-09-06 — Enhancement batch (chat streaming, auth, linking, review)

A pass over app quality picked from the recommendations list.

- **Open sign-ups** (`feat/auth`): new `INVITE_ONLY` flag (default `0` = open).
  The email allowlist in `sendMagicLink` + `/auth/callback` is gated on it;
  `/settings/access` still curates the list for when it's flipped on. Plus a
  `CHAT_HOURLY_LIMIT` (40) rolling-window guard on `/api/chat`, counted off the
  `chat_messages` table. Enable Supabase's own Attack-Protection (CAPTCHA,
  email rate limits) in the dashboard too.
- **Streaming chat + follow-ups** (`feat/chat`): `ChatModel.streamAnswer()`
  (optional); Gemini implements it over `:streamGenerateContent` (SSE) with a
  tolerant scanner that pulls the growing `answer` string out of the partial
  JSON so prose renders token-by-token; citations resolve from the final
  parse. `/api/chat` now emits newline-delimited JSON
  (`{t:"delta"}` … `{t:"done"|"error"}`); pre-stream errors still come back as
  plain JSON. The route also feeds the model the last 6 turns of the session,
  and embeds a short/anaphoric question together with the previous one so
  retrieval isn't blind to what "it" means. First token ~0.8s vs waiting for
  the whole JSON.
- **Image lightbox** (`feat/memory`): tap the captured image → full-screen,
  click-to-zoom 2.5×, drag to pan, pinch on touch, Esc / tap-out to close.
- **Auto-linking** (`feat/memory`): end of pipeline, a new memory is linked to
  its nearest neighbours (cosine over the summary-chunk embedding, sim ≥ 0.78,
  ≤ 4, relation `"auto"` + score). Populates the existing "Related" panel;
  best-effort, never fails the capture.
- **Review queue** (`feat/today`): `ocr_confidence = low` + not-yet-corrected
  memories surface in one "Needs review" card on Today, linking to the
  in-place text corrector. No migration.
- Also: chat type-keywords now bias ranking instead of hard-filtering
  retrieval (`fix/chat`); the PWA service worker no longer runs in dev
  (`fix/pwa`), which was shadowing every source change on localhost.

### Deferred — PDF page-1 thumbnails

Wanted, but server-side rendering means `pdfjs-dist` on untrusted uploads, and
our transitively-pinned `pdfjs-dist@6.1.200` is inside the range of
GHSA-hq66-cqwq-w95j (arbitrary JS on a malicious PDF; fixed in 6.2.108, which
`officeparser` doesn't ship yet). We never hit that path today (PDFs go to
Gemini, never to `officeparser`), and adding a thumbnail step would newly run
it — not acceptable with open sign-ups. Options for later: render page 1
**client-side** (user's own browser/file) and upload the JPEG, or swap to a
non-pdfjs renderer (`mupdf` WASM).

---

## 2026-09-06 — Fix: `/api/chat` 500 on any type-scoped question

Found while verifying the live site end-to-end after the document-capture
deploy (drove the deployed API with a minted session: begin → signed-URL
upload → finish → poll → chat — all green except chat, which 500'd).

`searchChunks` built its type filter as `c.type::text = any(${opts.types})`,
dropping a JS array straight into a raw Drizzle `sql` template. That binds as
one untyped parameter Postgres rejects on the right of `= any(...)`, so the
whole retrieval query failed (`Failed query: …`) and the route returned a
generic 500 — for **any** chat question the rule-based query-parser tags with
a type ("show me the timetable", "which notice…", "what's in that document").
Plain questions were unaffected, which is why it went unnoticed. Same class as
the date-filter crash fixed 2026-09-05 (raw JS value in a `sql` template).

Fix: expand the list into individual text params via `sql.join`, giving
`c.type::text in ($n, $n+1, …)`. Verified against the real DB (no filter,
single type, multiple types, the previously-crashing `["document"]` case) and
re-verified the full live-site flow — chat now answers and cites a
document-only memory correctly, `mime` carried through to the citation.

---

## 2026-09-05 — Document capture: PDF, Word, PowerPoint

A third capture modality alongside photos and voice notes, plus a fix to an
architectural limit that already silently constrained those two.

- **Direct-to-storage uploads** (removes a hidden 4.5MB ceiling): Vercel
  serverless functions cap request bodies at a hard, unconfigurable 4.5MB —
  this already applied to photo/audio uploads in production even though the
  app's own 20MB check never caught it. The browser now uploads the raw file
  straight to Supabase Storage via a signed URL
  (`POST /api/captures/begin` mints it, `lib/api-client.ts`'s
  `uploadCapture()` PUTs through the Supabase SDK), then
  `POST /api/captures` finalizes with a tiny JSON body
  (`lib/pipeline/create-capture.ts`: `beginCaptureUpload` / `finishCaptureUpload`).
  Image processing (`sharp`) moved from upload-time into `runPipeline` itself,
  since the server no longer has the original bytes in a request body to work
  with synchronously — it downloads from Storage, generates `display.jpg`/`thumb.jpg`,
  and a new `updateCaptureDerivedKeys()` query points the row at them.
- **PDF**: reuses the photo pipeline almost unchanged — Gemini reads PDFs
  natively (text, images, diagrams, across every page) via the same
  `VisionExtractor` interface, just with `mediaType: "application/pdf"`.
  Capped at 40MB (under Gemini's 50MB PDF ceiling).
- **DOCX/PPTX**: text-only extraction via `officeparser`
  (`lib/pipeline/office-text.ts`) ahead of a new text-based extraction call
  (`TextDocumentExtractor` interface, `GeminiTextDocumentExtractor`,
  `DOCUMENT_TEXT_SYSTEM` prompt) — mirrors the Phase 4 audio-transcriber
  shape. `officeparser` bundles a `pdfjs-dist` with a known CVE
  (GHSA-hq66-cqwq-w95j); mitigated architecturally by always passing an
  explicit `fileType` hint and never routing a PDF through it. Capped at 25MB.
  Legacy binary `.doc`/`.ppt` are out of scope.
- **Thumbnail rendering generalized beyond `voice_note`**: a memory can now
  lack a real image thumbnail for two different reasons (audio, or an
  uploaded document) instead of one, so the `type !== "voice_note"` check
  used across 7 render sites (memory card, recent strip, chat citations,
  command palette, related-memories ×2, memory detail) no longer works.
  Replaced with `mime?.startsWith("image/")`, which required threading
  `captures.mime` through every query that already selects `thumbKey`
  (`listMemories`, `listMemoriesInCollection`, `searchAll`,
  `listLinkedMemories`, `searchChunks`, `listRecentCaptures`) and the full
  chat-citation chain (`/api/chat` → stored `citations` jsonb → `chat-hydrate.ts`
  → `ChatCitation` type). The memory detail page also gained a third
  image/audio/document branch — previously a DOCX/PDF capture (where
  `displayKey === thumbKey === originalKey`, the raw file) would have tried
  to `<img src>` the raw document blob.
- **Found and fixed during real-provider verification**: the DOCX/PPTX
  extraction prompt said "reproduce the meaningful text," which is weaker
  than the image/PDF prompt's "transcribe ALL legible text" — a real Gemini
  run on a 3-slide test deck silently dropped the last, oddest-looking line
  from the stored `text` field (officeparser's raw extraction had it; the
  model didn't reproduce it). Tightened `DOCUMENT_TEXT_SYSTEM` to explicitly
  require verbatim inclusion of every line "no matter how short, repetitive,
  or meaningless-looking," bumped `DOCUMENT_TEXT_PROMPT_VERSION` to `_v2`,
  and re-verified — full-document coverage confirmed with a synthetic 3-page
  PDF, 3-paragraph DOCX, and 3-slide PPTX (marker text on the last
  page/paragraph/slide only), each round-tripped through real Gemini with a
  correct-memory retrieval hit on that marker.
- New `scripts/test-document-pipeline.ts` (`npm run test:documents [-- --real]`),
  the document counterpart to `test-pipeline.ts` — synthesizes test files
  in-memory (raw PDF bytes; DOCX/PPTX via `fflate`'s `zipSync`, since
  `officeparser` only requires `word/document.xml` / `ppt/presentation.xml`
  + slides to parse, not a fully realistic Office package), checks
  `officeparser` extraction directly (no AI), then the real upload → capture
  row → pipeline → retrieval path.
- Gates green: `typecheck` + `lint` + `vitest` (37 tests) + `build`.

### Recommendations not in this pass (for later)

- Real PDF thumbnails (render page 1 as an image) instead of a generic icon tile.
- Run embedded images in DOCX/PPTX through the vision extractor too — an
  image-heavy slide deck currently loses everything but its text.
- Legacy `.doc`/`.ppt` support (different binary format, different parser).
- Citation-level highlighting: which page/paragraph an answer came from, not
  just the memory title.
- Watch embedding-call latency/cost once real large (50-page) PDFs start
  flowing through — a lot more chunks than a photo ever produced.

---

## 2026-09-05 — Fix: ECONNRESET on long-lived DB connections

User-reported, caught live: loading `/capture` failed with a server
console error — `listRecentCaptures()`'s query dying with `Caused by:
Error / read ECONNRESET` — after the dev server had been running for
several hours.

`getDb()` (`db/index.ts`) built its `postgres-js` client with no
`idle_timeout`, so it held connections open indefinitely from the
client's side. Supabase's pooled (transaction-mode, port 6543)
connection can close an idle socket server-side without telling the
client; the next query sent down that now-dead socket fails with a raw
`ECONNRESET` instead of `postgres-js` reconnecting first, since nothing
told it to give up on that connection. Not specific to this one query —
any long-lived process (a warm Vercel function reused across requests,
or a dev server left running for hours, as happened here) was exposed
to it.

Fix: `idle_timeout: 20` (proactively close connections idle for 20s)
and `max_lifetime: 30min` (recycle every connection periodically
regardless of use) — the standard `postgres-js`-against-a-pooler
config. Verified the exact failing query against the real DB with the
new client config; full gate green after.

---

## Stack as built (supersedes TRD §3 for anything conflicting)

| Concern | Built with |
|---|---|
| App framework | **Next.js 16** (App Router, Turbopack), React 19, TypeScript strict |
| Styling | **Tailwind v4** (CSS-first tokens in `app/globals.css`), shadcn-style primitives in `components/ui/*`, `tw-animate-css`, `next-themes` (forced dark — single "cosmic" violet theme, no light mode) |
| Auth | **Supabase Auth** — email magic link + Google OAuth (`lib/supabase/*`, `app/(auth)/*`, `app/auth/callback`, `proxy.ts`) |
| DB | **Supabase Postgres + `pgvector`**, **Drizzle** for typed queries (`db/schema.ts`), authoritative hand-written migration (`db/migrations/0000_init.sql`) |
| Storage | **Supabase Storage** — private `captures` bucket, RLS by path prefix `{user_id}/…` |
| Security boundary | **Postgres RLS** (`auth.uid() = user_id` on every table) + app-level owner filters |
| Deploy target | **Vercel** (single project) |
| AI pipeline | **Not built yet** — see "Next" |

Retained from the original docs: memory/type model & enums ([Schema](05-SCHEMA.md)), the capture→memory→chunk→embed→recall design ([Architecture](03-ARCHITECTURE.md)), API contracts ([API Spec](09-API-SPEC.md)) — to be implemented as Next Route Handlers, prompt library ([Prompts](10-PROMPTS.md)), security stance ([Security](12-SECURITY-PRIVACY.md)).

---

## 2026-09-05 — Fix: 6 bugs found by a second, independent review pass

Static checks (typecheck/lint/vitest/build) were already clean after the
Tier 2–4 backlog work, so this pass was specifically hunting logic bugs — a
manual re-read plus an independent background agent given the full diff and
told to look for exactly that. Six real, currently-triggerable issues:

- **Mode-switch-mid-recording leak** (`capture-panel.tsx`): the Photo/Voice
  toggle stayed live and clickable throughout an active voice recording
  (`stage.kind` never left `"idle"` during recording), so switching to
  Photo mid-recording orphaned the `MediaRecorder`/mic stream with no UI
  left to stop it. Toggle now disables while `recState === "recording"`.
- **Object URL leak on retake** (`capture-panel.tsx`): `reset()` and the
  recorder's `onstop` handler both replaced `objectUrl.current` without
  revoking the previous value — hit on every discarded/re-recorded voice
  note, not just the rare HEIC-fallback path that pattern was written for.
- **Unenforced `voice_note` type** (`run.ts`): the six thumbUrl-as-`<img>`
  guards added across the app for audio memories all depend on
  `memory.type === "voice_note"` — which came straight from the model's
  output, only *asked* via the prompt to always be that value, never
  enforced. Now set server-side after transcription regardless of what
  the model returned.
- **Voice mode offered with no working backend** (`capture-panel.tsx`,
  `capture/page.tsx`): `getAudioTranscriber()` only has a real
  implementation for Gemini; on an Anthropic/Ollama-configured deployment,
  recording a voice note burned a daily capture slot and then failed
  forever in the pipeline with no warning. The tab is now hidden
  server-side (`aiMode().provider`) when audio isn't supported.
- **`collection_memories` RLS gap** (`db/migrations/0003`): the 0002
  policy only checked the *collection*'s owner, not the *memory*'s —
  masked today since the app's pooled connection bypasses RLS, but a real
  gap if that connection is ever downgraded. Tightened to require both.
- **Cron batch fragility** (`lib/email.ts`, both cron routes):
  `resend.emails.send()` wasn't wrapped in try/catch, so one recipient's
  network blip would abort the rest of the batch; the reminder dedupe was
  also a plain check-then-act, racy under overlapping invocations.
  Replaced with an atomic claim (`insert ... onConflictDoNothing()
  .returning()`) released only if the send itself fails, and isolated
  each recipient's work in its own try/catch.
- Smaller: `createCollection()` let the `unique(user_id, name)` constraint
  surface as a generic 500 — now returns `null` on conflict and the API/UI
  show a proper "You already have a collection with that name."

Also found (not a code bug, but worth recording): an earlier manual cron
test in this same session had left a real `weekly_digest` row in the
production `reminder_log` table from before the "only dedupe on an actual
send" fix landed — it would have silently suppressed this user's real
first digest email once `RESEND_API_KEY` is configured. Deleted.

Verified against the real stack, not just by inspection: migration 0003
applied and its policy read back to confirm both `exists` checks are
present; re-ran the digest cron against a cleaned `reminder_log` and
confirmed 0 rows remain after a claim-then-release cycle (the earlier
"skipped" result had been masked by the stale row, not proof the fix
worked); duplicate-collection-name handling exercised directly against
the DB. Full gate green afterward.

---

## 2026-09-05 — Tier 2–4 backlog: search/links/collections/text-fix, PWA, email, audio

Built out the remaining recommendations from the Tier 1 "full app" pass, in
four phases (own migration/commits each, `phase-4-audio-capture` branch for
the last one — everything before it already landed on `main`):

**Phase 0/1 — schema groundwork + zero-new-dependency bundle.** Migration
`db/migrations/0002_collections_links_voice.sql` adds the `voice_note`
memory type and `collections`/`collection_memories` tables. Activates two
pieces of schema that had sat dormant since the original build: the
`memory_links` table (now a "Related" section on the memory detail page,
`components/app/related-memories.tsx`) and `memories.correctedText` (now
writable via an edit/save flow, `components/app/text-corrector.tsx`,
`lib/pipeline/correct.ts` — re-chunks/re-embeds without a new vision call).
Adds a global Cmd/Ctrl+K command palette (`components/app/command-palette.tsx`,
`GET /api/search`) superseding the old Timeline-local shortcut, and
lightweight named collections surfaced as a Timeline chip row rather than a
new nav tab (`components/app/collections-bar.tsx`) — the redesign's 4-tab
nav stays as the user chose it.

**Phase 2 — PWA installability.** `app/manifest.ts` gains a `share_target`
so "Share to..." from other apps lands a photo in Capture
(`app/share-target/route.ts`); the capture-creation logic (dedupe, daily
cap, sharp processing, upload, pipeline kick-off) was factored out of
`app/api/captures/route.ts` into `lib/pipeline/create-capture.ts` so both
routes share one implementation. `public/sw.js` is a minimal hand-written
service worker (cache-first for static assets, network-first with a cached
`/offline` fallback for navigations) — no `next-pwa` dependency. Settings
gains an "Install MirrorMind" button wired to `beforeinstallprompt`.

**Phase 3 — weekly digest + due-soon reminder emails.** Wires up
`resend` on top of scaffolding that already existed but was never
connected: `profile_prefs.{emailReminders,weeklyDigest}` (long editable in
Settings), `reminder_log` (built for exactly this dedupe), and
`RESEND_API_KEY`/`EMAIL_FROM` (already in `lib/env.ts`/`.env.example`).
`lib/email.ts` degrades gracefully without a key (logs instead of sending,
matching the AI provider fallback philosophy). New crons
`app/api/cron/{digest,reminders}/route.ts`, scheduled in `vercel.json`.
Found and fixed two real bugs while testing against the live DB:
`listUsersForWeeklyDigest`/`listUsersForReminders` were INNER JOINing
`profile_prefs`, silently excluding every user who'd never opened Settings
despite both prefs defaulting to true (fixed with a LEFT JOIN + coalesce);
and both cron routes were marking a send as "sent" even when it silently
no-op'd for a missing key, which would have permanently blocked a real
retry once a key is added (now only dedupes on an actual send).

**Phase 4 — audio capture + transcription.** A new capture modality:
record a voice memo, get it transcribed and remembered like any other
capture. `lib/ai/types.ts` adds `AudioInput`/`AudioTranscriber` reusing the
existing `Extraction` shape unchanged; `lib/ai/gemini.ts` adds
`GeminiAudioTranscriber` (only Gemini is wired for audio — anthropic/ollama
throw a clear "set AI_PROVIDER=gemini" error). `create-capture.ts` skips
the sharp image pipeline for audio and uploads the raw bytes once
(original/display/thumb keys all point at the same object — every render
site branches on `type === "voice_note"` before treating them as an
image). `capture-panel.tsx` gets a Photo/Voice mode toggle with a
MediaRecorder-based record/stop/timer UI. Fixed six render sites
(memory-card, recent-strip, chat-shell, command-palette, related-memories
×2, memory detail page) that assumed a truthy `thumbUrl` was safe to
render as `<img>` — for a voice note it's a signed URL to the raw audio
file, which would have shown a broken image; memory detail now renders a
real `<audio controls>` player instead.

All four phases gated (`typecheck`/`lint`/`vitest`/`build`) and verified
against the real stack rather than by inspection alone: a one-off script
exercised search/link/collection/correct end to end (Phase 1); both cron
routes were curled directly (Phase 3, confirmed the join-bug fix flipped
`recipients` from 0→1 and the dedupe fix flipped a false "sent" to
"skipped"); and a full storage-upload → `insertCapture` → `runPipeline` run
produced a real `ready` capture + `voice_note` memory end to end (Phase 4,
torn down after).

### Not done / next
- `RESEND_API_KEY` is still unset — digest/reminder emails compile and
  no-op cleanly but nothing has actually been delivered yet. Needs a
  Resend account + key before Phase 3 can be called fully verified.
- Sentry error monitoring and product analytics were explicitly deferred
  this round (need accounts only the user can create).
- No visual regression tests for any of this — spot-checked in a running
  dev server / against the real DB per phase, same as the redesign pass.

---

## 2026-09-05 — Fix: chat 500'd on any time-scoped question

`searchChunks()` (`lib/db/queries.ts`) built its `captured_at` bound with a
raw `Date` interpolated straight into a Drizzle `sql\`\`` template:
`sql\`c.captured_at >= ${opts.after}\``. Every other date filter in this
file goes through Drizzle's typed query builder (`gte`/`lt` on a real
column), which serializes a `Date` correctly for the `postgres` driver —
but a bare tagged-template interpolation doesn't get that treatment, so
the driver received a raw `Date` object at bind time and threw
`TypeError [ERR_INVALID_ARG_TYPE]` trying to call `Buffer.byteLength` on
it, 500ing the request.

`lib/pipeline/query-parser.ts` sets `filters.after`/`before` for a wide
set of everyday phrasings — "today", "yesterday", "this morning/
afternoon/evening", "last night", "this/last week" — so this wasn't an
edge case: **any chat question containing one of those words crashed
`/api/chat` outright**, no matter what was actually captured. Found by
writing a one-off script that ran `parseQuery → embed → searchChunks →
chat model` directly against the real DB and Gemini (bypassing HTTP auth
to isolate the pipeline), rather than by inspection — the bug wasn't
visible from reading the route handler in isolation.

Fix: `${opts.after.toISOString()}` / `${opts.before.toISOString()}`.
Re-ran the same script for a temporal ("What did I capture this week?")
and non-temporal ("When is my next class?") question against the real
account's 3 memories — both now return a cited answer. Gates
(`typecheck`/`lint`/`vitest`/`build`) all green.

---

## 2026-09-05 — Cosmic redesign (Claude Design import)

Re-skinned the whole app from the original warm-paper light/dark theme to a
single dark violet "cosmic" theme, based on a Claude Design mockup
(`design/MirrorMind.dc.html`, vendored read-only under `design/` — see
`design/HANDOFF-README.md`). The Claude Design MCP itself couldn't be reached
from this session (`/design-login` needs an interactive OAuth flow this
session can't run), so the mockup was worked from a zip the user exported
manually and re-implemented natively in Tailwind/React rather than ported
structurally.

Scope, as confirmed with the user up front: full switch to dark-only (no
light theme, no theme toggle), keep the existing 4-tab nav (Capture /
Timeline / Chat / Today — the mockup's Home/Capture/Ask 3-tab structure was
**not** adopted), and add both a Splash screen and a 3-slide onboarding flow.

- **Design tokens** (`app/globals.css`): full rewrite onto a single dark
  palette — `--background:#04040f`, `--primary:#8b5cf6` (violet), `--card`/
  `--secondary` as translucent whites, plus one `--type-*` CSS var per
  `MemoryType` (mockup only styled 4 of the 9 types; generalized to all 9)
  driving accent bars/icon tiles/chips via `color-mix(in oklab, ...)`. New
  `@utility bg-cosmic` (radial nebula), `bg-grid`, `text-gradient`, `glass`;
  mockup's keyframes (`orb-glow`, `float`, `dot-pulse`, `scan-line`,
  `particle-float`, `fade-in-up`, `ring-pulse`, …) ported as `--animate-*`
  tokens. Fonts: Space Grotesk (display/headings) + DM Sans (body), replacing
  Inter/JetBrains Mono. `next-themes` now `forcedTheme="dark"`.
- **Brand**: `components/brand/logo.tsx` rewritten around a reusable `Orb`
  (radial-gradient sphere) component; new favicon/app icons regenerated from
  it via `qlmanage`/`sips` (no ImageMagick available).
  All `components/ui/*` primitives (button, card, badge, input) restyled to
  the new tokens; `AppShell`/`AppNav` restyled, `MobileTabBar` added (floating
  center Capture button, matches the mockup's tab bar).
- **Screens**: Timeline, Capture + Processing (scan-line animation over the
  thumbnail, step indicator), Memory Detail (icon-tile header, "Ask about
  this memory" CTA), Chat (violet-gradient user bubbles, citation chips),
  Today, Settings (+ Access), and the marketing/landing + pricing/legal +
  auth sign-in pages all restyled — most of marketing/legal needed no direct
  edits since they already rendered off semantic tokens (`bg-card`,
  `text-primary`, etc.) that now resolve to the cosmic palette automatically;
  only literal `bg-grain` (a utility dropped in the token rewrite) needed
  replacing with `bg-cosmic`.
- **Onboarding**: `components/app/splash-screen.tsx` (glowing orb + gradient
  wordmark + pulsing dots) and `components/app/onboarding-flow.tsx` (3
  slides — capture / search / amplify, copy taken verbatim from the mockup's
  `slides` array), tied together by `components/app/onboarding-gate.tsx` and
  mounted once in `app/(app)/layout.tsx`. Gated by a `mm-onboarded` flag in
  `localStorage` (no DB migration) — shows once per browser, then never
  again. The state-transition effect is written as a single `setTimeout`
  callback rather than a plain synchronous `useEffect` body, to satisfy the
  `react-hooks/set-state-in-effect` lint rule.
- Removed `components/theme-toggle.tsx` (dead now that theme is forced dark)
  and its usage in `components/marketing/site-header.tsx`.
- **Gates**: `typecheck` ✅ · `lint` ✅ · `vitest run` ✅ (37/37, unchanged —
  this was a styling pass, no logic touched) · `next build` ✅ (18 routes).
  Spot-checked the landing, sign-in, and pricing pages in a real browser
  against the running dev server.

### Not done / next
- Tier 2–4 recommendations from the previous entry (PWA share target, text
  correction UI, unified search, email reminders, audio capture, weekly
  digest, collections, error monitoring, offline PWA) are still just
  recommendations — none built yet.
- No visual regression / screenshot tests exist for the new theme; future UI
  changes should be spot-checked in a browser same as this pass was.

---

## 2026-09-04 — "Full app" Tier 1: reliability, access control, caps

**Requires migration `db/migrations/0001_full_app.sql`** and new env vars
(`OWNER_EMAIL`, `CRON_SECRET`, `APP_TZ`, `DAILY_CAPTURE_LIMIT`, `RESEND_*` — see
`.env.example`).

- **Server-side image pipeline** (`lib/images/process.ts`, `sharp`): every capture
  → 3 JPEGs (`original.jpg` ≤3000px q90, `display.jpg` ≤1400px q82, `thumb.jpg`
  ≤400px q70), auto-oriented, EXIF/GPS stripped, HEIC/HEIF/AVIF/TIFF accepted and
  transcoded. `POST /api/captures` rewritten to store all three keys + real
  dimensions; client (`capture-panel.tsx`, `lib/image.ts`) falls back to raw
  upload when the browser can't decode the format. `serverExternalPackages: sharp`.
- **Stuck-capture recovery** (`lib/pipeline/recover.ts`): captures non-terminal
  for >4 min are re-queued. Runs opportunistically via `after()` on the Capture
  page and as a Vercel Cron backstop — `GET /api/cron/recover` (bearer
  `CRON_SECRET`), scheduled in `vercel.json` (03:00 daily).
- **Sign-up allowlist**: `allowed_emails` table. `sendMagicLink` pre-checks;
  `/auth/callback` post-checks OAuth (rejected sign-ups are signed out +
  `admin.deleteUser`); `requireUser()` re-checks on every app load (fail-open).
  `OWNER_EMAIL` bypasses and unlocks **`/settings/access`** — an owner-only page to
  add/remove invited emails (`InviteForm`, `addInvite`/`removeInvite` actions).
  The migration auto-adds every existing `auth.users` email.
- **Per-user daily cap**: `DAILY_CAPTURE_LIMIT` (default 50) counted from local
  midnight (`lib/time.ts`); `POST /api/captures` → 429 `daily_limit_reached`; the
  Capture page shows "N/limit left today" and disables input at zero.
- **Settings page** made real: preferences form (timezone, email-reminder /
  weekly-digest opt-ins → `profile_prefs`), owner-only Access link, and working
  **export** (`GET /api/export` → full JSON download) + **delete account**
  (`POST /api/account/delete` → wipes storage objects, all rows, the auth user,
  signs out).

---

## 2026-09-04 — Tests, tag editing, loading skeletons

- **Vitest suite** — `npm test` (`vitest run`), config in `vitest.config.mts`
  (native tsconfig paths, node env). 37 tests over 6 files covering the risky
  pure logic: `chunkMemory`, `parseQuery` (temporal + type), `derive`
  (`entityTimestamp` / `deriveTags` / `deriveActionItems`), `buildDigest`,
  `extractionSchema` tolerance (kind aliasing, offset-less `ts_value`, malformed
  entities dropped, `.catch` defaults), and `env` (blank→default, bad
  `AI_PROVIDER`/`DRY_RUN`→fallback, missing required→throw). Bumped
  `@types/node` to ^22 for Vitest 5.
- **Tag editing** — `components/app/tag-editor.tsx`: inline chip editor on the
  memory page, optimistic `PATCH /api/memories/[id]`, slugifies input, Enter/comma
  to add, Backspace to remove.
- **`loading.tsx`** skeletons for `/capture`, `/timeline`, `/memory/[id]`,
  `/chat`, `/today` — Suspense fallbacks during the server data fetch.

---

## 2026-09-04 — Deploy + hardening

- **Deployed to Vercel** at `mirror-mindai.vercel.app` (auto-deploys on push to
  `main`). Env vars set in the Vercel dashboard; Supabase redirect URLs updated.
- **env schema hardened twice**: (1) `AI_PROVIDER` / `EMBEDDING_PROVIDER` /
  `DRY_RUN` tolerate whitespace/case/quotes and fall back on bad values; (2)
  blank/whitespace values everywhere are treated as unset so `.default()` applies
  — a Vercel var set to `""` (`GEMINI_EMBED_MODEL`) had been resolving to an empty
  model name → captures would 404 at the embedding step in production.
- **`/api/health`** now reports `ai.{provider,visionModel,embeddingModel}`.
- **Fixed** `TimelinePage` runtime crash: `<Stagger.Item>` compound component's
  static was lost across the RSC boundary → split to `<Stagger>` + `<StaggerItem>`
  named exports.

---

## 2026-09-04 — Chat history + Today (P4 partial)

- **Chat persistence**: `chat_sessions` / `chat_messages` now used. `POST /api/chat`
  takes an optional `sessionId` (creates one lazily, auto-titles from the first
  message), persists both turns, returns `sessionId`. New routes:
  `GET/POST /api/chat/sessions`, `GET/DELETE /api/chat/sessions/[id]`.
  Citations are stored as `thumbKey` and re-signed on read (`lib/chat-hydrate.ts`)
  so old chats don't show expired image URLs.
- **ChatShell** rewritten: server-hydrated session list + messages, session
  switcher sidebar (mobile drawer), New-chat / delete, URL `?s=<id>`.
- **Today page** is real: `listMemoriesBetween` + template digest
  (`lib/pipeline/digest.ts`, no LLM call) grouped by type, plus a working
  **action-item checklist** — `GET /api/action-items`, `PATCH /api/action-items/[id]`,
  optimistic toggle, overdue styling (computed server-side to satisfy the
  purity lint rule).
- `npm run test:chat` — verifies session lifecycle, message persistence with
  citations jsonb, auto-title, cascade delete, and action-item listing against
  real Supabase. Green.

---

## 2026-09-04 — Gemini live & hardened (images are being read)

Real extraction working end to end on the free Gemini tier. Debugging chain:
`gemini-2.0-flash` retired → `gemini-2.5-flash` blocked for new keys → flash-3.x
are reasoning models that returned empty output under the token budget → free-tier
503s. Resolution:

- Default `GEMINI_MODEL = gemini-flash-lite-latest` (available on new keys, fast,
  no thinking overhead; `gemini-3.6-flash` is the fallback for better OCR).
- `postWithRetry()` — 4 attempts, exp backoff + jitter, on 429/500/502/503/504 and
  network blips, for `generateContent` and `embedContent`.
- `firstText()` throws a readable error (finishReason/blockReason) instead of an
  opaque parse failure; output budgets raised (extraction 8192, chat 2048).
- **Extraction schema made tolerant**: entity `kind` aliasing + fallback,
  `ts_value` accepts any string, `.catch()` defaults on all top-level fields,
  malformed entities dropped rather than failing the capture.
- `classifyError` → `model_busy`; ProcessingCard shows a "try again in a minute"
  message and the raw `errorDetail` (owner-only, via `GET /api/captures/[id]`).
- New tooling: `npm run diagnose [-- --fix]`, `npm run probe:gemini`;
  `/api/health` now reports `ai.{provider,visionModel,embeddingModel}`;
  `[pipeline] <id> provider=… vision=name:model` logged per run.
- **Op note**: a long-running `next dev` doesn't hot-reload the `after()` pipeline
  path — restart with `pkill -f "next dev"; rm -rf .next; npm run dev` after AI changes.

---

## 2026-09-04 — Multi-provider AI (free option)

- Added **Google Gemini** adapters (`lib/ai/gemini.ts`) — vision extraction, chat, and embeddings over the free Generative Language REST API. `responseMimeType: application/json` forces valid JSON. `gemini-embedding-001` with `outputDimensionality: 1024` (+ L2 normalise) keeps the existing `vector(1024)` column — no migration.
- Added **Ollama** adapters (`lib/ai/ollama.ts`) — local/private/free (`llama3.2-vision`, `llama3.1`, `bge-m3`). Not usable on Vercel.
- `lib/ai/index.ts`: `AI_PROVIDER` env (`auto | gemini | anthropic | ollama | fixture`). `auto` = Gemini key → Anthropic key → fixtures. Embeddings follow the provider unless `EMBEDDING_PROVIDER`+`EMBEDDING_API_KEY` (voyage/openai) override.
- `Embedder.embed(texts, kind?)` gains a `"document" | "query"` hint (Gemini task type); chat route passes `"query"`.
- `.env` restructured into Option A/B/C. `docs/12` §4 gains an **AI provider & training** table — free Gemini is dev-only; don't launch on it.
- `npm run test:pipeline -- --real [image]` runs against the configured provider instead of fixtures. Fixture path re-verified green.

---

## 2026-09-04 — Capture pipeline + recall (P2 + P3)

### Done
- **AI adapter layer** (`lib/ai/`): `types.ts` (zod `Extraction` schema + `VisionExtractor` / `Embedder` / `ChatModel` interfaces), `prompts.ts` (`extract_v1`, `answer_v1` from docs/10), `vision.ts` (Anthropic image→JSON, fenced-JSON parse, 1 retry), `embeddings.ts` (Voyage/OpenAI over `fetch`, batched), `chat.ts` (Anthropic answer, citation-id validation), `fixtures.ts` (deterministic DRY_RUN: 3 seeded extractions + hash-based unit vectors + canned chat), `index.ts` factory. **Auto-fallback to fixtures when the API key is absent or `DRY_RUN=1`** — the whole flow runs offline today.
- **Pipeline** (`lib/pipeline/`): `chunk.ts` (~300-token windows, 15% overlap, summary chunk), `derive.ts` (entity→ISO timestamps, derived tags, action items from deadlines), `query-parser.ts` (rule-based temporal + type filters), `run.ts` orchestrator (status transitions, storage download, extract, clear-and-reinsert for retry, chunk+embed, transactional `insertMemoryGraph`, error classification).
- **DB access** (`lib/db/queries.ts`): captures CRUD + sha dedupe + recent list; `insertMemoryGraph` (one transaction: memory + entities + tags + memory_tags + action_items + chunks + embeddings); `listMemories` (filters + cursor), `getMemoryDetail`, `updateMemoryTags`, `softDeleteMemory`; `searchChunks` (filtered pgvector cosine `<=>` + hydration).
- **API routes**: `POST/GET /api/captures` (multipart upload → Supabase Storage as the user → `captures` row → `after()` runs the pipeline post-response; sha dedupe; `runtime=nodejs`, `maxDuration=60`), `GET /api/captures/[id]` (status poll), `POST /api/captures/[id]/retry`, `GET /api/memories`, `GET/PATCH/DELETE /api/memories/[id]`, `POST /api/chat` (parse → embed → `searchChunks` k·3 → rerank sim+recency+type, dedupe ≤2/memory → answer → hydrate citations with signed thumbs). `lib/http.ts` = typed `HttpError` + `handle()` + `requireApiUser()`.
- **Storage**: `lib/supabase/admin.ts` (service-role client, pipeline only), `lib/storage.ts` (batch signed URLs, object-key helper).
- **UI wired to real data**: Capture panel now uploads → `ProcessingCard` polls status → routes to the memory; Capture page "Recent" strip is live; Timeline is a real grid with URL-driven `TimelineFilters` (range + type + search); Memory detail renders the image, per-type `StructuredCard` (notice/timetable/textbook/whiteboard/circuit/generic), entities grouped, tags, action items, collapsible extracted text, delete via `MemoryActions`; Chat calls `/api/chat` and renders cited answers with thumbnail chips, "filters used", and a distinct no-memory state.
- **Tooling**: `npm run test:pipeline` (`scripts/test-pipeline.ts` + `scripts/shims/no-server-only.mjs`) creates a capture against real Supabase, runs the pipeline, then `searchChunks`, and asserts memory + embeddings + retrieval. **Verified green**: `ready` status, memory + 2 chunks + 2 embeddings + 6 entities + 2 tags, retrieval returns the memory.
- **Gates**: `typecheck` + `lint` + `build` all green (20 routes). API 401s verified on the running dev server.

### Not done / next
- Chat history not persisted yet (schema has `chat_sessions`/`chat_messages`; `ChatShell` keeps messages client-side).
- No server-side image derivatives (thumb == display == uploaded image; client already downscales to ≤1600px). Add `sharp` later.
- Query-parser has no LLM fallback yet (rules only).
- Real AI: add `ANTHROPIC_API_KEY` (vision + chat) and `EMBEDDING_API_KEY` (Voyage) to `.env.local` — the adapters switch from fixtures automatically.
- Tests: still no Vitest/Playwright suite.
- Daily digest, action-item checkboxes, tag editing UI, `/today` data.

---

## 2026-09-04 — Foundation build

### Done
- **Repo**: renamed `Mirror MInd ` → `mirrormind`; `git init`; Next scaffold; deps installed (Supabase, Drizzle, Radix, sonner, motion, lucide, zod).
- **Design system**: full token set (warm-paper light + dark) in `app/globals.css` mapped to the shadcn variable names; Inter + JetBrains Mono; `container-px`, `bg-grain`, `animate-rise`/`fade-in` utilities. Primitives: button, card, badge, input, label, skeleton, separator, avatar, dropdown-menu, sheet, tooltip, sonner.
- **Brand**: `components/brand/logo.tsx` (gradient mark + wordmark), `public/favicon.svg`.
- **Marketing site** (`app/(marketing)/`): responsive header (scroll-aware, mobile sheet) + footer; landing page (hero with static "ask" preview, capture-types strip, 3-step how-it-works, evidence callout, 6 feature cards, 3 use-case columns, CTA) with scroll `Reveal` animation; `/pricing` (Free/Pro/Teams); `/privacy` + `/terms` (plain-language launch summaries).
- **Auth** (`app/(auth)/`): premium split-screen sign-in with rotating example quote; Google OAuth + email magic-link via Server Actions (`app/(auth)/actions.ts`); `app/auth/callback/route.ts` (PKCE exchange, sanitized `next`); `app/auth/sign-out/route.ts`; `proxy.ts` + `lib/supabase/middleware.ts` refresh session and guard `/capture|/timeline|/memory|/chat|/settings`, bounce signed-in users off `/sign-in`. Degrades gracefully when Supabase env is absent.
- **App shell** (`app/(app)/`): `requireUser()` gate; sidebar (desktop) / top bar + sheet (mobile); `UserMenu` with theme switch + sign-out. Screens: **Capture** (working webcam capture + drag/drop upload + client downscale + preview/retake; "Save to memory" stubbed pending pipeline), **Timeline** (filter bar UI + empty state), **Chat** (composer + suggestion chips + local echo, recall stubbed), **Today** (digest/action-item placeholders), **Memory/[id]** (skeleton), **Settings** (account info, export/delete disabled).
- **Data model**: `db/schema.ts` (all 13 tables + enums, uuid user ids → `auth.users`), `db/vector.ts` (pgvector custom type, `EMBEDDING_DIMS = 1024`), `db/index.ts` (lazy postgres.js client), `drizzle.config.ts`. `db/migrations/0000_init.sql`: extensions, enums, `profiles` + `handle_new_user` trigger, all tables + FKs + indexes (incl. HNSW cosine on `embeddings`, trigram on titles), `touch_updated_at` triggers, **RLS enabled + owner policies on every table** (join tables via parent-memory ownership), private `captures` storage bucket + object policies.
- **Config**: `lib/env.ts` (lazy zod validation, `publicEnv`, `isSupabaseConfigured`), `.env.example`, `next.config.ts` (Supabase image host, pinned turbopack root, `agentRules:false`), `.gitignore` keeps `.env.example`.
- **Misc**: `app/api/health`, `app/not-found.tsx`, `app/error.tsx`, `README.md`, `CLAUDE.md` + `AGENTS.md` (point at `docs/06-RULES.md`).
- **Gates**: `npm run typecheck` ✅ · `npm run lint` ✅ (0 warnings) · `npm run build` ✅ (14 routes).

### Not done / stubbed
- No Supabase project connected yet — migration not applied, auth not exercised end-to-end.
- Capture "Save to memory", Timeline data, Chat recall, Memory detail, Today digest, Settings export/delete — all UI-only.
- No AI adapters, no Route Handlers for `/captures`, `/memories`, `/chat`.
- No tests yet (Vitest + Playwright per [Test Plan](13-TEST-PLAN.md)).
- PWA manifest / service worker not added.

### Next (milestone: Recall)
1. Create Supabase project; run `0000_init.sql`; fill `.env.local`; verify sign-in + a row insert under RLS.
2. `lib/ai/`: `vision.ts`, `embeddings.ts`, `chat.ts` adapters behind interfaces + `DRY_RUN` fixtures ([Prompts](10-PROMPTS.md), [Rules](06-RULES.md) §"provider isolation").
3. Route Handlers: `POST /api/captures` (upload → Storage → `captures` row → background pipeline), SSE status, `GET /api/memories`, `POST /api/chat/...` ([API Spec](09-API-SPEC.md)).
4. Wire Capture panel → real upload; Timeline → `getDb()` query; Chat → retrieval + cited answer; Memory detail → structured card.
5. `scripts/seed-demo.ts` + a small retrieval eval ([Test Plan](13-TEST-PLAN.md)).
