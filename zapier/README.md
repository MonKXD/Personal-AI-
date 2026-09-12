# Personal AI — Zapier integration

A `zapier-platform` app that wires Personal AI's public API (`/api/v1`, see
`docs/16-API.md`) into Zapier.

## Triggers

| Key | Kind | Source |
|---|---|---|
| **New Memory** | polling | `GET /api/v1/memories` |
| **New or Open Deadline** | polling | `GET /api/v1/action-items?status=open` |
| **Instant Event (webhook)** | REST Hook | `POST` / `DELETE /api/v1/webhooks` — `memory.created`, `capture.completed`, `action_item.due_soon`, `digest.weekly` |

## Actions

| Key | Source |
|---|---|
| **Save to Personal AI** | `POST /api/v1/captures` (`url` or `text` + `title`) |
| **Ask Personal AI** | `POST /api/v1/ask` |

## Auth

Custom API-key. The user pastes a token from **Personal AI → Settings → API**;
it's sent as `Authorization: Bearer mm_…`. Auth test hits `GET /api/v1/me`.

## Publish

```bash
cd zapier
npm install
npx zapier login
npx zapier register "Personal AI"   # first time only
npx zapier push
```

Then invite testers or submit for public review from the Zapier developer
dashboard. Bump `version` in `package.json` before each `zapier push`.
