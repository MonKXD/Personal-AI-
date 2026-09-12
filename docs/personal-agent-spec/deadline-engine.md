# Module Spec: Deadline Engine

**Build this first** — email, WhatsApp, and calls all feed into it, so it needs to exist before those modules do.

## Purpose

One engine that flags deadlines regardless of where they came from, instead of the study tracker being the only thing that counts down to something. "I have a deadline" should mean the same thing whether it came from an email, a WhatsApp message, a call, or something typed in manually.

## Data model

See `deadlines` in `docs/00-firestore-schema.md`.

## Extraction approach

Each source module (email summarizer, WhatsApp triage, call summary) runs its content through a shared extraction step rather than each reimplementing its own date-parsing logic:

```ts
// shared/extractDeadline.ts
async function extractDeadline(text: string, context: { source: string; sourceRefId: string }):
  Promise<{ found: boolean; title?: string; dueDate?: string; priority?: "urgent"|"high"|"normal" }>
```

Implementation: a single Claude tool-call with a structured extraction prompt — pass the message/email/call-transcript text, ask for `{found, title, dueDate, confidence}` as structured output. Only write to `deadlines` when confidence is reasonably high; low-confidence hits are better surfaced as a "possible deadline?" prompt than silently created, since false positives erode trust in the flagging fast.

## Priority scoring

- `urgent`: due within 24 hours
- `high`: due within 7 days
- `normal`: everything else

Recompute priority on read (not stored as static), since "due in 3 days" becomes "due tomorrow" without anything else changing.

## Agent tools to register

```json
{
  "name": "list_deadlines",
  "description": "List upcoming deadlines, optionally filtered by status or a cutoff date",
  "input_schema": {
    "type": "object",
    "properties": {
      "status": { "type": "string", "enum": ["pending", "done", "missed"] },
      "before": { "type": "string", "description": "ISO date cutoff" }
    }
  }
}
```

```json
{
  "name": "add_manual_deadline",
  "description": "Add a deadline Harsh mentions directly in conversation",
  "input_schema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "dueDate": { "type": "string", "description": "ISO date" }
    },
    "required": ["title", "dueDate"]
  }
}
```

```json
{
  "name": "mark_deadline_done",
  "description": "Mark a deadline as completed",
  "input_schema": {
    "type": "object",
    "properties": { "deadlineId": { "type": "string" } },
    "required": ["deadlineId"]
  }
}
```

## UI

A "Deadlines" card on the dashboard: sorted by `dueDate` ascending, color-coded by priority (urgent = red-ish accent within the existing teal-green palette, high = amber, normal = default), each item showing its source icon (email/WhatsApp/call/study/manual) and linking back to `sourceRefId` where applicable.

## Notifications

Out of scope for the first build — revisit once the PWA's push-notification setup (if any) is confirmed working. For now, the dashboard card and the daily brief (see project brief's "additional recommendations") are the surfacing mechanism.
