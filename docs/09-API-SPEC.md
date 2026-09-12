# 09 — API Specification

**Product:** MirrorMind
**Base URL:** `/api/v1`
**Auth (MVP):** header `X-User-Id: demo-user` (defaulted if absent). Real auth later.
**Content type:** `application/json` unless noted. Times: ISO-8601 UTC (`...Z`).
**Related:** [Schema](05-SCHEMA.md) · [Architecture](03-ARCHITECTURE.md) · [Rules](06-RULES.md) §5

---

## 1. Conventions

- IDs are ULID strings.
- Pagination: `?limit` (1–100, default 20) + `?cursor` (opaque). Responses include `next_cursor` (null at end).
- Errors: `{ "error_code": string, "message": string, "detail"?: object }` with the matching HTTP status (§7).
- File URLs returned by the API point at `GET /api/v1/files/{key}` (API streams from object storage with cache headers).
- SSE endpoints: `Content-Type: text/event-stream`; each event `event: <name>\ndata: <json>\n\n`; keep-alive comment every 15 s; terminal `event: done`.

---

## 2. Endpoint index

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/healthz` | liveness |
| GET | `/readyz` | readiness (db, storage, adapter ping) |
| POST | `/captures` | create a capture (multipart) |
| GET | `/captures` | list recent captures |
| GET | `/captures/{id}` | capture status + refs |
| GET | `/captures/{id}/events` | SSE pipeline status stream |
| POST | `/captures/{id}/retry` | re-run pipeline from extraction |
| GET | `/memories` | list/search memories (filters) |
| GET | `/memories/{id}` | full memory detail |
| PATCH | `/memories/{id}` | update tags / corrected_text |
| DELETE | `/memories/{id}` | soft-delete (`?hard=true` admin) |
| GET | `/action-items` | list action items *(stretch)* |
| PATCH | `/action-items/{id}` | set status *(stretch)* |
| GET | `/digest` | generated daily digest *(stretch)* |
| POST | `/chat/sessions` | create chat session |
| GET | `/chat/sessions` | list sessions |
| GET | `/chat/sessions/{id}/messages` | message history |
| POST | `/chat/sessions/{id}/messages` | ask a question (SSE stream) |
| GET | `/files/{key}` | stream an image derivative |

---

## 3. Captures

### POST `/captures`  (multipart/form-data)

| Field | Type | Notes |
|-------|------|-------|
| `file` | binary | jpg/png/webp/heic, ≤ 15 MB, ≤ 8000 px/side |
| `source` | string | `upload` \| `webcam` (default `upload`) |
| `captured_at` | string (ISO) | client capture time; server uses receipt time if absent/implausible |
| `geo_consent` | bool | if `true` and lat/lng provided, they are stored; else dropped |
| `latitude`, `longitude` | number | optional |
| `device_hint` | string | optional, e.g. `"iPhone Safari"` |

Headers: `Idempotency-Key: <uuid>` (recommended). Same key within 24 h → returns the original capture with `200`.

**201 Created**
```json
{
  "id": "01J9Z3K8Q1M2N3P4R5S6T7U8V9",
  "status": "queued",
  "captured_at": "2026-09-04T03:12:00Z",
  "thumb_url": "/api/v1/files/uploads/demo-user/01J9.../thumb.jpg",
  "display_url": "/api/v1/files/uploads/demo-user/01J9.../display.jpg",
  "memory_id": null
}
```

Errors: `unsupported_media_type` (415), `file_too_large` (413), `image_too_large` (422), `invalid_image` (422), `heic_conversion_failed` (422).

### GET `/captures?limit=&cursor=`
```json
{
  "items": [
    { "id": "01J9...", "status": "ready", "captured_at": "2026-09-04T03:12:00Z",
      "thumb_url": "...", "memory_id": "01J9...MEM", "type": "notice", "title": "Robotics Club — Open House" }
  ],
  "next_cursor": null
}
```

### GET `/captures/{id}`
```json
{
  "id": "01J9...", "status": "extracting", "error_code": null,
  "captured_at": "2026-09-04T03:12:00Z",
  "original_url": "...", "display_url": "...", "thumb_url": "...",
  "memory_id": null,
  "timings": { "ingest_ms": 940 }
}
```
`status` ∈ `queued | extracting | embedding | ready | failed`. When `failed`: `error_code`, `error_detail` present.

### GET `/captures/{id}/events`  (SSE)
```
event: status
data: {"capture_id":"01J9...","status":"extracting","step":"vision","ms":0}

event: status
data: {"capture_id":"01J9...","status":"embedding","chunks":3}

event: ready
data: {"capture_id":"01J9...","memory_id":"01J9...MEM"}

event: done
data: {}
```
On failure:
```
event: failed
data: {"capture_id":"01J9...","error_code":"vision_unavailable","retryable":true}
event: done
data: {}
```

### POST `/captures/{id}/retry`
Allowed only when `status == failed`. → `202` `{ "id": "...", "status": "queued" }`. Errors: `not_retryable` (409), `not_found` (404).

---

## 4. Memories

### GET `/memories`
Query params: `after` (ISO), `before` (ISO), `types` (csv of `memory_type`), `tags` (csv), `q` (free text; trigram match on title + ANN on chunks), `limit`, `cursor`.

```json
{
  "items": [
    {
      "id": "01J9...MEM", "capture_id": "01J9...", "type": "timetable",
      "title": "Sem 3 — Section B timetable", "summary": "Weekly class schedule effective Aug 28.",
      "captured_at": "2026-09-01T04:30:00Z", "ocr_confidence": "high",
      "tags": ["timetable","sem-3","physics"],
      "thumb_url": "/api/v1/files/.../thumb.jpg"
    }
  ],
  "next_cursor": "01J9...ABC"
}
```

### GET `/memories/{id}`
```json
{
  "id": "01J9...MEM",
  "capture_id": "01J9...",
  "type": "notice",
  "type_confidence": 0.94,
  "title": "Robotics Club — Open House & Recruitment",
  "summary": "Open house on Sep 5, 5 PM, Main Auditorium. Register by Sep 4.",
  "text": "ROBOTICS CLUB\nOpen House & Recruitment\n...",
  "corrected_text": null,
  "ocr_confidence": "high",
  "language": "en",
  "structured": {
    "issuer": "Robotics Club",
    "headline": "Open House & Recruitment",
    "location": "Main Auditorium",
    "dates": [{ "label": "Event", "value": "2026-09-05", "time": "17:00" }],
    "deadlines": [{ "label": "Registration closes", "value": "2026-09-04", "time": "17:00" }],
    "contacts": [{ "name": "Aditi", "email": "robotics@college.edu" }]
  },
  "entities": [
    { "id": "01J9...E1", "kind": "date", "value_text": "Sep 5", "value_norm": "2026-09-05", "ts_value": "2026-09-05T00:00:00Z" },
    { "id": "01J9...E2", "kind": "deadline", "value_text": "by Sep 4, 5 PM", "value_norm": "2026-09-04T17:00:00Z", "ts_value": "2026-09-04T17:00:00Z" },
    { "id": "01J9...E3", "kind": "place", "value_text": "Main Auditorium" }
  ],
  "tags": ["notice","robotics","club"],
  "action_items": [
    { "id": "01J9...A1", "title": "Register for Robotics Open House", "due_at": "2026-09-04T17:00:00Z", "status": "open" }
  ],
  "related": [
    { "id": "01J9...MEM2", "type": "timetable", "title": "Sem 3 timetable", "thumb_url": "..." }
  ],
  "captured_at": "2026-09-04T03:12:00Z",
  "original_url": "...", "display_url": "...", "thumb_url": "..."
}
```

### PATCH `/memories/{id}`
```json
{ "tags": ["notice","robotics","priority"], "corrected_text": "ROBOTICS CLUB\n..." }
```
Both fields optional. Setting `corrected_text` triggers re-chunk + re-embed (async); response `200` with the updated memory, `reembedding: true`.

### DELETE `/memories/{id}`
Soft-delete → `204`. `?hard=true` (admin/demo) removes rows + files → `204`.

---

## 5. Chat

### POST `/chat/sessions` → `201`
```json
{ "id": "01J9...S1", "title": "New chat", "created_at": "2026-09-04T03:20:00Z" }
```

### GET `/chat/sessions/{id}/messages`
```json
{
  "items": [
    { "id": "01J9...M1", "role": "user", "content": "What was on the robotics notice I saw this morning?", "created_at": "..." },
    { "id": "01J9...M2", "role": "assistant",
      "content": "The Robotics Club open house is on Sep 5 at 5 PM in the Main Auditorium; register by Sep 4, 5 PM.",
      "citations": [
        { "memory_id": "01J9...MEM", "title": "Robotics Club — Open House", "snippet": "Open House & Recruitment ... Main Auditorium", "thumb_url": "..." }
      ],
      "used_filters": { "after": "2026-09-04T00:00:00Z", "before": "2026-09-04T12:00:00Z", "types": ["notice"], "tags": [] },
      "created_at": "..." }
  ],
  "next_cursor": null
}
```

### POST `/chat/sessions/{id}/messages`  (SSE)
Request:
```json
{ "text": "I have a Physics lab clashing with the fee deadline — when's the lab, when's the deadline, and what topic is it on?" }
```
Response stream:
```
event: filters
data: {"after":null,"before":null,"types":["timetable","notice","textbook_page"],"tags":["physics"]}

event: token
data: {"t":"Your "}
event: token
data: {"t":"Physics lab is Wed 2–4 PM in Lab-3. "}
...
event: message
data: {
  "message_id":"01J9...M4",
  "answer":"Your Physics lab is Wed 2–4 PM in Lab-3. The fee payment deadline is Wed 5 PM (from the fee circular). The lab topic is RC circuits (textbook Ch. 27, p. 742).",
  "citations":[
    {"memory_id":"01J9...MEM_TT","title":"Sem 3 timetable","snippet":"Wed 14:00–16:00 Physics Lab, Lab-3","thumb_url":"..."},
    {"memory_id":"01J9...MEM_FEE","title":"Fee payment circular","snippet":"Last date: Wed, 5:00 PM","thumb_url":"..."},
    {"memory_id":"01J9...MEM_TB","title":"Physics Ch.27 — Circuits","snippet":"RC time constant τ = RC","thumb_url":"..."}
  ],
  "used_filters":{"types":["timetable","notice","textbook_page"],"tags":["physics"]},
  "no_memory":false
}

event: done
data: {}
```
No-memory case: `answer` is a fixed "I don't have a memory of that yet…" string, `no_memory: true`, `citations: []`.

Errors mid-stream: `event: error` `data: {"error_code":"chat_model_unavailable"}` then `event: done`.

---

## 6. Stretch endpoints

### GET `/action-items?status=open&due_before=`
```json
{ "items": [ { "id":"01J9...A1","title":"Register for Robotics Open House","due_at":"2026-09-04T17:00:00Z","status":"open","memory_id":"01J9...MEM","memory_title":"Robotics Club — Open House","thumb_url":"..." } ] }
```
### PATCH `/action-items/{id}` → `{ "status": "done" }` → `200`.

### GET `/digest?date=2026-09-04`
```json
{
  "date": "2026-09-04",
  "summary": "You captured 5 things today: a robotics notice, your updated timetable, two textbook pages on circuits, and a whiteboard from standup.",
  "groups": [
    { "type": "notice", "items": [ { "memory_id": "01J9...MEM", "title": "Robotics Club — Open House", "thumb_url": "..." } ] }
  ],
  "action_items": [ { "id":"01J9...A1","title":"Register for Robotics Open House","due_at":"2026-09-04T17:00:00Z" } ]
}
```

---

## 7. Error codes

| HTTP | `error_code` | When |
|------|--------------|------|
| 400 | `bad_request` | malformed body/params |
| 401 | `unauthorized` | (post-MVP) missing/invalid auth |
| 403 | `forbidden` | resource not owned by caller |
| 404 | `not_found` | unknown id |
| 409 | `not_retryable` / `conflict` | retry on non-failed capture; idempotency mismatch |
| 413 | `file_too_large` | upload > 15 MB |
| 415 | `unsupported_media_type` | not an accepted image type |
| 422 | `invalid_image` / `image_too_large` / `heic_conversion_failed` / `validation_error` | image or payload invalid |
| 429 | `rate_limited` | (post-MVP) throttle |
| 502 | `vision_unavailable` / `embeddings_unavailable` / `chat_model_unavailable` | upstream adapter failed after retries |
| 503 | `not_ready` | `/readyz` failing dependency |
| 500 | `internal_error` | unhandled |

`detail` may include `{ "field": "...", "reason": "..." }` for `validation_error`, and `{ "retryable": true|false }` for adapter errors.

---

## 8. Headers & caching

- `GET /files/{key}`: `Cache-Control: private, max-age=86400, immutable`; `ETag` = sha256; supports `Range` for large originals.
- SSE responses: `Cache-Control: no-store`, `X-Accel-Buffering: no` (nginx), `Connection: keep-alive`.
- CORS: `Access-Control-Allow-Origin` = configured web origin only; `Allow-Headers: Content-Type, X-User-Id, Idempotency-Key`; `Allow-Methods: GET,POST,PATCH,DELETE,OPTIONS`.

---

## 9. OpenAPI

FastAPI auto-serves `/api/v1/openapi.json` and `/api/v1/docs`. The `web` API client (`lib/api.ts`) is generated from that schema; regenerate on any contract change (`make gen-client`).
