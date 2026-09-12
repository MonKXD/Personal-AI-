# Module: Deadline Engine

**Status: built.** Schema in `db/migrations/0017_deadlines_finance_calls_whatsapp.sql` +
`db/schema.ts` (`deadlines`). Extraction in `lib/deadlines.ts` +
`lib/ai/{types,prompts,gemini,fixtures,index}.ts`. API in `app/api/deadlines/`.
UI at `/deadlines` (`components/app/deadlines-view.tsx`).

Adapted from an earlier Firebase/Firestore spec onto this app's actual
Postgres + Drizzle + Next.js stack — see docs/08-MEMORY.md for the note on
why the shape changed.

## Purpose

One list that flags deadlines regardless of where they came from — manual
entry today, WhatsApp triage and the calling assistant's call summaries once
those are configured (both call `extractDeadline()` on completion).

Note: memory-derived deadlines from the capture pipeline already exist as
`action_items` (dated entities extracted from photos/documents) and are
**not** duplicated into `deadlines` — the Today page's "Action items" card
already covers that source. `deadlines` is for everything else.

## Data model

`deadlines` (see docs/05-SCHEMA.md §New tables (0017)):
`id, user_id, title, due_at, status (pending|done), source (manual|whatsapp|call),
source_ref_id, confidence, created_at, updated_at`.

`status` only ever stores `pending`/`done` — "missed" is never written; it's
computed on read from `due_at` vs now, same pattern the existing
`action_items` overdue flag uses. Priority (`urgent`/`high`/`normal`) is also
computed on read (`computeDeadlinePriority()` in `lib/ai/types.ts`), never
stored, since "due in 3 days" silently becomes "due tomorrow."

## Extraction

`extractDeadline(text, { userId, source, sourceRefId })` in `lib/deadlines.ts`
is the shared step every non-manual source calls instead of reimplementing
date-parsing. One Gemini call (`getDeadlineExtractor()`) returns
`{found, title, dueDate, confidence}`; a row is only written when
`confidence >= DEADLINE_CONFIDENCE_THRESHOLD` (0.6) — a false positive here
erodes trust in the whole list faster than a missed one. Failures are
swallowed (logged via `reportError`) so a flaky AI call never breaks the
caller's own write.

Only Gemini is wired (`AI_PROVIDER=gemini`, or `DRY_RUN=1` for the
deterministic fixture) — same constraint as this app's existing audio/
document extractors; add an Anthropic/Ollama implementation in
`lib/ai/{vision,ollama}.ts`-equivalent files if needed later.

## Priority

Computed in `computeDeadlinePriority(dueAt, now)`:
- `urgent`: due within 24 hours
- `high`: due within 7 days
- `normal`: everything else
- `none`: no due date

## API

- `GET /api/deadlines?status=&before=` — list, sorted by `due_at` ascending
  (nulls last).
- `POST /api/deadlines` `{title, dueDate}` — add a manual deadline.
- `PATCH /api/deadlines/[id]` `{status: "pending"|"done"}`.

## UI

`/deadlines`: add-manual form, list sorted soonest-first, priority-colored
due date, source tag, mark-done toggle. Not yet added to the Today page's
digest — that stays scoped to `action_items` for now; revisit once WhatsApp/
calling are actually producing rows worth surfacing there.

## Notifications

Out of scope, as in the original spec — this app's existing due-soon email
reminder / weekly digest (`app/api/cron/reminders`) covers `action_items`
only; extending it to `deadlines` is a follow-up once a real source other
than manual entry exists.
