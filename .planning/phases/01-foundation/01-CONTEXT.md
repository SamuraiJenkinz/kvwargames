# Phase 1: Foundation - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

All TypeScript data contracts, EDIP game data, and Zustand store exist and are stable. Every subsequent layer (backend, UI, LLM integration) builds against these without rework. Also includes Vite/React/Tailwind v4 scaffolding and dev proxy config.

</domain>

<decisions>
## Implementation Decisions

### EDIP data fidelity
- The spec (`WARGAME_ENGINE_DEV_SPEC.md` Section 7) is the authoritative source for all EDIP game data — teams, scenarios, cards, national actions, and game guide text
- All 11 cards, 4 national actions, 4 teams, 2 scenarios, and all guide text fields (objective, redLines, pcThresholds, votingRule, eoMechanic, resourceLogic, facilitation) are transcribed verbatim from the spec into the TypeScript constant
- No corrections or modifications to game data — the spec is final for v1
- If discrepancies are found during implementation between spec sections, the Section 7 `edipConfig.ts` block takes precedence

### Dev tooling setup
- Package manager: pnpm (spec suggests pnpm as primary, npm as fallback)
- Linting: ESLint with TypeScript-aware config (strict mode)
- Formatting: Prettier with sensible defaults (no tabs, 2-space indent, single quotes, trailing commas)
- Test framework: Vitest (native Vite integration, same config, fast)
- No additional tooling beyond what's needed — keep the foundation lean

### Scaffolding scope
- Create the full `src/` folder structure from the spec's project structure (Section 4), adapted for Vite/React instead of Next.js
- Include empty directories for future phases (`components/setup/`, `components/game/`, `components/shared/`, `lib/`, `data/`, `types/`)
- Do NOT create placeholder/stub files for future phases — only files Phase 1 directly delivers (types, data, store, config)
- Backend (`backend/`) folder structure created but empty — Phase 2 populates it
- Root config files: `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts` (Tailwind v4 CSS-first), `.env.example`, `.gitignore`

### Store behavior edge cases
- `initGame` is idempotent — calling it again overwrites all game state cleanly (no confirmation needed, that's a UI concern for Phase 4)
- `resetGame` returns the store to its initial state: `phase: "setup"`, `gameConfig: null`, `gameState: null`, `messages: []`, `llmHistory: []`, `loading: false`, `activeTab: "cards"`
- No state persists across resets — sessions are fully ephemeral per spec
- `configJson` is pre-populated with the EDIP config JSON string on store creation (convenience for the setup screen)
- `applyStateUpdate` silently no-ops on null/undefined fields — only changed fields are applied
- Team updates match by `id`, not array index — if an LLM returns an unknown team ID, that update is silently dropped

### Discretion
- TypeScript interface adaptation from spec's Next.js patterns to Vite/React (path aliases `@/` via `tsconfig.json` paths + Vite resolve alias)
- Zustand store implementation details: middleware choices (devtools in dev, immer if state updates are complex), slice organization
- Exact ESLint/Prettier rule choices beyond the defaults noted above
- Whether to use `zustand/vanilla` for any non-React test utilities
- Vite proxy configuration specifics for `/api/*` routing to FastAPI

</decisions>

<specifics>
## Specific Ideas

- Spec was written for Next.js — all path aliases (`@/`), imports, and project structure need systematic adaptation for Vite/React + FastAPI backend
- The store interface from spec Section 8 is the reference shape — adapt types but preserve the same action surface
- EDIP config constant should be importable and usable for runtime validation in tests (e.g., assert it satisfies `GameConfig` interface, assert 2 scenarios, 4 teams, 11 cards)
- `.env.example` should document both frontend (Vite `VITE_` prefix) and placeholder backend variables even though backend isn't built until Phase 2

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-13*
