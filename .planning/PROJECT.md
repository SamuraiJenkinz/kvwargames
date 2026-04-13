# War Game Engine

## What This Is

A three-persona AI-powered facilitation tool for structured policy tabletop exercises. It runs alongside a human facilitation team during live wargame sessions — three expert AI personas (Kent Valentina, Dr. Alistair Finch, Dr. Michael Chen) respond in-character to events described by the facilitator, while tracking game state across teams, resources, and crisis escalation. Built for someone else to use at a corporate facilitation table.

## Core Value

Three AI personas respond in-character to facilitator input with accurate, live game state tracking — the tool must enhance the human facilitation team, never slow it down or break immersion.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] LLM proxy API that routes through corporate endpoint (GPT-4o/5, OpenAI-compatible), credentials never reach browser
- [ ] Three visually distinct AI personas (Kent, Finch, Chen) responding in-character via real-time chat interface
- [ ] Persona routing logic — correct persona speaks for correct game event (round starts, card plays, disputes, debrief)
- [ ] Live game state dashboard — crisis severity, EDIP legitimacy, team resources (PC, PO, Readiness, Stock, CRM, IC)
- [ ] State updates from LLM responses — structured JSON parsed and applied with clamping
- [ ] Game configuration via JSON — load a config or generate one from a plain-text brief via LLM
- [ ] EDIP Security of Supply Wargame as canonical first game config (2 scenarios, 4 teams, 11 cards, 4 national actions)
- [ ] In-session reference panels — EDIP cards, national actions, unique team powers, game guide
- [ ] Round advancement with inject delivery and key tension framing
- [ ] Session export — downloadable debrief report
- [ ] Setup flow — home screen, load config (pre-loaded with EDIP default), generate from brief, review/edit JSON, launch scenario
- [ ] Facilitator input bar with action buttons (advance round, end game + debrief, request debrief now)
- [ ] Three-column game layout — state panel (left), chat feed (center), reference panel (right)
- [ ] Dark themed UI designed via Google Stitch — directional from spec, not pixel-perfect
- [ ] Responsive layout (1280px+ primary target, tablet-usable)

### Out of Scope

- Multi-user real-time collaboration — single-facilitator use only
- Authentication / user accounts — handled by corporate SSO layer if needed
- Mobile-first design — facilitation tool used on laptop at a table
- Persistent game history across sessions — session-only state, ephemeral by design
- Full game automation — assists humans, does not replace them
- Pixel-perfect spec UI compliance — Stitch designs the UI using spec as directional guide

## Context

- **Detailed spec exists:** `WARGAME_ENGINE_DEV_SPEC.md` in project root defines TypeScript interfaces, component specs, prompt engineering, game data, routing logic, and UI design tokens. This is the authoritative reference for game mechanics and data models, adapted for our Python+React stack.
- **Domain:** European Defence Industrial Policy (EDIP) — the game simulates crisis response and supply chain coordination between EU member states using EDIP regulatory tools.
- **End user:** A human facilitation team running live policy tabletop exercises at a corporate table. Single facilitator operates the app on a laptop.
- **Corporate deployment:** Runs inside corporate network hitting an internal OpenAI-compatible LLM endpoint (GPT-4o or GPT-5).
- **Game mechanics:** 4 teams, each with 2 character personas and a unique team power. 11 EDIP cards across 7 categories. 4 national actions. Voting system (Support >= 3, Objections <= 1). Resource tracking (PC, PO, Readiness, Stock, CRM, IC) with clamping rules. Crisis state escalation (No Crisis -> Supply Crisis -> Security-Related Supply Crisis).
- **UI approach:** Google Stitch for design system and screen generation. Spec's layout structure, dark theme, persona colour identity, and information hierarchy preserved. Stitch refines spacing, typography, colour harmonization, and polish.

## Constraints

- **Tech stack**: FastAPI (Python) backend + React/Vite frontend — replaces spec's Next.js monolith
- **LLM endpoint**: Corporate OpenAI-compatible API (GPT-4o/5) — all calls proxied server-side, no client-side API keys
- **UI design**: Google Stitch for design system — spec is directional, not prescriptive for exact pixels/hex
- **State management**: Zustand — session-only, no persistence (per spec)
- **Target resolution**: 1280px+ primary, tablet-usable
- **Persona voice**: 2-4 sentences per response, never break character, JSON structured output only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| FastAPI + React/Vite over Next.js | User prefers Python backend; rich UI needs React anyway | -- Pending |
| Directional UI from spec, not pixel-perfect | Stitch produces coherent design system; slavish spec copying defeats purpose | -- Pending |
| Google Stitch for UI design | User preference; produces polished, consistent design foundation | -- Pending |
| Spec as requirements source, GSD derives phases | Spec's phases were for Next.js build; stack change requires different build order | -- Pending |
| Corporate LLM (GPT-4o/5) via OpenAI-compatible proxy | Deployment target is corporate network with internal endpoint | -- Pending |

---
*Last updated: 2026-04-13 after initialization*
