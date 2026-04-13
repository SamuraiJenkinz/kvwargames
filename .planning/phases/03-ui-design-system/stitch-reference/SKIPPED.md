# Stitch Layout Directionals — Skipped

**Date:** 2026-04-13
**Plan:** 03-01
**Status:** SKIPPED — Stitch MCP tools unavailable in execution environment

## Attempt Summary

Attempted to invoke `mcp__stitch__*` MCP tools to generate dark-themed game layout directionals. The tools are not available in this Claude Code execution environment.

## Design Brief (for manual use or future Stitch run)

If you want to run this manually via Google Stitch, use the following brief:

### Aesthetic
Military briefing room / situation awareness display. NOT consumer SaaS.

### Screens to Generate
1. **Game Screen** — three-column layout:
   - Left: StatePanel (~210px) — round indicator, crisis state, key metrics
   - Center: ChatFeed (flexible) — AI persona responses, facilitator input
   - Right: ReferencePanel (~252px) — EDIP cards, reference data
2. **Setup/Home Screen** — two-path entry:
   - Load existing config (file picker / list)
   - Generate from brief (textarea + generate button, stubbed in Phase 3)

### Colour Palette
- Background: `#060810` (near-black)
- Panel surfaces: `#0D1117` (cool-toned dark)
- Border/dividers: `#1C2333`
- Persona Kent: `#5B9BD5` (blue accent)
- Persona Finch: `#DFA02A` (amber accent)
- Persona Chen: `#2BC48A` (green accent)
- Text primary: `#E8EAF0`
- Text secondary: `#8892A4`
- Muted labels: `#4A5568`

### Typography
- Display/headings: Syne (bold weight)
- Body/UI labels: DM Sans
- Data values/section headers: IBM Plex Mono

### Component Style
- Flat / outlined only
- Sharp corners (border-radius: 2px max)
- No glassmorphism, no gradients, no rounded cards
- Density: balanced — key info prominent, details on hover/interaction

### Header
- Game title (left): "KV War Game"
- Round indicator (center): "ROUND 3 OF 8"
- Scenario name (right): e.g. "EDIP Crisis Simulation"

## Impact on Downstream Work

None. All design tokens are authoritative from the spec in `03-RESEARCH.md`:
- Token hex values are confirmed and do not depend on Stitch output
- Layout dimensions are defined in the spec
- Phase 5 (game screen layout) can proceed directly from the spec

This plan is best-effort and does not block any subsequent plans.
