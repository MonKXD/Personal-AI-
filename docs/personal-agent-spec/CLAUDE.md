# CLAUDE.md — Personal AI Agent

This file is read automatically by Claude Code at the start of every session in this repo. Keep it current as the project evolves — it's the single source of truth for conventions, decisions, and module boundaries so you don't have to re-explain context every session.

## What this project is

Harsh's personal daily-life-management AI agent — a single app that consolidates study tracking, wellness, finances, messages, calls, and deadlines into one Claude-powered assistant, used daily from his phone.

## Stack (already established — don't change without discussion)

- **Frontend + backend:** Next.js (API routes double as backend)
- **Data + auth:** Firebase / Firestore
- **Agent core:** Anthropic Claude API with tool-use routing, central route at `/api/agent`
- **Styling:** Tailwind CSS, dark charcoal + teal-green design system
- **Deployment:** Vercel, PWA-enabled (`next-pwa` + web manifest) for phone home-screen install

## Hard rule: real integrations only

No mock data, no placeholder API responses, even in early development. Every module should hit the real API/service from the first working version. This is an explicit standing preference — don't suggest "let's mock this first and wire it up later."

## Module map

| Module | Route(s) | Firestore collection(s) | Status |
|---|---|---|---|
| Study/exam tracker | *(existing — check current routes)* | `exams` / `study` *(verify exact name in codebase)* | Built |
| Wellness logging | *(existing)* | `wellness_logs` *(verify exact name)* | Built |
| Expense logging | *(existing)* | `expenses` *(verify — may be superseded, see finance spec)* | Built, being extended |
| News digest | *(existing)* | — | Built |
| Gmail summarizer | new | `deadlines` (writes into it) | Not yet built |
| Deadline engine | new | `deadlines` | **Detail: `docs/modules/deadline-engine.md`** |
| WhatsApp triage | new | `whatsapp_messages`, `deadlines` | **Detail: `docs/modules/whatsapp-triage.md`** |
| Calling assistant | new | `calls`, `deadlines` | **Detail: `docs/modules/calling-assistant.md`** |
| Finance (deepened) | new | `finance_transactions`, `finance_statement_batches` | **Detail: `docs/modules/finance-tracking.md`** |

Authoritative schema for everything, existing + new: `docs/04-SCHEMA.md`.

## Architecture decisions already locked in — do not re-litigate these

1. **Calling assistant works as real, live AI-placed and AI-answered calls** via Twilio Voice + ConversationRelay — not call-recording summarization, not logging-only.
2. **WhatsApp integration uses an unofficial library (Baileys) in strictly passive/read-only mode.** It never sends messages or auto-replies — it only observes and categorizes. This is a deliberate risk trade-off already made; don't propose switching to the official Business API as a "safer alternative" without flagging the functional loss (it can't read existing personal chats).
3. **Finance tracking is manual entry + statement upload with AI categorization**, not live bank data via the Account Aggregator framework. This can be revisited later, but isn't in scope now.

## Agent tool-use pattern

New capabilities are added as tools registered in the `/api/agent` route's tool-use router, following whatever pattern is already established there for existing tools. Each module's spec doc lists the tool definitions (name, description, input schema) it needs. Keep tool names and Firestore field names consistent with what's defined in the module docs — the docs are the contract.

## Hosting wrinkle to know about

Vercel serverless functions are short-lived and stateless — they can't hold the persistent WebSocket connection a WhatsApp listener needs. The WhatsApp module (only) needs a small always-on process outside Vercel (see `docs/modules/whatsapp-triage.md` for options). Everything else stays on the existing Vercel/Next.js setup.

## Environment variables (consolidated — existing + new)

```
# Existing
ANTHROPIC_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
NEXT_PUBLIC_FIREBASE_*=            # client config, as already set up

# New — Gmail (already planned pre-existing roadmap item)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=

# New — Calling assistant (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=               # E.164, the dedicated assistant number
CONVERSATION_RELAY_WS_URL=         # your deployed WebSocket handler URL

# New — WhatsApp (Baileys, on the separate always-on process)
WHATSAPP_SESSION_DIR=              # where Baileys persists its auth/session files
WHATSAPP_SYNC_WEBHOOK_SECRET=      # shared secret for the listener -> main app sync endpoint
```

## Design system

Dark charcoal background, teal-green accent — keep every new page/component consistent with this. Match whatever Tailwind config/theme tokens the existing pages already use rather than introducing new colors.

## Also read every session

- **`RULES.md`** (repo root) — how to behave while working in this repo: non-negotiables, when to ask before proceeding, code conventions
- **`MEMORY.md`** (repo root) — decision history and gotchas; append to it, don't just read it

## Docs index

Core spec set (read in order for a full picture; reference individually otherwise):
- `docs/01-PRD.md` — product goals, user stories, scope boundaries
- `docs/02-TRD.md` — architecture, integrations, non-functional requirements, security
- `docs/03-APP-FLOW.md` — navigation structure and key user journeys
- `docs/04-SCHEMA.md` — authoritative data model, existing + new collections
- `docs/05-DESIGN.md` — design tokens, component patterns, per-module layout notes
- `docs/06-IMPLEMENTATION-PLAN.md` — phased build plan with tasks and definitions of done
- `docs/07-TRACKER.md` — live status view, edited continuously as work happens

Per-integration implementation detail (referenced from the core docs above, not duplicated there):
- `docs/modules/deadline-engine.md`
- `docs/modules/whatsapp-triage.md`
- `docs/modules/calling-assistant.md`
- `docs/modules/finance-tracking.md`
