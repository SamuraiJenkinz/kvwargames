# Phase 3: UI Design System - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the visual language for the war game console — dark theme, Tailwind v4 CSS tokens, persona colours, fonts, and component primitives. All subsequent UI phases (4–8) build against this system. No functional components or screens are built here — only the design system and a reference page proving the tokens work.

</domain>

<decisions>
## Implementation Decisions

### Dark theme direction
- **Ops/command center aesthetic** — the console should feel like a military briefing room or situation awareness display, not a consumer SaaS app
- **Balanced density** — show key information prominently with comfortable spacing; details available on interaction. Not crammed, not sparse.
- Cool-toned dark backgrounds appropriate for a serious policy exercise context

### Discretion
The user has delegated the following decisions based on research:

**Typography hierarchy:**
- How Syne, DM Sans, and IBM Plex Mono are assigned across the UI (headings, body, data displays)
- Font sizes, weights, and line heights for the balanced density target
- Research may suggest alternative fonts if they better serve the ops/command center aesthetic

**Persona colour treatment:**
- How Kent blue (#5B9BD5), Finch amber (#DFA02A), and Chen green (#2BC48A) are applied — bubble tints, borders, glows, intensity
- Whether bold/vivid or subtle/muted treatment best serves readability and atmosphere
- Colour contrast ratios for accessibility against dark backgrounds

**Component density & style:**
- Badge, track bar, and card styling — rounded vs sharp edges, spacing, visual weight
- Whether to use glassmorphism, flat, outlined, or other treatment
- Custom scrollbar styling details
- Crisis/warning badge colour intensity and treatment

**General principle:** All discretionary decisions should serve the ops/command center feel with balanced information density. When in doubt, prioritise readability and situational awareness over decoration.

</decisions>

<specifics>
## Specific Ideas

- User referenced "ops/command center" as the mood anchor — think military briefing room, situation awareness displays
- Balanced density: facilitator is knowledgeable but shouldn't be overwhelmed — key info prominent, detail on demand
- Persona colours, card category colours, and crisis badge colours are specified in the roadmap success criteria and must all be tokenised

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-ui-design-system*
*Context gathered: 2026-04-13*
