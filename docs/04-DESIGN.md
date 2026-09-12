# 04 — Design (UX / UI)

**Product:** MirrorMind
**Related:** [PRD](01-PRD.md) · [Architecture](03-ARCHITECTURE.md) · [API Spec](09-API-SPEC.md)

---

## 1. Design principles

1. **Capture in one gesture.** The camera/upload is the home screen. Nothing between the user and a capture.
2. **Show the memory forming.** Processing is visible and reassuring, not a spinner void.
3. **Evidence over assertion.** Every answer carries its receipts — the original image is one tap away.
4. **Calm, not busy.** A memory app should feel like a quiet notebook, not a dashboard.
5. **Trust the imperfect.** Surface confidence; make correction effortless; never pretend certainty.

---

## 2. Information architecture

```
MirrorMind
├── Capture (home)         "/"        capture + "Recent" strip
├── Timeline               "/timeline" all memories, filterable
├── Memory detail          "/memory/:id"
├── Chat                    "/chat"    ask questions
└── (stretch) Today         "/today"   digest + action items
```

Bottom nav (mobile) / left rail (desktop): **Capture · Timeline · Chat · Today***.

---

## 3. Screens

### 3.1 Capture (home)
- **Hero:** live webcam preview (if permission granted) with a large shutter button; below it a dashed "or drop / choose an image" zone.
- **On capture:** the frame freezes, thumbnail flies into a **Processing card** that shows the pipeline steps as a stepper: `Reading → Understanding → Remembering → Ready`. Each step ticks with a subtle check; ETA text "~7s".
- **Recent strip:** horizontal scroller of the last ~10 memories (thumb + type icon + relative time). Tap → memory detail.
- **Empty state:** friendly line — "Point your camera at a notice, a page, a whiteboard. I'll remember it for you." + a "Try a sample" button that ingests a bundled image.
- **Errors:** permission denied → show upload zone only, with "Enable camera" help. Processing failed → card turns amber with "Couldn't read this clearly" + **Retry** + **Keep anyway** (stores text-only).

### 3.2 Timeline
- **Filter bar:** date chips (`Today`, `This week`, `All`, custom range), type multi-select (icon toggles), tag chips, search field.
- **List/grid toggle.** Default: grouped by day, newest first. Card = thumbnail, type icon + label, title, time, tag pills, confidence dot (green/amber/grey).
- **Infinite scroll**, virtualized.
- **Empty (filtered):** "No memories match. Clear filters."

### 3.3 Memory detail
Two-column on desktop, stacked on mobile:
- **Left:** original image (pinch/scroll zoom; download).
- **Right:**
  - Header: title, type badge, `captured_at` (absolute + relative), confidence band.
  - **Structured card** (varies by type — see §5).
  - **Extracted text** (collapsible; monospace; "Correct text" button → inline editable → Save re-embeds *(stretch)*).
  - **Entities:** chips grouped (Dates, People, Places, Contacts, Subjects). Date chips with a calendar glyph.
  - **Tags:** editable chip input.
  - **Related memories:** small thumbs (from `memory_links`).
  - **Action items:** checkboxes with source link *(stretch)*.
  - Overflow menu: Delete (soft), Re-run extraction, Copy text.

### 3.4 Chat
- Message list; user bubbles right, assistant left.
- Assistant answer renders markdown; **citation chips** `[1] Robotics notice` inline and a "Sources" row of thumbnails beneath the answer.
- Tap a citation → **Memory Drawer** slides up with the image + key fields + "Open full memory".
- Below the answer, a subtle line: `Filters used: this morning · type: notice` (from `used_filters`), tappable to tweak and re-ask.
- Composer: text field, send; suggestion chips when empty ("What did I capture today?", "Any deadlines this week?", "Summarize the whiteboard from this morning").
- **No-memory answer** styled distinctly (muted) with a "Capture it now" button → Capture screen.
- Streaming: tokens appear progressively; a stop button while streaming.

### 3.5 Today (stretch)
- **Digest:** generated paragraph + grouped bullet list by type, each linking to its memory.
- **Action items:** due-soon first; check to complete; "Add to calendar" (v0.4).

---

## 4. Core user flows

### 4.1 First capture
```
Open app → (grant camera) → point at notice → tap shutter
 → Processing card steps through → "Ready" toast
 → tap card → Memory detail: title "Robotics Club — Open House", structured notice card with date + location, text, entities
```

### 4.2 Ask a time-scoped question
```
Chat → "What was written on the robotics club notice I saw this morning?"
 → filters chip shows [this morning · notice]
 → streamed answer + [1] citation → tap → drawer shows the exact photo
```

### 4.3 Multi-source question (the demo)
```
Capture timetable, circular, textbook page (pre-seeded)
 → Chat: "I have a Physics lab clashing with the fee deadline — when's the lab,
          when's the deadline, and what topic is the lab on?"
 → answer combines: timetable (lab Wed 2–4pm, Room 3),
   circular (fees due Wed 5pm), textbook page (lab topic: RC circuits)
 → three source thumbnails
```

---

## 5. Structured cards by type

| Type | Card contents |
|---|---|
| `notice` | Title · body preview · **Dates** (with "add reminder") · Deadlines (highlighted) · Location · Contacts · Issuing body |
| `timetable` | A compact weekly grid (day columns × time rows) built from `slots[]`; "Next class" callout computed client-side against `now` |
| `textbook_page` | Book/chapter/page (if detected) · key terms · a 2-line summary · "Definitions" list |
| `whiteboard` | Summary · bullet list of points · detected diagram note · action items |
| `circuit` | Components list (qty × label) · connections (from→to) · notes/values |
| `handwritten_note` | Summary · checklist/bullets · dates |
| `slide` | Slide title · bullets · presenter/source if visible |
| `other` | Just text + entities |

Cards degrade gracefully: any missing field is hidden, not shown empty.

---

## 6. Component inventory

`AppShell` (nav) · `CapturePanel` (`WebcamView`, `DropZone`, `ShutterButton`) · `ProcessingCard` (`PipelineStepper`) · `RecentStrip` · `MemoryCard` · `FilterBar` (`DateChips`, `TypeToggleGroup`, `TagChips`, `SearchInput`) · `TimelineList` (virtualized, day group headers) · `MemoryDetail` (`ImageViewer`, `StructuredCard` variants, `TextBlock`, `EntityChips`, `TagEditor`, `RelatedMemories`, `ActionItemList`) · `ChatView` (`MessageList`, `AssistantMessage`, `CitationChip`, `SourcesRow`, `FiltersUsed`, `Composer`, `SuggestionChips`) · `MemoryDrawer` · `ConfidenceDot` · `Toast` · `EmptyState` · `ErrorState`.

Built on shadcn/ui primitives (Button, Dialog, Drawer/Sheet, Badge, Tabs, Tooltip, ScrollArea, Skeleton, Command).

---

## 7. Design tokens

```css
/* styles/tokens.css — light is default; dark overrides below */
:root {
  --bg:            #FBFAF7;   /* warm paper */
  --surface:       #FFFFFF;
  --surface-alt:   #F3F1EC;
  --border:        #E6E2D9;
  --text:          #1C1B18;
  --text-muted:    #6B6459;
  --primary:       #3B5BDB;   /* indigo — actions, links */
  --primary-fg:    #FFFFFF;
  --accent:        #12805C;   /* teal-green — "remembered" success */
  --warn:          #B7791F;   /* amber — low confidence / failed */
  --danger:        #C0392B;
  --focus-ring:    #3B5BDB;
  --radius:        14px;
  --radius-sm:     8px;
  --shadow-1:      0 1px 2px rgba(28,27,24,.06), 0 2px 8px rgba(28,27,24,.06);
  --shadow-2:      0 8px 30px rgba(28,27,24,.12);
  --font-sans:     "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono:     "JetBrains Mono", ui-monospace, monospace;
  --step-1:.83rem; --step0:1rem; --step1:1.2rem; --step2:1.5rem; --step3:2rem;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px; --space-8:32px;
}
:root[data-theme="dark"], :root:not([data-theme="light"]) {
  @media (prefers-color-scheme: dark) {
    --bg:#16150F; --surface:#1E1D17; --surface-alt:#26241C; --border:#332F25;
    --text:#F1EEE6; --text-muted:#A69E8E; --primary:#8AA0FF; --primary-fg:#0E1330;
    --accent:#4FD1A5; --warn:#E3B341; --danger:#E7796B;
  }
}
```

Confidence dot: `high → var(--accent)`, `medium → var(--warn)`, `low → var(--text-muted)`.

Type icons (lucide): notice `megaphone` · timetable `calendar-days` · textbook_page `book-open` · whiteboard `presentation` · circuit `cpu` · handwritten_note `pencil` · slide `monitor` · other `file`.

---

## 8. States & feedback

| Surface | Loading | Empty | Error |
|---|---|---|---|
| Recent strip | 3 skeleton cards | "No memories yet" + Try a sample | inline retry |
| Processing card | animated stepper | — | amber card, Retry / Keep anyway |
| Timeline | skeleton grid | contextual empty | full-page retry |
| Memory detail | skeleton right column, blurred image placeholder | — | "Couldn't load memory" retry |
| Chat answer | streaming caret / typing dots | suggestion chips | "Something went wrong — resend" |

Toasts: `Memory ready`, `Saved`, `Deleted · Undo`, `Extraction failed`.

---

## 9. Motion

- Capture: frame freeze (120 ms) → thumbnail scales from viewfinder to processing card (240 ms ease-out).
- Pipeline stepper: each step check pops (spring, low stiffness).
- Chat citation drawer: slide-up 220 ms; backdrop fade.
- Respect `prefers-reduced-motion`: replace transforms with fades.

---

## 10. Accessibility

- All actionable icons have labels; type toggles are a labeled group.
- Image viewer: `alt` = memory title + type; extracted text is the accessible fallback for content.
- Focus trapped in Drawer/Dialog; `Esc` closes; focus returns to trigger.
- Contrast: text on `--bg`/`--surface` ≥ 4.5:1; large text ≥ 3:1 (tokens chosen to pass).
- Live region announces "Memory ready" and streaming completion.
- Full keyboard path for the demo flow: `Tab` to shutter, `Enter` to capture, `g` `t`/`c` shortcuts to Timeline/Chat (documented in a `?` help sheet).

---

## 11. Responsive

- **Mobile (≤ 640):** single column; bottom nav; webcam full-bleed; chat composer sticky.
- **Tablet (641–1024):** two-column memory detail; timeline 2-up grid.
- **Desktop (≥ 1025):** left rail nav; timeline 3–4-up grid; chat centered max-width 760 px; memory detail 60/40 split.
- Wide content (timetable grid, text block, mermaid-ish diagrams) scrolls inside its own container; page never scrolls sideways.

---

## 12. Visual reference (wireframe sketch)

```
┌───────────────────────────────────────────────┐
│  MirrorMind            Capture Timeline Chat   │
├───────────────────────────────────────────────┤
│  ┌───────────────────────────┐   Recent        │
│  │      [ webcam preview ]    │  ┌──┐┌──┐┌──┐   │
│  │                           │  │  ││  ││  │   │
│  │           ( ◉ )           │  └──┘└──┘└──┘   │
│  └───────────────────────────┘                 │
│  or drop an image here                         │
│                                               │
│  ┌ Processing ─────────────────────────────┐   │
│  │ ✔ Reading  ✔ Understanding  … Remembering │   │
│  └─────────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```
