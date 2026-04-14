---
phase: 07-debrief-export-config-generation
plan: 03
subsystem: config-generation
tags: [zustand, immer, react, fastapi, openai, json-mode, abortcontroller, vitest, pytest]

# Dependency graph
requires:
  - phase: 07-01
    provides: stateSnapshots/gameEnded store foundation
  - phase: 04
    provides: briefText/setBriefText store fields (REUSED not re-declared), SetupMode routing, LoadConfigPanel
  - phase: 06-llm-integration
    provides: backend llm.py auth/error patterns, httpx.MockTransport test harness
provides:
  - CONFIG_GEN_SYSTEM_PROMPT rewrite — GameConfig-shape compliant + json_object mode
  - response_format: {type: 'json_object'} in backend payload
  - draftSource: 'brief' | 'load' | null store field + setDraftSource
  - GenerateBriefPanel.tsx — full generate-from-brief UI with loading/error/cancel/chips
  - "← Back to Brief" conditional in LoadConfigPanel (draftSource === 'brief' gate)
  - HomeScreen 'Generate from Brief' card enabled (was aria-disabled stub)
  - SetupScreen 'brief' mode routing wired to GenerateBriefPanel
affects:
  - 07-04 (config validator — builds on generated config reaching LoadConfigPanel)
  - 08-phase-8-ops (DEV-mode GuardedGameScreen follow-up)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AbortController per-component via useRef — fresh ref on each Generate click, abort on unmount"
    - "Error-code known-list gate: (KNOWN_ERROR_CODES as string[]).includes(code) ?? 'INTERNAL_ERROR'"
    - "json_object mode unconditional + comment-documented fallback path for non-OpenAI endpoints"
    - "Condensed EDIP structural exemplar in system prompt (not full 194-line config)"
    - "Post-200 triple store write sequence: setConfigJson → setDraftSource('brief') → setSetupMode('load')"

key-files:
  created:
    - src/components/setup/GenerateBriefPanel.tsx
    - src/components/setup/GenerateBriefPanel.test.tsx
  modified:
    - backend/app/routers/config_gen.py
    - backend/tests/test_config_gen.py
    - src/lib/gameStore.ts
    - src/lib/gameStore.test.ts
    - src/components/setup/SetupScreen.tsx
    - src/components/setup/HomeScreen.tsx
    - src/components/setup/LoadConfigPanel.tsx

key-decisions:
  - "Store additions limited to draftSource + setDraftSource only — briefText/setBriefText pre-existed from Phase 4, reused"
  - "draftSource: null default; 'brief' set by GenerateBriefPanel on success; 'load' reserved for manual-paste flows"
  - "response_format json_object added unconditionally — non-OpenAI fallback: ops removes the line, existing LLM_UPSTREAM_ERROR path surfaces the 400"
  - "AbortController per-component useRef, not shared with gameStore runLLMTurn"
  - "System prompt uses condensed EDIP structural exemplar — not the full 194-line config"
  - "Literal 'JSON' appears in system prompt header and rules section — OpenAI json_object mode requirement"
  - "No schema validation in this plan — 07-04 owns validateGameConfig; on successful JSON.parse the result is written blindly"
  - "Post-success: setConfigJson → setDraftSource('brief') → setSetupMode('load') in order — panel unmounts naturally"
  - "PARSE_FAILURE handled frontend-side: if JSON.parse(data.text) throws, show inline error, log raw to console.error, preserve brief text"

# Metrics
duration: ~2h (including smoke test checkpoint)
completed: 2026-04-14
---

# Phase 7 Plan 03: Config Generation from Brief Summary

**Backend CONFIG_GEN rewrite with json_object mode, draftSource store plumbing, and fully functional GenerateBriefPanel delivering end-to-end brief-to-config flow — smoke tested 3/3 briefs passed**

## Performance

- **Duration:** ~2h (including human-verify checkpoint for smoke test)
- **Started:** 2026-04-14
- **Completed:** 2026-04-14 (post-checkpoint approval)
- **Tasks:** 3 (Task 1 backend, Task 2a store, Task 2b UI + wiring)
- **Files modified:** 9 (2 new .tsx, 2 new .test, 5 modified)

## Accomplishments

- **Backend (Task 1, commit `3ad65e3`):** Rewrote `CONFIG_GEN_SYSTEM_PROMPT` with GameConfig-compliant field enumeration, condensed EDIP structural exemplar, and explicit numeric range constraints. Added `response_format: {"type": "json_object"}` to LLM payload. Extended backend tests (6 tests total) to assert payload shape, prompt content (`pcThresholds`, `nationalActions`, `redLines` present; `winConditions`, `scenarioName` absent), and existing error-mapping paths.

- **Store (Task 2a, commit `64a106c`):** Added `draftSource: 'brief' | 'load' | null` field and `setDraftSource` setter. Default `null`. Reset to `null` in `newGame()` and `resetGame()`. Existing `briefText`/`setBriefText` fields (Phase 4) confirmed present and untouched. Three new store tests: setDraftSource round-trips, newGame reset, resetGame reset.

- **UI + Wiring (Task 2b, commit `13dabd4`):** Built `GenerateBriefPanel.tsx` from scratch (~220 lines). Includes: 7-code `ErrorKind` union with friendly copy map, 2 example chips (energy + cyber), `MIN_CHARS=50` / `MAX_CHARS=4000` guards, `AbortController` per-component via `useRef`, post-200 triple store write, `PARSE_FAILURE` frontend path. Wired: `HomeScreen` 'Generate from Brief' card enabled (removed `aria-disabled`), `SetupScreen` switch case for `'brief'` mode renders `GenerateBriefPanel`, `LoadConfigPanel` adds `← Back to Brief` button gated on `draftSource === 'brief'`.

## Task Commits

1. **Task 1: Backend CONFIG_GEN rewrite + tests** — `3ad65e3`
2. **Task 2a: Store draftSource** — `64a106c`
3. **Task 2b: GenerateBriefPanel + wiring** — `13dabd4`

## Files Created/Modified

- `backend/app/routers/config_gen.py` — CONFIG_GEN_SYSTEM_PROMPT rewritten; `response_format: {"type": "json_object"}` added to payload; comment documents ops fallback path
- `backend/tests/test_config_gen.py` — 6 tests (A: response_format assertion, B: 'JSON' literal, C: pcThresholds/nationalActions shape, D: happy-path 200, E: 401 → LLM_AUTH_ERROR, F: timeout → LLM_TIMEOUT 504)
- `src/lib/gameStore.ts` — draftSource field, setDraftSource, newGame/resetGame resets added
- `src/lib/gameStore.test.ts` — 3 new tests for draftSource
- `src/components/setup/GenerateBriefPanel.tsx` — New file; full implementation
- `src/components/setup/GenerateBriefPanel.test.tsx` — New file; loading/error/cancel/parse-failure/success tests
- `src/components/setup/SetupScreen.tsx` — Added `'brief'` case rendering `<GenerateBriefPanel />`
- `src/components/setup/HomeScreen.tsx` — Removed `aria-disabled` from 'Generate from Brief' card; added `setSetupMode('brief')` onClick
- `src/components/setup/LoadConfigPanel.tsx` — Added `draftSource` store subscription; conditional `← Back to Brief` button at lines 87–95

## Decisions Made

**07-03: draftSource scope — store-level flag, not component state**

`draftSource` lives in Zustand so `LoadConfigPanel` can read it without prop drilling. The value is set exclusively by `GenerateBriefPanel` on success (`'brief'`) and reset by `newGame()`/`resetGame()` to `null`. `setConfigJson` does not clear it — coupling a store setter to UI intent was ruled out; the UI decides provenance via `setDraftSource`.

**07-03: json_object mode unconditional + documented fallback**

`response_format: {"type": "json_object"}` added to config_gen.py payload. If the deployed endpoint is not OpenAI-compatible and rejects this with 400, the existing `LLM_UPSTREAM_ERROR` path surfaces it to the facilitator as "LLM service returned an error. Try again." No env flag added. An ops admin removes the line from `config_gen.py` for non-OpenAI deployments. Documented via inline comment in the payload dict.

**07-03: AbortController per-component, per-request**

`useRef<AbortController | null>(null)` inside `GenerateBriefPanel`. A new `AbortController` is created at the start of each `handleGenerate()` call, replacing any prior ref. `useEffect` cleanup aborts on unmount. This is independent of `gameStore.runLLMTurn`'s controller.

**07-03: System prompt condensed exemplar strategy**

The system prompt uses a condensed single-scenario, single-team EDIP exemplar covering every required field shape — NOT the full 194-line `edipConfig.ts`. This keeps the config-gen context window minimal while covering field structure. The literal string "JSON" appears in both the introductory line and the RULES section, satisfying the OpenAI `json_object` mode requirement.

**07-03: LAST-wins not applicable — parseConfigJson untouched**

Plan 07-04 owns `validateGameConfig`. This plan blindly writes `JSON.stringify(parsed, null, 2)` to the store on successful `JSON.parse`. No schema validation happens in this plan.

## Smoke Test Results

**3 of 3 briefs PASSED** (success criterion: ≥ 2/3)

Human-verify checkpoint approved after live smoke test against the deployed LLM endpoint.

| # | Input chip/brief | Generated name | Key shape checks |
|---|---|---|---|
| 1 | Cyber incident response chip | "Electric Grid Cyberattack Wargame" | 14 top-level fields, 2 scenarios, 4 teams A/B/C/D, 4 national actions, 6 cards. Launch Scenario 1 succeeded — game initialised with HEIGHTENED ALERT badge. |
| 2 | Energy supply crisis chip | "EU Energy Security Tabletop Exercise" | Same shape-correctness; all required fields present |
| 3 | Freeform pandemic brief | "Global Pandemic Response Wargame" | Same shape-correctness; all required fields present |

### Informational observations for 07-04 validator scope

1. **Non-canonical crisisState values** — LLM emitted "Heightened Alert", "Alert", "Strain", "Crisis Emergent" across the 3 briefs. The GameConfig spec enum may be tighter. `parseConfigJson` does not validate enum membership. 07-04 validator could optionally tighten this with an allowlist check.

2. **Free-form card `cat` values** — LLM invented per-brief categories ("Immediate Response", "Diplomatic", "Research", "Logistics", "Public Opinion", "Crisis Escalation", etc.). `cat` is a free-form string in `GameConfig` so this is spec-compliant. 07-04 could add a whitelist if facilitator UX suffers from inconsistent categorisation.

3. **Non-zero `startState.crisisSeverity`** — Briefs 1 and 2 produced `crisisSeverity: 1` or `2`, reflecting the ongoing-crisis framing. The EDIP exemplar seeds 0. This is brief-faithful behaviour, not a bug. No clamping violation (within 0–5).

4. **Numeric field compliance confirmed** — All 3 briefs produced `po` within -2..2, `pc` within 0..6, `readiness` within 0..5. No clamp violations observed in the smoke test.

## Back-to-Brief Conditional Verification

**Verified by user observation AND code inspection.** User confirmed the "← Back to Brief" link appeared at the top of the Load panel when Brief 2's generated JSON landed (post-Generate, in the live smoke test run). Code inspection below corroborates the wiring.

`LoadConfigPanel.tsx` lines 87–95 contain:

```tsx
{draftSource === 'brief' && (
  <button
    type="button"
    onClick={() => setSetupMode('brief')}
    className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
  >
    ← Back to Brief
  </button>
)}
```

The `draftSource` subscription is at line 26 (`const draftSource = useGameStore((s) => s.draftSource)`). The conditional is correctly gated. Button only renders when `draftSource === 'brief'`; hidden when null (manual load) or 'load'. Confirmed correct by inspection — no gap.

## @theme Token Notes

GenerateBriefPanel uses:
- `bg-bg-surface`, `bg-bg-elevated`, `text-text-primary`, `text-text-secondary` — pre-existing @theme tokens
- `bg-persona-kent` for Generate button — pre-existing persona token
- `animate-blink` — pre-existing @keyframes token (from Phase 3)
- `border-border-dim` — pre-existing token
- `var(--color-category-crisis)` for error alert — consistent with LoadConfigPanel error pattern

No new @theme tokens required or added.

## Backend Fallback Path Confirmation

If `response_format: {"type": "json_object"}` is rejected by a non-OpenAI-compatible upstream with HTTP 400:

1. Backend receives `httpx` error response with status 400
2. `generate_config` handler catches HTTP errors in the same branch as other upstream errors
3. Returns `{"error": {"code": "LLM_UPSTREAM_ERROR", "message": "..."}}` with HTTP 502
4. Frontend `GenerateBriefPanel` maps `LLM_UPSTREAM_ERROR` → "LLM service returned an error. Try again."
5. Brief text preserved; facilitator can retry after ops removes the `response_format` line

No data loss. The pipeline degrades gracefully with a visible error message.

## Deviations from Plan

None — plan executed exactly as written. All decisions were locked prior to execution.

## Issues Encountered

**DEV-mode GuardedGameScreen interference (Phase 8 follow-up)**

During the smoke test, clicking "New Game" from the `/game` route while in DEV mode re-seeded the EDIP mock state instead of returning to `/setup`. This caused a navigation detour that prevented explicit confirmation of the "← Back to Brief" button during the smoke test. The button was subsequently confirmed correct by code inspection.

Root cause: `GuardedGameScreen` in `App.tsx` calls `seedMockState()` when `import.meta.env.DEV === true` and `gameState === null`. After `newGame()` clears `gameState`, the guard re-seeds immediately on the next render — short-circuiting the redirect to `/setup`. This is pre-existing Phase 4/5 behaviour, not a 07-03 regression. Workaround: navigate to `/` directly, or use `pnpm build && pnpm preview` for smoke testing.

Despite this detour, the user manually returned to `/setup` and ran Brief 2 → the "← Back to Brief" link rendered correctly at the top of the Load panel, providing direct user-observation confirmation of the wiring.

Logged for Phase 8 follow-up: condition `DEV && gameState === null` in GuardedGameScreen should distinguish "initial load" from "intentional new-game reset".

## Test Coverage

**Frontend (pnpm exec vitest run): 458/458 passing**
- GenerateBriefPanel.test.tsx: new file — loading states, error code mapping (LLM_TIMEOUT, LLM_AUTH_ERROR, LLM_UPSTREAM_ERROR, PARSE_FAILURE, NETWORK_ERROR), AbortController cancel, successful flow (store writes + mode transition)
- gameStore.test.ts: 3 new draftSource tests
- All prior 442 tests: no regressions

**Backend (pytest): 8/8 passing**
- test_config_gen.py: 6 tests (A–F per plan spec)
- test_llm_auth_header.py: 2 tests (no regressions)

## Next Phase Readiness

- **07-04 (Config Validator):** `LoadConfigPanel` receives the generated config via `configJson` store. `draftSource === 'brief'` is available for context. 07-04 can add `validateGameConfig` at the panel level to surface field-level errors without touching this plan's wiring. Observations 1–4 above provide the known validator scope.
- **07-02 (Debrief Wiring):** Independent of this plan — no shared files. Can execute in parallel or before/after 07-03.
- **Phase 8:** DEV-mode GuardedGameScreen re-seed follow-up logged as concern in STATE.md.

---
*Phase: 07-debrief-export-config-generation*
*Completed: 2026-04-14*
