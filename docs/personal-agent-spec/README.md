# Original spec set (reference only)

These are the original module specs as they were first written and uploaded —
for a Firebase/Firestore stack (`CLAUDE.md`, `RULES.md`, `MEMORY.md`,
`01-PRD.md` through `07-TRACKER.md`, and the four module docs). Kept here
verbatim for reference and history.

**The actual build in this repo does not use Firebase.** It was adapted onto
this repo's real stack — Next.js (App Router), Supabase Postgres + Drizzle
ORM, Supabase Auth/Storage/RLS — inherited from the codebase this project
was forked from. The adapted, currently-accurate module docs live in
[`docs/modules/`](../modules/); `docs/06-RULES.md`, `docs/08-MEMORY.md`, and
`docs/15-BUILD-LOG.md` at the repo root describe the actual engineering
conventions and what's built. Where this folder's specs disagree with those
(stack, data model, tool-calling pattern), the root docs win.
