# Phase 4: Setup Screen - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Facilitator-facing pre-game UI: a home landing with two path cards, a Load Config panel that accepts and validates EDIP JSON, a live scenario summary, and scenario-launch buttons that initialise the store and navigate to `/game`. "Generate from Brief" is a visible but non-functional stub (wired in Phase 7). Mid-game exit controls, session resumption, and brief-generation wiring are all out of scope.

</domain>

<decisions>
## Implementation Decisions

### Home screen layout
- Side-by-side cards at 1280px — "Load Config / EDIP Default" and "Generate from Brief" — stack vertically at 768px
- Both cards render with visual parity (equal size/prominence)
- Minimal chrome: app title + subtitle + the two cards. No persistent header bar on home
- Stateless landing — no "resume last session" or history surface on home
- "Generate from Brief" card is visible but disabled, dimmed, with a "Coming in Phase 7" (or similar stubbed) badge; click surfaces a message rather than navigating

### JSON editor UX
- Debounced live parse (~300ms after last keystroke) — scenario summary updates in real-time as typing settles
- Inline error strip below the editor when parse fails — red, clickable to jump cursor to the offending line; Launch buttons disabled while invalid
- Compact read-only preview panel for the summary beside/below the editor: game name, # scenarios, # teams, # cards, # national actions
- Textarea stays editable at all times — facilitator can edit JSON and re-launch with a different scenario without any lock/unlock step

### Scenario selection flow
- Two inline Launch buttons ("Launch Scenario 1" / "Launch Scenario 2") appear directly beneath the summary panel once JSON is valid
- Scenarios show name only — no initial-state preview before launch (Phase 5 handles post-launch state display)
- Launch = immediate navigation to `/game`; no confirmation modal, no toast
- Re-launch is always permitted: clicking either button re-validates and re-initialises the store from whatever JSON is currently in the textarea

### Navigation & guards
- React Router with `/setup` and `/game` routes — real URL routing, refresh works on `/game` via the guard
- `/game` guard: if `gameState` is null, `<Navigate to="/setup" replace />` — silent redirect, no toast or error page
- Back navigation from Load Config panel → a "← Back" (or "← Home") button in the panel header returns to home
- Mid-game exit back to setup is out of scope for Phase 4 — Phase 5's GameHeader owns that control

### Discretion
- JSON editor implementation — choose between plain textarea with monospace + line-number gutter, lightweight syntax-highlighted editor (e.g. react-simple-code-editor + prism), or fuller solution; weigh dep cost against UX. Default leaning: plain textarea + monospace + line numbers unless syntax highlighting is effectively free
- Exact spacing, typography, and card hover/focus treatments on the home screen
- Debounce interval fine-tuning (300ms is a starting point, not a contract)
- Error strip exact wording/format (e.g. "Line 12: Unexpected token '}'") and line-jump UX specifics
- Whether to confirm a "Back to home" click when editor is dirty
- Responsive breakpoints within 768px–1280px window

</decisions>

<specifics>
## Specific Ideas

- Home screen feels like a clean launcher — app title, two cards, nothing else. The stubbed "Generate from Brief" card is honest about being incomplete ("Coming in Phase 7" badge) rather than hidden or faked
- Load Config panel should feel like a power-user tool: JSON on one side, live summary on the other, launch buttons right where the eye lands after reading the summary
- The facilitator is expected to iterate on the JSON — editor must never feel locked or "done"

</specifics>

<deferred>
## Deferred Ideas

- Session resumption / history on home — out of scope; would need persistence layer
- Mid-game "End Session" / return-to-setup control — Phase 5 GameHeader concern
- Generate-from-Brief wiring — Phase 7 (SETUP-04/05)
- Confirmation modals on launch — not needed now; revisit if accidental launches become an issue

</deferred>

---

*Phase: 04-setup-screen*
*Context gathered: 2026-04-13*
