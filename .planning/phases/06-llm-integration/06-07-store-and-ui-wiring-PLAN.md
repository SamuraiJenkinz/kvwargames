---
phase: 06-llm-integration
plan: 07
type: execute
wave: 4
depends_on: ["06-03", "06-04", "06-05", "06-06"]
files_modified:
  - src/lib/gameStore.ts
  - src/lib/gameStore.test.ts
  - src/components/game/ChatFeed/ErrorMessage.tsx
  - src/components/game/ChatFeed/PersonaMessage.tsx
  - src/components/game/ChatFeed/PersonaMessage.test.tsx
  - src/components/game/FacilitatorInput/FacilitatorInput.tsx
  - src/components/game/FacilitatorInput/ActionToolbar.tsx
  - src/components/game/FacilitatorInput/ControlBanner.tsx
autonomous: true

must_haves:
  truths:
    - "`sendFacilitatorMessage(text)` builds the system prompt + windowed history, calls `callLLMProxy`, parses the response, and applies all state changes in a single atomic `set()` (FLOW-01, RESP-03, RESP-04, STATE-03)"
    - "On parse/network/timeout failure the store adds a red error bubble and does NOT mutate `gameState` (CONTEXT.md atomicity guarantee; RESP-02)"
    - "`advanceRound()` inserts a round divider AND triggers an LLM call with a `[ROUND_START Round N]` prefix so Kent frames + Finch delivers the inject (FLOW-02)"
    - "`triggerDebrief()` inserts a debrief divider AND triggers an LLM debrief call with a `[DEBRIEF_TRIGGER]` prefix; all three personas respond in order (FLOW-03)"
    - "`retryLastMessage()` replays the last facilitator input (or round/debrief trigger) with a fresh AbortController (RESP-02 retry affordance)"
    - "`llmHistory` is appended with `{role:'user'}` + `{role:'assistant'}` pairs for each successful turn. After every append, `llmHistory` is sliced to the last `2 × HISTORY_WINDOW_N + 1 = 13` entries, so the invariant `llmHistory.length ≤ 13` holds after any number of turns (CTX-01, CTX-02, matches CONTEXT.md line 72)"
    - "`newGame()` aborts any in-flight LLM call and clears `currentAbortController`, `lastFacilitatorInput`, `pendingControlBanner`, and `llmHistory` before the existing reset runs — so a mid-turn 'New Game' click never strands the store in a permanently-loading state (FLOW-05)"
    - "`ErrorMessage` renders the error reason, a collapsible `<details>` showing `message.rawResponse`, and a Retry button that invokes `retryLastMessage`"
    - "`PersonaMessage` applies `message.revealDelay` as `style={{ animationDelay: ... }}` — staggered reveal is CSS-driven from a single `addMessages([kent, finch, chen])` call (avoids sticky-scroll pitfall)"
    - "`PersonaMessage` renders `message.flag` as an amber facilitator-facing note below the message body when non-null (RESP-05)"
    - "`ControlBanner` shows a non-blocking banner when `pendingControlBanner` is set; [Advance]/[Enter Debrief] confirm, [Dismiss] clears without re-triggering"
    - "`ActionToolbar` gains a `Request Debrief Now` button (LAYOUT-04, FLOW-04)"
  artifacts:
    - path: "src/lib/gameStore.ts"
      provides: "Replaced sendFacilitatorMessage / advanceRound / triggerDebrief + new retryLastMessage, pendingControlBanner slice"
    - path: "src/components/game/FacilitatorInput/ControlBanner.tsx"
      provides: "Non-blocking confirmation banner"
      min_lines: 40
    - path: "src/components/game/ChatFeed/ErrorMessage.tsx"
      provides: "Extended error bubble with raw disclosure + Retry"
  key_links:
    - from: "src/lib/gameStore.ts"
      to: "src/lib/promptBuilder.ts, contextWindow.ts, llmClient.ts, responseParser.ts, stateUpdater.ts"
      via: "imports + orchestration in sendFacilitatorMessage"
      pattern: "import .* from '@/lib/(promptBuilder|contextWindow|llmClient|responseParser|stateUpdater)'"
    - from: "src/components/game/ChatFeed/ErrorMessage.tsx"
      to: "gameStore.retryLastMessage"
      via: "useGameStore(s => s.retryLastMessage)"
      pattern: "retryLastMessage"
    - from: "src/components/game/FacilitatorInput/FacilitatorInput.tsx"
      to: "ControlBanner"
      via: "component render + pendingControlBanner selector"
      pattern: "ControlBanner"
---

<objective>
Wire all Phase 6 modules into the store and UI. This is the integration plan: after it ships, the end-to-end loop (facilitator types → LLM responds → state updates animate → errors surface) is complete.

Purpose: Every prior Phase 6 plan builds an isolated, tested module. This plan glues them together in the store (atomic set(), abort management, retry, control-banner state, newGame abort, llmHistory bound) and extends three UI components (ErrorMessage disclosure + retry; PersonaMessage reveal delay + flag rendering; FacilitatorInput control banner). State-visibility polish (StatePanel delta ghost + TeamCard pulse) is split into plan 06-09 so it lands AFTER 06-08's smoke test confirms the core loop.
Output: The working LLM loop, the non-blocking control banner, in-flight cancellation safety on New Game, and bounded llmHistory.
</objective>

<execution_context>
</execution_context>

<context>
@.planning/phases/06-llm-integration/06-CONTEXT.md
@.planning/phases/06-llm-integration/06-RESEARCH.md
@.planning/phases/06-llm-integration/06-03-SUMMARY.md
@.planning/phases/06-llm-integration/06-04-SUMMARY.md
@.planning/phases/06-llm-integration/06-05-SUMMARY.md
@.planning/phases/06-llm-integration/06-06-SUMMARY.md
@src/lib/gameStore.ts
@src/components/game/ChatFeed/ErrorMessage.tsx
@src/components/game/ChatFeed/PersonaMessage.tsx
@src/components/game/FacilitatorInput/FacilitatorInput.tsx
@src/components/game/FacilitatorInput/ActionToolbar.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: gameStore — replace stubs + add retry/abort/control-banner state + tests</name>
  <files>src/lib/gameStore.ts, src/lib/gameStore.test.ts</files>
  <action>
    In `src/lib/gameStore.ts`:

    **Add to interface and initial state:**
    - `currentAbortController: AbortController | null` (default `null`) — so the store can cancel in-flight calls on Retry / new Game.
    - `lastFacilitatorInput: string | null` (default `null`) — the canonical input string to replay on Retry. Store the *prefixed* input (e.g. `"[ROUND_START Round 3] {inject}"`) for round/debrief triggers, plain text for facilitator messages.
    - `pendingControlBanner: { kind: 'advanceRound' | 'triggerDebrief'; targetRound?: number } | null` (default `null`).
    - New actions:
      - `retryLastMessage(): void` — replays `lastFacilitatorInput` via the same core LLM-call path as `sendFacilitatorMessage`, with a new AbortController.
      - `confirmControlBanner(): void` — closure-captured approach (no new state field): the banner-confirm path reads `pendingControlBanner`, clears it first (`set(s => { s.pendingControlBanner = null })`), then invokes `advanceRound()` or `triggerDebrief()` as appropriate. Because the LLM response from that call can itself only set `pendingControlBanner` if the LLM sends `control.advanceRound` again, there is no infinite loop — the next banner, if raised, reflects a fresh LLM signal and is legitimately new. We do NOT need an `isConfirmingControl` flag. (Rejected alternative: tracking a transient suppress-flag — adds store surface area for no benefit.)
      - `dismissControlBanner(): void` — sets `pendingControlBanner = null`.
      - `abortCurrentLLMCall(): void` — calls `currentAbortController?.abort()` then nulls it; also clears `loading`.

    **Override `newGame()` (existing action) to handle in-flight LLM cancellation (FLOW-05):**
    Before the existing reset logic runs, add these steps at the top of `newGame`:
    ```typescript
    newGame: () => {
      // Abort any in-flight LLM call so the fetch's promise rejects cleanly.
      get().currentAbortController?.abort()
      set((state) => {
        state.currentAbortController = null
        state.lastFacilitatorInput = null
        state.pendingControlBanner = null
        state.llmHistory = []
        // existing reset logic continues below (gameState, gameConfig, messages, loading, etc.)
      })
      // ...rest of the existing newGame implementation
    }
    ```
    Result: clicking "New Game" during an in-flight LLM call aborts the fetch (store's `runLLMTurn` sees `ABORTED` via the existing abort-handling branch and exits without mutating state further), clears `loading`, and resets all Phase 6 transient slices.

    **Refactor `sendFacilitatorMessage(text)`** (remains synchronous at call site, fires non-awaited inner async):

    ```typescript
    sendFacilitatorMessage: (text: string) => {
      const trimmed = text.trim()
      if (trimmed === '' || get().loading) return

      // 1. Synchronously push facilitator bubble + start loading
      set((state) => {
        state.messages.push({
          id: crypto.randomUUID(), type: 'facilitator', speaker: 'facilitator',
          text: trimmed, timestamp: formatTime(),
        })
        state.loading = true
        state.lastFacilitatorInput = trimmed
      })

      // 2. Fire async flow without awaiting (store actions stay sync)
      void runLLMTurn(trimmed)
    }
    ```

    Define `runLLMTurn(input: string)` as a module-level closure over `get/set` (or a local helper inside the `create` call):

    ```typescript
    async function runLLMTurn(input: string) {
      const { gameConfig, gameState, llmHistory } = get()
      if (!gameConfig || !gameState) { set(s => { s.loading = false }); return }

      const controller = new AbortController()
      set(s => { s.currentAbortController = controller })

      // Client-side safety timeout on top of backend timeout
      const timeoutId = setTimeout(() => controller.abort(), LLM_FRONTEND_TIMEOUT_MS)

      const systemPrompt = buildSystemPrompt(gameConfig, gameState)
      const windowedHistory = windowHistory(llmHistory)

      const llmResult = await callLLMProxy(systemPrompt, [
        ...windowedHistory,
        { role: 'user', content: input },
      ], { signal: controller.signal })

      clearTimeout(timeoutId)

      if (!llmResult.ok) {
        set(state => {
          state.messages.push(buildErrorMessage({
            code: llmResult.errorCode,
            message: llmResult.message,
            retryInput: input,
            rawResponse: undefined,
          }))
          state.loading = false
          state.currentAbortController = null
        })
        return
      }

      const parseResult = parsePersonaResponse(llmResult.text)
      if (!parseResult.ok) {
        set(state => {
          state.messages.push(buildErrorMessage({
            code: parseResult.errorKind,
            message: parseResult.detail,
            retryInput: input,
            rawResponse: parseResult.raw,
          }))
          state.loading = false
          state.currentAbortController = null
          // Successful LLM call but unparseable: DO append to llmHistory so persona continuity is preserved?
          // Decision: NO — CONTEXT.md atomicity: state never mutates on failed response.
          // llmHistory is state; therefore also not appended.
        })
        return
      }

      // Success — apply atomically
      const value = parseResult.value
      const { nextState, clampLog } = value.responses.reduce<{ nextState: GameState; clampLog: ClampLog[] }>(
        (acc, r) => {
          if (!r.stateUpdate) return acc
          const result = applyStateUpdatePure(acc.nextState, r.stateUpdate)
          return { nextState: result.nextState, clampLog: [...acc.clampLog, ...result.clampLog] }
        },
        { nextState: gameState, clampLog: [] },
      )

      if (clampLog.length && import.meta.env.DEV) {
        console.warn('[stateUpdater] clamped fields:', clampLog)
      }

      set(state => {
        // Persona messages (single push with CSS revealDelay per CONTEXT.md pitfall #3)
        const personaMsgs = value.responses.map((r, i) => buildPersonaMessage(r, i * 500))
        state.messages.push(...personaMsgs)

        // State update — write the computed nextState wholesale
        state.gameState = nextState

        // llmHistory append + bound length (matches CONTEXT.md invariant: ≤ 2N+1 = 13 when N=6)
        state.llmHistory.push({ role: 'user', content: input })
        state.llmHistory.push({ role: 'assistant', content: llmResult.text })
        const maxHistoryEntries = 2 * HISTORY_WINDOW_N + 1
        if (state.llmHistory.length > maxHistoryEntries) {
          state.llmHistory = state.llmHistory.slice(-maxHistoryEntries)
        }

        // Control banner from LLM
        if (value.control?.triggerDebrief) {
          state.pendingControlBanner = { kind: 'triggerDebrief' }
        } else if (value.control?.advanceRound) {
          state.pendingControlBanner = { kind: 'advanceRound', targetRound: gameState.round + 1 }
        }

        state.loading = false
        state.currentAbortController = null
      })
    }
    ```

    Helpers `buildErrorMessage`, `buildPersonaMessage`, `formatTime` can be module-private.

    **Refactor `advanceRound()`:**
    - Insert the round divider + increment round synchronously (same as today).
    - Then fire an LLM call with input `"[ROUND_START Round N] {scenario.injects[N-1] ?? ''}"` via `runLLMTurn`.
    - On success, Finch/Kent bubbles appear per routing rules.
    - Do NOT push a stub Kent message anymore.

    **Refactor `triggerDebrief()`:**
    - Insert debrief divider.
    - Fire LLM call with input `"[DEBRIEF_TRIGGER] Facilitator-requested debrief."` via `runLLMTurn`.

    **`retryLastMessage()`:**
    ```typescript
    retryLastMessage: () => {
      const input = get().lastFacilitatorInput
      if (!input || get().loading) return
      set(s => { s.loading = true })
      void runLLMTurn(input)
    }
    ```

    **Tests — extend `src/lib/gameStore.test.ts`:**
    Mock the four external modules (`buildSystemPrompt`, `windowHistory`, `callLLMProxy`, `parsePersonaResponse`, `applyStateUpdatePure`) via `vi.mock(...)`. Cases:
    - Happy path: `sendFacilitatorMessage('hello')` → eventually 2 persona messages added, gameState.crisisSeverity updated, llmHistory length increased by 2, loading becomes false. Use `await waitFor(...)`.
    - LLM error path: `callLLMProxy` returns `{ok: false, errorCode: 'LLM_TIMEOUT'}` → one error message added with `errorCode: 'LLM_TIMEOUT'`, `retryInput: 'hello'`, `rawResponse: undefined`, gameState unchanged, llmHistory unchanged.
    - Parse failure path: `callLLMProxy` returns ok with junk text, `parsePersonaResponse` returns `{ok: false, errorKind: 'PARSE_FAILURE', raw: '...'}` → error message carries `rawResponse` + `retryInput`, gameState unchanged.
    - Atomicity: error paths leave `llmHistory.length` AND `gameState` byte-identical to before the call.
    - Retry: after an error, `retryLastMessage()` calls `runLLMTurn` again with the stored input; on the retry's success the good path applies.
    - Control banner set: LLM response contains `control: { advanceRound: true }` → `pendingControlBanner.kind === 'advanceRound'`.
    - Control banner preference: LLM sets both flags → `kind === 'triggerDebrief'` (documented conflict resolution).
    - `dismissControlBanner()` clears banner; subsequent message with no control → stays null.
    - `confirmControlBanner()` with `kind:'advanceRound'` → round increments, banner clears.
    - Clamp log warning: LLM returns stateUpdate with `crisisSeverity: 9` → dev console warn called (spy on `console.warn`), gameState.crisisSeverity is 5 (clamped).
    - `llmHistory.length` invariant: simulate 10 consecutive successful `runLLMTurn` calls (mocked callLLMProxy/parsePersonaResponse). After each call, assert `useGameStore.getState().llmHistory.length <= 2 * HISTORY_WINDOW_N + 1` (i.e. ≤ 13 when N=6). After 10 turns the length should stabilise at 13.
    - `newGame()` mid-LLM-turn (FLOW-05): set up an in-flight call by mocking `callLLMProxy` to return a never-resolving promise; call `sendFacilitatorMessage('hello')`; immediately call `newGame()`; assert: (a) `currentAbortController` is null, (b) `loading` is false, (c) `llmHistory` is `[]`, (d) `lastFacilitatorInput` is null, (e) `pendingControlBanner` is null, (f) the AbortController passed to the fetch mock received an `abort()` signal (via `signal.aborted === true`).

    Keep existing gameStore tests passing.
  </action>
  <verify>
    - `pnpm test src/lib/gameStore.test.ts` — existing + new cases pass.
    - `pnpm typecheck` passes.
    - Manual: `grep "sendFacilitatorMessage" src/lib/gameStore.ts` — the stub `text placeholder until LLM wiring` is gone.
  </verify>
  <done>
    Store orchestrates the full LLM turn atomically. Error paths preserve state. Retry works. Control banner state is set/cleared correctly. All tests green.
  </done>
</task>

<task type="auto">
  <name>Task 2: UI integration — ErrorMessage, PersonaMessage revealDelay, ControlBanner, ActionToolbar, FacilitatorInput</name>
  <files>src/components/game/ChatFeed/ErrorMessage.tsx, src/components/game/ChatFeed/PersonaMessage.tsx, src/components/game/FacilitatorInput/ControlBanner.tsx, src/components/game/FacilitatorInput/ActionToolbar.tsx, src/components/game/FacilitatorInput/FacilitatorInput.tsx</files>
  <action>
    **`ErrorMessage.tsx`** — extend (keep the existing red-tinted container):
    - Render plain-English reason from `message.text`.
    - If `message.rawResponse`, add a `<details><summary className="...">Show raw response</summary><pre className="...">{message.rawResponse}</pre></details>`.
    - If `message.retryInput`, add a Retry button that calls `useGameStore(s => s.retryLastMessage)` on click.
    - Keep timestamp display.
    - Style: use existing `text-crisis-security` tokens; `summary` has subtle underline on hover; `pre` uses `whitespace-pre-wrap` and `max-h-48 overflow-auto`.

    **`PersonaMessage.tsx`** — add `revealDelay` support + flag rendering (RESP-05):
    - Apply `style={{ animationDelay: message.revealDelay ? \`${message.revealDelay}ms\` : undefined }}` to the top-level div that already carries `animate-[messageIn_180ms_ease-out_both]`.
    - No new Tailwind token needed — CSS animation-delay is inline style.
    - Flag rendering: if `message.flag` is a non-null non-empty string, render `<p className="mt-2 text-sm italic text-persona-amber">{message.flag}</p>` below the message body `<p>` element. If `flag` is `null` or `undefined`, render nothing (no empty `<p>`). `text-persona-amber` is the existing Phase 3 @theme token; if it does not yet exist, use `text-amber-400` as a literal pre-baked class (never via variable) and flag this in SUMMARY for a later token consolidation pass.

    **`PersonaMessage.test.tsx`** — add tests:
    - "renders flag as italic amber note below message body when `message.flag` is non-null" — pass a message with `flag: 'caution: advisory only'`, assert the flag text is in the DOM AND has the amber class.
    - "does not render the flag element when `message.flag` is null" — pass a message with `flag: null`, assert `queryByText` for any plausible flag string returns null AND the rendered output has no element with the amber class.
    - "does not render the flag element when `message.flag` is undefined" — same as above with `flag` omitted entirely.

    **`ControlBanner.tsx`** (NEW) — non-blocking banner above FacilitatorInput:
    ```tsx
    export default function ControlBanner() {
      const banner = useGameStore(s => s.pendingControlBanner)
      const confirm = useGameStore(s => s.confirmControlBanner)
      const dismiss = useGameStore(s => s.dismissControlBanner)
      if (!banner) return null
      const label = banner.kind === 'advanceRound'
        ? `Advance to Round ${banner.targetRound}?`
        : 'Enter debrief?'
      const confirmLabel = banner.kind === 'advanceRound' ? 'Advance' : 'Enter Debrief'
      return (
        <div className="flex items-center gap-2 rounded-sm border border-persona-finch/40 bg-persona-finch/8 px-3 py-2 text-xs text-persona-finch">
          <span className="font-mono uppercase">{label}</span>
          <button onClick={confirm} className="ml-auto rounded-sm border border-persona-finch/40 px-2 py-1 hover:bg-persona-finch/20">{confirmLabel}</button>
          <button onClick={dismiss} className="rounded-sm border border-border-default px-2 py-1 text-text-muted hover:bg-bg-elevated">Dismiss</button>
        </div>
      )
    }
    ```

    **`ActionToolbar.tsx`** — add "Request Debrief Now" button (LAYOUT-04). Wire to the existing `triggerDebrief` store action. Rename current "Trigger Debrief" button to "End Game + Debrief" to match LAYOUT-04 spec wording. "Request Debrief Now" calls the same action today; Plan 08 can distinguish interim vs. end if needed.

    **`FacilitatorInput.tsx`** — mount `<ControlBanner />` as the first child of the outer div, above the `<ActionToolbar />` row. The banner is null-when-idle so it takes no layout space unless active.

    Tests: extend existing `FacilitatorInput.test.tsx` with one case asserting `ControlBanner` renders when `pendingControlBanner` is set (mock the store selector).
  </action>
  <verify>
    - `pnpm test src/components/game/FacilitatorInput src/components/game/ChatFeed` — all pass.
    - `pnpm typecheck` passes.
    - Manual: inspect `PersonaMessage.tsx` — `animationDelay` only set when `revealDelay` provided (so non-staggered bubbles still animate immediately).
  </verify>
  <done>
    Error bubbles disclose raw + Retry. Control banner appears on LLM signal and disappears on confirm/dismiss. ActionToolbar has Request Debrief Now. Staggered reveal works via CSS animation-delay.
  </done>
</task>

  <!-- Task 3 (StatePanel delta ghost-text + TeamCard cell pulse) moved to new plan 06-09
       (state-visibility polish). Runs after the smoke test (06-08) validates the core loop,
       so if the smoke test uncovers a store bug we are not ripping apart CSS animations to
       fix it. See 06-09-state-visibility-PLAN.md. -->

</tasks>

<verification>
- All unit + component tests pass: `pnpm test && pnpm typecheck`.
- Store's atomic-update invariant tested: error paths never mutate `gameState` or `llmHistory`.
- End-to-end flow covered by gameStore tests (with mocked modules) and by Plan 06-08's live smoke test.
- No regressions in prior Phase 5 tests.
</verification>

<success_criteria>
- `sendFacilitatorMessage` performs the full LLM turn atomically with error recovery (RESP-02, RESP-03, RESP-04, FLOW-01).
- `advanceRound` + `triggerDebrief` drive LLM calls (FLOW-02, FLOW-03) and action toolbar gains Request Debrief Now (FLOW-04).
- `newGame` aborts in-flight LLM calls and clears all Phase 6 transient state before the existing reset runs (FLOW-05).
- `retryLastMessage` replays last input with fresh AbortController.
- `pendingControlBanner` + `ControlBanner` gives facilitator non-blocking confirmation.
- ErrorMessage surfaces rawResponse + Retry.
- PersonaMessage honours revealDelay for staggered reveal via CSS and renders `message.flag` as an amber note when non-null (RESP-05).
- `llmHistory` is windowed at call site via `windowHistory()` AND bounded in the store to `≤ 2N+1 = 13` entries after every successful turn (CTX-01, CTX-02, CONTEXT.md line 72).
- StatePanel/TeamCard delta ghost-text + cell pulse are handled in plan 06-09 (split out of this plan for risk reduction).
</success_criteria>

<output>
After completion, create `.planning/phases/06-llm-integration/06-07-SUMMARY.md` listing which requirements are now fully satisfied (PROMPT-*, STATE-*, RESP-*, FLOW-*, CTX-01, CTX-02) and any open items for Plan 06-08 (budget + smoke test) and Plan 06-09 (state-visibility polish).
</output>
