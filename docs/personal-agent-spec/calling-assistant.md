# Module Spec: Calling Assistant

## Chosen approach: Twilio Voice + ConversationRelay, real live calls

Twilio handles the phone line, speech-to-text, and text-to-speech; ConversationRelay streams the live conversation to your own WebSocket backend, where Claude decides what to say next and what to log. This is the standard pattern for building an AI voice agent on Twilio — you're not building STT/TTS/telephony from scratch.

## Setup

1. Create a Twilio account, buy a dedicated India voice-capable number — this is the assistant's number, not Harsh's personal SIM
2. Configure the number's voice webhook to point at your `/api/twilio/voice` route, which returns TwiML with a `<Connect><ConversationRelay>` verb pointing at your deployed WebSocket handler (`CONVERSATION_RELAY_WS_URL`)
3. Optional: set up conditional call forwarding from Harsh's personal number (forward-on-no-answer/busy) to the Twilio number, so missed personal calls can be caught by the assistant too — this is a carrier-level setting on his own SIM, not something the app controls

## Outbound flow

1. Agent tool `place_call` is invoked (either directly by Harsh in chat, or by another module — e.g., the deadline engine escalating something)
2. Backend calls the Twilio REST API to originate the call, pointing the call's TwiML at the same ConversationRelay WebSocket handler, passing `purpose` and `instructions` as session metadata
3. Claude conducts the conversation per the given instructions — e.g., "call the clinic, confirm my appointment time for Thursday, ask if I need to bring anything"
4. On call end: generate `summary` and `extractedTasks` from the full `transcript`, write to `calls`; if any extracted task has a date, also write to `deadlines` with `source: "call"`

## Inbound flow

1. Someone calls the Twilio number → webhook → ConversationRelay
2. Claude answers with a short greeting establishing it's Harsh's assistant, asks what they need, and either takes a message or (for known important contacts, if you want this later) offers to try connecting live
3. Same end-of-call summary/extraction/logging as outbound

## Disclosure

Have the assistant briefly identify itself at the start of every call ("Hi, this is Harsh's AI assistant calling on his behalf...") — not strictly required under India's one-party consent standard when Harsh's own assistant is the participant, but it's good practice for outbound calls to people who don't know an AI is calling them, and it avoids awkward "wait, who is this really" moments.

## Data model

See `calls` in `docs/00-firestore-schema.md`.

## Agent tools to register

```json
{
  "name": "place_call",
  "description": "Place an outbound call on Harsh's behalf",
  "input_schema": {
    "type": "object",
    "properties": {
      "to": { "type": "string", "description": "E.164 phone number" },
      "purpose": { "type": "string", "description": "Short label for what this call is for" },
      "instructions": { "type": "string", "description": "What the assistant should say/ask/accomplish on the call" },
      "maxDurationSec": { "type": "number" }
    },
    "required": ["to", "instructions"]
  }
}
```

```json
{
  "name": "get_call_log",
  "description": "List recent calls",
  "input_schema": {
    "type": "object",
    "properties": {
      "since": { "type": "string" },
      "status": { "type": "string", "enum": ["in_progress", "completed", "missed", "voicemail"] }
    }
  }
}
```

```json
{
  "name": "get_call_transcript",
  "description": "Get the full transcript and summary for a specific call",
  "input_schema": {
    "type": "object",
    "properties": { "callId": { "type": "string" } },
    "required": ["callId"]
  }
}
```

## UI

Call log page: reverse-chronological list, each entry showing direction, counterpart, duration, one-line summary, expandable full transcript, and any extracted tasks (linked into the Deadlines card if dated).

## Cost note

Twilio billing is usage-based: number rental (monthly) + per-minute rates for calls + ConversationRelay's own per-minute charge on top. Worth checking current India pricing directly on Twilio's site before committing to heavy usage patterns (e.g., calling many numbers daily).
