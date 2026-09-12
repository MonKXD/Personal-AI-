# 01 — Product Requirements Document (PRD)

**Product:** MirrorMind — Your AI Memory
**Version:** 0.1 (MVP)
**Author:** harshgosalia007@gmail.com
**Date:** 2026-09-03
**Related:** [TRD](02-TRD.md) · [Design](04-DESIGN.md) · [Tracker](07-TRACKER.md)

---

## 1. Summary

MirrorMind is a personal memory assistant for the physical world. A user captures things they encounter during the day — a printed notice, a handwritten timetable, a textbook page, a whiteboard, a circuit diagram — as photos (or, later, audio). MirrorMind extracts the meaningful content, structures it, stores it as searchable "memories," and answers natural-language questions later, citing the original captures as evidence.

The emotional promise: *it feels like you gave an AI a memory of your day, not like you uploaded a file.*

---

## 2. Problem

People constantly encounter information in physical or ephemeral form and lose it:

- A notice on a board is read once and forgotten; the deadline is missed.
- A timetable is photographed and buried in a camera roll of 8,000 images.
- Lecture whiteboards are erased; notes are incomplete.
- Textbook facts are read and not retained.

Existing tools each solve a slice and none solve the whole:

| Tool class | Gap |
|---|---|
| Camera roll / Photos search | Finds "a photo with text," not *answers*. No structure, no Q&A, no time-scoped recall. |
| Note apps (Notion, Keep) | Manual transcription; no automatic extraction or semantic recall. |
| OCR scanner apps | Produce a text blob or PDF; no memory, no cross-document reasoning. |
| Generic chatbots + file upload | Stateless; you must re-supply context every time; feels like a tool, not a memory. |

**Opportunity:** combine automatic capture, typed extraction, semantic + temporal recall, and evidence-cited answers into one loop.

---

## 3. Goals & non-goals

### 3.1 Goals (MVP)
- G1: Let a user capture an image (upload or webcam) in ≤ 2 taps.
- G2: Automatically extract text + a type-specific structured payload from each capture.
- G3: Automatically classify each capture (notice / timetable / textbook_page / whiteboard / circuit / handwritten_note / slide / other) and timestamp it.
- G4: Make all captured content searchable via natural-language chat.
- G5: Every answer cites the memories used and shows the original image as evidence.
- G6: Support a multi-source question (combine a timetable + a circular + a textbook page in one answer).
- G7: Provide a browsable memory list/timeline with type and date filters.

### 3.2 Stretch goals (if time permits in the 1-day build)
- S1: Detect deadlines/dates and show an action-item checklist.
- S2: "Daily digest" generated summary.
- S3: Inline correction of extracted text (re-embed on save).

### 3.3 Non-goals (MVP)
- N1: Real authentication / multi-tenant accounts (single local user).
- N2: Native mobile apps (responsive PWA only).
- N3: Audio capture & transcription (roadmap).
- N4: Always-on / background capture.
- N5: Non-English handwriting.
- N6: Editing/annotating the original image.
- N7: Offline mode.

---

## 4. Target users & personas

| Persona | Context | Primary jobs-to-be-done |
|---|---|---|
| **Ishaan, 19, engineering student** (primary) | Lectures, club notices, lab circuits, shifting timetables | "Remind me what that notice said." "When's my next lab?" "What were the components in today's circuit?" |
| **Priya, 27, knowledge worker** | Meeting whiteboards, printed briefs, conference slides | "Summarize the whiteboard from this morning's standup." "What action items did I photograph this week?" |
| **Self-learner / researcher** | Textbook pages, article scans, handwritten notes | "What did that page say about X?" "Find my note about Y." |

---

## 5. Key user stories

- **US1 (capture):** As a user, I can take a webcam photo or upload an image and see it start processing immediately, so capture is frictionless.
- **US2 (auto-understand):** As a user, after capture I see the detected type, extracted text, and a structured card, so I trust it "got it."
- **US3 (recall by content):** As a user, I can ask "What was on the robotics club notice I saw this morning?" and get an answer with the notice image shown, so I don't have to scroll my camera roll.
- **US4 (recall by structure):** As a user, I can ask "When is my next Physics class?" and get a specific time derived from a captured timetable.
- **US5 (multi-source):** As a user, I can ask a question that needs my timetable, a circular, and a textbook page together, and get one coherent answer citing all three.
- **US6 (browse):** As a user, I can scroll a timeline of today's/this week's captures filtered by type, so I can find something visually.
- **US7 (evidence):** As a user, I can click a citation in an answer and see the full original image, so I can verify.
- **US8 (correct) [stretch]:** As a user, I can fix a wrongly-read word and the memory updates.

---

## 6. Functional requirements

### 6.1 Capture
- FR-C1: Accept image upload (`jpg`, `png`, `webp`, `heic→jpg`), max 15 MB.
- FR-C2: Webcam capture via `getUserMedia`; single-frame grab.
- FR-C3: Store the original file; generate a display-size derivative (long edge ≤ 1600 px) and a thumbnail (long edge ≤ 320 px).
- FR-C4: Record `captured_at` (client-provided capture time; fallback server receipt time) and optional `latitude`/`longitude` if the user grants permission.
- FR-C5: Show processing status: `queued → extracting → embedding → ready` (or `failed` with retry).

### 6.2 Extraction & understanding
- FR-E1: Classify capture type with a confidence score.
- FR-E2: Extract full plain text (reading order preserved) with an overall OCR confidence band (`high` / `medium` / `low`).
- FR-E3: Extract a type-specific structured payload (see [Schema](05-SCHEMA.md) §4 for shapes).
- FR-E4: Extract a short title and a 1–2 sentence summary.
- FR-E5: Extract entities: dates, times, deadlines, people, locations, course/subject names, phone/email.
- FR-E6: On extraction failure, fall back to Tesseract OCR for text and mark `type = other`, `structured = null`.
- FR-E7: Chunk the text (≈ 200–400 tokens, 15% overlap) and embed each chunk plus the summary.

### 6.3 Storage & memory
- FR-S1: Persist capture, memory, chunks, embeddings, tags, entities, action items.
- FR-S2: Auto-tag from type + subject + detected keywords; allow user tag edits.
- FR-S3: Soft-delete a memory (excluded from search, recoverable for 30 days).

### 6.4 Retrieval & chat
- FR-R1: Chat input accepts free text; conversation persists per session.
- FR-R2: Retrieval = vector similarity over chunks + summaries, with optional filters parsed from the query:
  - temporal ("this morning", "yesterday", "last week", explicit dates) → `captured_at` range
  - type ("the notice", "on the timetable") → `type` filter
  - tag/subject mentions → tag filter
- FR-R3: Top-k (default 8) chunks assembled into context; answer generated with instructions to only use provided context and to cite memory IDs.
- FR-R4: Response includes: answer text, `citations[]` (memory id, snippet, thumbnail URL), and `used_filters`.
- FR-R5: If retrieval returns nothing relevant, answer "I don't have a memory of that" and suggest capturing it.
- FR-R6: Structured questions ("next Physics class") may be answered from the structured payload directly when a timetable/agenda memory is retrieved.

### 6.5 Browse
- FR-B1: Timeline/grid of memories, newest first, with type icon, title, thumbnail, time.
- FR-B2: Filters: date range, type, tag, free-text.
- FR-B3: Memory detail view: original image, extracted text, structured card, entities, tags, related memories, action items.

### 6.6 Action items [stretch]
- FR-A1: Surface detected deadlines as a checklist with source memory link; mark done.

---

## 7. Non-functional requirements

| ID | Requirement | Target (MVP) |
|---|---|---|
| NFR-1 | Capture-to-"ready" latency | p50 ≤ 8 s, p95 ≤ 20 s per image |
| NFR-2 | Chat answer latency | p50 ≤ 4 s, p95 ≤ 10 s |
| NFR-3 | Extraction usefulness (labeled eval, see [Test Plan](13-TEST-PLAN.md)) | ≥ 85% of fields correct on the demo eval set |
| NFR-4 | Retrieval hit rate (answerable questions where correct memory in top-k) | ≥ 90% on eval set |
| NFR-5 | Availability (demo window) | No unhandled crash; every failure path shows a retry |
| NFR-6 | Data at rest | Images on local disk with restrictive perms; DB not exposed publicly |
| NFR-7 | Privacy | Captured text treated as untrusted; never executed as instructions (see [Security](12-SECURITY-PRIVACY.md)) |
| NFR-8 | Cost | ≤ $0.05 per capture, ≤ $0.02 per chat turn (guardrail, not billed in MVP) |
| NFR-9 | Accessibility | Keyboard-navigable, WCAG AA contrast, alt text on images |

---

## 8. Success metrics

**North star:** *Recall queries answered correctly with evidence per active user per week.*

| Metric | Definition | MVP / demo target |
|---|---|---|
| Time-to-first-memory | Signup/open → first `ready` memory | < 60 s |
| Capture success rate | captures reaching `ready` / total | ≥ 95% |
| Answer-with-evidence rate | chat answers that include ≥ 1 citation / total answers | ≥ 80% |
| Multi-source answer works | the 3-artifact demo question returns a correct combined answer | Yes/No (must be Yes) |
| "Wow" qualitative | observers say some version of "that's spooky/amazing" | ≥ 3 of 5 |

---

## 9. Scope by release

| Release | Contents |
|---|---|
| **MVP (Day 1)** | G1–G7, FR-C*, FR-E1–E7, FR-S1–S2, FR-R1–R6, FR-B1–B3 |
| **v0.2** | Stretch S1–S3, audio capture + transcription, PWA install + share target |
| **v0.3** | Privacy modes (local-only, face blur, PII redaction), cross-memory linking UI, conflict-aware answers |
| **v0.4** | Real auth, shared memory spaces, browser extension, calendar push |

---

## 10. Assumptions & dependencies

- A1: A vision-capable LLM API key is available and reliable during the demo.
- A2: An embeddings API key is available; dimension known at build time.
- A3: Demo device has a working webcam and network.
- A4: Demo captures are legible English print/handwriting on reasonably flat surfaces.
- A5: Postgres with `pgvector` can be run locally (Docker).

Dependencies tracked in [Memory](08-MEMORY.md) §"Open questions / risks."

---

## 11. Open questions

| # | Question | Owner | Needed by |
|---|---|---|---|
| Q1 | Do we ship audio in Day 1 or defer? | PM | Start of build |
| Q2 | Local disk vs Supabase Storage for the demo? | Eng | Hour 1 |
| Q3 | Show OCR confidence to users in MVP or hide? | Design | Hour 3 |
| Q4 | How aggressively do we parse temporal phrases (library vs LLM)? | Eng | Hour 4 |
| Q5 | Retention default for soft-deleted memories | PM | Pre-launch |
