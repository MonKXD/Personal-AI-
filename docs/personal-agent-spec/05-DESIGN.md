# Design

## Important note before using this doc
The app already has a design system in place (dark charcoal + teal-green, per the existing build). The tokens below are **suggested starting values** for the new modules to stay consistent with — reconcile them against whatever's actually already defined in the existing `tailwind.config` rather than treating these as ground truth. Don't introduce a second, slightly-different dark theme by accident.

## Suggested tokens (reconcile against existing config)

```
Background:        charcoal, near-black (e.g. #16181D range)
Surface/card:       one step lighter than background (e.g. #1E2127 range)
Primary accent:     teal-green (e.g. #2DD4A7 range)
Text (primary):     off-white (e.g. #E8EAED)
Text (muted):       mid-gray (e.g. #8A8F98)
Border/divider:     low-contrast gray, barely-there
```

Status colors (used for deadline priority, WhatsApp category pills, call status):
```
Urgent / important:  warm red-orange, kept low-saturation so it doesn't fight the teal accent
High / deadline:     amber
Normal / routine:    the muted text-gray, i.e. deliberately unemphasized
Filtered / done:     lowest visual weight — should recede, not draw the eye
```

## Typography

Match whatever's already established for the existing pages. If nothing's formally defined yet: one sans-serif family, three weights (regular/medium/semibold) is enough — avoid introducing a second typeface for new modules.

## Spacing

Standard 4px-based scale (4/8/12/16/24/32) — nothing unusual needed here, just consistency with whatever the existing pages already use.

## Component patterns

- **Category/status pill** — small rounded-full badge, used for WhatsApp category, deadline priority, call status, finance transaction direction. One shared component, colored via the status-color tokens above, not four separately-styled badges per module.
- **List → detail pattern** — shared between WhatsApp, Calls, and Deadlines: a scrollable list on the left/top, tap-through to a detail view. Build this as one reusable layout, not three.
- **Card** — the dashboard's summary cards (Deadlines, WhatsApp preview, Wellness prompt, News teaser) should all be one `<SummaryCard>` component with a title, a compact preview, and a "view all" link — not bespoke per card.
- **Upload/processing flow** — the finance statement upload needs a 3-state visual (uploading → processing/categorizing → review-and-confirm) — a simple stepper or progress indicator, not a full-page spinner that hides what's happening.
- **Empty states** — every list view (no deadlines, no flagged messages, no calls yet) needs a real empty state, not a blank screen — a short reassuring line ("Nothing flagged right now") rather than nothing at all.

## Per-module layout notes

- **Dashboard** — information-dense but scannable; this is the screen Harsh sees most, so prioritize glanceability over completeness. Everything here should be a summary with a link to the full view, never the full view itself.
- **WhatsApp** — filter tabs need to be reachable with one thumb-tap, they're the primary navigation within this screen
- **Calls** — transcript should be collapsed by default (summary-first), since most of the time the summary is all that's needed
- **Finance** — the category breakdown chart is the thing Harsh will look at most; transaction table is secondary and can be denser/smaller text
- **Deadlines** — sort order (soonest first) and color-coding are doing most of the communication work here — keep the row itself simple (title, source icon, due date, priority color) rather than cramming in extra detail

## Mobile/PWA specifics

- Design for one-handed phone use first — this is explicitly not a desktop-first tool
- Keep primary navigation within thumb reach (bottom nav, not top nav, on mobile widths)
- Respect safe-area insets for the PWA install context (notches, home indicators)
- Loading states matter more here than on desktop — mobile data can be slow; every async action needs a visible loading state, not just a delayed appearance

## Accessibility baseline

- Dark theme contrast: verify text-on-background and text-on-surface both clear WCAG AA (4.5:1) — easy to accidentally fail this on a charcoal background with muted gray text
- Tap targets minimum ~44px, especially on the filter tabs and list rows that get tapped constantly
- Status shouldn't be color-only — the priority/category pills should carry a label or icon too, not just a color, since color alone isn't accessible

## Related docs
`docs/03-APP-FLOW.md` (the flows these patterns support)
