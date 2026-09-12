# Module: WhatsApp Triage

**Status: partially built.** The receiving side — categorization, storage,
filter rules, deadline extraction, the `/whatsapp` inbox UI — is real and
wired. The passive Baileys listener itself (the process that actually
watches WhatsApp) is **not** part of this repo and must be run as a separate
always-on process, same constraint as the calling assistant's WS handler.

## Chosen approach: Baileys, strictly passive/read-only

Unchanged from the original spec — this constraint is load-bearing. The
listener observes and categorizes messages. It never sends messages, never
auto-replies, never initiates a chat. WhatsApp's ban detection weighs
outbound behavior heavily; a silent observer doesn't trip those signals the
way an active bot does. Risk is reduced, not eliminated — Baileys is still an
unofficial client impersonating a linked device.

**Security requirement, unchanged:** use only the core `@whiskeysockets/baileys`
package. Do not add third-party "anti-ban middleware" — one such package with
tens of thousands of downloads was found exfiltrating WhatsApp session
credentials and message content. The passive-only design is the actual
mitigation; extra middleware adds attack surface, not protection.

## Why the listener isn't in this repo

Baileys holds a long-lived WebSocket connection to WhatsApp's servers —
incompatible with this app's Vercel serverless deployment. It needs to run
as a small always-on Node process (Railway, Render, Fly.io, a home machine),
authenticate once via QR code (standard "linked device" flow), persist its
session locally, and POST each incoming message to this app's
`/api/whatsapp/sync` instead of writing to the database directly — so all
categorization logic stays in one place (this repo).

## What's wired here

- `POST /api/whatsapp/sync` — the listener's only integration point.
  Authenticated by `WHATSAPP_SYNC_WEBHOOK_SECRET` (bearer token — the
  listener isn't a browser, so there's no user session to check). Body:
  `{userId, chatId, chatName?, sender?, text, timestamp, direction, recentContext?}`.
  `userId` is passed explicitly because this is a personal, single-account
  WhatsApp link, not a per-chat OAuth flow.
  - Applies any per-chat filter rule first (`mute` → `filtered` without an AI
    call; `always_flag` → `important`).
  - Otherwise runs `getWhatsappCategorizer()` (one Gemini call: chat name,
    sender, message text, a short recent-context window) →
    `{category, reason}`.
  - If `category === "deadline"`, also runs the shared `extractDeadline()`
    (source: `"whatsapp"` — see docs/modules/deadline-engine.md).
  - Writes the categorized message to `whatsapp_messages`.
- `GET /api/whatsapp/messages?category=` — list, newest first.
- `GET/POST /api/whatsapp/filters` — per-chat mute / always-flag rules
  (`whatsapp_filter_rules`).

## Categorization

Categories: `important`, `deadline`, `routine`, `promotional`, `filtered`
(`WHATSAPP_CATEGORIES` in `lib/ai/types.ts`). `reason` is kept to one short
sentence — shown as a hover tooltip in the UI so the user can sanity-check
why something got flagged or filtered. Only Gemini is wired
(`AI_PROVIDER=gemini`, or `DRY_RUN=1` for the deterministic fixture).

## Data model

`whatsapp_messages`, `whatsapp_filter_rules` (see docs/05-SCHEMA.md §New
tables (0017)).

## UI

`/whatsapp`: category tabs (All/Important/Deadlines/Routine/Promotional/
Filtered), category pill with the reason as a tooltip, one-click mute per
chat.

## What you still need to build/host to receive real messages

A small standalone Node script using `@whiskeysockets/baileys`: connect,
scan the QR once, persist the auth folder, and on every incoming message
`POST` its fields to `${SITE_URL}/api/whatsapp/sync` with
`Authorization: Bearer <WHATSAPP_SYNC_WEBHOOK_SECRET>`. Kept out of this
repo's own `package.json`/build on purpose — Baileys pulls in a large,
telephony-specific dependency tree that has no reason to ship with the
Next.js app or slow down its Vercel build. Run it as its own small project
on whatever always-on host you pick.
