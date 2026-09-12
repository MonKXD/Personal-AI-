# App Flow

## Navigation structure

```
Dashboard (home)
├── Deadlines
├── WhatsApp
├── Calls
├── Finance
│   ├── Transactions
│   └── Upload statement
├── Wellness
├── Study
├── News
└── Settings
    ├── Connections (Gmail, WhatsApp, Twilio status)
    └── Filter rules (WhatsApp mute/always-flag list)
```

Bottom nav (mobile/PWA) should carry the highest-frequency items only — likely Dashboard, Deadlines, WhatsApp, Calls — with Finance/Wellness/Study/News/Settings reachable from the dashboard or an overflow menu, to keep the primary nav thumb-reachable on a phone.

## Key journeys

### 1. Morning check-in (the core daily loop)
```
Open PWA → Dashboard
  → Deadlines card (anything urgent today?)
  → Flagged WhatsApp preview (top 3 important/deadline messages)
  → Wellness quick-log prompt (if not logged yet today)
  → News digest teaser
→ Tap into whichever card needs action
```

### 2. WhatsApp triage
```
WhatsApp tab → filter tabs (Important / Deadlines / Routine / Filtered)
  → tap a message → see category + reason (hover/tap tooltip)
  → if category == deadline → linked deadline entry, one tap to view in Deadlines
  → option to override: mute this chat / always-flag this chat
```

### 3. Placing an outbound call
```
Chat with agent ("call the clinic and confirm my Thursday appointment")
  → agent invokes place_call tool
  → call happens live via Twilio/ConversationRelay
  → on completion: summary + transcript appear in Calls tab
  → any extracted task with a date also appears in Deadlines
```

### 4. Reviewing a call
```
Calls tab → reverse-chronological list → tap entry
  → summary at top, full transcript below (collapsed by default)
  → extracted tasks shown as a checklist, linkable to Deadlines
```

### 5. Uploading a bank statement
```
Finance → Upload statement → select file + label account (e.g. "HDFC Savings")
  → processing state shown (parsing → categorizing → done)
  → review screen: parsed transactions with suggested categories, editable before final save
  → confirm → transactions appear in the main Transactions view
```

### 6. Deadline lifecycle
```
Created (from email/WhatsApp/call extraction, or manual add)
  → appears in Deadlines card, colored by urgency
  → Harsh marks done, or it ages into "missed" if dueDate passes unaddressed
  → done/missed items drop out of the default view but remain queryable
```

### 7. First-time setup (run once per integration)
```
Settings → Connections
  → Gmail: OAuth consent flow → refresh token stored
  → WhatsApp: "Link WhatsApp" → QR code shown → scan with phone's WhatsApp app → connected
  → Twilio: shows configured number once env vars are set (this one's config-file-driven, not an in-app flow)
```

## Screen-level notes

- **Dashboard** is the only screen that reads from multiple collections at once — worth a single aggregated API route (see TRD) rather than the page firing off five separate client-side fetches
- **WhatsApp** and **Calls** are both fundamentally "list → detail" patterns — share a layout component between them rather than building two bespoke list views
- **Finance** is the only module with a multi-step flow (upload → review → confirm) — don't collapse the review step even though it adds friction; silently trusting AI-categorized financial data without a review step is the kind of thing that erodes trust in the whole app if it gets something wrong once

## Related docs
`docs/01-PRD.md` · `docs/05-DESIGN.md` (visual treatment of these flows)
