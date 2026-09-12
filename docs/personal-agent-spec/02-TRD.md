# TRD — Technical Requirements Document

## Architecture overview

```
                         ┌─────────────────────────┐
                         │   Next.js app (Vercel)   │
                         │  PWA, phone-installable  │
                         │                          │
  Harsh's phone  ───────►│  Pages (dashboard,       │
                         │  deadlines, whatsapp,    │
                         │  calls, finance, etc.)   │
                         │                          │
                         │  /api/agent  ─────────── │──► Claude API (tool-use)
                         │  /api/twilio/voice       │
                         │  /api/whatsapp/sync      │
                         │  /api/gmail/*            │
                         │  /api/finance/upload     │
                         └───────────┬──────────────┘
                                     │
                                     ▼
                         ┌─────────────────────────┐
                         │   Firebase / Firestore   │
                         │   (all app data)         │
                         └─────────────────────────┘
                                     ▲
                                     │ sync via authenticated webhook
                         ┌───────────┴──────────────┐
                         │  Baileys listener         │
                         │  (small always-on process,│
                         │   NOT on Vercel)          │
                         └────────────────────────────┘

  Twilio Voice ◄──────► ConversationRelay WebSocket handler ◄──► Claude API
  (calls)                (part of the Next.js deployment or a
                          small dedicated WebSocket service —
                          see "Calling" below)
```

## Stack

Next.js (frontend + API routes) · Firebase/Firestore · Claude API with tool-use routing · Tailwind CSS · Vercel · PWA (`next-pwa`). See `CLAUDE.md` for the authoritative, always-current version of this list.

## Non-functional requirements

| Requirement | Target |
|---|---|
| Availability | Best-effort. This is a personal tool — brief downtime is acceptable, silent data loss is not. |
| Performance | Dashboard should feel instant on a phone on mobile data — avoid waterfalled API calls on page load, prefer a single aggregated `/api/dashboard` read where practical. |
| Security | All Firestore reads/writes scoped to Harsh's single authenticated user via security rules — no collection should be readable without auth, even though there's only one user. |
| Cost visibility | Usage-based services (Twilio, any future AA integration) should be checkable at a glance — a simple "this month's usage" note in the finance or settings view is enough; no need for a billing dashboard. |
| Data integrity | Nothing that gets flagged (a deadline, a flagged WhatsApp message, a call log) should ever be silently dropped on a parsing/categorization failure — fail into an "uncategorized/needs review" state rather than failing silently. |

## Third-party integrations

| Service | Purpose | Auth | Hosting note |
|---|---|---|---|
| Anthropic Claude API | Agent core, all classification/extraction/summarization | API key | Called from Vercel serverless functions — fine, stateless |
| Firebase/Firestore | All persistent data | Service account (server), Firebase Auth (client) | N/A |
| Gmail API | Email summarization | OAuth 2.0, refresh token stored server-side | Vercel-compatible |
| Twilio Voice + ConversationRelay | Calling assistant | Account SID + Auth Token | Needs a WebSocket endpoint — see note below |
| Baileys (WhatsApp) | Message triage | QR-code linked device, session persisted to disk | **Cannot run on Vercel** — needs an always-on process (see `docs/modules/whatsapp-triage.md`) |

### On the ConversationRelay WebSocket
Vercel's serverless functions don't hold long-lived WebSocket connections well. Two options: (a) deploy the ConversationRelay WebSocket handler as a small separate always-on service (same place as the Baileys listener, if you want to consolidate always-on infra into one host), or (b) check whether Vercel's newer Fluid Compute / Edge Functions offer a supported long-lived WebSocket pattern by the time you build this — confirm current Vercel docs rather than assuming, since this changes over time. Defaulting to option (a) is the safer bet.

## Security requirements

- Firestore security rules: every collection scoped to `request.auth.uid == harshUid` (or equivalent single-user check) — no public reads, even for "harmless" collections like news digest cache
- Secrets (Twilio, Gmail, Anthropic, Firebase service account) live only in server-side env vars, never in client-bundled code
- The WhatsApp listener → main app sync endpoint (`/api/whatsapp/sync`) must validate `WHATSAPP_SYNC_WEBHOOK_SECRET` on every request — it's an unauthenticated-by-default internal endpoint otherwise
- Uploaded bank statements: don't persist raw files longer than needed for parsing; store only the extracted structured transactions
- Call transcripts and WhatsApp message content are sensitive — don't log them to any third-party logging/analytics service, only to Firestore

## Error handling & logging

- Every external API call (Twilio, Gmail, Claude, Baileys sync) wrapped with retry-once-then-fail-visibly — a silent failure that just doesn't show up anywhere is worse than a visible error state in the UI
- A lightweight `errors` collection (or reuse Vercel's own function logs) for anything that fails after retry, so failures are discoverable without needing to have been watching logs live

## Testing approach

Given this is a solo personal project, full test-suite coverage isn't the priority — but a few things are worth having:
- A manual QA checklist per module before considering a phase "done" (see `docs/07-TRACKER.md`)
- For the deadline-extraction and WhatsApp-categorization logic specifically, a small set of saved example inputs/expected outputs is worth keeping, since these are the two places silent misclassification would be easy to miss

## Related docs
`docs/01-PRD.md` · `docs/04-SCHEMA.md` · `docs/modules/` (per-integration implementation detail)
