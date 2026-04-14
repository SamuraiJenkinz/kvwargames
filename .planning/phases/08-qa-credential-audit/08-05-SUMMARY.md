---
phase: 08-qa-credential-audit
plan: 05
subsystem: testing
tags: [debrief-export, bucketing, prompt-builder, multi-trigger-routing, regression-guard]

# Dependency graph
requires:
  - phase: 07-debrief-export-config-generation
    provides: generateDebriefMarkdown round-bucketing + LAST debrief_divider anchor
  - phase: 06-llm-integration
    provides: buildSystemPrompt block 8 routing-rules text
provides:
  - Debrief export bucketing fix — post-debrief messages no longer double-render in Round-N transcripts
  - Regression test that fails against pre-fix bucketing (catches the STATE.md line 217 bug)
  - Block-8 routing-rule static text-presence coverage (multi-trigger static-side assertion for Phase 8 success criterion #5)
affects: [future debrief-export edits, persona-routing rule edits, 08-02 live-run behavioural multi-trigger assertion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Early-computed halt index + index-based for loop (bucketing ends at lastDebriefIdx via `break`, preserving no-debrief flow via `!== -1` guard)"
    - "Slice-before / slice-from markdown section isolation for locational assertions"
    - "Block-scoped prompt assertions via `indexOf(heading) + slice(next heading)` (reused from 06-04 pattern)"

key-files:
  created: []
  modified:
    - src/lib/debriefExporter.ts
    - src/lib/debriefExporter.test.ts
    - src/lib/promptBuilder.test.ts

key-decisions:
  - "lastDebriefIdx reduce() moved from line ~228 to line ~202 — before the bucketing loop so the loop can `break` on it"
  - "Bucketing loop rewritten from `for..of` to index-based `for (let i = 0; ...)` — exposes index cheaply for the halt guard"
  - "Halt condition is `lastDebriefIdx !== -1 && i >= lastDebriefIdx` — the `!== -1` sentinel preserves pre-fix behaviour for no-debrief sessions"
  - "Multi-trigger behavioural validation deferred to 08-02 live run; this plan covers the static text-presence half only"

patterns-established:
  - "Regression tests for duplication bugs: slice markdown at the section header, assert message absent from before-half, present in from-half"
  - "Block-8 routing-rule coverage: slice between `## 8. Routing Rules` and `## 9. JSON Output Schema` before asserting verbatim trigger keywords"

# Metrics
duration: 8min
completed: 2026-04-14
---

# Phase 8 Plan 05: Debrief Bucketing Fix + Multi-Trigger Prompt Coverage Summary

**Bucketing loop now halts at `lastDebriefIdx` — post-debrief persona messages render only in `## Debrief`, never double-rendered in their enclosing round transcript. STATE.md line 217 follow-up resolved with a regression guard + block-8 multi-trigger static coverage added.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-14T17:31:26Z
- **Completed:** 2026-04-14T17:33:30Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- STATE.md line 217 duplication bug FIXED in `src/lib/debriefExporter.ts` — the bucketing loop now exits at `lastDebriefIdx` via a `break`, so messages after the final `debrief_divider` flow only through the `messages.slice(lastDebriefIdx + 1)` debrief path.
- Regression test added to `debriefExporter.test.ts` Group 3 that would have caught the original bug (passes on post-fix; would fail against pre-fix code).
- New block-8 routing-rule presence test added to `promptBuilder.test.ts` asserting the multi-trigger routing keywords (Round start, Card play, National action, Dispute, Threshold warning, Debrief) plus the `Kent → Finch → Chen` fixed order and 1-3 personas-per-turn cap are all present in the system prompt.
- Full frontend suite: **515/515 green** (was 514 pre-plan — added 2 new tests; Group 3b multi-divider assertions unchanged and still passing per Pitfall 4 verification).
- `pnpm typecheck` + `pnpm build` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix debriefExporter.ts bucketing** — `17ff1a0` (fix)
2. **Task 2: Regression test for post-debrief bucketing** — `8aaf7dd` (test)
3. **Task 3: Block-8 multi-trigger routing text assertions** — `949d135` (test)

## Files Created/Modified

- `src/lib/debriefExporter.ts` — `lastDebriefIdx` reduce() moved above the round-bucketing loop; bucketing loop rewritten as index-based `for` with `if (lastDebriefIdx !== -1 && i >= lastDebriefIdx) break`. Downstream `messages.slice(lastDebriefIdx + 1)` debrief path unchanged.
- `src/lib/debriefExporter.test.ts` — Added `regression: post-debrief persona message does NOT appear in any Round transcript section` — slices markdown at `## Debrief` header and asserts `'Final reflection.'` is absent from the before-half and present in the from-half.
- `src/lib/promptBuilder.test.ts` — Added `block 8 contains all multi-trigger routing rules (Phase 8 success criterion #5 — static-side coverage)` — isolates Block 8 via `indexOf` slice and asserts six trigger-keyword substrings plus two structural rules. Cross-references 08-02-LIVE-RUN.md for behavioural validation.

## Decisions Made

- **Bucketing halt shape**: chose index-based `for` loop + `break` over filter-before-bucket because it preserves the existing forward-scan `currentRound` state machine with minimal diff and zero allocation overhead. 08-RESEARCH Open Question 4 resolution.
- **`lastDebriefIdx` single definition**: `grep -c "const lastDebriefIdx"` = 1 — the variable is declared once, reused by both the halt guard and the downstream `messages.slice(lastDebriefIdx + 1)` debrief path. No duplicate computation.
- **No-debrief sentinel**: `lastDebriefIdx === -1` is the no-debrief case; the guard `lastDebriefIdx !== -1 && ...` is inert in that case, so sessions that never trigger a debrief bucket the full message stream exactly as before the fix.
- **Group 3b Pitfall 4 verification (not a new test)**: the existing multi-divider test (`two debrief_dividers: debrief section shows FINAL message only, not INTERIM or R2 play`) continued to pass after the fix. `lastDebriefIdx = 4` (index of second `debrief_divider`); `INTERIM_DEBRIEF_MSG` at index 1 and `R2_PLAY_MSG` at index 3 are both `< 4` so they correctly remain bucketed in Round 1 and Round 2 respectively. `FINAL_DEBRIEF_MSG` at index 5 is `> 4` and correctly lives in `## Debrief` only.
- **Behavioural multi-trigger assertion deferred**: the "single facilitator message combining round-start + card-play + dispute → 2-3 distinct speakers, no duplicates, additive state updates" assertion is a deliverable of **08-02-LIVE-RUN.md** (Wave 2). This plan added only the static text-presence half. Cross-referenced explicitly in the new `promptBuilder.test.ts` it() block's comment.
- **Block-8 keyword selection**: asserted verbatim strings that exist in `buildBlock8()` without paraphrase (`Round start`, `Card play`, `National action`, `Dispute`, `Threshold warning`, `Debrief`, `Kent → Finch → Chen`, `Minimum 1, maximum 3 personas per turn`). Read `promptBuilder.ts` lines 170-192 before writing the test to avoid drift.

## Deviations from Plan

None — plan executed exactly as written. Edge cases (no divider, single divider, multiple dividers) all handled by the `!== -1` sentinel + `break` pattern as spec'd.

## Issues Encountered

None. All three tasks executed cleanly on first attempt. No TypeScript errors, no test failures, no build regressions.

## Cross-References

- **08-02-LIVE-RUN.md (Wave 2)**: the behavioural multi-trigger assertion ("single facilitator message → 2-3 distinct personas, no duplicates, additive state updates") is that plan's responsibility. This plan (08-05) cross-references it so the Phase 8 verifier can confirm success criterion #5 is satisfied by the combination of (a) static prompt-text test here + (b) live-run behavioural observation in 08-02.
- **STATE.md line 217**: follow-up addressed; ready to flip from "Phase 8 polish" → "resolved 08-05".
- **07-01 decision locked (STATE.md)**: `stateSnapshots[N] = state at START of Round N` and `## Debrief anchor = LAST debrief_divider via reduce()` both preserved — `lastDebriefIdx` reduce() pattern kept verbatim, only its position in the function moved.

## Next Phase Readiness

- STATE.md line 217 follow-up resolved; remove from Blockers/Concerns.
- Remaining Phase 8 plans unaffected (this fix is local to debrief export + prompt test file; no store or component changes).
- Cross-reference to 08-02 live-run stands — that plan must exercise a genuine multi-trigger facilitator input to close success criterion #5.

---
*Phase: 08-qa-credential-audit*
*Completed: 2026-04-14*
