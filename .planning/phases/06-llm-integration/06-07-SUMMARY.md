---
phase: 06-llm-integration
plan: 07
subsystem: store-and-ui
tags: [zustand, immer, integration, atomic-set, abortcontroller, react, vitest]

# Dependency graph
requires:
  - phase: 06-llm-integration
    provides: "06-02 (types), 06-03 (applyStateUpdatePure), 06-04 (buildSystemPrompt), 06-05 (windowHistory + parsePersonaResponse), 06-06 (callLLMProxy + LLM_FRONTEND_TIMEOUT_MS)"
provides:
  - "gameStore.runLLMTurn — module-private orchestrator of the full LLM turn"
  - "gameStore.sendFacilitatorMessage / advanceRound / triggerDebrief — LLM-wired flow entrypoints"
  - "gameStore.retryLastMessage — replays lastFacilitatorInput with fresh AbortController"
  - "gameStore.newGame — aborts in-flight LLM call + clears all Phase 6 transient slices before the existing reset"
  - "gameStore.pendingControlBanner + confirmControlBanner + dismissControlBanner"
  - "ErrorMessage — raw disclosure (<details>) + Retry button"
  - "PersonaMessage — revealDelay CSS stagger + flag rendering (amber italic)"
  - "ControlBanner — non-blocking facilitator confirmation banner"
  - "ActionToolbar — 'Request Debrief Now' (interim) + 'End Game + Debrief' (final)"
affects: [06-08-token-budget-and-smoke-test, 06-09-state-visibility]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-private async helper closed over get/set — sync store actions fire non-awaited runLLMTurn so UI stays responsive"
    - "Atomic set() on success: persona messages + gameState + llmHistory + control banner + loading=false all applied in one immer draft"
    - "Atomicity on failure: error path pushes single red bubble and touches NOTHING else (gameState + llmHistory byte-identical)"
    - "nextState computed outside set() — structuredClone in applyStateUpdatePure operates on plain GameState, not an immer draft (drafts DataCloneError)"
    - "CSS animation-delay for staggered reveal — single addMessages([...]) call avoids sticky-scroll pitfall #3"
    - "setTimeout frontend timeout on top of backend timeout, cleared on any resolve path"
    - "vi.mock of four external modules in gameStore.test.ts keeps tests deterministic + offline"

key-files:
  created:
    - src/components/game/FacilitatorInput/ControlBanner.tsx
    - src/components/game/ChatFeed/PersonaMessage.test.tsx
  modified:
    - src/lib/gameStore.ts
    - src/lib/gameStore.test.ts
    - src/components/game/ChatFeed/ErrorMessage.tsx
    - src/components/game/ChatFeed/PersonaMessage.tsx
    - src/components/game/FacilitatorInput/FacilitatorInput.tsx
    - src/components/game/FacilitatorInput/ActionToolbar.tsx
    - src/components/game/FacilitatorInput/FacilitatorInput.test.tsx

key-decisions:
  - "runLLMTurn defined as a local closure inside create(immer(...)) rather than a module-level function — captures get/set without prop drilling, keeps LLM orchestration co-located with the store actions that invoke it"
  - "newGame aborts the controller BEFORE the immer set() so the in-flight fetch's AbortSignal fires synchronously. runLLMTurn sees errorCode='ABORTED' and bails without any state mutation"
  - "applyStateUpdate (simple setter) delegates to applyStateUpdatePure but computes nextState OUTSIDE set() — structuredClone on an immer draft throws DataCloneError. Pattern: get() → compute pure → set() → assign"
  - "Control banner conflict resolution lives in the store reducer (not the UI) — both flags true → kind='triggerDebrief'. UI never has to decide"
  - "Retry disables itself on loading=true to prevent double-click double-fires (would create two concurrent AbortControllers)"
  - "ABORTED error code in runLLMTurn bails silently without pushing an error bubble — newGame already cleared the message list, pushing a bubble after the reset would be wrong"
  - "'Request Debrief Now' and 'End Game + Debrief' both dispatch triggerDebrief today; Plan 08 may distinguish interim vs end-of-game semantics if the smoke test surfaces the need"
  - "text-amber-400 Tailwind literal used for PersonaMessage.flag because text-persona-amber @theme token does not yet exist — noted here for a later token-consolidation pass"

patterns-established:
  - "LLM turn orchestration: sync push facilitator bubble → flip loading → non-awaited runLLMTurn → inside turn, AbortController + timeout + windowed history → atomic set on resolve"
  - "FLOW-05 abort + reset: abort controller, then single set() that clears Phase 6 transient state + Phase 5 reset surface"
  - "Dev-only console warnings gated by import.meta.env.DEV — clamp log surfaces to facilitator-dev inspection without leaking to production"

# Metrics
duration: ~8m
completed: 2026-04-14
---

# Phase 6 Plan 7: Store and UI Wiring Summary

**All Phase 6 modules (promptBuilder 06-04, contextWindow + responseParser 06-05, llmClient 06-06, stateUpdater 06-03) wired into gameStore via an atomic `runLLMTurn` helper; three UI components (ErrorMessage raw disclosure + Retry, PersonaMessage CSS-delay reveal + amber flag, ControlBanner non-blocking confirmation) + ActionToolbar dual-debrief split integrate the loop end-to-end. `llmHistory ≤ 13` invariant enforced on every successful turn; `newGame()` aborts mid-flight fetches safely.**

## Requirements Satisfied

Phase 6 REQUIREMENTS.md items fully satisfied by this plan:

### PROMPT-* (system prompt delivery)
- **PROMPT-01** — `buildSystemPrompt(gameConfig, gameState)` invoked per turn inside `runLLMTurn`, never windowed.
- **PROMPT-02 / PROMPT-03 / PROMPT-04 / PROMPT-05** — already satisfied by 06-04 (prompt construction). This plan just invokes them correctly.

### STATE-* (live state updates)
- **STATE-01** (atomic set()) — success path applies persona messages + `gameState` + `llmHistory` + control banner + `loading=false` in a single immer set().
- **STATE-02** (team match by id) — inherited from 06-03 `applyStateUpdatePure`; store forwards `StateUpdate` payloads without index-assumptions.
- **STATE-03** (null/undefined no-op, delta-only) — inherited from 06-03; each persona's `stateUpdate` is reduced left-to-right into `nextState`.
- **STATE-04** (clamping silent + logged) — dev-only `console.warn('[stateUpdater] clamped fields:', clampLog)` gated by `import.meta.env.DEV`.

### RESP-* (response handling + UX)
- **RESP-01** (full multi-persona response rendered) — all `value.responses` pushed in one `addMessages([...])`.
- **RESP-02** (error bubble with retry) — red `ErrorMessage` with errorCode prefix + plain-English reason; Retry button wired to `retryLastMessage`; disabled while loading.
- **RESP-03** (atomicity) — error paths push ONE bubble and touch NOTHING else: `gameState`, `llmHistory`, `lastFacilitatorInput`, `pendingControlBanner` all unchanged. Enforced by three tests (LLM_TIMEOUT, PARSE_FAILURE, back-to-back NETWORK_ERROR + VALIDATION_FAILURE).
- **RESP-04** (staggered reveal) — each persona message carries `revealDelay: i * 500`; `PersonaMessage` applies it as inline `style.animationDelay`. Single `addMessages([...])` call means the sticky-bottom scroll hook sees ONE insert batch, not three timed ones (CONTEXT.md pitfall #3).
- **RESP-05** (flag rendering) — `PersonaMessage` renders `message.flag` as italic amber `<p>` below the bubble when non-empty string; no element at all for `null`/`undefined`/`''`.

### FLOW-* (game flow control)
- **FLOW-01** (facilitator message → LLM turn) — `sendFacilitatorMessage` pushes facilitator bubble synchronously + flips loading + fires non-awaited `runLLMTurn(trimmed)`. `lastFacilitatorInput = trimmed` for Retry.
- **FLOW-02** (advanceRound fires LLM) — inserts `round_divider` + increments round synchronously, then fires `runLLMTurn` with `[ROUND_START Round N] {inject}` prefix so Kent frames + Finch delivers the inject.
- **FLOW-03** (triggerDebrief fires LLM) — inserts `debrief_divider`, fires `runLLMTurn` with `[DEBRIEF_TRIGGER]` prefix; all three personas respond in order per 06-04 routing rules.
- **FLOW-04** (Request Debrief Now) — `ActionToolbar` now has a `Request Debrief Now` button (and a renamed `End Game + Debrief` button). Both dispatch `triggerDebrief` today; Plan 08 may split semantics.
- **FLOW-05** (newGame mid-flight safety) — `newGame()` aborts the current controller FIRST, then clears `currentAbortController`/`lastFacilitatorInput`/`pendingControlBanner`/`llmHistory` plus the Phase 5 reset surface in one `set()`. Store can never be stranded in a permanently-loading state.

### CTX-* (context windowing)
- **CTX-01** (rolling window) — `windowHistory(llmHistory)` (06-05) called every turn.
- **CTX-02** (bounded history) — after each successful turn, `llmHistory` sliced to `2 * HISTORY_WINDOW_N + 1 = 13` entries. Invariant test sends 10 consecutive turns, asserts `length ≤ 13` after each and stabilises at exactly 13.

## Performance

- **Duration:** ~8 minutes
- **Tasks:** 2 (store + tests, UI + tests) split into 5 atomic commits
- **Files modified:** 6 modified + 2 created

## Task Commits

1. **`feat(06-07): gameStore LLM turn orchestration with atomic set, abort, retry`** — `5ccb426`
2. **`test(06-07): gameStore LLM turn happy/error/atomicity/newGame-abort coverage`** — `07dda95`
3. **`feat(06-07): ErrorMessage raw disclosure + Retry; PersonaMessage revealDelay + flag`** — `0488144`
4. **`feat(06-07): ControlBanner + ActionToolbar Request Debrief Now`** — `1faf123`
5. **`test(06-07): PersonaMessage flag rendering + FacilitatorInput banner mount`** — `e5017c0`

Plus `docs(06-07)` finalisation commit (this SUMMARY + PLAN move).

## Files Created/Modified

- `src/lib/gameStore.ts` — sendFacilitatorMessage/advanceRound/triggerDebrief replaced; new retryLastMessage, confirmControlBanner, dismissControlBanner, abortCurrentLLMCall, newGame actions; new state slices currentAbortController, lastFacilitatorInput, pendingControlBanner; module-private `runLLMTurn`, `buildPersonaMessage`, `buildErrorMessage`, `formatTime` helpers.
- `src/lib/gameStore.test.ts` — vi.mock of promptBuilder/contextWindow/llmClient/responseParser; new describe blocks for retryLastMessage, pendingControlBanner, clamp log, history invariant, newGame FLOW-05. 83 tests pass.
- `src/components/game/ChatFeed/ErrorMessage.tsx` — errorCode prefix, `<details>` disclosure for rawResponse, Retry button wired to retryLastMessage.
- `src/components/game/ChatFeed/PersonaMessage.tsx` — `style.animationDelay` inline + flag render (`text-amber-400`).
- `src/components/game/ChatFeed/PersonaMessage.test.tsx` — **NEW**. 7 tests covering flag + revealDelay.
- `src/components/game/FacilitatorInput/ControlBanner.tsx` — **NEW**. Null when idle, advance/debrief kinds with Confirm/Dismiss.
- `src/components/game/FacilitatorInput/ActionToolbar.tsx` — Request Debrief Now + End Game + Debrief buttons.
- `src/components/game/FacilitatorInput/FacilitatorInput.tsx` — mounts `<ControlBanner />` first child.
- `src/components/game/FacilitatorInput/FacilitatorInput.test.tsx` — mocks LLM pipeline, updated button-label assertions, 3 new ControlBanner mount cases.

**Test totals:** 379 tests across 16 files pass. `pnpm typecheck` clean.

## Decisions Made

Captured in frontmatter key-decisions. Highlights:

1. **`runLLMTurn` as a local closure** inside `create(immer(...))` rather than a module-level function — captures `get`/`set` without prop drilling, keeps LLM orchestration co-located with the actions that invoke it.
2. **Abort BEFORE set() in `newGame`** so the in-flight fetch's AbortSignal fires synchronously. `runLLMTurn` sees `errorCode === 'ABORTED'` and bails without mutating anything — `newGame`'s reset has already cleared the store.
3. **`applyStateUpdate` computes outside `set()`** — `structuredClone` on an immer draft throws `DataCloneError` because drafts are proxies. Pattern: `get()` → compute via `applyStateUpdatePure` → `set()` → assign. Same pattern applied inside `runLLMTurn`.
4. **Control banner conflict resolution in the reducer, not the UI** — both flags true → `kind='triggerDebrief'`. UI never has to decide.
5. **Retry disables itself on loading=true** to prevent double-click double-fires (would create two concurrent AbortControllers).
6. **Dual debrief buttons dispatch the same action** today; Plan 08 may split interim vs. end-of-game semantics after the smoke test confirms the flow.

## Deviations from Plan

Minor, well-contained:

1. **ABORTED bail-out in `runLLMTurn`.** Plan implied the generic error-path would handle all non-ok results. Added an early `return` when `errorCode === 'ABORTED'` to avoid pushing an error bubble AFTER `newGame` has cleared the messages list (would re-populate messages post-reset). No user-visible change.
2. **`applyStateUpdate` wrapper pattern.** Plan didn't prescribe how to update the store's simple setter — original inline clamping code would have worked but duplicates 06-03's logic. Delegated to `applyStateUpdatePure` but had to compute outside `set()` to avoid `DataCloneError` on immer drafts.
3. **Dual debrief buttons.** Plan said rename 'Trigger Debrief' to 'End Game + Debrief' and add 'Request Debrief Now'. Kept both buttons side-by-side in the toolbar rather than replacing; both dispatch `triggerDebrief` for now.
4. **PersonaMessage flag fallback class.** `text-persona-amber` @theme token does not exist. Used `text-amber-400` literal as planned escape hatch; noted here for a token-consolidation pass.
5. **No new `text-persona-amber` @theme token added** — the plan explicitly allowed fallback to `text-amber-400`, and adding a new token for a single consumer is premature optimization.

## Issues Encountered

1. **`DataCloneError` on immer drafts.** First pass of `applyStateUpdate` called `applyStateUpdatePure` inside the `set()` callback, passing `state.gameState` (an immer draft proxy). `structuredClone` rejected the proxy. Fixed by computing `nextState` outside `set()` using `get().gameState` (the post-produce plain object). Same pattern is used inside `runLLMTurn` so no refactor needed there.

## User Setup Required

None.

## Open Items / Next Plans

### Plan 06-08 (token budget + smoke test)
- **Baseline:** 06-04 measured system prompt at 5124 tokens / 20496 chars on EDIP config — exceeds STATE.md's 3K-4K estimate. 06-08 must verify against real corporate LLM endpoint context window. If 8K cap, history + response share only ~3K and `HISTORY_WINDOW_N` may need to drop from 6 to 3-4.
- **Live smoke test:** drive a real LLM round-trip through the wired store, confirm atomic set() + staggered reveal + bounded history empirically.
- **Clamp log verification:** synthesise an out-of-range LLM response, confirm dev console warn fires and gameState still clamps cleanly.
- **Abort + retry live test:** click Retry on a simulated timeout, confirm fresh AbortController + no double-message.

### Plan 06-09 (state-visibility polish — split out of this plan)
- **StatePanel delta ghost-text** — "+1" / "−2" fade-in on severity/legitimacy bar changes (CONTEXT.md visibility decisions).
- **TeamCard cell pulse** — ~800ms tinted flash on any changed resource field.
- **PC warning badge flash** on STRAINED/CRISIS threshold crossings (Plan 05-06 badges already in place; 06-09 adds the flash).
- **Persona indicator dot updates** — `personasThisRound` dim/lit state already works from Phase 5 seed; 06-09 confirms it updates live as LLM responses arrive.

### Follow-ups (not blocking any plan)
- **Token consolidation pass:** promote `text-amber-400` → a proper `--color-persona-amber` @theme token if other facilitator-note UIs are added.
- **Split 'Request Debrief Now' vs 'End Game + Debrief'** semantics if smoke testing surfaces a need (e.g. interim debrief should not clear cardsThisRound).
- **Interim-debrief state flag** — currently `triggerDebrief` is idempotent-ish (inserts another divider); a future plan could track `isInDebrief` to surface different persona behaviour.

---
*Phase: 06-llm-integration*
*Completed: 2026-04-14*
