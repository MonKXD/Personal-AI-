# Module Spec: WhatsApp Triage

## Chosen approach: Baileys, strictly passive/read-only

**This constraint is load-bearing — do not relax it while building.** The listener observes and categorizes messages. It never sends messages, never auto-replies, never initiates a chat. This isn't a stylistic choice — it's the specific thing that keeps this meaningfully lower-risk than a typical WhatsApp bot, since WhatsApp's ban detection weighs outbound behavior (reply ratio, messaging strangers, robotic timing) heavily. A silent observer doesn't trip those signals the way an active bot does. Risk is reduced, not eliminated — Baileys is still an unofficial client impersonating a linked device, and that alone carries some residual risk.

### Security requirement: no third-party "anti-ban" packages

Use the core `@whiskeysockets/baileys` package only. Do not add community "anti-ban middleware" packages beyond that — one such package with tens of thousands of downloads was found shipping code that exfiltrated WhatsApp session credentials and message content to a third party. The passive-only design is the actual risk mitigation here; extra middleware adds attack surface without adding real protection.

## Architecture wrinkle: this needs a persistent process

Baileys holds a long-lived WebSocket connection to WhatsApp's servers — that's fundamentally incompatible with Vercel's stateless, short-lived serverless functions. This module needs to live outside the main Next.js deployment:

- A small always-on Node process — a cheap always-on host (Railway, Render, Fly.io, a low-cost VPS) or even a Raspberry Pi/always-on machine at home, if you want zero recurring cost
- It authenticates once via QR code (scan with the WhatsApp app on your phone, standard "linked device" flow) and persists its session to `WHATSAPP_SESSION_DIR`
- On each incoming message, it calls a small internal sync endpoint on the main Next.js app (authenticated with `WHATSAPP_SYNC_WEBHOOK_SECRET`) rather than writing to Firestore directly, so all the categorization logic stays in one place

## Data flow

1. Baileys listener receives a message → POSTs raw `{chatId, chatName, sender, text, timestamp, direction}` to `/api/whatsapp/sync`
2. `/api/whatsapp/sync` runs the message through a Claude categorization call:
   - Categories: `important`, `deadline`, `routine`, `promotional`, `filtered`
   - If `deadline`, also runs the shared `extractDeadline()` from the deadline engine and writes to `deadlines` with `source: "whatsapp"`
3. Writes the categorized message to `whatsapp_messages`

## Categorization prompt shape

Give Claude the message text, sender/chat name, and a short recent-context window (last few messages in that chat, for continuity) — ask for `{category, reason, isDeadline, deadlineDate?}` as structured output. Keep the `reason` short (one sentence) — it's shown as a hover tooltip in the UI so Harsh can sanity-check why something got flagged or filtered.

## Filtering rules

Beyond the AI categorization, support simple user-configurable overrides stored alongside chat metadata:
- Mute a chat entirely (never surface, still logged for search but hidden from the main view)
- Always-flag a chat/contact as important (e.g., recruiters, professors, family)
- Keyword-based auto-filter for the `promotional` bucket (common spam/marketing patterns)

## UI

A WhatsApp inbox mirror page: list view grouped by chat, category pill on each message, filter tabs (Important / Deadlines / Routine / Filtered), click-through to the extracted deadline where relevant.

## Agent tools to register

```json
{
  "name": "get_flagged_whatsapp_messages",
  "description": "Get recent WhatsApp messages by category",
  "input_schema": {
    "type": "object",
    "properties": {
      "category": { "type": "string", "enum": ["important", "deadline", "routine", "promotional", "filtered"] },
      "since": { "type": "string", "description": "ISO datetime" }
    }
  }
}
```

```json
{
  "name": "set_whatsapp_filter_rule",
  "description": "Mute or always-flag a specific WhatsApp chat",
  "input_schema": {
    "type": "object",
    "properties": {
      "chatId": { "type": "string" },
      "action": { "type": "string", "enum": ["mute", "always_flag"] }
    },
    "required": ["chatId", "action"]
  }
}
```
