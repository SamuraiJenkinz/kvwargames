---
phase: 06-llm-integration
plan: 08
type: execute
wave: 5
depends_on: ["06-07"]
files_modified:
  - src/lib/promptBudget.ts
  - src/lib/promptBudget.test.ts
  - src/lib/contextWindow.ts
  - .planning/phases/06-llm-integration/06-08-BUDGET.md
autonomous: false

must_haves:
  truths:
    - "Empirical token budget for `buildSystemPrompt(EDIP_CONFIG, freshGameState)` is measured and recorded (CTX-03)"
    - "If the measured system prompt + 2*N history budget exceeds a safe ceiling (default 7500 tokens for an 8k gpt-4 deployment), the plan captures the decision to reduce `HISTORY_WINDOW_N` and applies it"
    - "A live smoke test validates the end-to-end loop: facilitator types a message → 1-3 persona responses appear → StatePanel reflects any deltas → no credential leak in DevTools Network tab"
    - "All 22 Phase 6 requirements (PROMPT-01..05, STATE-01..04, RESP-01..05, FLOW-01..05, CTX-01..03) are individually verified in the smoke test checklist"
  artifacts:
    - path: "src/lib/promptBudget.ts"
      provides: "reportPromptBudget(config, gameState): { systemPromptTokens, maxHistoryTokensEstimate, totalCeiling, withinLimit }"
      exports: ["reportPromptBudget", "SAFE_CONTEXT_CEILING_TOKENS"]
      min_lines: 40
    - path: ".planning/phases/06-llm-integration/06-08-BUDGET.md"
      provides: "Recorded empirical measurement + chosen N"
  key_links:
    - from: "src/lib/promptBudget.ts"
      to: "src/lib/promptBuilder.ts, src/lib/contextWindow.ts"
      via: "measurePromptTokens + HISTORY_WINDOW_N"
      pattern: "measurePromptTokens|HISTORY_WINDOW_N"
---

<objective>
Close Phase 6 by (a) measuring the actual prompt token budget against EDIP config, adjusting `HISTORY_WINDOW_N` if the corporate deployment is context-constrained, and (b) running a live integration smoke test that exercises the full loop end-to-end with the facilitator in the loop.

Purpose: Phase 6 success criterion 5 says "After 4+ rounds ... `llmHistory.length` never exceeds 2×N+1 entries." The invariant is only meaningful if N is chosen against the real context window. Smoke test converts 22 individual requirements into a single end-to-end confidence check before Phase 7.
Output: Budget report module + BUDGET.md artefact + human-verified smoke test result.
</objective>

<execution_context>
</execution_context>

<context>
@.planning/phases/06-llm-integration/06-CONTEXT.md
@.planning/phases/06-llm-integration/06-RESEARCH.md
@.planning/phases/06-llm-integration/06-07-SUMMARY.md
@src/lib/promptBuilder.ts
@src/lib/contextWindow.ts
@src/data/edipConfig.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: `promptBudget.ts` — compute + report token ceiling; adjust N if needed</name>
  <files>src/lib/promptBudget.ts, src/lib/promptBudget.test.ts, src/lib/contextWindow.ts, .planning/phases/06-llm-integration/06-08-BUDGET.md</files>
  <action>
    Create `src/lib/promptBudget.ts`:

    ```typescript
    import type { GameConfig, GameState } from '@/types/game'
    import { buildSystemPrompt, measurePromptTokens } from './promptBuilder'
    import { HISTORY_WINDOW_N } from './contextWindow'

    /**
     * Safe input-context ceiling, chosen for the most constrained documented
     * corporate deployment (gpt-4 8k). Leaves ~500 tokens for LLM output.
     * Raise to 24000+ for gpt-4o-mini-128k / gpt-4-32k deployments.
     */
    export const SAFE_CONTEXT_CEILING_TOKENS = 7500

    /**
     * Rough per-turn estimate: ~250 tokens facilitator input + ~550 tokens for the
     * 3-persona JSON response (speaker + message + stateUpdate + flag, ×3). Original
     * estimate of 500 was too low for the realistic JSON shape — calibrated to 800
     * pre-empirically and re-validated post-smoke-test against an actual response.
     */
    export const TOKENS_PER_TURN_ESTIMATE = 800

    export interface PromptBudgetReport {
      systemPromptTokens: number
      historyWindowN: number
      maxHistoryTokensEstimate: number
      totalCeilingEstimate: number
      safeCeiling: number
      withinLimit: boolean
    }

    export function reportPromptBudget(
      config: GameConfig,
      gameState: GameState,
    ): PromptBudgetReport {
      const systemPromptTokens = measurePromptTokens(buildSystemPrompt(config, gameState))
      const maxHistoryTokensEstimate = HISTORY_WINDOW_N * TOKENS_PER_TURN_ESTIMATE  // 6 × 800 = 4800
      const totalCeilingEstimate = systemPromptTokens + maxHistoryTokensEstimate
      return {
        systemPromptTokens,
        historyWindowN: HISTORY_WINDOW_N,
        maxHistoryTokensEstimate,
        totalCeilingEstimate,
        safeCeiling: SAFE_CONTEXT_CEILING_TOKENS,
        withinLimit: totalCeilingEstimate <= SAFE_CONTEXT_CEILING_TOKENS,
      }
    }
    ```

    Tests (`src/lib/promptBudget.test.ts`):
    - `reportPromptBudget(EDIP_CONFIG, mockGameState)` returns a report with `systemPromptTokens > 0`.
    - `maxHistoryTokensEstimate === HISTORY_WINDOW_N * TOKENS_PER_TURN_ESTIMATE` (currently 6 × 800 = 4800).
    - `withinLimit` is `boolean` and matches `totalCeilingEstimate <= safeCeiling`.
    - `TOKENS_PER_TURN_ESTIMATE === 800` — pinned so future drift is caught.
    - The test also `console.info`s the full report so the executor can capture it verbatim for BUDGET.md.

    **Procedure for the executor:**
    1. Run the budget test once to capture the empirical report.
    2. If `report.withinLimit === true` with `HISTORY_WINDOW_N = 6`, leave `contextWindow.ts` as-is.
    3. If `report.withinLimit === false`, reduce `HISTORY_WINDOW_N` in `src/lib/contextWindow.ts` to the largest integer `n` where `systemPromptTokens + n * TOKENS_PER_TURN_ESTIMATE <= SAFE_CONTEXT_CEILING_TOKENS` (with current values: `n * 800 <= 7500 - systemPromptTokens`). Update the adjoining test in `contextWindow.test.ts` that pins `HISTORY_WINDOW_N === 6` to pin the new value. Also update the bound applied in `gameStore.ts` / `runLLMTurn` (the `2 * HISTORY_WINDOW_N + 1` slice from plan 06-07) — it imports the constant so should adjust automatically. Re-run budget test to confirm `withinLimit === true`.
    4. Write `.planning/phases/06-llm-integration/06-08-BUDGET.md` with:
       - Empirical `systemPromptTokens` count.
       - Chosen `HISTORY_WINDOW_N`.
       - Whether a reduction was applied and why.
       - Deployment assumptions (8k vs 32k vs 128k) and how this affects the chosen N.
       - Note if the corporate deployment context window is unconfirmed — flag as a Phase 8 follow-up.

    Add an import of `reportPromptBudget` into `gameStore.ts` `initGame` so that in DEV, right after game init, the budget is logged. Branch on `withinLimit` so an over-budget config produces a distinct, attention-grabbing error (CTX-03 must NOT silently fail):
    ```typescript
    if (import.meta.env.DEV) {
      const budget = reportPromptBudget(config, gameState)
      if (budget.withinLimit) {
        console.info('[promptBudget]', budget)
      } else {
        console.error('[promptBudget] CTX-03 BUDGET EXCEEDED — reduce HISTORY_WINDOW_N or raise SAFE_CONTEXT_CEILING_TOKENS', budget)
      }
    }
    ```
    This gives every fresh scenario a budget readout without running a test, and an over-budget configuration is impossible to miss in DevTools.
  </action>
  <verify>
    - `pnpm test src/lib/promptBudget.test.ts` — passes; `console.info` output visible in test runner.
    - `pnpm typecheck` passes.
    - `.planning/phases/06-llm-integration/06-08-BUDGET.md` exists with the empirical numbers written in.
    - If N was reduced: `contextWindow.ts` and `contextWindow.test.ts` both updated consistently, all prior tests still pass.
    - **Post-smoke-test recalibration of `TOKENS_PER_TURN_ESTIMATE`:** during Task 2, capture one actual LLM response from the DevTools Network tab. Compute `actualTurnTokens ≈ (userMessage.length + assistantResponse.length) / 4` (rough char-to-token ratio). Confirm `TOKENS_PER_TURN_ESTIMATE = 800` is within 20% of `actualTurnTokens`. If outside that band, update `TOKENS_PER_TURN_ESTIMATE` in `promptBudget.ts` (and the pinned-value test) to the rounded actual, re-run `pnpm test`, and re-run the budget report. Document the new value + measurement in BUDGET.md.
  </verify>
  <done>
    Budget recorded. N is either validated at 6 or reduced to a safe value. BUDGET.md captures the decision rationale for future reference.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Live end-to-end smoke test against the corporate LLM endpoint</name>
  <what-built>
    Full Phase 6 loop: facilitator types → backend proxies to Azure OpenAI with the corrected auth header → response parsed + personas rendered + state updates animate → errors surface as red bubbles with Retry + raw disclosure → control banner appears on LLM signal and clears on dismiss.
  </what-built>
  <how-to-verify>
    **Prerequisites:**
    1. `.env` in `backend/` is populated with real `LLM_API_KEY`, `LLM_ENDPOINT_URL`, `LLM_MODEL`. If using Azure corporate endpoint: `LLM_AUTH_HEADER_NAME=api-key` and `LLM_AUTH_VALUE_PREFIX=` (empty).
    2. Start backend: `cd backend && uvicorn app.main:app --reload --port 8000`.
    3. Start frontend: from repo root `pnpm dev`.
    4. Open http://localhost:5173 in Chromium. Open DevTools Network tab.

    **Run the following checklist — tick each item:**

    *Setup path (regression):*
    - [ ] Home → Load Config / EDIP Default → Launch Scenario 1 → arrives on /game with three-column layout visible.
    - [ ] DevTools Console after init: the line `[promptBudget] {systemPromptTokens: ..., withinLimit: true, ...}` appears as `console.info` (NOT a red `console.error`). If the line reads `CTX-03 BUDGET EXCEEDED`, stop the smoke test and reduce `HISTORY_WINDOW_N` per Task 1 procedure before continuing.

    *PROMPT requirements:*
    - [ ] First facilitator message: type "The EO has just tightened CRM export restrictions." → Send.
    - [ ] 1–3 persona bubbles appear within ~30 seconds; at least one is Kent OR Finch (routing for institutional/adversary triggers).
    - [ ] Persona voice is distinct: Kent reads structured/inclusive, Finch precise/data-driven, Chen grounding/numerical (check at least across 2-3 messages).
    - [ ] LLM response JSON (inspect via DevTools Network → /api/llm response) has `responses` array; each item has `speaker`, `message`, `stateUpdate`, `flag` fields.

    *STATE requirements:*
    - [ ] If the LLM sent a stateUpdate, StatePanel reflects it (bar animates if severity/legitimacy changed; team cell pulses if team resource changed).
    - [ ] If an LLM response sends out-of-range (check dev console for `[stateUpdater] clamped fields:` warn), the bar displays the clamped value, not the raw.

    *RESP requirements:*
    - [ ] Induce a parse failure by temporarily modifying the backend to return `response.text = "definitely not json"` for one call (or just trust the defensive parse test suite here). Red error bubble with "Response was not valid JSON" + "Show raw response" `<details>` + Retry button appears; session continues; next message produces a normal response.
    - [ ] `flag` field from at least one persona response renders as amber note below the persona bubble.

    *FLOW requirements:*
    - [ ] Click "Advance to Round 2" → round divider inserts, Finch delivers the scenario inject, Kent frames. At least one of these appears.
    - [ ] Click "End Game + Debrief" → debrief divider inserts, all three personas respond in Kent → Finch → Chen order.
    - [ ] "Request Debrief Now" button exists and produces an interim debrief without ending the session.
    - [ ] New Game button (header) navigates back to setup and clears state.

    *CTX requirements:*
    - [ ] Play 4+ rounds (or equivalent ~10+ facilitator turns). Personas still respond in character; JSON format never breaks.
    - [ ] In DevTools console, inspect `useGameStore.getState().llmHistory.length` after each turn — it grows with each successful turn, unbounded in the store.
    - [ ] In DevTools Network tab, inspect the request body sent to `/api/llm` — the `messages` array length should stay `<= 2 * HISTORY_WINDOW_N` regardless of history growth.

    *Credential audit (pre-Phase 8):*
    - [ ] DevTools Network → every request to `/api/llm` — the request headers contain NO `Authorization` header sourced from the client. Backend-only.
    - [ ] `document.cookie` / `localStorage` / `sessionStorage` contain no LLM keys.

    *Control banner:*
    - [ ] If during testing the LLM sets `control.advanceRound: true`, confirm the banner appears non-blockingly above FacilitatorInput; Dismiss clears it; Advance increments the round.

    **Failure modes to explicitly try:**
    - Stop backend mid-call → frontend shows LLM_UNREACHABLE or NETWORK_ERROR bubble with Retry.
    - Set a bad API key in `.env`, restart backend, send message → LLM_AUTH_ERROR bubble.
    - Delete API key env var, restart backend → backend fails to start (Pydantic validation) — expected.

    **If any box fails, the executor files a gap in a VERIFICATION.md per the /gsd:plan-phase --gaps workflow.**
  </how-to-verify>
  <resume-signal>
    Type "approved — phase 6 smoke test green" to mark Phase 6 complete, or paste the specific failing checklist item(s) to trigger gap closure planning.
  </resume-signal>
</task>

</tasks>

<verification>
- BUDGET.md exists with empirical system-prompt token count and chosen `HISTORY_WINDOW_N`.
- Smoke test checklist signed off by the human (22 requirement boxes + credential audit + failure-mode tests).
</verification>

<success_criteria>
- Token budget empirically measured; N is safe for the deployment.
- End-to-end loop verified in a live session (facilitator perspective).
- Credential isolation spot-checked ahead of Phase 8's full audit.
- All 22 Phase 6 requirements individually exercised in the smoke test.
</success_criteria>

<output>
After completion, create `.planning/phases/06-llm-integration/06-08-SUMMARY.md` summarising the empirical budget, the smoke test result, and any items deferred to Phase 8 (e.g. context window still unconfirmed with ops; multi-trigger routing edge case).
</output>
