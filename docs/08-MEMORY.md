# 08 — Project Memory

**Product:** Personal AI
**Purpose:** the living context an AI assistant (or a returning human) should load before working. Keep entries short, dated, and factual. Newest decisions on top of each list.
**Related:** every other doc. When something here changes a requirement, also change the source doc.

---

## 1. One-paragraph project state

Personal AI is **built and live in beta**: capture → AI extraction → structured memory → embeddings → cited recall works end to end (Next.js + Supabase Postgres/Drizzle/Auth/Storage/RLS), plus folders, chat history, Today digest, notifications, Telegram capture, and a public v1 API. Four additional modules were adapted from an earlier Firebase-oriented spec onto this stack: the deadline engine and finance tracking are fully live; the calling assistant and WhatsApp triage are wired on this app's side but each need a separately-hosted always-on process (a Twilio ConversationRelay handler, a passive Baileys listener — see `docs/modules/`) that isn't part of this repo by design. See [15-BUILD-LOG.md](15-BUILD-LOG.md) for the full, current history and [07-TRACKER.md](07-TRACKER.md) for status.

---

## 2. Glossary (project language)

| Term | Meaning |
|------|---------|
| **Capture** | One upload/webcam event. Owns the image files + pipeline `status`. |
| **Memory** | The processed, structured result of a Capture (text, `type`, `summary`, `structured` JSON). 1:1 with Capture in MVP. |
| **Chunk** | A retrievable text segment of a Memory (~300 tokens). One special chunk = `title + summary`. |
| **Structured payload** | `memories.structured` — a type-specific JSON object (timetable slots, notice dates, circuit components…). |
| **Type** | One of `notice, timetable, textbook_page, whiteboard, circuit, handwritten_note, slide, document, other`. |
| **Evidence / citation** | The original image + snippet shown with a chat answer. |
| **used_filters** | The temporal/type/tag constraints the query parser applied to a chat question. |
| **DRY_RUN** | Env mode where adapters return canned fixtures — offline dev + demo fallback. |
| **The demo question** | A single question needing timetable + circular + textbook page together. The "wow" moment. |

---

## 3. Decision log

| # | Date | Decision | Why | Alternatives rejected |
|---|------|----------|-----|-----------------------|
| DL-24 | 2026-09-04 | **Free AI default = Google Gemini** (`gemini-2.0-flash` + `gemini-embedding-001`@1024); Ollama for private local; Anthropic still supported. `AI_PROVIDER` env selects; `auto` prefers a free key | User asked for a free option. Gemini free tier is multimodal, JSON-mode, Vercel-compatible, one provider for vision+chat+embeddings. Ollama covers offline/private dev | Groq (no embeddings, only some vision models), Mistral free (smaller), HF Inference (flaky), OpenRouter free (rate-limited) |
| DL-23 | 2026-09-04 | **Free Gemini tier is dev-only**; must move to a paid key or self-host before real users | Google may train on free-tier content; contradicts our own privacy policy. Adapter interface makes the switch one env var | Launch on free tier (privacy violation), pay from day one (unnecessary in dev) |
| DL-22 | 2026-09-04 | **Foundation build order**: marketing site + auth + app shell + schema first; AI pipeline next session | User chose "Foundation first". A clickable, signed-in, on-brand product de-risks everything downstream and is the CV/market-facing surface | Core-loop-first (ugly until late), thin vertical slice |
| DL-21 | 2026-09-04 | **Supabase** for Postgres + `pgvector` + Auth + Storage; **RLS** is the security boundary | One managed service, no Docker needed, generous free tier; solo-maintainable. RLS `auth.uid() = user_id` on every table replaces the app-only owner filter as the hard guarantee | Neon + Clerk + Vercel Blob (3 services), self-managed VPS (ops burden) |
| DL-20 | 2026-09-04 | **Auth = Supabase Auth**, email magic link + Google OAuth, no passwords | "User-based" product per user's goal; magic link is premium-feeling and removes password handling/rules-compliance concerns | Clerk (cost as it grows), Auth.js self-host (more wiring) |
| DL-19 | 2026-09-04 | **Full TypeScript / Next.js 16 (App Router)** replaces the hackathon FastAPI+Docker+React/Vite plan (supersedes DL-2, DL-3, DL-4, DL-5) | Machine has no Docker/Homebrew and only Python 3.9; user has Vercel; solo ship-to-market. One language, one deploy. AI pipeline runs in Route Handlers / Server Actions behind adapter interfaces | Keep FastAPI (2 deploys, install Python 3.11), hybrid Next + thin Python API (2 languages) |
| DL-18 | 2026-09-04 | Project scope pivot: **market launch + CV project**, premium multi-user product — not a 1-day hackathon | User's explicit ask. Raises the bar on design, auth, and polish; the 8+6 spec docs remain the north star, but MVP non-goals N1 (no auth) is reversed | — |
| DL-17 | 2026-09-04 | Folder renamed `Mirror MInd ` → `personal-ai` | Trailing space + spaces break Vercel project names, git, shell tooling | Keep the name (constant friction) |
| DL-16 | 2026-09-04 | Vision extraction stays a single multimodal LLM call (carried from DL-6); embeddings default `voyage-3.5` @ 1024 dims; `EMBEDDING_DIMS` asserted == `vector(n)` column == `db/vector.ts` | Unchanged rationale; now enforced in `lib/env.ts` and `db/vector.ts` | — |
| DL-15 | 2026-09-04 | Drizzle ORM for typed queries, but the **hand-written SQL migration is authoritative** (`db/migrations/0000_init.sql`) | pgvector HNSW, RLS policies, `auth.users` triggers, and the storage bucket are cleaner in raw SQL than drizzle-kit generate | drizzle-kit generate only (weak on extensions/RLS), Prisma (pgvector + Supabase friction) |
| DL-14 | 2026-09-04 | Ship 6 extra docs (API Spec, Prompts, Demo Script, Security, Test Plan, Setup) alongside the 8 requested | Parallel build under time pressure needs frozen contracts, tuned prompts, a rehearsed demo, and an explicit security stance | Folding them into TRD (would bloat, get skimmed) |
| DL-13 | 2026-09-04 | `structured` stored as validated JSONB, `null` on validation failure | Keeps schema stable while allowing rich per-type cards; failure is non-fatal | Separate tables per type (too much for MVP), free-form text only (loses precision) |
| DL-12 | 2026-09-04 | Query parser = rules for common temporal/type phrases + one cheap LLM fallback | Deterministic + debuggable for the demo; LLM covers the long tail | Pure-LLM (opaque, slower), pure-rules (misses phrasing) |
| DL-11 | 2026-09-04 | Answers must cite memory IDs and show the image; "no memory" is an explicit answer | Trust is the product; hallucinated recall would kill the demo | Free-form answers without citations |
| DL-10 | 2026-09-04 | Retrieved memory text is inserted only as delimited, "untrusted" `CONTEXT` blocks; prompts forbid following instructions in it | Captured text is attacker-controlled (whiteboard could say "ignore instructions") | Trusting context, no framing |
| DL-9 | 2026-09-04 | `embeddings` is a separate table with `VECTOR(n)`; model+dims stored per row | Lets us swap embedding models with a re-embed script; keeps `chunks` light | Vector column on `chunks` directly |
| DL-8 | 2026-09-04 | pgvector HNSW, cosine; `k*3` candidates re-ranked in app (sim + recency + type-match) | Single store, good recall, cheap rerank; filters via join to `chunks` denormalized cols | Separate vector DB (extra service), IVFFlat (needs training/tuning) |
| DL-7 | 2026-09-04 | Denormalize `user_id`, `captured_at`, `type` onto `chunks`/`embeddings` | Filtered ANN without extra joins; every query filters owner | Joins at query time (slower, easy to forget owner filter) |
| DL-6 | 2026-09-04 | One vision LLM call does OCR + layout + classification + structuring; Tesseract only as fallback | Fewer moving parts, better handwriting + structure than classic OCR pipeline | Google Vision + separate LLM (2 calls, 2 keys), Tesseract-only (poor handwriting/structure) |
| DL-5 | 2026-09-04 | `BackgroundTasks` for the pipeline in MVP; `captures.status` already models a queue | No infra to run; clean upgrade path to Arq/Celery | Celery+Redis now (setup cost), synchronous (blocks request, slow UX) |
| DL-4 | 2026-09-04 | Local disk storage behind a `Storage` port; API streams files via `/files` | Zero setup for the hackathon; swap to S3 later without touching callers | S3/Supabase now (creds + config time) |
| DL-3 | 2026-09-04 | No auth in MVP; `X-User-Id` header defaults to `demo-user` | Saves ~a day; every query already filters `user_id` so auth slots in later | Clerk/Auth.js now |
| DL-2 | 2026-09-04 | FastAPI + Postgres + React/Vite; Docker Compose single host | Team familiarity, async, Pydantic, one-command bring-up | Next.js full-stack, SQLite+sqlite-vec, serverless |
| DL-1 | 2026-09-04 | Model Capture and Memory as separate rows (1:1 now) | Future: audio/video capture may yield multiple memories; keeps files vs content concerns separate | Single `captures` table holding everything |

---

## 4. Assumptions currently relied on

| # | Assumption | If false → |
|---|-----------|-----------|
| A1 | A reliable vision-LLM API key is available for the build + demo | Fall back to Tesseract path; structured cards degrade to text; pre-seed everything |
| A2 | Embeddings API available; dimension known and set in `EMBEDDING_DIMS` | Swap to a local `bge-small` (384-dim) + re-embed; update `VECTOR(n)` migration |
| A3 | Demo captures are legible English print/handwriting on flat-ish surfaces | Curate assets; add a "keep anyway (text-only)" path |
| A4 | Single user, single host is enough for the demo audience | Add a second Uvicorn worker; still fine |
| A5 | Postgres + pgvector runs via the pinned Docker image on the build machine | Documented manual install in [Setup](14-SETUP.md); or SQLite+sqlite-vec branch |
| A6 | Client can `getUserMedia` on the demo device/browser over `localhost` or HTTPS | Use upload path only; webcam is not on the critical demo path |

---

## 5. Open questions / risks (see [Tracker](07-TRACKER.md) §5–6 for status)

- Q1 Audio in Day 1? — default **no**.
- Q2 Storage backend for demo — default **local disk**.
- Q3 Show OCR confidence to users in MVP? — default **yes** (subtle dot).
- Q4 Temporal parsing depth — default **rules + LLM fallback**.
- Q5 Soft-delete retention — default **30 days**.
- R1 handwriting misreads · R2 API outage at demo · R3 temporal parse errors · R4 prompt injection · R5 pgvector setup friction · R8 scope creep.

---

## 6. Key file / name references (verify before relying on them)

- Backend module map: [Architecture](03-ARCHITECTURE.md) §3.
- Table names & columns: [Schema](05-SCHEMA.md) §3 (authoritative).
- Endpoint list: [API Spec](09-API-SPEC.md) §2.
- Prompt versions: [Prompts](10-PROMPTS.md) — bump `prompt_version` in `memories.model_meta` when changed.
- Env var names: [Setup](14-SETUP.md) §2 / `.env.example`.
- Enum values: `capture_status`, `memory_type`, `confidence_band`, `entity_kind`, `action_status`, `chat_role`.

---

## 7. Conventions cheat-sheet (full: [Rules](06-RULES.md))

- IDs = ULID text. Times = UTC internally, convert at edges to `user.tz` (default `Asia/Kolkata`).
- No vendor SDKs outside `api/adapters/`. Services use `protocols.py`.
- Every query filters `user_id` and `deleted_at IS NULL`.
- Captured text = untrusted; only in delimited `CONTEXT` blocks; never in system prompts.
- Never send >1600 px images to the vision adapter. Batch embeddings per capture.
- Update [Tracker](07-TRACKER.md) + this file on status/decision changes.

---

## 8. Session handoff notes

> Append a dated bullet at the end of each working session: what changed, what's next, any landmine.

- **2026-09-04** — Created document set v0.1 (14 docs). No code. Next: M0 (repo, compose, Alembic `0001_init`). Landmine to watch: keep `EMBEDDING_DIMS` and the `VECTOR(n)` column in lockstep — add the startup assert early.
- **2026-09-12** — Adapted a 4-module spec set (deadline engine, WhatsApp
  triage, calling assistant, finance tracking) that had been written for an
  unrelated Firebase/Firestore personal-agent concept onto this app's real
  Postgres+Drizzle+Next.js stack, per explicit user instruction. New
  migration `0017_deadlines_finance_calls_whatsapp.sql`; detail in
  `docs/modules/*.md` and `docs/15-BUILD-LOG.md`. Deadline engine and
  finance tracking are fully live (Gemini-backed, same `GOOGLE_API_KEY` this
  app already uses). Calling assistant and WhatsApp triage are wired on this
  app's side but each depends on a piece that structurally cannot live in a
  Vercel serverless deploy — a ConversationRelay WebSocket handler and a
  Baileys listener process, respectively — both documented as separate
  always-on processes to build/host, not stubbed or faked here. Landmine:
  don't confuse `deadlines` (new, source-agnostic) with the existing
  `action_items` (capture-derived only, untouched) — they're intentionally
  separate tables, not a migration of one into the other.
- **2026-09-04 (later)** — Scope pivoted to market/CV product (DL-18). Stack pivoted to full TS / Next.js 16 + Supabase (DL-19–21). **Foundation build shipped**: renamed folder to `personal-ai`, scaffolded Next app, design-token system (`app/globals.css`), shadcn-style primitives, marketing site (landing/pricing/privacy/terms), Supabase auth (magic link + Google) with `proxy.ts` session refresh + route guarding, authenticated app shell + Capture/Timeline/Chat/Today/Memory/Settings screens (UI complete, data pending), Drizzle schema + authoritative SQL migration (`db/migrations/0000_init.sql`) with RLS + pgvector + storage bucket. `typecheck`, `lint`, `build` all green. See `docs/15-BUILD-LOG.md`. **Next**: wire Supabase project + run migration; then the capture→extract→embed→recall pipeline (adapters in `lib/ai/*`, Route Handlers per `docs/09-API-SPEC.md`). Landmine: the AI adapters must keep captured text out of system prompts (DL-10).
