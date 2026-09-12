# Schema — Firestore Data Model

This is the authoritative schema reference for the whole app. Detailed per-integration notes (why a field exists, how it gets populated) live alongside each module's implementation doc in `docs/modules/` — this file is the contract those docs implement against.

## Existing collections (inferred from the current build — verify against actual code before relying on this)

These already exist from earlier build phases. Field names below are a best-effort reconstruction based on what those pages do, not a read of the actual code — check the real implementation before writing anything that depends on exact field names.

### `wellness_logs` *(verify name)*
```ts
{
  id: string;
  date: Timestamp;
  // likely: mood/energy rating, sleep, notes, exercise — confirm actual fields in the existing wellness page
}
```

### `study` / `exams` *(verify name)*
```ts
{
  id: string;
  examName: string;
  examDate: Timestamp;
  syllabusChecklist: Array<{ item: string; done: boolean }>;
}
```

### `expenses` *(verify name — likely superseded)*
Likely the precursor to `finance_transactions` below. **Decision needed during Phase 3 (finance):** migrate existing docs into `finance_transactions` with `source: "manual"`, or keep both running in parallel. Migrating is cleaner — don't maintain two collections for the same concept unless there's a real reason to.

---

## New collections

### `calls`
```ts
{
  id: string;                    // Twilio Call SID
  direction: "inbound" | "outbound";
  counterpartNumber: string;     // E.164
  counterpartName: string | null;
  purpose: string | null;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  durationSec: number | null;
  transcript: string;
  summary: string;
  extractedTasks: Array<{ text: string; dueDate: string | null }>;
  status: "in_progress" | "completed" | "missed" | "voicemail";
  recordingUrl: string | null;
}
```

### `whatsapp_messages`
```ts
{
  id: string;
  chatId: string;
  chatName: string;
  sender: string;                 // JID, or "me"
  text: string;
  timestamp: Timestamp;
  direction: "incoming" | "outgoing";
  category: "important" | "deadline" | "routine" | "promotional" | "filtered";
  categoryReason: string;
  deadlineDate: string | null;
  read: boolean;
  archivedFromView: boolean;
}
```

### `whatsapp_chat_rules`
*(new — not previously documented; needed for the mute/always-flag override in `docs/03-APP-FLOW.md`)*
```ts
{
  id: string;                     // chatId
  rule: "mute" | "always_flag";
  setAt: Timestamp;
}
```

### `deadlines`
```ts
{
  id: string;
  title: string;
  dueDate: Timestamp;
  source: "email" | "whatsapp" | "call" | "study" | "manual";
  sourceRefId: string | null;
  priority: "urgent" | "high" | "normal";   // recomputed on read, not trusted as stored truth
  status: "pending" | "done" | "missed";
  createdAt: Timestamp;
  notifiedAt: Timestamp | null;
}
```

### `finance_transactions`
```ts
{
  id: string;
  date: Timestamp;
  amount: number;
  direction: "income" | "expense";
  category: string;
  merchant: string | null;
  note: string | null;
  source: "manual" | "statement_upload";
  statementBatchId: string | null;
}
```

### `finance_statement_batches`
```ts
{
  id: string;
  uploadedAt: Timestamp;
  fileName: string;
  accountLabel: string;
  parsedCount: number;
  status: "processing" | "done" | "error";
}
```

### `finance_budgets` *(optional, stretch)*
```ts
{ id: string; monthlyLimit: number; }
```

---

## Indexes to set up

Firestore composite indexes you'll need once query volume matters (create these when you hit the "missing index" error in the console, which will link you directly to create it — no need to pre-guess every one):
- `deadlines`: `status == "pending"` + order by `dueDate`
- `whatsapp_messages`: `category == X` + order by `timestamp desc`
- `calls`: order by `startedAt desc`
- `finance_transactions`: `date` range + order by `date desc`, and separately by `category`

## Security rules shape

Every collection above: read/write restricted to Harsh's authenticated UID. No collection in this schema should be publicly readable, including seemingly low-stakes ones like `whatsapp_chat_rules`.

## Related docs
`docs/02-TRD.md` · `docs/modules/*.md`
