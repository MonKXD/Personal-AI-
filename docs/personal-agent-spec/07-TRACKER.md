# Tracker

A living status view — update the **Status** and **Notes** columns as work happens. Task detail and definitions of done live in `docs/06-IMPLEMENTATION-PLAN.md`; this file is just for "where are we right now" at a glance. Status values: `Not started` · `In progress` · `Blocked` · `Done`.

## Phase 0 — Deadline engine

| Task | Status | Notes |
|---|---|---|
| `deadlines` collection + security rules | Not started | |
| `extractDeadline()` shared function | Not started | |
| Agent tools (list/add/mark-done) | Not started | |
| Dashboard deadlines card + list view | Not started | |
| Manual add flow, end to end | Not started | |

## Phase 1 — Gmail summarizer

| Task | Status | Notes |
|---|---|---|
| Gmail OAuth flow | Not started | |
| Inbox fetch + summarization | Not started | |
| Pipe through `extractDeadline()` | Not started | |

## Phase 2 — WhatsApp triage

| Task | Status | Notes |
|---|---|---|
| Choose + provision always-on host | Not started | |
| Baileys listener + QR-link flow | Not started | |
| `/api/whatsapp/sync` + secret validation | Not started | |
| Categorization pipeline | Not started | |
| List/detail UI + filter tabs | Not started | |
| Mute/always-flag overrides | Not started | |

## Phase 3 — Finance, deepened

| Task | Status | Notes |
|---|---|---|
| Migration decision: `expenses` → `finance_transactions` | Not started | |
| Upload UI (PDF/CSV) | Not started | |
| Parsing pipeline | Not started | |
| Categorization step | Not started | |
| Dedup logic | Not started | |
| Review-before-confirm screen | Not started | |
| Breakdown + trend views | Not started | |

## Phase 4 — Calling assistant

| Task | Status | Notes |
|---|---|---|
| Twilio account + India number | Not started | |
| `/api/twilio/voice` + TwiML | Not started | |
| ConversationRelay WebSocket handler | Not started | |
| `place_call` tool + outbound flow | Not started | |
| Inbound answer flow | Not started | |
| Post-call summary/extraction | Not started | |
| Calls list/detail UI | Not started | |

## Phase 5 — Polish & extras

| Task | Status | Notes |
|---|---|---|
| Daily brief | Not started | |
| Career pipeline tile | Not started | |
| Course/skill discovery | Not started | |
| Budgets | Not started | |
| Push notifications | Not started | |

## Cross-cutting

| Task | Status | Notes |
|---|---|---|
| Full Firestore security rules pass | Not started | |
| Always-on hosting decision (WhatsApp + ConversationRelay) | Not started | |

---
*Update this file directly as you work — it's meant to be edited, not regenerated. If a task's scope changes enough that the plan doc needs updating too, update both together so they don't drift apart.*
