# Memory

A running log of decisions, reasoning, and gotchas — not a spec (that's `docs/`), a record of *why* things are the way they are and what's already been tried or ruled out. Read this at the start of every session. Append to it as you go; don't delete history, and don't let it turn into a duplicate of the specs — if something belongs in a spec, put it there and just leave a pointer here.

## Project state as of initial planning (2026-09)

- Existing app already scaffolded: Next.js + Firebase/Firestore + Claude API (tool-use core at `/api/agent`) + Tailwind (dark charcoal/teal-green) + Vercel + PWA
- Already built: dashboard shell, wellness logging, expense logging, study/exam tracker, news digest
- Already planned pre-existing: Gmail summarizer, job/internship discovery via aggregator APIs, course/skill discovery
- This planning pass added: calling assistant, WhatsApp triage, cross-source deadline engine, deepened finance tracking

## Locked architecture decisions (and why)

**Calling — real, live AI calls via Twilio Voice + ConversationRelay.** Chosen over call-recording summarization or logging-only, because it's what was actually asked for, and ConversationRelay makes the "real calls" version genuinely buildable rather than a from-scratch STT/TTS project. India's one-party consent standard for call recording means an AI assistant acting as Harsh, recording its own calls, is on solid legal footing — brief self-identification at the start of a call is a trust/etiquette choice, not a legal requirement.

**WhatsApp — unofficial library (Baileys), strictly passive/read-only.** The official Business API can't read a personal inbox, which was the actual requirement, so it wasn't a real option. Baileys carries real ban risk (roughly one in five unofficial-API accounts banned within a year per community reporting, no appeal process if it happens), but that risk profile is driven almost entirely by *outbound* bot-like behavior — low reply ratio, messaging strangers, robotic timing. A connection that only ever observes and never sends should sit meaningfully below that risk, though not at zero. This is a deliberate, informed trade-off on Harsh's primary personal number — don't relax the passive-only constraint without re-raising the risk conversation first. Explicitly avoid third-party "anti-ban" middleware packages — one was found stealing WhatsApp session data (the `lotusbail` npm package, ~56k downloads, flagged 2026).

**Finance — manual entry + statement upload with AI categorization, not the Account Aggregator framework.** AA is real, RBI-regulated infrastructure (via Setu/Finvu/etc.), but it's usage-based (roughly ₹3–6/account, ~₹2.50/fetch) and generally built for registered FIU businesses — real friction for a personal project with no pressing need for live balances yet. Statement upload gets most of the practical value without that friction. Schema is designed so this can be revisited later without a rebuild.

## Other decisions worth remembering

- **Don't rebuild job search inside this app.** A separate, working automation already runs multi-board searches (LinkedIn, Naukri, Internshala, and a wide set of other India-focused boards) on a schedule, feeding a live tracker Harsh checks daily. The app's job-discovery roadmap item should surface that existing tracker, not duplicate the search logic.
- **Vercel serverless can't host the WhatsApp listener or (likely) the ConversationRelay WebSocket handler.** Both need a small always-on process outside the main Vercel deployment. Worth consolidating both onto the same always-on host to avoid managing two separate pieces of infra.
- **`expenses` (existing) vs. `finance_transactions` (new)** — likely the same concept under two names once Phase 3 lands. Decide at that point whether to migrate or keep parallel; migrating is the cleaner default unless there's a concrete reason not to.

## Open questions not yet resolved

- Exact field names in the existing `wellness_logs`/`study`/`expenses` collections — the schema doc's version of these is inferred, not read from actual code. Confirm before Phase 1+ work touches them.
- Whether push notifications are viable in the current PWA setup — deferred to Phase 5, not yet investigated.
- Whether `finance_budgets` is actually wanted, or whether the breakdown/trend views alone are enough — build only if it comes up again after Phase 3 ships.

## How to use this file going forward

When a future session makes a decision that would be genuinely confusing to re-derive from scratch later (an architecture choice, a "we tried X, it didn't work because Y," a constraint discovered mid-build), add a dated entry under a new `## <date> — <short title>` heading below. Keep entries short — this is a memory aid, not a changelog of every commit.
