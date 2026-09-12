# Module: Calling Assistant

**Status: partially built.** Call placement, logging, and TwiML are real and
wired (`lib/twilio.ts`, `app/api/calls/`, `app/api/twilio/voice/`, `/calls`
UI). The live conversation itself — the actual ConversationRelay WebSocket
handler that streams speech and asks Claude what to say next — is **not**
part of this repo and needs to be built and hosted separately. Nothing here
is mocked: every wired piece talks to the real Twilio REST API and returns a
real 501 with a clear message when unconfigured, rather than pretending to
place a call.

## Chosen approach: Twilio Voice + ConversationRelay, real live calls

Unchanged from the original spec. Twilio handles the phone line, STT, and
TTS; ConversationRelay streams the live conversation to a WebSocket backend
you host, where Claude decides what to say and what to log.

## Why the WS handler isn't in this repo

Same constraint as WhatsApp triage: this app deploys to Vercel serverless
functions, which are short-lived and stateless and cannot hold the
persistent WebSocket connection ConversationRelay requires. `lib/twilio.ts`
only originates calls (REST POST to `/2010-04-01/Accounts/.../Calls.json`,
plain `fetch`, no vendor SDK — kept the dependency footprint small) and
builds the TwiML that points Twilio at `CONVERSATION_RELAY_WS_URL`, a
WebSocket server you host on a small always-on process (Railway, Render,
Fly.io, a home machine) — same hosting shape as the WhatsApp listener.

## What's wired here

- `POST /api/calls` (`place_call`) — validates Twilio + ConversationRelay are
  configured (else 501 with setup instructions), inserts a `calls` row,
  originates the call via `placeOutboundCall()`, stores the Twilio call SID.
- `GET /api/calls`, `GET /api/calls/[id]` — call log + one call's detail.
- `POST /api/twilio/voice` — Twilio's voice webhook (both the outbound call's
  `Url` and, once you point a number's inbound webhook here, incoming calls).
  Validates `X-Twilio-Signature` (`validateTwilioSignature` — Twilio's
  standard HMAC-SHA1 request-validation scheme) before returning TwiML, since
  this endpoint isn't behind a user session. Returns
  `<Connect><ConversationRelay>` pointing at your WS handler, with `purpose`
  and `instructions` passed as `<Parameter>` elements the WS handler reads
  off Twilio's "setup" message.
- `POST /api/calls/[id]/complete` — the WS handler calls this when a call
  ends, authenticated by `CONVERSATION_RELAY_CALLBACK_SECRET` (bearer token,
  not a user session). Writes `transcript`/`summary`/`extractedTasks`/
  `durationSec`, and runs any dated extracted task through the shared
  `extractDeadline()` (source: `"call"` — see docs/modules/deadline-engine.md).

## What you still need to build/host to make a call actually happen

A small always-on process implementing the ConversationRelay WS protocol:
on `setup`, read `purpose`/`instructions` from the custom parameters; on each
`prompt` message (the caller's speech, transcribed by Twilio), call Claude
with those instructions as context and reply with a `text` message (Twilio
speaks it back); on `end`, POST the transcript/summary to
`/api/calls/[id]/complete`. Twilio's ConversationRelay docs cover the exact
message shapes.

## Disclosure

Per the original spec: have the WS handler's Claude turn open every call
identifying itself ("Hi, this is Harsh's AI assistant calling on his
behalf…") — not strictly required under India's one-party consent standard
when it's the user's own assistant, but avoids "wait, who is this" moments
for outbound calls. `buildVoiceTwiml()` sets this as ConversationRelay's
`welcomeGreeting`.

## Data model

`calls` (see docs/05-SCHEMA.md §New tables (0017)): `id, user_id, direction,
counterpart, status, purpose, instructions, transcript (jsonb),
summary, extracted_tasks (jsonb), duration_sec, provider_call_sid,
created_at, updated_at`.

## Cost note

Unchanged from the original spec: Twilio billing is number rental + per-
minute call rates + ConversationRelay's own per-minute charge. Check current
pricing before heavy usage.
