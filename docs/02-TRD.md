# 02 — Technical Requirements Document (TRD)

**Product:** Personal AI
**Version:** 0.1 (MVP)
**Related:** [PRD](01-PRD.md) · [Architecture](03-ARCHITECTURE.md) · [Schema](05-SCHEMA.md) · [API Spec](09-API-SPEC.md)

---

## 1. Purpose & scope

Defines the technical solution for the MVP described in the [PRD](01-PRD.md): stack, components, data flow, interfaces, non-functional engineering requirements, and risks. Implementation-level detail (diagrams, exact request shapes, DDL) lives in [Architecture](03-ARCHITECTURE.md), [API Spec](09-API-SPEC.md), and [Schema](05-SCHEMA.md).

---

## 2. System context

```
            ┌────────────┐        HTTPS/JSON        ┌──────────────┐
  Browser ──│  Web (SPA) │ ───────────────────────▶ │  API (FastAPI)│
  (webcam / │  React PWA │ ◀─────────────────────── │              │
   upload)  └────────────┘        SSE (status)      └──────┬───────┘
                                                           │
                          ┌────────────────────────────────┼───────────────┐
                          ▼                ▼                ▼               ▼
                   ┌────────────┐   ┌────────────┐   ┌────────────┐  ┌────────────┐
                   │ Postgres + │   │  Object    │   │  Vision    │  │ Embeddings │
                   │  pgvector  │   │  storage   │   │  LLM API   │  │   API      │
                   └────────────┘   └────────────┘   └────────────┘  └────────────┘
                                                          │
                                                     ┌────────────┐
                                                     │  Chat LLM  │
                                                     │   API      │
                                                     └────────────┘
```

---

## 3. Technology stack & rationale

| Layer | Choice | Rationale | Alternatives considered |
|---|---|---|---|
| Web | React + Vite + TS + Tailwind + shadcn/ui | Fast HMR, component velocity, PWA-ready | Next.js (heavier for a SPA), SvelteKit |
| State/data fetching | TanStack Query + Zustand (light UI state) | Cache + background refetch for status polling | Redux (overkill) |
| API | FastAPI + Uvicorn (Python 3.11) | Async, Pydantic validation, first-class with ML SDKs | Node/Express, Flask |
| Task execution | FastAPI `BackgroundTasks` for MVP; interface ready for a real queue | No infra to run; single host | Celery + Redis, RQ, Arq (v0.2) |
| DB | PostgreSQL 15 + `pgvector` 0.7+ | One store for relational + vector; HNSW index | SQLite + `sqlite-vec` (simpler, weaker filtering), Chroma/Qdrant (extra service) |
| ORM / migrations | SQLAlchemy 2.0 + Alembic | Standard, async support | Prisma (Py support immature), raw SQL |
| Object storage | `Storage` port with `LocalDiskStorage` impl | Zero setup for demo | S3, Supabase Storage, MinIO (v0.2 via `S3Storage`) |
| Vision extraction | Claude `claude-sonnet-5`, image + JSON instructions | One call yields text + layout + structure + classification; strong on handwriting | Google Vision + separate LLM, GPT-class vision, Tesseract-only |
| Fallback OCR | `pytesseract` + `pdf2image`/`Pillow` | Works offline, no key; degrade gracefully | EasyOCR (heavier) |
| Embeddings | `voyage-3.5`, 1024-dim, cosine | Strong retrieval quality; configurable | `text-embedding-3-small` (1536-dim), local `bge-small` |
| Chat / RAG | Claude `claude-sonnet-5`, tool-call for structured answer | Good instruction-following for "only use context + cite" | Same alternatives as vision |
| Transcription (v0.2) | `whisper-1`-class API | Simple, good enough | local `faster-whisper` |
| Auth (MVP) | none; `X-User-Id` header defaulting to `demo-user` | Removes a day of work | Clerk/Auth.js (v0.4) |
| Packaging | Docker Compose: `db`, `api`, `web` | One command bring-up | bare-metal |
| Config | `pydantic-settings`, `.env` | Typed config | os.environ |

Full decision log with dates: [Memory](08-MEMORY.md).

---

## 4. Components & responsibilities

### 4.1 Web app (`/web`)
- Routes: `/` (capture + recent), `/timeline`, `/memory/:id`, `/chat`.
- `CapturePanel`: file input + `getUserMedia` webcam grab; client-side downscale via `createImageBitmap` + canvas before upload; sends `captured_at`, optional geo.
- Status: subscribe to `GET /api/v1/captures/:id/events` (SSE) until `ready`/`failed`.
- `ChatView`: message list, streaming answer, citation chips → open `MemoryDrawer`.
- `TimelineView`: virtualized list/grid, filter bar.
- Offline: none (MVP). PWA manifest present but no service worker caching of API.

### 4.2 API (`/api`)
Modules:
- `routers/captures.py` — create, get, list, SSE events, retry.
- `routers/memories.py` — get, list/search, patch (tags, corrected text), soft-delete.
- `routers/chat.py` — create session, post message (streaming), list messages.
- `routers/action_items.py` — list, patch done. *(stretch)*
- `routers/digest.py` — `GET /digest?date=` generated summary. *(stretch)*
- `services/pipeline.py` — orchestrates extract → structure → entities → chunk → embed → persist; emits status events.
- `services/classifier.py`, `services/extractor.py`, `services/embedder.py`, `services/retriever.py`, `services/answerer.py`.
- `services/query_parser.py` — parse temporal/type/tag filters from a question (rules + a small LLM fallback).
- `adapters/` — `vision_llm.py`, `chat_llm.py`, `embeddings.py`, `ocr_tesseract.py`, `storage.py` (all behind protocols).
- `db/` — SQLAlchemy models, Alembic migrations, session.
- `core/` — config, logging, errors, ids (ULID), events bus (in-proc pub/sub for SSE).

### 4.3 Data stores
- Postgres: all entities (see [Schema](05-SCHEMA.md)).
- Object storage: `uploads/{user}/{capture_id}/original.{ext}`, `.../display.jpg`, `.../thumb.jpg`.

### 4.4 External services (behind adapters)
- Vision LLM, Chat LLM, Embeddings, (v0.2) Transcription. All have: timeout, 2 retries w/ jittered backoff, circuit-breaker-lite (skip to fallback after N consecutive failures within a window), and a `DRY_RUN` mode returning fixtures for offline dev/tests.

---

## 5. Processing pipeline (capture → memory)

Detailed sequence in [Architecture](03-ARCHITECTURE.md) §4. Summary:

1. **Ingest** — validate file, store original, generate `display.jpg` + `thumb.jpg`, insert `captures` row (`status=queued`), enqueue background job, return `201` with capture id.
2. **Classify + extract (single vision call)** — input: `display.jpg`. Output JSON: `{type, type_confidence, text, ocr_confidence, title, summary, structured, entities[]}`. Validate with Pydantic; on invalid/failed → Tesseract text, `type=other`.
3. **Persist memory** — insert `memories` row, `entities`, derived `tags`, `action_items` (from entities with `kind in (deadline,date)`).
4. **Chunk** — split `text` into ~300-token windows, 15% overlap; always include one chunk = `title + "\n" + summary`.
5. **Embed** — batch embed chunks; insert `chunks` + `embeddings` (vector column).
6. **Finalize** — `captures.status=ready`; emit SSE `ready`.
Failures at any step: `status=failed`, `error_code`, SSE `failed`; `POST /captures/:id/retry` restarts from step 2.

---

## 6. Retrieval & answer flow (chat)

1. `POST /chat/sessions/:id/messages { text }`.
2. `query_parser` → `{ cleaned_query, filters: { after?, before?, types?[], tags?[] } }`.
3. `retriever`:
   - embed `cleaned_query`;
   - `SELECT ... FROM chunks JOIN embeddings ... WHERE <filters> ORDER BY embedding <=> :q LIMIT :k*3`;
   - re-rank: cosine score − recency bonus − type-match bonus; take top `k` (default 8), dedupe by memory (max 2 chunks/memory).
   - If best score < `MIN_SIM` (0.2 cosine sim) and no filter hits → empty context.
4. `answerer`: system prompt = "answer only from context, cite memory ids, say you don't remember if not present"; user message = question + numbered context blocks (each: memory id, type, captured_at, snippet). Model returns `{answer, citations:[memory_id...], used_structured?:bool}` via tool-call; stream the `answer` text token-by-token, then attach citation objects (hydrated with title + thumb URL).
5. Persist `chat_messages` (user + assistant, with `citations` jsonb, `retrieval_debug` jsonb).

---

## 7. Interfaces

- **HTTP/JSON** REST under `/api/v1`; full contract in [API Spec](09-API-SPEC.md).
- **SSE** `text/event-stream` for capture status and (optionally) chat token streaming; fallback to polling `GET /captures/:id` every 1.5 s if SSE drops.
- **Adapter protocols** (Python `Protocol`): `VisionExtractor.extract(image_bytes) -> Extraction`, `Embedder.embed(list[str]) -> list[Vector]`, `ChatModel.answer(system, messages, tools) -> Answer`, `Storage.put/get/url`, `Ocr.read(image_bytes) -> str`.

---

## 8. Non-functional engineering requirements

| Area | Requirement |
|---|---|
| Performance | Pipeline steps run in background; API request handlers do no blocking model calls except chat. Vision call timeout 30 s; embeddings 20 s; chat 30 s. Image downscale on client and again server-side (never send >1600 px to vision). |
| Concurrency | Single Uvicorn worker for MVP is fine (≤ few concurrent users). Background tasks capped at `MAX_INFLIGHT_JOBS=4` via a semaphore; excess stays `queued`. |
| Idempotency | `POST /captures` accepts `Idempotency-Key`; duplicate key returns the original capture. Pipeline steps are re-runnable (upserts keyed by capture/memory id). |
| Observability | Structured JSON logs with `request_id`, `capture_id`; timing per pipeline step; `/healthz` (liveness) and `/readyz` (db + storage + one adapter ping). Minimal `/metrics` counter dict. |
| Error handling | Typed errors → RFC7807-ish JSON `{error_code, message, detail?}`. User-facing failure states always offer retry. No secrets/PII in logs or error bodies. |
| Config | All tunables via env (`.env.example` in [Setup](14-SETUP.md)); no hardcoded keys, models, or dimensions. |
| Security | See [Security & Privacy](12-SECURITY-PRIVACY.md). Highlights: CORS locked to web origin; upload MIME/size/dimension validation + re-encode images (strip EXIF except orientation; drop GPS unless user opted in); captured text is data, never instructions — passed only in clearly delimited context blocks; parameterized SQL only. |
| Testing | Unit (services with fake adapters), contract (adapter fixtures), integration (pipeline end-to-end with `DRY_RUN`), retrieval eval script. See [Test Plan](13-TEST-PLAN.md). |
| Data lifecycle | Soft-delete → hard-delete job after 30 days removes rows + files. `DELETE /memories/:id?hard=true` for demo cleanup. |
| Portability | No provider SDK types leak past `adapters/`. Swapping embeddings model = change 2 env vars + re-embed migration script `scripts/reembed.py`. |
| Accessibility/i18n | UI strings centralized; English only MVP; semantic HTML; focus management on drawer/dialog. |

---

## 9. Deployment

- **MVP:** `docker compose up` on one machine (laptop or a small VM). Services: `db` (postgres+pgvector image), `api`, `web` (nginx serving built SPA, proxying `/api`). Volumes: `pgdata`, `uploads`.
- **Env:** `.env` loaded by compose; secrets not committed.
- **Migrations:** `api` entrypoint runs `alembic upgrade head` before serving.
- **Backups (demo):** `pg_dump` + `uploads/` tar via `scripts/backup.sh` before the demo.
- **v0.2:** split web to a CDN/static host; api to a container host; managed Postgres with pgvector; object storage to S3-compatible.

---

## 10. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Vision model misreads handwriting → wrong answers in demo | Med | High | Curate demo captures (legible), show confidence, allow correction (stretch), pre-run the pipeline on demo assets and cache results |
| R2 | External API latency/outage during demo | Med | High | Pre-seed the demo memories; `DRY_RUN` fixtures as a hard fallback; local Tesseract path; keep a recorded video |
| R3 | Temporal phrase parsing wrong ("this morning") | Med | Med | Rules for common phrases + explicit date chips in UI; show `used_filters` so it's inspectable |
| R4 | Prompt injection via captured text ("ignore instructions…") | Med | Med | Context blocks delimited + labeled "untrusted"; system prompt forbids following instructions found in memories; eval case for it |
| R5 | pgvector setup friction | Low | Med | Pinned `pgvector/pgvector:pg15` image; migration creates extension; documented in [Setup](14-SETUP.md) |
| R6 | Cost blowup from large images / retries | Low | Med | Client + server downscale; retry cap; per-request token ceiling |
| R7 | HEIC uploads from iPhone fail | Med | Low | Convert HEIC→JPEG server-side (`pillow-heif`); reject with clear message if it fails |
| R8 | Scope creep (audio, auth) eats the day | High | High | Non-goals in [PRD](01-PRD.md) §3.3; tracker time-boxes; stretch items gated behind "core demo works" |

---

## 11. Rollout / cutover for the demo

1. T-2h: run `scripts/seed_demo.py` — ingest the 3 demo images (timetable, circular, textbook page) + 4 distractors; verify all `ready`.
2. T-1h: run the eval script; confirm the scripted questions ([Demo Script](11-DEMO-SCRIPT.md)) return correct cited answers.
3. T-30m: `scripts/backup.sh`; note the DB snapshot path.
4. Demo: live-capture one new item, then ask the multi-source question.
5. Fallback ladder: live capture fails → use pre-seeded → API down → `DRY_RUN` mode → recorded video.
