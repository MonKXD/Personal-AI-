# 07 — Tracker

**Product:** MirrorMind
**Legend:** ☐ todo · ◐ in progress · ☑ done · ⨯ cut/deferred · ⚠ blocked
**Related:** [PRD](01-PRD.md) · [TRD](02-TRD.md) · [Rules](06-RULES.md) · [Build Log](15-BUILD-LOG.md) — update this file whenever status changes.

> **2026-09-04 pivot** — no longer a 1-day hackathon. Now a market/CV product on **Next.js 16 + Supabase + Vercel** (see [Memory](08-MEMORY.md) DL-18–22). The hackathon hour-by-hour plan below is retained for reference but superseded by the milestones. Live status lives in [Build Log](15-BUILD-LOG.md).

---

## 0. Product milestones (current)

| ID | Milestone | Definition of done | Status |
|----|-----------|--------------------|--------|
| P0 | Foundation | Next app scaffolded; design system; marketing site; Supabase auth + route guard; app shell + all screens (UI); Drizzle schema + SQL migration; typecheck/lint/build green | ☑ 2026-09-04 |
| P1 | Data online | Supabase project created; `0000_init.sql` applied; `.env.local` set; sign-in works end-to-end; an RLS-protected insert/read verified | ☑ 2026-09-04 — `check:db` green, sign-in confirmed, `test:pipeline` writes+reads under real Supabase |
| P2 | Capture pipeline | `POST /api/captures`: upload → Storage → `captures` row → `after()` vision extract → `memories` + entities + tags + chunks + embeddings → status poll; Capture UI wired; Timeline + Memory detail render real data | ☑ 2026-09-04 (DRY_RUN fixtures; real AI on key add). `test:pipeline` verified end to end |
| P3 | Recall | Retrieval (filtered pgvector cosine + rerank) + cited answers + evidence thumbnails; Chat UI wired; rule-based query parser (temporal/type) | ☑ 2026-09-04 — `POST /api/chat` + `ChatShell`. Follow-ups: chat history persistence, LLM query-parser fallback |
| P4 | Polish & launch | Daily digest, action items, `seed-demo` + retrieval eval, tests (Vitest/Playwright), PWA, error/empty/loading pass, deploy to Vercel + custom domain | ◐ 2026-09-04 — chat history persisted; Today digest + action-item checklist; **deployed to Vercel** (mirror-mindai.vercel.app); PWA manifest + icons + install prompt + Web Share Target + offline shell (2026-09-05); weekly digest + due-soon reminder emails via Resend (2026-09-05); global search / Cmd+K, collections, memory linking, text-correction UX (2026-09-05); motion pass; **Vitest suite (37 tests)**; tag-editing UI; `loading.tsx` skeletons for app routes; **seed-demo ☑** (`npm run seed:demo`) + **retrieval eval ☑** (`npm run eval` — recall@k / MRR / citation-F1, `.github/workflows/eval.yml`). **Beta launched 2026-09-09** (see P8 — invite sent, end-to-end smoke green on live prod). Left: Playwright smoke, custom domain, paid AI key |
| P5 | v0.2 | Audio capture + transcription, cross-memory linking, conflict-aware answers, Teams spaces | ◐ 2026-09-07 — audio + transcription ☑ · cross-memory linking ☑ · auto-linking ☑ · **conflict-aware answers** ☑ (2026-09-07) · Teams spaces ☐ (own project — multi-tenancy + sharing) |
| P6 | Document capture | Upload PDF / Word / PowerPoint → deep text extraction (Gemini native PDF; `officeparser` for DOCX/PPTX) → same memory/chunk/embed/recall pipeline; direct-to-Storage upload (bypasses Vercel's 4.5MB body limit); thumbnail rendering generalized from `voice_note` to `mime` | ☑ 2026-09-06 — PR #2 merged; verified end to end against real Gemini (`npm run test:documents -- --real`); production deploy green. **+ 2026-09-07: URL capture** (`0010`, SSRF-guarded `fetchReadable`, `text/plain` pipeline branch) |
| P7 | Free-tier beta | Open sign-ups (link = access) capped at `MAX_USERS` (10) with graceful "at capacity"; owner-only Members admin to remove users / free seats; shared per-day Gemini call budget (`ai_call_log`, migration 0006) past `DAILY_AI_CALL_BUDGET`; per-user daily capture cap 15; new landing page (3-tier pricing, feature walkthrough, FAQ); "quietly expressive" UI redesign; seeded read-only demo account; Vercel Analytics; in-app privacy line | ◐ 2026-09-07 — safeguards ☑ (0006); redesign 5 slices ☑ (warm-dark; 0007 accent picker); landing + pricing + walkthrough ☑; Vercel Analytics ☑ (enabled + collecting, `hasData:true`); Speed Insights ⨯ (Pro-only, 402 on Hobby); privacy line ☑; onboarding→capture ☑; shortcuts + week strip ☑; **seeded demo account ☑** (`npm run seed:demo`, read-only guards, one-click sign-in); **open sign-ups + Members admin ☑** (`52f847b`); camera + `stillAllowed` auth bugs fixed; Vercel env all set + redeployed. **Left:** folder colour+emoji; pinned shelf; light-mode wiring |
| P9 | UI reskin | Recreate the Claude Design handoff (`MirrorMind.dc.html`) across marketing + app: Bricolage Grotesque + Sora, cream/violet/teal palette (light primary, dark retuned), pill controls, aurora, new landing hero + app shell; remove the accent-colour picker | ☑ 2026-09-09 — 12 verified slices on `redesign/bricolage-sora`, merged `1065a69`, live on prod (`o61g25mqk`). Fonts swapped via `next/font`; `defaultTheme` dark→light; `lib/accent.ts` deleted (`profile_prefs.accent` column left unused); `FeatureWalkthrough` dropped from landing. Gate green every slice (typecheck/lint/build 37 pages + audit 29/29 + 41 tests); authed dev walkthrough clean. **Follow-ups shipped:** animated `FeatureWalkthrough` restored + restyled, re-added as `#walkthrough` (`977292d`); **new brand mark** (`3ae220d`) — violet "mind" sphere w/ cream+teal hemispheres from `MirrorMind Logo Final.dc.html`, `Orb` → inline SVG, favicon + all app/extension PNG icons regenerated via `sharp`, verified live. Remaining (cosmetic): a few app panels still `rounded-2xl`, some eyebrow labels not pixel-exact. See [Build Log](15-BUILD-LOG.md) 2026-09-09 |
| P8 | Depth & integrations | Retrieval eval harness; calendar (.ics) feed; public share link per memory; URL / web-page capture; public REST API + personal tokens; outbound webhooks | ☑ 2026-09-09 — **eval harness ☑** (`npm run eval`, recall@k/MRR/citation-F1, weekly workflow); **calendar feed ☑** (0008, `/api/calendar/<token>`, Settings → Calendar); **share link ☑** (0009, `/m/<id>`, noindex + OG); **URL capture ☑** (0010, SSRF-guarded `fetchReadable`); **public API ☑** (0011, `/api/v1/{me,captures,memories,ask,action-items}`, Bearer tokens, `docs/16-API.md`); **webhooks ☑** (0012, `capture.completed` / `memory.created` / `action_item.due_soon` / `digest.weekly`, HMAC-signed, auto-disable at 15 fails); **browser extension ☑** (`extension/`, MV3, popup + context menus → `/api/v1/captures`, verified vs live API); **pre-deploy hardening ☑** — storage cleanup on memory delete + `sweep:orphans`; Sentry wired (inert without DSN); in-app "Report a problem" (0013 `feedback` + owner bell + `/settings/feedback`); Privacy/Terms rewritten honest for the free-tier beta. **Features ☑** — pinned shelf + folder colour/emoji (0014); related-memory graph (`/graph`); Markdown + Anki export; light theme wired + Settings toggle. **Integrations ☑** — AI chat fallback (`FallbackChatModel` → any OpenAI-compatible endpoint, chat only, on `FALLBACK_AI_KEY`); Web Push (0015 `push_subscriptions`, VAPID, `sw.js` push listeners, Settings PushToggle); Zapier CLI app (`zapier/`, 3 triggers + 2 actions, `/api/v1/webhooks` REST hooks); Telegram capture bot (0016 `telegram_links`, `/api/telegram/webhook`, `/start` link code, photo/PDF/link/note → capture, Settings Connect). Migrations 0006–0016 applied + verified; audit 29/29; **41 tests**; typecheck/lint/build clean. **Launch-day bugfix (`355a9c3`):** `tzOffsetMs()` leaked sub-second drift into the day bucket key → `ai_call_log` had 160 `calls:1` rows and `DAILY_AI_CALL_BUDGET` never actually counted; rounded the offset to the whole minute, added `lib/time.test.ts`, collapsed the stray rows (177 calls preserved), verified live (one call bumps the single bucket, no new row). **Live in prod (2026-09-09):** Sentry (`SENTRY_DSN` set, client SDK confirmed initialised); AI chat fallback (`FALLBACK_AI_KEY` set → OpenRouter free Llama-3.3-70B, wiring re-verified); Supabase auth hardened — anon sign-ins **off** (`anonymous_provider_disabled` confirmed) + Site URL set, magic-link sign-in re-verified end to end against live prod; `sweep:orphans --apply` run → **0 orphaned** (bucket already clean); **end-to-end smoke on live prod** as the owner (magic-link SSR session → photo capture → pipeline `ready` in ~18 s → chat answer correct + cited the new memory → delete-with-cleanup), test memory removed. **🚀 LAUNCHED 2026-09-09** — WhatsApp invite sent to the beta cohort (~10 users; `MAX_USERS=10` caps the 11th with a graceful "at capacity"). First-week watch: Sentry, daily Gemini calls vs `DAILY_AI_CALL_BUDGET=800`, seat count. **Telegram capture bot LIVE (2026-09-09)** — `TELEGRAM_*` set in Vercel, webhook registered via new owner-only `POST /api/telegram/register` helper (`1a44abf`; token stays server-side), full E2E verified against prod (`/start` link, text→capture→memory, url→capture, bad-secret 403, unlinked-chat no-op); register-route 401 fix `8b00c67`. Reskin polish: leftover pre-reskin `rgba(154,141,255,…)` glows + the mobile FAB's old-dark-ground ring converted to tokens (`0df5007`). Bug sweep + authed dev walkthrough of every route — all green, zero console errors. **Web Push LIVE (2026-09-09)** — 4×`VAPID_*` set in Vercel, redeployed `b0qm7g3bb`; verified on prod: `pushEnabled()` true → PushToggle renders, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` inlined client-side, `sendPush()` wired to `cron/reminders` + `cron/digest`. **Open-original link (`30359ab`, 2026-09-10)** — memory detail page now surfaces an "Open PDF / Word / PowerPoint" link (signed `originalKey`) for uploaded document captures, covering Telegram-sent PDFs; verified live. Known doc limit: 20 MB Telegram bot-download cap. **Telegram auto-file (`ed8db81`, 2026-09-10)** — bot captures land in a "From Telegram" ✈️ folder (`getOrCreateFolder`, folderId threaded through the text/url capture fns); shows on `/folders` + tree + counts like any folder; E2E-verified on prod (folder auto-created, memory filed, no dup on repeat). **Server-side PDF page-1 thumbnails (`5aabdff`, 2026-09-10)** — pipeline step 1c rasterises page 1 via `mupdf` (WASM) for captures with no client render (Telegram / share / API) → `processImage()` → `display.jpg`/`thumb.jpg`; closes the long-deferred "Real PDF thumbnails" item; E2E-verified on prod (server-path PDF → memory shows a rendered JPEG thumb). Only remaining owner step (post-launch, not blocking): `zapier push` |

---

## 1. Milestones (original hackathon plan — superseded, kept for reference)

| ID | Milestone | Definition of done | Target | Status |
|----|-----------|--------------------|--------|--------|
| M0 | Repo + infra up | `docker compose up` brings db+api+web; `/healthz` green; migrations applied | Day 1, H2 | ⨯ replaced by P0/P1 |
| M1 | Capture path | Upload/webcam → file stored → `captures` row → SSE status to `ready` (extraction stubbed) | Day 1, H4 | ⨯ → P2 |
| M2 | Understanding | Real vision extraction → `memories` + entities + tags + structured card renders | Day 1, H7 | ⨯ → P2 |
| M3 | Recall | Chunk+embed on ingest; chat retrieves + answers with citations + evidence image | Day 1, H10 | ⨯ → P3 |
| M4 | Demo-ready | 3 seeded artifacts; multi-source question answers correctly; fallbacks tested; script rehearsed | Day 1, H12 | ⨯ → P4 |
| M5 | v0.2 polish | Stretch items, PWA install, audio capture | Post-hackathon | ⨯ → P5 |

---

## 2. One-day hour-by-hour plan

> Assumes a 12-hour build with 2 people (BE = backend, FE = frontend). Solo: skip FE polish, use a minimal UI.

| Hour | BE | FE | Exit check |
|------|----|----|-----------|
| H0 | Scaffold `api`, compose, `.env`, Alembic `0001_init`, `pgvector` extension | Scaffold `web` (Vite+TS+Tailwind+shadcn), routes, AppShell | `docker compose up` runs; `/healthz` 200; blank app loads |
| H1 | `Storage` (local disk), `POST /captures` (validate, resize, store, insert `queued`), `/files` route | `CapturePanel`: upload + webcam grab; client downscale; POST | New capture row + files on disk; thumb visible |
| H2 | Event bus + SSE `/captures/:id/events`; pipeline skeleton with fake extractor; status transitions | `ProcessingCard` + `PipelineStepper` subscribed to SSE; `RecentStrip` | Capture goes `queued→…→ready` with fake data; UI ticks steps |
| H3 | `vision_llm` adapter (real call) + `Extraction` DTO + Pydantic validation + Tesseract fallback | `MemoryDetail` shell: image + text block + entity chips | Real image → real extracted text + type in DB |
| H4 | `structured` per-type models + `tagging` + `entities` persist; `GET /memories/:id`, `GET /memories` | `StructuredCard` variants (notice, timetable grid, textbook) | Structured card renders for a real notice + timetable |
| H5 | `embedder` adapter + chunking + `chunks`/`embeddings` insert; HNSW index | `TimelineView` + `FilterBar` (date + type) | Chunks+vectors exist for each memory; timeline filters work |
| H6 | `query_parser` (temporal + type rules); `retriever` (filtered ANN + rerank) | `ChatView` + `Composer` + `MessageList` + suggestion chips | `POST /chat/.../messages` returns ranked chunks (log) |
| H7 | `answerer` (context blocks, cite ids, no-memory path); `POST /chat/sessions`, messages; SSE token stream | `AssistantMessage` markdown + `CitationChip` + `SourcesRow` + `MemoryDrawer` | Ask a question → streamed answer + working citation → drawer image |
| H8 | `seed_demo.py`; ingest 3 demo assets + 4 distractors; `eval_retrieval.py` | `FiltersUsed` line; empty/error states; mobile layout pass | All seeds `ready`; eval hit-rate ≥ 0.85; scripted Qs pass |
| H9 | Harden: retries, timeouts, `DRY_RUN` fixtures, `/captures/:id/retry`, idempotency | Polish: motion, confidence dot, a11y focus, keyboard shortcuts | Kill network → `DRY_RUN` still demos; retry works |
| H10 | `backup.sh`; run full pre-demo checklist ([TRD](02-TRD.md) §11) | Final visual QA on the demo device/screen size | DB snapshot saved; demo device rehearsed |
| H11 | Buffer / bugfix | Buffer / bugfix | — |
| H12 | **Demo** | **Demo** | 🎤 |

---

## 3. Backlog — MVP (grouped)

### Infra / platform
- ☐ P-1 `docker-compose.yml` (db=pgvector/pgvector:pg15, api, web)
- ☐ P-2 `.env.example` + `Settings` with fail-fast + `EMBEDDING_DIMS==VECTOR(n)` assert
- ☐ P-3 Alembic `0001_init` (all tables/enums/triggers/indexes from [Schema](05-SCHEMA.md))
- ☐ P-4 `core/`: ids (ULID), events bus, errors→problem+json, logging
- ☐ P-5 `/healthz`, `/readyz` (db + storage + one adapter ping)
- ☐ P-6 CI: ruff, mypy, pytest, eslint, tsc, web build, `alembic upgrade head`

### Capture
- ☐ C-1 `Storage` port + `LocalDiskStorage`
- ☐ C-2 `POST /captures`: sniff MIME, ≤15MB, ≤8000px; HEIC→JPEG; strip EXIF (keep orientation); drop GPS unless `geo_consent`
- ☐ C-3 Derivatives: `display.jpg` (≤1600px), `thumb.jpg` (≤320px); store keys + dims + sha256
- ☐ C-4 Insert `captures` (`queued`), `idempotency_keys`; enqueue background job
- ☐ C-5 `GET /captures/:id`, `GET /captures` (recent)
- ☐ C-6 SSE `GET /captures/:id/events`; poll fallback
- ☐ C-7 `POST /captures/:id/retry` (cascade-clean + re-run from extract)
- ☐ C-8 FE `CapturePanel` (DropZone, WebcamView, ShutterButton) + client downscale (`lib/image.ts`)
- ☐ C-9 FE `ProcessingCard`/`PipelineStepper` + `RecentStrip` + empty/error states

### Understanding
- ☐ U-1 `adapters/vision_llm.py` + prompt from [Prompts](10-PROMPTS.md) v1; JSON parse + `Extraction` validation
- ☐ U-2 `adapters/ocr_tesseract.py` fallback; `extractor` flag on memory
- ☐ U-3 `services/extractor.py` orchestration + timings
- ☐ U-4 Per-type `structured` Pydantic models + validation-or-null
- ☐ U-5 `services/tagging.py` (type + subject + keyword → `tags`/`memory_tags`)
- ☐ U-6 Persist `entities` (normalize dates→ISO, phones→E.164)
- ☐ U-7 `action_items` from entities (`kind in deadline,date`) *(stretch gate)*
- ☐ U-8 FE `MemoryDetail` + `StructuredCard` variants + `EntityChips` + `TagEditor`

### Recall
- ☐ R-1 `services/chunker.py` (~300 tok, 15% overlap, + summary chunk)
- ☐ R-2 `adapters/embeddings.py` (batch) + insert `chunks`/`embeddings`
- ☐ R-3 HNSW index + `hnsw.ef_search` session set
- ☐ R-4 `services/query_parser.py` (temporal + type + tag rules; LLM fallback)
- ☐ R-5 `services/retriever.py` (filtered SQL + rerank + dedupe by memory)
- ☐ R-6 `services/answerer.py` (context blocks, tool-call answer, cite ids, no-memory path, injection guardrail)
- ☐ R-7 `POST /chat/sessions`, `POST /chat/sessions/:id/messages` (SSE stream), `GET .../messages`
- ☐ R-8 Persist `chat_messages` with `citations`, `used_filters`, `retrieval_debug`
- ☐ R-9 FE `ChatView`, `AssistantMessage`, `CitationChip`, `SourcesRow`, `MemoryDrawer`, `FiltersUsed`, suggestion chips

### Browse
- ☐ B-1 `GET /memories` with `after/before/types/tags/q`, cursor pagination
- ☐ B-2 FE `TimelineView` + `FilterBar` + `MemoryCard` + `ConfidenceDot`
- ☐ B-3 `PATCH /memories/:id` (tags; `corrected_text` re-embed *(stretch)*), `DELETE` soft

### Demo / quality
- ☐ D-1 `scripts/seed_demo.py` + demo assets (self-made: timetable, circular, textbook page, 4 distractors)
- ☐ D-2 `docs/assets/eval/qa.jsonl` + `scripts/eval_retrieval.py`
- ☐ D-3 `DRY_RUN` fixtures for all adapters
- ☐ D-4 `scripts/backup.sh`; pre-demo checklist run
- ☐ D-5 Rehearse [Demo Script](11-DEMO-SCRIPT.md) end-to-end twice

---

## 4. Backlog — post-MVP (v0.2+)

- ☑ Audio capture (`getUserMedia` audio) + Gemini transcription + same pipeline — 2026-09-05 (PR #1)
- ☑ Document capture — PDF / Word / PowerPoint upload + deep text extraction + same pipeline — 2026-09-06 (PR #2)
- ☑ Direct-to-Storage capture upload (signed URL) — bypasses Vercel's hard 4.5MB function-body limit — 2026-09-06
- ☑ Stretch S1 action-item checklist UI + `PATCH /api/action-items/:id` — 2026-09-04
- ☑ Stretch S2 `Today` digest screen + weekly digest email (Resend) — 2026-09-04 / 2026-09-05
- ☑ Stretch S3 text correction UX + re-embed on save — 2026-09-05
- ☑ PWA: manifest + install prompt + Web Share Target + offline shell — 2026-09-05
- ☑ `memory_links` (manual link picker) + Related UI + collections — 2026-09-05
- ☐ `memory_links` *auto*-builder (embed-similarity + subject match)
- ☐ Conflict-aware answers ("newer timetable supersedes…")
- ☑ Real PDF thumbnails — render page 1 server-side (`mupdf` WASM, pipeline step 1c) — 2026-09-10 (`5aabdff`)
- ☐ OCR embedded images in DOCX/PPTX; legacy `.doc`/`.ppt`; citation-level page/paragraph highlighting *(document-capture follow-ups — see [Build Log](15-BUILD-LOG.md) 2026-09-06)*
- ☐ Privacy: local-only mode, face blur, PII redaction on stored images, per-memory private flag
- ☐ `S3Storage` adapter + pre-signed URLs
- ☐ Real auth (Auth.js/Clerk) + per-user isolation tests
- ☐ Background worker (Arq) replacing `BackgroundTasks`
- ☐ Browser extension "clip this"

---

## 5. Risk register (live)

| # | Risk | Owner | Mitigation status |
|---|------|-------|-------------------|
| R1 | Handwriting misread in demo | BE | ☐ curate legible assets · ☐ pre-cache pipeline output · ☐ show confidence |
| R2 | External API outage at demo time | BE | ☐ seed memories · ☐ `DRY_RUN` fixtures · ☐ recorded video |
| R3 | Temporal parsing wrong | BE | ☐ rules for top phrases · ☐ show `used_filters` · ☐ date chips |
| R4 | Prompt injection via captured text | BE | ☐ delimited untrusted context · ☐ guardrail prompt · ☐ eval case |
| R5 | pgvector/compose friction | BE | ☐ pinned image · ☐ [Setup](14-SETUP.md) verified on a clean machine |
| R8 | Scope creep | PM | ☐ non-goals enforced · ☐ stretch gated behind M3 |

---

## 6. Decisions needed (mirror of [PRD](01-PRD.md) §11)

| # | Decision | Status |
|---|----------|--------|
| Q1 | Audio in Day 1? | ☐ default: **no** |
| Q2 | Local disk vs Supabase storage | ☐ default: **local disk** |
| Q3 | Show OCR confidence in MVP? | ☐ default: **yes, subtle dot** |
| Q4 | Temporal parse: rules vs LLM | ☐ default: **rules + LLM fallback** |
| Q5 | Soft-delete retention | ☐ default: **30 days** |

---

## 7. Changelog

| Date | Change |
|------|--------|
| 2026-09-07 | **Folders** (replaces Collections) — single-home, nestable, Unfiled bucket, migration 0004. All 4 phases shipped: tree page + CRUD + nav, move-to-folder + folder pick at capture, bulk move on Timeline, and an AI folder suggestion (never auto-applied). Verified vs real Gemini. |
| 2026-09-06 | **Enhancement batch** — open sign-ups (`INVITE_ONLY` flag) + chat rate limit; **streaming chat answers** + short-term follow-up context; full-screen image lightbox; **auto-linking** new memories to nearest neighbours; "Needs review" queue on Today. Chat type-keywords now bias ranking, not hard-filter. PWA SW disabled in dev. PDF page-1 thumbnails deferred (pdfjs CVE + open sign-ups). See build log. |
| 2026-09-06 | **P6 Document capture** shipped (PR #2) — PDF / Word / PowerPoint upload, deep text extraction, direct-to-Storage upload removing the 4.5MB limit, `mime`-based thumbnail rendering. Verified against real Gemini; production deploy green. |
| 2026-09-05 | P5 partly done — audio capture + transcription (PR #1), cross-memory linking. Backlog: PWA (share target + install + offline), Resend digest/reminder emails, global search / Cmd+K, collections, text-correction UX all ☑. Fixes: chat date-filter crash, 6 review-pass bugs, ECONNRESET on long-lived DB connections. |
| 2026-09-04 | Document set v0.1 created; trackers seeded, all items ☐ |
