# PRD — Personal AI Agent

## Product, in one line
A single Claude-powered app that runs Harsh's daily life — study, wellness, money, messages, calls, and deadlines — from one dashboard he actually checks every day.

## Owner / user
Harsh only. This is a single-user personal tool, not a product being built for anyone else. Every decision in this doc set optimizes for "does Harsh actually use this daily," not for generalizability, multi-tenancy, or scale.

## Problem statement
Right now the things that matter daily — exam deadlines, job applications, WhatsApp messages worth acting on, money in and out, calls that need making — are scattered across apps, none of which talk to each other, and the ones that most need attention (a message buried in WhatsApp, a deadline mentioned in an email) are the easiest to miss. The goal isn't novelty, it's consolidation plus judgment: one place that actively flags what needs attention instead of Harsh having to remember to check five apps.

## Goals

| Area | What "done" looks like |
|---|---|
| Study | Exam countdowns + syllabus tracking stay current without manual upkeep |
| Wellness | Daily logging is fast enough that it actually keeps happening |
| Finance | Spend is categorized and visible without manual spreadsheet work |
| Email | Inbox gets summarized; anything deadline-shaped gets flagged automatically |
| WhatsApp | Important messages surface; noise gets filtered; nothing with a date attached gets missed |
| Calls | The assistant can make and take calls on Harsh's behalf and always leaves a clean written record |
| Deadlines | One list, fed from every source above, is the actual source of truth for "what's due when" |
| News | A digest exists without Harsh having to go looking for one |

## Explicit non-goals / deferred

- **Not multi-user.** No auth for other people, no sharing, no teams.
- **Not a commercial product.** No billing, no onboarding flow for strangers.
- **Not rebuilding job search.** Job/internship discovery already runs as a separate, working automation (scheduled multi-board searches feeding a live tracker) outside this app. This app's job is to *surface* that tracker, not duplicate the search logic. See `docs/03-APP-FLOW.md` for how that surfacing works.
- **Not live bank data (for now).** Real Account Aggregator integration is deferred — see `docs/modules/finance-tracking.md` for why. This can be revisited later without re-architecting; the schema is designed to accommodate it.
- **Not the official WhatsApp Business API as the primary path.** That API can't read Harsh's existing personal chats, which is the actual requirement — see `docs/modules/whatsapp-triage.md`.

## User stories

- As Harsh, I want to open one dashboard in the morning and see what's due today, so I don't have to check five apps to know if I'm missing something.
- As Harsh, I want WhatsApp messages that matter to be flagged automatically, so recruiter/professor/family messages don't get lost in group-chat noise.
- As Harsh, I want to tell my assistant to call someone and handle a specific task, so I don't have to make routine calls myself.
- As Harsh, I want every call the assistant makes or takes to leave a transcript and summary, so I never have to rely on memory for what was said.
- As Harsh, I want to upload a bank statement and get it categorized automatically, so tracking spend doesn't mean manual data entry.
- As Harsh, I want a single deadlines list that doesn't care whether the deadline came from an email, a WhatsApp message, or a call, so I only have to check one place.

## Success criteria

Qualitative, not metric-driven (single-user personal tool):
- Harsh opens the app daily without it feeling like a chore
- At least one real instance where the deadline engine or WhatsApp triage catches something that would otherwise have been missed
- The calling assistant successfully completes at least one real outbound task end-to-end (call placed, task accomplished, correctly logged)
- Finance categorization is accurate enough that Harsh trusts the spend breakdown without double-checking it manually

## Constraints

- Solo builder, built incrementally around college/job-search time, not a dedicated full-time build
- Cost-conscious: Twilio usage and any future Account Aggregator fetches should have visibility into running cost, not just "find out at the end of the month"
- Everything must work well on a phone via the existing PWA setup — this isn't a desktop-first tool

## Related docs
`docs/02-TRD.md` (technical requirements) · `docs/03-APP-FLOW.md` (user flows) · `docs/06-IMPLEMENTATION-PLAN.md` (phasing)
