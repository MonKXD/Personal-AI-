# Rules

Read alongside `CLAUDE.md`. Where `CLAUDE.md` explains *what this project is*, this file governs *how to behave while working on it*.

## Non-negotiables

1. **Real integrations only, always.** No mock data, no placeholder API responses, not even temporarily "to get the UI working first." If an integration isn't ready yet, the feature isn't built yet — don't fake it.
2. **The WhatsApp module stays passive/read-only.** It must never send a message, never auto-reply, never initiate a chat. If a feature request would require sending a message through the Baileys connection, stop and flag it rather than implementing it — this is a deliberate risk boundary, not an oversight.
3. **No third-party "anti-ban" or WhatsApp-automation middleware packages beyond `@whiskeysockets/baileys` itself.** One popular package in this space was found shipping credential-stealing code. If something claims to reduce ban risk beyond what passive-only usage already provides, treat it as a red flag, not a feature.
4. **Never commit secrets.** `.env*` stays gitignored. If a new integration needs a credential, add it to the env var list in `CLAUDE.md`, don't hardcode it anywhere, even during local testing.
5. **Single-user assumption is permanent for this app.** Don't add multi-tenancy, don't build a signup flow, don't generalize auth beyond "is this Harsh." If something *feels* like it wants multi-user support, that's a sign it's out of scope, not a sign to build it anyway.

## When to proceed vs. when to ask first

**Proceed without asking:**
- Implementing anything already specified in `docs/` — the specs are the contract, build against them
- Fixing bugs, refactoring within a module, improving error handling
- Adding tests, improving logging, tightening security rules

**Ask first:**
- Changing any of the three locked architecture decisions in `CLAUDE.md` (calling approach, WhatsApp approach, finance approach) — these were deliberated, not arbitrary
- Adding a new paid/usage-based external service
- Any change that would make the WhatsApp listener send messages instead of just observing
- Anything that would expose data across a user boundary that doesn't exist yet but might in some hypothetical future (i.e., don't preemptively build for multi-user "just in case")

## Code conventions

- Match whatever's already established in the existing codebase (naming, file structure, component patterns) rather than introducing a second convention for new modules — check existing pages before adding new ones
- Keep agent tool definitions and their corresponding Firestore schema in sync with `docs/04-SCHEMA.md` — if a tool's input/output shape changes, update the schema doc in the same change
- Prefer one shared component over near-duplicate components across modules (see `docs/05-DESIGN.md` for the specific cases already identified: category pills, list→detail layout, summary cards)

## Data handling

- Financial data and call transcripts are sensitive — never log their contents to any third-party service (analytics, error tracking) beyond Firestore itself
- Failed categorization/extraction should land in a visible "needs review" state, never fail silently
- Firestore security rules must cover every collection before it's considered production-ready, not retrofitted later

## Working across sessions

- Read `CLAUDE.md` and `MEMORY.md` at the start of every session — `MEMORY.md` has the decision history and any gotchas discovered mid-build that aren't "requirements" but are worth knowing
- When you make a nontrivial decision or discover a gotcha worth remembering, append it to `MEMORY.md` rather than letting it live only in that session's context
- Keep `docs/07-TRACKER.md` current as tasks complete — it's meant to be edited continuously, not regenerated
