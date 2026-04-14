---
phase: 05-game-screen-layout
plan: 02
subsystem: ui
tags: [zustand, vitest, tailwind, persona, typescript]

# Dependency graph
requires:
  - phase: 04-setup-screen
    provides: gameStore with immer/devtools, GameState, ChatMessage types
  - phase: 03-ui-design-system
    provides: persona-kent/finch/chen Tailwind @theme colour tokens
  - phase: 01-foundation
    provides: PersonaId, MessageType types in src/types/game.ts

provides:
  - PERSONA_META record (KV/AF/MC initials, bubble/dot/colour classes per persona)
  - PERSONA_ORDER iteration array
  - getPcBadge pure function (CRISIS/STRAINED/null from PC value)
  - getPersonasThisRound pure function (Set<PersonaId> since last round_divider)
  - advanceRound store action (round increment + round_divider + kent stub)
  - triggerDebrief store action (debrief_divider + facilitator stub)
  - sendFacilitatorMessage store action (trim, no-op guard, loading flag)

affects:
  - 05-03 onwards (every chat/state panel component imports personaConfig)
  - 06-llm-wiring (sendFacilitatorMessage signature is the Phase 6 LLM entry point)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pre-baked Tailwind class strings in PERSONA_META (no template-string class generation — Tailwind v4 purges dynamic classes)
    - Store action composition via get() for addMessage/addMessages/setLoading calls
    - Stub-first store actions with stable signatures ready for Phase 6 LLM replacement

key-files:
  created:
    - src/lib/personaConfig.ts
    - src/lib/pcThresholds.ts
    - src/lib/pcThresholds.test.ts
  modified:
    - src/lib/gameStore.ts
    - src/lib/gameStore.test.ts

key-decisions:
  - "REQUIREMENTS.md CHAT-02 KV/AF/MC initials override CONTEXT.md single-letter K/F/C — documented in personaConfig.ts comments"
  - "PERSONA_META bubbleClass pre-baked as literal Tailwind strings (not template-literal generation) — Tailwind v4 purges non-literal class references"
  - "advanceRound captures newRound before calling get().addMessages — avoids reading from immer draft after set() completes"
  - "sendFacilitatorMessage does NOT trigger LLM call — Phase 6 replaces this; action signature is the stable Phase 6 entry point"

patterns-established:
  - "personaConfig pattern: all per-persona UI classes centralised in PERSONA_META rather than scattered across components"
  - "Store action composition: new actions call existing actions (addMessage, setLoading) via get() rather than duplicating immer mutations"

# Metrics
duration: 2min
completed: 2026-04-14
---

# Phase 5 Plan 02: Store Stubs + Utility Modules Summary

**Three store stub actions (advanceRound/triggerDebrief/sendFacilitatorMessage) + PERSONA_META with KV/AF/MC initials + getPcBadge/getPersonasThisRound pure functions, all tested (22 new tests)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-14T11:07:30Z
- **Completed:** 2026-04-14T11:09:25Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- personaConfig.ts: PERSONA_META record with two-letter initials KV/AF/MC per REQUIREMENTS.md CHAT-02, pre-baked Tailwind bubble/dot/colour classes for all three personas
- pcThresholds.ts: getPcBadge (CRISIS/STRAINED/null) and getPersonasThisRound (Set<PersonaId> coverage scan since last round_divider), 10 tests
- gameStore.ts: three stub actions using get() composition — advanceRound increments round + appends divider/stub, triggerDebrief appends debrief_divider/stub, sendFacilitatorMessage trims + guards empty + sets loading; 12 new tests (65 total in gameStore, 144 across suite)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add persona metadata + PC threshold utilities** - `b8e1021` (feat)
2. **Task 2: Add stub store actions + tests** - `7fe1c4b` (feat)

**Plan metadata:** `(pending docs commit)` (docs: complete store stubs plan)

## Files Created/Modified
- `src/lib/personaConfig.ts` - PERSONA_META Record<PersonaId, PersonaMeta> + PERSONA_ORDER; two-letter initials per REQUIREMENTS.md CHAT-02
- `src/lib/pcThresholds.ts` - getPcBadge pure function + getPersonasThisRound round-coverage scanner
- `src/lib/pcThresholds.test.ts` - 10 tests covering all badge states and round-divider boundary cases
- `src/lib/gameStore.ts` - Extended interface + three stub action implementations; added get() to immer creator
- `src/lib/gameStore.test.ts` - 12 new tests for advanceRound / triggerDebrief / sendFacilitatorMessage

## Decisions Made
- REQUIREMENTS.md CHAT-02 KV/AF/MC initials override CONTEXT.md single-letter K/F/C — documented in personaConfig.ts comments
- PERSONA_META bubbleClass pre-baked as literal Tailwind strings (not template-literal generation) — Tailwind v4 purges non-literal class references
- advanceRound captures newRound in a local variable before calling get().addMessages — avoids reading from the immer draft after set() resolves
- sendFacilitatorMessage does NOT trigger any LLM call — Phase 6 replaces this stub; the signature is now the stable entry point

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 2/3 plans (05-03+) can now import PERSONA_META, getPcBadge, getPersonasThisRound, and call all three store actions
- sendFacilitatorMessage signature is stable and ready for Phase 6 LLM wiring
- All 144 tests pass, TypeScript strict-mode clean

---
*Phase: 05-game-screen-layout*
*Completed: 2026-04-14*
