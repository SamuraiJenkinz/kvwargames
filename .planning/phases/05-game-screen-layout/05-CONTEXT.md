# Phase 5: Game Screen Layout - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete three-column game interface against mock data. Every visual component, message type, and interactive element is implemented and styled before any real LLM is wired in. Layout, ChatFeed (all seven message types), StatePanel (tracks + team cards + badges + persona dots), ReferencePanel (CARDS / ACTIONS / GUIDE), and FacilitatorInput (with stubbed store actions) all render and interact correctly. LLM wiring, real state mutations, debrief export, and brief generation are out of scope — they live in Phases 6–7.

</domain>

<decisions>
## Implementation Decisions

### Chat feed behaviour

- **Auto-scroll policy:** Sticky-bottom with escape hatch. If the facilitator is within ~100px of the bottom when a new message arrives, auto-scroll them down. If they've scrolled up to review earlier messages, do NOT yank them back — show a "↓ New message" pill floating above the input that scrolls to bottom on click.
- **Persona avatars:** Coloured circles with a single initial (K / F / C), 32px diameter, using the persona's theme colour as the fill (Kent blue `#5B9BD5`, Finch amber `#DFA02A`, Chen green `#2BC48A`). White letter, medium weight. Sits left of the bubble.
- **Bubble attribution:** Persona name + timestamp displayed above the bubble (small, muted). Facilitator bubbles right-aligned with no avatar (just a subtle label "You").
- **Message entrance animation:** Fade-in + 8px Y translate up, 180ms `ease-out`. Single animation per message append. Respects `prefers-reduced-motion` — skip animation when reduced motion is set.
- **Loading indicator:** Rendered as a persona-attributed bubble at the feed bottom (avatar + animated three-dot indicator). The facilitator sees *which* persona is thinking. Replaces into the real message when the response arrives. (Phase 5 shows a static demo loading bubble in one persona's colour as part of the mock state.)
- **Round divider:** Horizontal rule with centered label "Round N" — muted text, thin divider line in neutral border colour.
- **Debrief divider:** Horizontal rule with centered "DEBRIEF" label in Finch amber (matches spec).
- **Error bubble:** Full-width, red tinted background, red left border, icon + message text. Visually distinct from persona bubbles — not a bubble shape, more a banner inside the feed.

### State panel dynamics

- **Track bar animations:** Smooth value interpolation over 300ms `ease-out` on change. No flash, no pulse on threshold cross — the badge state change is the threshold cue. Keep visuals calm and professional.
- **PC warning badges:** Small pill next to the team name. "STRAINED" in amber, "CRISIS" in red. CRISIS pill uses a subtle opacity pulse (0.6 → 1.0, ~1.5s cycle, leveraging the existing `--animate-blink` token from Phase 3) — not a hard blink. STRAINED is static amber.
- **Badge thresholds:** Driven by the resource values in mock/real state per the canonical EDIP rules. Phase 5 reads them from `teamState` fields; the actual threshold logic is a pure function consumed by the StatePanel component.
- **Persona indicator dots:** Three dots in persona order (Kent, Finch, Chen), each coloured in its persona tint. Dot is lit at full saturation when that persona has responded at least once in the current round; dimmed to ~25% opacity otherwise. Gives facilitator an at-a-glance coverage read. Resets visually when round advances.
- **Team resource card layout:** Compact two-column grid inside each team card — label (muted, small, uppercase) + value (larger, medium weight). Six fields per team (PC, PO, RDY, STK, CRM, IC). Four team cards stacked vertically. Fits the ~210px column width without horizontal scroll.
- **Track bar styling:** Severity track uses red fill on neutral track, labelled 0–5 with numeric current value on the right. Legitimacy track uses blue fill, labelled −2 to +2 with zero centred. Both tracks have inline numeric value.

### Reference panel interactions

- **Tab structure:** Three tabs at the top of the panel: CARDS, ACTIONS, GUIDE. Active tab: underline + full-opacity label. Inactive tabs: 60% opacity. Click to switch.
- **Scroll preservation:** Each tab preserves its own scroll position when the facilitator switches away and back. (Keeps their place in the GUIDE if they flip over to CARDS for a quick check.)
- **Card detail view:** In-panel replacement — clicking a card in the list replaces the list view with a detail view inside the same panel. A "← Back" affordance at the top returns to the list. Modal overlays are rejected (they obstruct the chat, which is the facilitator's primary workspace during live play). Inline expansion is rejected (fights for vertical space in a 252px column).
- **Card list item:** Category colour chip (left edge, 4px wide), card name, one-line blurb. Category colours come from Phase 3 tokens.
- **Card detail view content:** Card name, category badge, full description, mechanical effects, and any persona-specific notes. Scrollable if long.
- **ACTIONS tab:** Two sections — "National Actions" (4 items) and "Team Unique Powers" (4 items). Each item: name + short description. No interactive detail view needed for actions; they're reference-only text.
- **GUIDE tab layout:** All six guide sections rendered flat, scrolled vertically, with bold section headers and dividers between sections. No accordion — facilitators skim during live play, and expand-collapse clicks hurt flow. Table of contents skipped for Phase 5 (sections are short enough to scroll).

### Mock data strategy + facilitator input UX

- **Mock state snapshot:** One mid-game Round 2 state that exercises every visual in one render. Specifically:
  - `crisisSeverity: 3`, `edipLegitimacy: +1` (non-zero on both tracks so animations are visible on future changes).
  - One team in **STRAINED** state, a different team in **CRISIS** state (so both badge variants render simultaneously).
  - A message history containing at least one of every chat message type: Kent bubble, Finch bubble, Chen bubble, facilitator bubble, round divider (Round 1 → Round 2), one error bubble from a simulated earlier failure, one debrief divider (as a preview of the debrief visual — clearly marked "SAMPLE" in mock context if needed, OR omit the debrief divider from the default mock and include it in a second mock scenario file).
  - A loading indicator bubble as the tail of the feed to show the typing state.
  - Persona indicator dots: two personas lit, one dim (shows the "partial round coverage" state).
- **Mock injection mechanism:** A dev-only helper in `src/mocks/` that seeds the Zustand store with the mock state. Phase 5 wires it into the `/game` route mount path only when `gameState` is null AND `import.meta.env.DEV` is true (so the game screen is always visible during development without going through the setup flow). Production build still requires Launch from the setup screen.
- **Facilitator input layout:** Two-row composition. Top row: action button toolbar — "Round Start", "Trigger Debrief", and a card/national-action quick-insert dropdown or button group. Bottom row: textarea + Send button on the right.
- **Action button behaviour (Phase 5 stubs):** Each action button dispatches a stub store action that appends a placeholder assistant message (e.g., "Round Start" appends a round divider + a stub Kent framing bubble with mock text). Phase 6 replaces these with real LLM triggers. The point of Phase 5 is to prove the wiring exists.
- **Send / Enter behaviour:** Plain Enter submits the current input. Shift+Enter inserts a newline (standard pattern, universal escape hatch). Send button is equivalent to pressing Enter.
- **Disabled state visual:** When loading, the textarea and all buttons go to 50% opacity with `cursor-not-allowed`, and the textarea is `disabled`. No spinner on buttons — the persona-attributed loading indicator in the chat feed carries the "work in progress" signal.
- **Empty input handling:** Send button and Enter are no-ops when the input is empty or whitespace-only.

### Discretion

- Exact spacing, padding, and typography scale within the design tokens already defined in Phase 3.
- The exact curve and duration of the track bar value interpolation (within the "smooth, calm, ~300ms" envelope).
- Whether the card detail "← Back" is a button or a header with an icon — either is fine as long as it's obvious.
- Whether the action button toolbar uses icons, text labels, or both — pick whatever reads cleanest at the column width available.
- Implementation of the mock state file — single TypeScript module or JSON, as long as it type-checks against `GameState`.
- Component splitting granularity (sub-components within ChatFeed, StatePanel, ReferencePanel) — planner and implementer's call.

</decisions>

<specifics>
## Specific Ideas

- **Slack/Discord auto-scroll model** for the chat feed — users expect the "scroll-up to review, new-message pill appears" pattern; don't reinvent it.
- **Linear's issue-card restraint** for the team resource cards — clean, dense, no visual noise.
- **Persona-attributed loading bubble** (who's thinking) is the most important single UX choice in the chat feed — it mirrors what facilitators actually want to know in the 25–35s LLM round-trip window in Phase 6.
- **Calm > flashy.** This tool is used in live professional facilitation. Animations should reassure, not entertain. No bouncy springs, no rainbow state transitions.

</specifics>

<deferred>
## Deferred Ideas

- Actual LLM wiring of the action buttons and send flow — **Phase 6**.
- Real state mutations from LLM responses (clamping, deltas) — **Phase 6**.
- Debrief export (`.md` download) — **Phase 7**.
- Generate-from-brief wiring — **Phase 7**.
- A second mock scenario file for visually testing the debrief divider in isolation — backlog; not required if the default mock includes it.
- Search / filter on the CARDS tab — no requirement in scope; backlog for a future UX phase.
- Collapsible StatePanel or ReferencePanel for narrow viewports — **Phase 8 / future responsive work**. Phase 5 ships 1280px primary + 768px usable per Phase 3 acceptance.
- Keyboard shortcuts beyond Enter / Shift+Enter (e.g., Cmd+K card search, 1/2/3 tab switching) — backlog.

</deferred>

---

*Phase: 05-game-screen-layout*
*Context gathered: 2026-04-14*
