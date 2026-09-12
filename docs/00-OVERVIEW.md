# MirrorMind — Document Set Overview

> **MirrorMind: Your AI Memory** — A personal AI that remembers what you see, hear, and learn during the day. Point a camera at a notice, textbook, circuit, timetable, or whiteboard; MirrorMind extracts the information, stores it in searchable memory, and later answers questions like *"What was written on the robotics club notice I saw this morning?"*

- **Status:** Concept / hackathon build (1-day MVP + roadmap)
- **Owner:** harshgosalia007@gmail.com
- **Last updated:** 2026-09-03

---

## 1. How to read this set

| # | Document | Purpose | Audience |
|---|----------|---------|----------|
| 00 | [Overview](00-OVERVIEW.md) | Index, product recommendations, doc map | Everyone |
| 01 | [PRD](01-PRD.md) | *What* we build and *why* — users, problems, scope, requirements, success metrics | PM, stakeholders, eng |
| 02 | [TRD](02-TRD.md) | *How* we build it — stack, components, data flow, non-functional requirements, risks | Eng |
| 03 | [Architecture & App Flow](03-ARCHITECTURE.md) | System diagram, capture→memory pipeline, RAG flow, deployment | Eng |
| 04 | [Design](04-DESIGN.md) | Screens, user flows, component inventory, design tokens, states, accessibility | Design, frontend |
| 05 | [Schema](05-SCHEMA.md) | Relational + vector schema, DDL, entity relationships, DTOs, migrations | Backend |
| 06 | [Rules](06-RULES.md) | Engineering conventions + AI-assistant/agent rules (`.cursorrules`-style) | Eng, AI coding agent |
| 07 | [Tracker](07-TRACKER.md) | Milestones, hour-by-hour 1-day plan, backlog, status board | Everyone |
| 08 | [Memory](08-MEMORY.md) | Living project memory — decisions, assumptions, glossary, open questions | Eng, AI coding agent |
| 09 | [API Spec](09-API-SPEC.md) | REST endpoint contracts, request/response shapes, errors | Frontend, backend |
| 10 | [Prompt Library](10-PROMPTS.md) | Extraction, classification, and RAG prompts + guardrails | Eng |
| 11 | [Demo Script](11-DEMO-SCRIPT.md) | Exact runbook for the "shock people" demo | Presenter |
| 12 | [Security & Privacy](12-SECURITY-PRIVACY.md) | Threat model, PII handling, prompt-injection from captured text, data retention | Eng, reviewers |
| 13 | [Test Plan](13-TEST-PLAN.md) | Test strategy + evaluation sets for extraction and retrieval quality | Eng, QA |
| 14 | [Setup](14-SETUP.md) | Local dev environment, env vars, run commands, seed data | Eng |

**Additional documents recommended and included:** API Spec (09), Prompt Library (10), Demo Script (11), Security & Privacy (12), Test Plan (13), Setup (14). Rationale below.

---

## 2. Product recommendations (add-ons to the idea)

The core idea is strong. These additions make it feel less like "OCR + search" and more like *a mind*. Ranked by impact-to-effort for the demo.

### Top 3 to include in the 1-day build
1. **Automatic time + type awareness.** Every capture is stamped with `captured_at` (and optional device location). Auto-classify each capture into a type (`notice`, `timetable`, `textbook_page`, `whiteboard`, `circuit`, `handwritten_note`, `slide`). This is what makes *"…the notice I saw **this morning**"* and *"…on the **timetable**"* actually work. Cheap: one extra model call, two extra columns.
2. **Structured extraction, not just raw text.** For each type, extract a typed payload alongside the plain text:
   - timetable → list of `{day, start, end, subject, room}`
   - notice → `{title, body, dates[], deadlines[], contacts[], location}`
   - circuit → `{components[], connections[], notes}`
   This powers precise answers ("When is my next Physics class?") and a nice UI card. Uses one JSON-mode model call.
3. **Evidence-first answers.** Every chat answer cites the memories it used and shows the **original image thumbnail** inline (click to zoom). This is the trust moment in the demo — the AI *shows its receipts*.

### High-value, low-risk next
4. **Action items / reminders.** Detect deadlines and dates in captures ("Registration closes Friday 5 PM") and surface them as a checklist; optionally push to calendar. Turns passive memory into useful nudges.
5. **Daily digest.** One-tap "What did I capture today?" — a generated summary grouped by type with links. Great retention hook and a great demo closer.
6. **Audio capture + transcription.** Record a lecture or conversation; transcribe; store as a memory with the same pipeline. Makes "hear" in the pitch real. (Whisper-class model.)
7. **Cross-memory linking.** When a new capture relates to an existing one (same course, same event), link them. Enables "combine all three" answers to feel connected, not just concatenated.
8. **Confidence + "please verify".** Handwriting OCR is imperfect. Show a confidence band; let the user tap to correct extracted text. Corrections are re-embedded. Builds trust and improves the corpus.

### Differentiators for the roadmap
9. **Privacy modes.** Local-only mode (on-device OCR + local embeddings, no cloud), automatic face blurring and PII redaction on stored images, per-memory "private" flag excluded from AI context.
10. **Capture surfaces.** PWA "add to home screen" + share-sheet target + a browser extension "clip this" so capture is one gesture anywhere.
11. **Semantic timeline.** A scrollable day/week timeline of captures with type icons; filter by type/tag/date; this is the "memory of the physical world" visualization.
12. **Multi-user / classroom.** Shared memory spaces (a study group shares a whiteboard photo; everyone can query it).
13. **Answer freshness / conflict handling.** If two timetables disagree, the newest wins and the answer says so ("Your timetable from Aug 28 says…, but a newer one from Sep 2 says…").

### Explicitly out of scope for MVP
- Always-on wearable capture, native mobile apps, real-time video understanding, OCR of dense multi-column PDFs, multi-language handwriting beyond English, offline sync/CRDT.

---

## 3. Why the extra documents

| Doc | Why it matters here |
|-----|--------------------|
| **API Spec** | Frontend and backend are built in parallel under time pressure; a frozen contract prevents rework. |
| **Prompt Library** | The product *is* its prompts (classification, extraction, RAG). Versioning them separately keeps quality measurable and lets non-authors tune them. |
| **Demo Script** | The stated goal is to "shock people." A scripted, rehearsed 3-artifact demo with fallback assets is the difference between wow and a live failure. |
| **Security & Privacy** | Camera input + personal documents + an LLM reading arbitrary captured text = real risks: PII at rest, and **prompt injection via OCR'd text** ("ignore previous instructions" written on a whiteboard). Needs an explicit stance. |
| **Test Plan** | Extraction and retrieval quality are subjective and regress silently. A small labeled eval set makes "is it still good?" a 2-minute check. |
| **Setup** | A one-command local bring-up (DB + pgvector + API + web) saves the first hour of the hackathon and every new contributor after. |

---

## 4. Locked technical choices (shared by all docs)

| Concern | Choice | Note |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind + shadcn/ui | PWA-capable |
| Backend | FastAPI (Python 3.11), Uvicorn | Async |
| DB | PostgreSQL 15 + `pgvector` | HNSW index, cosine distance |
| Object storage | Local disk (`./data/uploads`) for MVP; S3-compatible interface behind a `Storage` port | Swap for S3/Supabase later |
| Vision extraction | Claude (`claude-sonnet-5`) image input | Replaces classic OCR; handles handwriting, layout, structure in one call |
| Fallback OCR | Tesseract (`pytesseract`) | Used only if vision call fails or local-only mode |
| Embeddings | `voyage-3.5` (1024-dim) | Configurable via `EMBEDDING_MODEL`, `EMBEDDING_DIMS` |
| Transcription (roadmap) | `whisper-1`-class | Audio captures |
| Chat / RAG | Claude (`claude-sonnet-5`) with retrieved context + citations | JSON tool-call for structured answer |
| Auth (MVP) | Single local user, no login; `X-User-Id` header stub | Real auth post-MVP |
| Deploy (MVP) | `docker compose up` (db, api, web) | One host |

See [TRD](02-TRD.md) §3 and [Memory](08-MEMORY.md) for the reasoning and alternatives considered.
