---
phase: 12-crisis-state-prompt-engineering
plan: 01
subsystem: prompt-engineering
tags: [prompt-builder, finch-persona, crisis-state, inline-snapshot, vitest, token-budget]

# Dependency graph
requires:
  - phase: 06-llm-client
    provides: buildSystemPrompt 10-block structure, reportPromptBudget, parsePersonaResponse, applyStateUpdatePure
  - phase: 08-qa-credential-audit
    provides: empirical evidence that v1.0 prompt omitted crisisState transition rule (08-02-LIVE-RUN.md lines 109-144)
provides:
  - Explicit crisisState transition rule encoded in Block 7 Finch MUST list + Block 9 "Crisis State Transition Rules" subsection
  - Mechanical guardrail via two inline snapshot tests on the rule text
  - End-to-end parser → applier round-trip tests covering both canonical transitions (severity=2 → "Supply Crisis", severity=3+ → "Security-Related Supply Crisis")
  - Promoted `withinLimit === true` assertion turning future token-budget regressions into CI failures
  - Top-of-file JSDoc pointing to the (yet-to-be-written) 12-PROMPT-ENGINEERING-NOTES.md
affects: [12-02, future prompt-engineering phases, live-LLM replay verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline snapshot tests for load-bearing prompt sections (first repo use of toMatchInlineSnapshot)"
    - "Block-isolation slicing via indexOf boundaries to keep snapshots resilient to unrelated prompt edits"
    - "Test-level comments pointing failures back to the canonical notes file before rubber-stamp updates"

key-files:
  created: []
  modified:
    - "src/lib/promptBuilder.ts — Block 7 Finch MUST +1 element; Block 9 +7 lines above clamp; top-of-file JSDoc"
    - "src/lib/promptBuilder.test.ts — +2 inline-snapshot tests locking Block 7 Finch + Block 9 transition subsection"
    - "src/lib/stateUpdater.test.ts — +2 round-trip tests through parsePersonaResponse + applyStateUpdatePure"
    - "src/lib/promptBudget.test.ts — +1 hard assertion `expect(report.withinLimit).toBe(true)`"

key-decisions:
  - "Use parsePersonaResponse (actual name) instead of plan's parseLLMResponse (naming drift in plan)"
  - "Keep the existing 'crisisState: one of ... | ... | ...' clamp-range line untouched; the new transition subsection DOCUMENTS the trigger, the clamp line DOCUMENTS allowed values — both coexist (RESEARCH.md Risk 3)"
  - "Initial-state fixture for severity=3+ test starts at `Supply Crisis` (not `No Crisis`) to realistically model a game mid-escalation"

patterns-established:
  - "Inline snapshots for prompt text: extract narrow subsection between indexOf boundaries, fail-message points to notes file"
  - "Budget regression guard: promote `withinLimit` from informational boolean to hard CI assertion whenever a prompt edit lands"

# Metrics
duration: ~20 min
completed: 2026-04-15
---

# Phase 12 Plan 01: Crisis-State Prompt-Engineering Rule Encoding Summary

**Encoded the missing crisisState transition rule in Finch's persona (Block 7 MUST) and JSON Output Schema (Block 9), locked it in with inline-snapshot + round-trip + budget-regression tests, and left a JSDoc breadcrumb to the notes file Plan 12-02 will write.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-15T19:04:00Z (approx)
- **Completed:** 2026-04-15T19:24:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Closed PROMPT-01: Block 7 Finch MUST list now contains the explicit `Advance crisisState per the threshold rules in Block 9 when crisisSeverity crosses 2 or 3.` item, and Block 9 now contains a `Crisis State Transition Rules` subsection pinning the three canonical literals and both thresholds.
- Closed PROMPT-02 (source-side): top-of-file JSDoc references `12-PROMPT-ENGINEERING-NOTES.md` and flags both sections as load-bearing. Standalone notes file is Plan 12-02's scope.
- Added 6 new tests: 2 inline snapshots (Block 7 Finch section, Block 9 transition subsection), 2 parser→applier round-trips (severity=2 "Supply Crisis", severity=4 "Security-Related Supply Crisis"), and 1 promoted budget-regression assertion.
- Full suite: **534 tests pass** (528 prior + 6 new). `totalCeilingEstimate = 6858` tokens (642-token headroom under the 7500 ceiling).
- `npm run build` succeeds.

## Task Commits

Each task was committed atomically:

1. **Task 1: promptBuilder.ts edits (Block 7 + Block 9 + JSDoc)** — `c403b90` (feat)
2. **Task 2: Tier A automated tests (snapshots + round-trip + budget)** — `ff7ff99` (test)

_TDD not applicable — this plan is a prompt-engineering edit to a pure-function string builder, not a behavioural change._

## Files Created/Modified

- `src/lib/promptBuilder.ts` — added 17 lines (JSDoc 9 lines, Finch MUST +1, Block 9 transition +7)
- `src/lib/promptBuilder.test.ts` — added 64 lines (1 describe block + 2 inline-snapshot tests)
- `src/lib/stateUpdater.test.ts` — added ~70 lines (1 describe block + 2 round-trip tests + 1 import line)
- `src/lib/promptBudget.test.ts` — added 9 lines (1 promoted hard assertion)

## Decisions Made

- **Naming: `parsePersonaResponse` not `parseLLMResponse`** — the plan referenced `parseLLMResponse`, but the exported symbol in `responseParser.ts:100` is `parsePersonaResponse`. Used the real name; no behavioural impact.
- **Round-trip initial-state fixture for severity=4 test uses `crisisState: 'Supply Crisis'`** — mid-escalation modelling; would also pass from `'No Crisis'` since applier has no enum gate (stateUpdater.ts:120–122), but the mid-escalation starting point is more realistic.
- **Kept the existing Block 9 clamp-range line for `crisisState` untouched** — the new transition subsection documents the TRIGGER; the clamp line documents the ALLOWED VALUES. Both must coexist per 12-RESEARCH.md Risk 3.
- **JSDoc is at the top of the file, BEFORE the single `import type` line** — establishes maintainer context before any imports are read; `12-PROMPT-ENGINEERING-NOTES` string appears exactly once so future greps land cleanly.

## Deviations from Plan

None - plan executed exactly as written, with one minor naming correction (`parsePersonaResponse` vs plan's `parseLLMResponse`) documented in Decisions.

## Issues Encountered

- **Inline snapshot Windows line-ending noise:** Vitest normalises snapshot whitespace, and the hand-written snapshots passed on first run — no need to run `-u` to seed them. Git reported LF→CRLF conversion warnings on stage but these are tracked by `.gitattributes` elsewhere in the repo and do not affect the stored snapshot content (Vitest reads from the source file, CRLF is transparent).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 12-02:**

- `promptBuilder.ts` JSDoc points to `.planning/phases/12-crisis-state-prompt-engineering/12-PROMPT-ENGINEERING-NOTES.md` — Plan 12-02 writes that file.
- Plan 12-02 performs Tier B live-LLM replay of Scenario 2 severity=4, which is the only way to close Phase 12 success criterion #2 (the behavioural guarantee that the rule actually WORKS with a real model).

**Phase 12 criteria status after 12-01:**

- ✅ Criterion #1 (explicit transition rule in system prompt): CLOSED
- ⏳ Criterion #2 (Scenario 2 severity=4 replay produces transition): NOT YET — Plan 12-02 Tier B
- 🟡 Criterion #3 (rule documented so future edits preserve it): PARTIAL — JSDoc + inline snapshots in 12-01; standalone notes file in 12-02

**Open items:**

- PROMPT-01: **Closed** (rule encoded in prompt)
- PROMPT-02: **Closed** (documented in source via JSDoc + snapshot tests with failure-message breadcrumbs)
- PROMPT-03: **Still open** — pending Plan 12-02 Tier B live replay

**No blockers.** Plan 12-02 can proceed on top of master at `ff7ff99`.

---
*Phase: 12-crisis-state-prompt-engineering*
*Completed: 2026-04-15*
