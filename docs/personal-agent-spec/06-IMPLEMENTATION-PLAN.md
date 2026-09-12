# Implementation Plan

Phased by risk/dependency, not by excitement — each phase should be genuinely usable on its own before moving to the next, so the app is never in a half-broken state for long.

## Phase 0 — Deadline engine (foundation)
**Goal:** the shared engine every later phase writes into exists and works with manual input first.
- [ ] Create `deadlines` collection + security rules
- [ ] Build shared `extractDeadline()` function (Claude structured-extraction call)
- [ ] Build `list_deadlines` / `add_manual_deadline` / `mark_deadline_done` agent tools
- [ ] Build the Deadlines dashboard card + full list view
- [ ] Manual add flow works end-to-end
**Definition of done:** Harsh can manually add a deadline via chat or the UI and see it correctly prioritized/colored on the dashboard.
**New env vars:** none beyond existing.

## Phase 1 — Gmail summarizer
**Goal:** already-planned roadmap item; also the first real feed into the deadline engine.
- [ ] Gmail OAuth flow (consent screen, refresh token storage)
- [ ] Inbox fetch + summarization
- [ ] Pipe summarized emails through `extractDeadline()`, write hits to `deadlines` with `source: "email"`
**Definition of done:** a real email with a date in it produces a correctly-dated entry in the Deadlines list without manual intervention.
**New env vars:** `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`

## Phase 2 — WhatsApp triage
**Goal:** passive read/categorize/flag pipeline live.
- [ ] Stand up the always-on Baileys listener (pick hosting: Railway/Render/home machine)
- [ ] QR-link flow, session persistence
- [ ] `/api/whatsapp/sync` endpoint with webhook-secret validation
- [ ] Categorization pipeline (category + reason + deadline extraction)
- [ ] WhatsApp list/detail UI with filter tabs
- [ ] Mute/always-flag override (`whatsapp_chat_rules`)
**Definition of done:** a real incoming message gets correctly categorized within a few seconds and shows up in the right filter tab; a message with a date in it produces a linked deadline.
**New env vars:** `WHATSAPP_SESSION_DIR`, `WHATSAPP_SYNC_WEBHOOK_SECRET`
**Full detail:** `docs/modules/whatsapp-triage.md`

## Phase 3 — Finance, deepened
**Goal:** statement upload + categorization on top of existing manual entry.
- [ ] Decide: migrate existing `expenses` docs into `finance_transactions`, or run in parallel
- [ ] File upload UI (PDF/CSV)
- [ ] Parsing (CSV direct, PDF via text extraction + Claude normalization)
- [ ] Categorization step
- [ ] Dedup logic against existing transactions
- [ ] Review-before-confirm screen
- [ ] Category breakdown + trend views
**Definition of done:** a real statement upload produces a correctly categorized, deduplicated set of transactions that Harsh confirms in one pass without heavy manual correction.
**New env vars:** none beyond existing (unless a PDF-parsing service requires its own key — confirm once a library is chosen).
**Full detail:** `docs/modules/finance-tracking.md`

## Phase 4 — Calling assistant
**Goal:** real inbound/outbound AI calls.
- [ ] Twilio account + India number
- [ ] `/api/twilio/voice` webhook + TwiML
- [ ] ConversationRelay WebSocket handler (deployed as its own always-on service, alongside the WhatsApp listener if consolidating infra)
- [ ] `place_call` agent tool + outbound flow
- [ ] Inbound answer flow
- [ ] Post-call summary/task extraction, write to `calls` + `deadlines`
- [ ] Calls list/detail UI
**Definition of done:** a real outbound call, placed via a chat instruction, completes the stated task and produces an accurate transcript + summary + any extracted tasks.
**New env vars:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `CONVERSATION_RELAY_WS_URL`
**Full detail:** `docs/modules/calling-assistant.md`

## Phase 5 — Polish & extras
Not required for the core to be useful — revisit once Phases 0–4 are solid and in daily use.
- [ ] Daily brief (morning digest pulling from deadlines/whatsapp/wellness/news)
- [ ] Career pipeline tile (surface the existing external job tracker — no rebuild)
- [ ] Course/skill discovery (original roadmap item, still pending)
- [ ] Budgets (`finance_budgets`)
- [ ] Push notifications for urgent deadlines, if the PWA setup supports it

## Cross-cutting setup (do these once, early, regardless of phase order)
- Firestore security rules covering every collection in `docs/04-SCHEMA.md`, not just the ones live today
- Decide and provision WhatsApp-listener/ConversationRelay hosting (can be the same always-on host for both)

## Related docs
`docs/06-IMPLEMENTATION-PLAN.md` mirrors into `docs/07-TRACKER.md` at task granularity — update the tracker as items get checked off, don't let the two drift out of sync.
