---
phase: "01"
plan: "02"
subsystem: "game-data"
tags: ["typescript", "vitest", "game-config", "edip", "data-integrity"]

dependency-graph:
  requires: ["01-01"]
  provides: ["EDIP_CONFIG constant", "config data integrity tests"]
  affects: ["02-backend", "03-api", "05-ui-components", "06-llm-integration"]

tech-stack:
  added: []
  patterns: ["as const satisfies pattern for typed constants", "it.each for parameterised test cases"]

key-files:
  created:
    - "src/data/edipConfig.ts"
    - "src/data/edipConfig.test.ts"
  modified: []

decisions:
  - id: "01-02-a"
    decision: "Used `as const satisfies GameConfig` instead of explicit type annotation"
    rationale: "Provides maximum type safety — TypeScript narrows literal types (e.g. 'No Crisis' as CrisisState literal) while still enforcing interface compliance at compile time"
    impact: "All downstream consumers get precise literal types from the constant"

metrics:
  duration: "3m 19s"
  completed: "2026-04-13"
  tasks-completed: 2
  tests-added: 51
---

# Phase 01 Plan 02: EDIP Config Constant Summary

**One-liner:** Verbatim EDIP game configuration transcribed from spec Section 7 into typed TypeScript constant with 51 Vitest data integrity assertions.

## What Was Built

### src/data/edipConfig.ts

Canonical EDIP game configuration exported as `EDIP_CONFIG`. The constant is typed via `as const satisfies GameConfig`, providing:

- 2 scenarios (S1: Germanium/CRM crisis with 4 rounds; S2: Eastern Flank hybrid-to-hot-war with 5 rounds)
- 4 teams (A through D) with full persona descriptions, unique action rules, and starting resource values
- 11 game cards (CS-01/02, MP-01/02, SP-01/02, CP-01, PA-01/02/03, TR-01) with category, timing, requirements, and effect text
- 4 national actions (NA-1 through NA-4) with summary and cost text
- 7 guide text fields: objective, redLines, pcThresholds, votingRule, eoMechanic, resourceLogic, facilitation

All text fields are transcribed verbatim from spec Section 7 (lines 383–578).

### src/data/edipConfig.test.ts

51 Vitest tests across 7 describe blocks validating data integrity at runtime:

1. **Structural counts** — correct array lengths (2/4/11/4)
2. **Scenario validation** — round counts, inject counts, startState values for both scenarios
3. **Team starting resources** — all 4 teams validated with `it.each` (24 assertions)
4. **Card IDs completeness** — all 11 IDs present, all fields non-empty
5. **National action IDs** — all 4 IDs present, all fields non-empty
6. **Guide text fields** — all 7 fields non-empty and length > 50
7. **Team metadata** — 2 personas each, non-empty uniqueAction and description

## Verification Outcomes

| Check | Result |
|-------|--------|
| `pnpm exec tsc --noEmit` | Zero errors |
| `pnpm vitest run src/data/edipConfig.test.ts` | 51/51 tests pass |
| `grep -c "id:" src/data/edipConfig.ts` | 21 (2+4+4+11 = correct) |
| Team A pc=3, po=0, readiness=3, stock=2, crm=2, ic=2 | Confirmed |
| Team B ic=5 | Confirmed |
| S1 rounds=4, S2 rounds=5 | Confirmed |
| cards array has 11 entries | Confirmed |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| e286325 | feat | Transcribe EDIP config constant from spec Section 7 |
| 84a7fcd | test | Write Vitest tests validating EDIP config data integrity |

## Deviations from Plan

None — plan executed exactly as written.

The spec (lines 383–578) provided the EDIP_CONFIG constant as valid TypeScript already. The `as const satisfies GameConfig` pattern required adding `as const` to `crisisState` string literals (`"No Crisis" as const`) to satisfy the `CrisisState` union type — this is correct TypeScript behaviour, not a deviation.

## Next Phase Readiness

**Ready for 01-03** (LLM integration or backend).

- `EDIP_CONFIG` is the sole source of game data — import from `@/data/edipConfig`
- All 51 integrity tests provide regression coverage if config is ever modified
- The `as const satisfies` pattern means TypeScript will catch any future spec divergence at compile time
