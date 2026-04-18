---
phase: 15-tts-health-graceful-degradation
plan: 02
subsystem: ui
tags: [react, typescript, vitest, health-badge, tts, amber, zustand, sse]

# Dependency graph
requires:
  - phase: 15-01
    provides: GET /api/health/tts endpoint with TTSHealthResponse JSON contract
  - phase: 14-03
    provides: LoadConfigPanel with HealthBadge + launchDisabled pattern
  - phase: 10
    provides: HealthBadge component pattern and formatLatency convention
provides:
  - src/lib/formatLatency.ts — shared latency formatter (single-sourced)
  - src/types/health.ts extended with TTSHealthResponse/TTSHealthOk/TTSHealthFail/TTSHealthErrorCode
  - src/components/setup/TtsHealthBadge.tsx — amber informational badge for /api/health/tts
  - src/components/setup/LoadConfigPanel.tsx updated — TtsHealthBadge mounted, launchDisabled UNCHANGED
  - 17 new vitest tests (5 formatLatency + 9 TtsHealthBadge + 3 mid-gen SC4)
  - SC4 engineering-layer proof: mid-gen error code flow + markdown decoupling
affects:
  - 15-03 (empirical graceful degradation verification — uses TtsHealthBadge setup screen state)
  - 16-01 (live ElevenLabs verification — TtsHealthBadge will show real auth_error)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TtsHealthBadge: informational-only badge pattern (no gate, no setHealthStatus wiring)
    - Separate vi.mock test file for store-level error path tests (avoids hoisting conflicts)
    - formatLatency single-sourced in src/lib/ (imported by both health badge components)
    - TTSHealthErrorCode = LLMHealthErrorCode type alias (zero-drift guarantee)

key-files:
  created:
    - src/lib/formatLatency.ts
    - src/lib/formatLatency.test.ts
    - src/components/setup/TtsHealthBadge.tsx
    - src/components/setup/TtsHealthBadge.test.tsx
    - src/lib/podcastMidGenFailure.test.ts
  modified:
    - src/types/health.ts (TTSHealthResponse types appended)
    - src/components/setup/HealthBadge.tsx (import formatLatency from @/lib)
    - src/components/setup/LoadConfigPanel.tsx (TtsHealthBadge mount + import)

key-decisions:
  - "vi.mock hoisting conflict: mid-gen tests live in podcastMidGenFailure.test.ts (separate file) not appended to podcastClient.test.ts — vi.mock at top of podcastClient.test.ts would have replaced the transport-level generatePodcast with a mock, breaking 11 existing tests"
  - "9 TtsHealthBadge tests not 8: test_9 (auto-check fetches no force param) added as a natural complement to test_6 (Re-check uses force=true) — both sides of the URL fork tested"
  - "TTSHealthErrorCode = LLMHealthErrorCode alias (not duplicate union) — zero divergence possible"
  - "TtsHealthBadge onStatusChange wired to no-op in LoadConfigPanel — PODRES-02 invariant"

patterns-established:
  - "Informational badge pattern: mount beside gating badge, wire onStatusChange to no-op"
  - "Separate test file for store-level error path: avoids vi.mock hoisting poisoning transport tests"
  - "formatLatency in src/lib/ imported by all health badge components (single source)"

# Metrics
duration: 7min
completed: 2026-04-18
---

# Phase 15 Plan 02: TTS Health Frontend Badge Summary

**Amber-only `TtsHealthBadge` with shared `formatLatency`, zero-drift `TTSHealthErrorCode` alias, 17 new tests, and SC4 mid-gen error-path proof via isolated `podcastMidGenFailure.test.ts`**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-18T16:13:07Z
- **Completed:** 2026-04-18T16:20:00Z
- **Tasks:** 3 of 3
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- Extracted `formatLatency` to `src/lib/formatLatency.ts`; `HealthBadge` now imports it — no behavior change, 5 unit tests proving all format boundaries
- Shipped `TtsHealthBadge` with locked copy strings, amber `bg-[var(--color-crisis-supply)]` dot, `text-amber-400` text, `title={hint}` hover diagnostic, and `?force=true` Re-check wiring — 9 vitest tests
- Mounted `TtsHealthBadge` in `LoadConfigPanel` directly below `HealthBadge` with a no-op `onStatusChange`; `launchDisabled` expression is byte-identical to pre-plan state
- Proved SC4 engineering-layer invariant: `TypeError` mid-gen → `network_error` in store; `PodcastGenerationError auth_error` → `podcastStore.error.code === 'auth_error'`; `generateDebriefMarkdown` succeeds with poisoned podcastStore — 3 tests in `podcastMidGenFailure.test.ts`
- Full suite: 625 tests passing (608 baseline + 17 new), zero regressions

## Task Commits

1. **Task 1: Extract formatLatency + TTSHealthResponse types + grep-verify** — `11f5691` (refactor)
2. **Task 2: TtsHealthBadge component + mount in LoadConfigPanel** — `936edc0` (feat)
3. **Task 3: Mid-gen failure vitest safety net** — `e712347` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/formatLatency.ts` — Shared latency formatter: ms<1000 → "Xms", else "X.Ys"
- `src/lib/formatLatency.test.ts` — 5 unit tests (0, 999, 1000, 1234, 12500ms boundaries)
- `src/types/health.ts` — TTSHealthErrorCode = LLMHealthErrorCode alias; TTSHealthOk, TTSHealthFail, TTSHealthResponse types
- `src/components/setup/HealthBadge.tsx` — import formatLatency from @/lib/formatLatency (pure extraction, no behavior change)
- `src/components/setup/TtsHealthBadge.tsx` — Informational amber badge for /api/health/tts; 3-state (checking/ok/failed); locked copy strings; force=true Re-check
- `src/components/setup/TtsHealthBadge.test.tsx` — 9 vitest tests covering all states, amber styling, force=true, onStatusChange order, button-disabled-while-checking
- `src/components/setup/LoadConfigPanel.tsx` — TtsHealthBadge import + mount below HealthBadge; launchDisabled expression UNCHANGED
- `src/lib/podcastMidGenFailure.test.ts` — 3 mid-gen SC4 tests: network_error mapping, auth_error propagation, markdown decoupling

## Decisions Made

- **Separate test file for mid-gen tests** (`podcastMidGenFailure.test.ts` not appended to `podcastClient.test.ts`): `vi.mock` in vitest is hoisted to the top of the file. Adding `vi.mock('@/lib/podcastClient')` to `podcastClient.test.ts` would have replaced the real `generatePodcast` for all 11 existing tests, causing 8 failures. Separate file isolates the mock scope cleanly — mirrors the approach used by `podcastStore.test.ts`.

- **9 TtsHealthBadge tests** (plan specified "8+"): Test 9 (`auto-check on mount fetches /api/health/tts without force param`) is the natural counter-assertion to test 6 (Re-check uses force=true). Both sides of the URL-selection fork are now explicitly asserted.

- **`TTSHealthErrorCode = LLMHealthErrorCode`** (type alias, not duplicate union): Guarantees 8-code taxonomy stays in lockstep without any manual sync — if `LLMHealthErrorCode` gains a 9th code in future, `TTSHealthErrorCode` picks it up automatically.

## Deviations from Plan

None — plan executed exactly as written. The `podcastMidGenFailure.test.ts` file name is a minor naming deviation from `podcastClient.test.ts` (as suggested in the plan), but this was necessary to avoid `vi.mock` hoisting conflicts documented above (deviation avoidance, not scope creep).

## Issues Encountered

**vi.mock hoisting conflict (resolved):** First attempt appended mid-gen tests including `vi.mock('@/lib/podcastClient')` to the existing `podcastClient.test.ts`. Vitest hoists `vi.mock` to the file top, which replaced the real `generatePodcast` implementation for all 11 existing tests — 8 failed with "generatePodcast returned undefined". Resolution: moved mid-gen tests to a dedicated `podcastMidGenFailure.test.ts` that owns its mock scope independently.

## Structural Invariant Evidence

**launchDisabled unchanged** (`grep -n "launchDisabled" LoadConfigPanel.tsx`):
```
106:  const launchDisabled =
107:    !parseResult.ok || validationErrors.length > 0 || healthStatus !== 'ok'
```
Expression is byte-identical to pre-plan state. TtsHealthBadge's `onStatusChange` is a no-op and is NOT wired to `setHealthStatus`.

**handleDownload decoupling** (`grep -n "podcastStore|podcastStatus|podcastError" ActionToolbar.tsx`):
Matches at lines 9, 39, 165, 170, 180 — all outside `handleDownload` (lines 99-112). Zero references inside the download handler.

## Next Phase Readiness

- Plan 15-03 (empirical graceful degradation verification) can proceed: setup screen renders both badges; flip `.env` to `ELEVENLABS_API_KEY=badkey123` + `TTS_PROVIDER=elevenlabs` to trigger amber failed state and capture screenshots
- Launch button remains enabled in TTS-down scenario — confirmed by code and tests
- All 625 frontend tests green; TypeScript clean

---
*Phase: 15-tts-health-graceful-degradation*
*Completed: 2026-04-18*
