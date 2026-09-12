# 16 — Public REST API (`/api/v1`)

Token-authenticated HTTP API for scripts, Shortcuts, and no-code tools
(Zapier / Make / n8n). Bearer-token only — no cookies — so CORS is open
(`*`) and there's no CSRF surface.

## Auth

Create a token in **Settings → API** (shown once). Then:

```
Authorization: Bearer mm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- 120 requests/min per token. Writes also count against your daily capture
  cap and the shared daily AI budget.
- `401 unauthorized` — missing token · `401 invalid_token` — bad/revoked ·
  `429 rate_limited` / `ai_budget_reached` · `4xx` errors are
  `{ "error_code": "...", "message": "..." }`.

Base URL: `https://mirror-mindai.vercel.app`

## Endpoints

### `GET /api/v1/me`
Token check. → `{ ok: true, user_id, token_id }`

### `POST /api/v1/captures`
Create a capture. One of:

```json
{ "url": "https://example.com/article" }
{ "text": "meeting notes …", "title": "Standup 9 Sep" }
```

→ `202 { "id": "<capture id>", "status": "queued" }` (or `200` + `deduped: true`).
Poll the next endpoint until `status` is `ready`.

### `GET /api/v1/captures/{id}`
→ `{ id, status, error_code, memory_id, captured_at, updated_at }`
`status`: `queued → extracting → embedding → ready` (or `failed`).

### `GET /api/v1/memories`
Query: `q` (text search), `type` (comma list), `since` (ISO), `limit` (1–100,
default 25), `cursor`.

→ `{ "items": [{ id, type, title, summary, tags, captured_at }], "next_cursor": "…"|null }`

### `GET /api/v1/memories/{id}`
→ full memory: `text`, `entities[]`, `action_items[]`, `source_url`,
`share_url`, `folder_id`, `tags`.

### `POST /api/v1/ask`
```json
{ "question": "when is my next physics lab?" }
```
→ `{ "answer": "…", "no_memory": false, "citations": [{ memory_id, title, type, snippet }], "used_filters": {…} }`
Non-streaming. Costs against the daily AI budget.

### `GET /api/v1/action-items`
Query: `status` = `open` (default) · `done` · `dismissed`.
→ `{ "items": [{ id, title, due_at, status, memory_id, memory_title }] }`

### `GET/POST /api/v1/webhooks`, `DELETE /api/v1/webhooks/{id}`
Register delivery targets from code (this is what the Zapier REST-hook
trigger uses). `POST { url, events?: ["memory.created", …] | ["*"] }` →
`201 { id, url, events, secret }` — the `secret` signs deliveries
(`X-MirrorMind-Signature`). Same events + payload shape as the Settings
webhooks below.

## Example

```bash
curl -s https://mirror-mindai.vercel.app/api/v1/ask \
  -H "Authorization: Bearer $MM_TOKEN" \
  -H "content-type: application/json" \
  -d '{"question":"what deadlines do I have this week?"}'
```

## Webhooks

Add one in **Settings → Webhooks** with a URL and the events you want.
MirrorMind then POSTs to that URL:

```json
{
  "event": "memory.created",
  "data": { "memory_id": "…", "capture_id": "…", "type": "notice", "title": "…", "summary": "…" },
  "timestamp": "2026-09-07T08:00:00.000Z"
}
```

Every request carries `X-MirrorMind-Signature: sha256=<hex>` —
`HMAC-SHA256(secret, raw_body)`. Verify it before trusting the payload
(the per-hook secret is shown in Settings).

| Event | Fires when | `data` |
|---|---|---|
| `capture.completed` | a capture reaches `ready` | `memory_id, capture_id, type, title, summary` |
| `memory.created` | same moment, for "new memory" semantics | same |
| `action_item.due_soon` | daily cron, a deadline ≤ ~24h away | `id, title, due_at, memory_id, memory_title` |
| `digest.weekly` | Sunday cron | `week_of, summary, count` |

Delivery: 2 attempts, 8s timeout. A hook is auto-disabled after 15
consecutive failures (re-enable by re-adding it).
