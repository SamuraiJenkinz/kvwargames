---
phase: 06-llm-integration
verified: 2026-04-14T00:00:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 6: LLM Integration Verification Report

**Phase Goal:** The facilitator can type an event, press Enter, and receive in-character persona responses that update the live game state - the complete LLM loop is hardened against JSON parse failures, context overflow, out-of-range state values, and credential leakage.

**Verified:** 2026-04-14
**Status:** passed
**Re-verification:** No - initial verification after full phase completion (9/9 plans)
**Test suite state:** 406/406 frontend tests green; 2/2 backend tests green.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Enter produces 1-3 in-character persona responses, correctly coloured | PASS | Full flow wired end-to-end in gameStore.ts + MessageInput.tsx; 06-08 live smoke test confirmed against real Azure OpenAI |
| 2 | Persona routing: round-start -> Kent+Finch, card-play -> card-relevant, debrief -> all three | PASS | Routing rules in promptBuilder.ts Block 8 (lines 170-192); exercised across 3+ trigger types in live smoke test |
| 3 | State deltas clamped silently for out-of-range crisisSeverity / edipLegitimacy | PASS | applyStateUpdatePure + CLAMP_RANGES in stateUpdater.ts; boundary tests pin all ranges |
| 4 | Malformed/truncated JSON -> red error bubble, session intact, retry works | PASS | 4-layer parsePersonaResponse (never throws); runLLMTurn atomicity; ErrorMessage.tsx renders red bubble with Retry |
| 5 | After 4+ rounds, prompt+history stays within context window; llmHistory.length <= 2N+1 | PASS | Empirical 5124+1600=6724 <= 7500 ceiling; runLLMTurn enforces slice(-maxHistoryEntries); dedicated test pins invariant |

**Score:** 5/5 truths verified.

---

## Must-Have #1 - Send Message -> Persona Responses

**Status:** SATISFIED

### Evidence

**UI entry point** - src/components/game/FacilitatorInput/MessageInput.tsx:37-43:
- handleKeyDown traps Enter (without Shift), calls e.preventDefault() and submit().
- submit() -> sendFacilitatorMessage(trimmed) on gameStore.

**Store action** - src/lib/gameStore.ts:503-518 sendFacilitatorMessage:
- Pushes facilitator bubble synchronously (line 507-513), flips loading=true (line 514), stores lastFacilitatorInput (line 515), fires runLLMTurn(trimmed) (line 517).

**Async orchestration** - gameStore.ts:140-265 runLLMTurn:
- Builds system prompt (line 157), windows history (line 158), calls callLLMProxy with AbortSignal + 45s frontend timeout (lines 155, 160-164).
- On success: parses response (line 190), computes clamped next state (lines 211-224), in a single atomic set() pushes persona messages with staggered CSS revealDelay (lines 234-237), replaces gameState (line 240), appends history with 2N+1 cap (lines 245-250), clears loading (line 262).

**Rendering with persona colour** - src/components/game/ChatFeed/PersonaMessage.tsx:19-68:
- Avatar colour from PERSONA_META[speaker].colorClass (line 26) - maps to bg-persona-kent|finch|chen (personaConfig.ts:15-41).
- Name colour from textClass (line 37); bubble tint from bubbleClass (line 48).
- revealDelay drives animation-delay inline style (lines 15-22) for staggered reveal.

**Timeout budget** - llmClient.ts:7 LLM_FRONTEND_TIMEOUT_MS = 45000; pinned in llmClient.test.ts.

**Live verification** - 06-08-SUMMARY.md:83-91 smoke test step 2: Finch + Chen responded, voices distinct against real corporate Azure OpenAI endpoint, within timeout.

---

## Must-Have #2 - Persona Routing Correctness

**Status:** SATISFIED

### Evidence

**Routing rules in system prompt** - src/lib/promptBuilder.ts:170-192 Block 8 (Routing Rules):
- Round start -> kent (framing) THEN finch (inject), in that order (line 178).
- Card play routed by cat: institutional/political/legitimacy -> kent; adversary/disruption/escalation -> finch; technical/operational/readiness -> chen; ambiguous -> kent (lines 180-184).
- National action routed by character (lines 185-187).
- Debrief -> all three personas, fixed order Kent -> Finch -> Chen (line 191).

**Fixed response order** - promptBuilder.ts:173: Fixed response order whenever multiple personas speak: Kent -> Finch -> Chen. Enforced post-hoc by responseParser.ts:158-160 PERSONA_ORDER sort (Layer 4 normalization) even if LLM deviates.

**Persona voice definitions** - promptBuilder.ts:9-52 PERSONA_PROMPT_DEFS with MUST / MUST NOT constraints for each persona.

**Trigger wiring:**
- Round-start: gameStore.advanceRound() prefixes input with [ROUND_START Round N] {inject} (gameStore.ts:459) so the LLM receives the round-start trigger token.
- Debrief: gameStore.triggerDebrief() prefixes with [DEBRIEF_TRIGGER] (gameStore.ts:483).
- Plain facilitator messages pass through untouched; LLM reads card/action mentions and routes per Block 8.

**Live verification** - 06-08-SUMMARY.md:86-89 smoke test:
- Step 2: first facilitator message -> Finch + Chen (trigger #1: plain event).
- Step 4: Advance Round 2 -> Round divider + Kent framing + Finch escalation analysis (trigger #2: round-start).
- Step 6: End Game + Debrief -> Kent -> Finch -> Chen in correct order (trigger #3: debrief).
- All three distinct trigger types exercised successfully.

---

## Must-Have #3 - State Deltas Clamped Silently

**Status:** SATISFIED

### Evidence

**Canonical clamp ranges** - src/lib/stateUpdater.ts:25-34 CLAMP_RANGES:
- crisisSeverity: [0, 5]
- edipLegitimacy: [-2, 2]
- pc: [0, 6], po: [-2, 2], readiness: [0, 5], stock/crm/ic: [0, 99]

**Pure clamping function** - stateUpdater.ts:104-142 applyStateUpdatePure:
- Silently clamps (no throw) via Math.max(min, Math.min(max, raw)) (line 62).
- Records clamp events in clampLog only when clamped is not equal to raw (line 63).
- Null/undefined = no-op (line 81 if value is null continue; line 111 if update.crisisSeverity is not null).
- Unknown team IDs silently skipped (line 136 if no team continue).
- Uses structuredClone (line 108) - input state never mutated.

**Store integration** - gameStore.ts:209-228:
- Reduces over value.responses, threading nextState + accumulated clampLog.
- Dev-only console.warn on non-empty clampLog (line 226-228) - facilitator sees no error.

**Test coverage** - src/lib/stateUpdater.test.ts:
- Boundary tests for every field: crisisSeverity 7->5 and -3->0; edipLegitimacy +/-5 -> +/-2; pc 7->6 and -1->0; po +/-3 -> +/-2; readiness -1->0 and 6->5; stock/crm/ic 100->99 and -1->0.
- Null field does not mutate state and no clampLog entry; undefined field is a no-op; empty update produces state deep-equal to input.

**Store-level tests** - gameStore.test.ts:828-852 LLM stateUpdate with crisisSeverity=9 -> clamped to 5, console.warn called in dev: proves end-to-end that an LLM response pushing over 5 is clamped silently in the StatePanel and logged to dev console, not rejected or crashed.

**Live verification** - 06-08-SUMMARY.md:86 smoke test step 3: crisisSeverity 0 -> 2, bar animated to match with no crash.

---

## Must-Have #4 - Malformed JSON -> Red Error Bubble, Retry Works

**Status:** SATISFIED

### Evidence

**Never-throws parser** - src/lib/responseParser.ts:100-168 parsePersonaResponse:
- Layer 1: BOM + whitespace + markdown fence cleanup (lines 101-111).
- Layer 2: JSON.parse wrapped in try/catch -> { ok: false, errorKind: PARSE_FAILURE, raw, detail } on throw (lines 113-124).
- Layer 3: manual type guards reject malformed shape -> VALIDATION_FAILURE (lines 127-135).
- Layer 4: canonical persona sort + dedup (lines 138-165).
- 11 never throws tests in responseParser.test.ts cover empty / whitespace / non-JSON / truncated / BOM-only / fence-only / null / array / number / boolean / nested-nonsense inputs - all return { ok: false, ... }, never throw.

**Atomic failure handling** - gameStore.ts:190-207:
- On parse failure, single set() pushes red error bubble via buildErrorMessage (line 196) and clears loading / controller (lines 203-204).
- **Critical:** no llmHistory push, no gameState mutation on the failure branch. gameStore.test.ts:631-655 parse failure path: error bubble carries rawResponse + retryInput; gameState + llmHistory unchanged pins this atomicity.

**Error bubble UI** - src/components/game/ChatFeed/ErrorMessage.tsx:
- Red-tinted bubble with border-crisis-security + AlertCircle icon (lines 24-26).
- Shows [errorCode] prefix in monospace (lines 28-32) - e.g. [PARSE_FAILURE], [LLM_TIMEOUT].
- Collapsible details disclosure exposes raw response (lines 40-49).
- Inline Retry button (lines 51-62) calls retryLastMessage; disabled while loading.

**Retry path** - gameStore.ts:525-532 retryLastMessage:
- Replays lastFacilitatorInput through runLLMTurn with a fresh AbortController.
- gameStore.test.ts:697-722 replays lastFacilitatorInput and applies the retry response confirms subsequent successful call after an error.

**Error source coverage** - llmClient.ts:42-101 maps every failure mode (abort, network, HTTP error with unparseable body, backend error envelope) to structured LLMCallResult - never throws. Covered by 19 llmClient.test.ts cases.

**Live verification** - 06-08-SUMMARY.md:91 smoke test step 8a: Backend down + Retry - Red error bubble appeared with Retry button; Retry succeeded after backend restart - session state intact, facilitator continued without refresh.

---

## Must-Have #5 - Context Window Holds Round 4+; llmHistory <= 2N+1

**Status:** SATISFIED

### Evidence

**Single source of truth for N** - src/lib/contextWindow.ts:25 HISTORY_WINDOW_N = 2 (reduced 6->2 in Plan 06-08 after empirical measurement).

**Sliding window** - contextWindow.ts:42-59 windowHistory:
- Returns at most 2*n entries via history.slice(-maxEntries).
- Guards against orphaned leading assistant (line 54-56) - maintains pair-aligned invariant.

**Store enforcement** - gameStore.ts:245-250 (inside the atomic success set()):
- Push user + assistant entries, then compute maxHistoryEntries = 2 * HISTORY_WINDOW_N + 1, then slice(-maxHistoryEntries) when over.
- Cap = 2x2+1 = 5 entries at N=2.

**Invariant test** - gameStore.test.ts:859-871: after 10 consecutive successful turns, llmHistory.length stays <= 2*HISTORY_WINDOW_N+1 - drives 10 turns, asserts cap after each, and verifies stable length = MAX at end.

**System prompt preserved every turn** - gameStore.ts:157 buildSystemPrompt(gameConfig, gameState) rebuilt each call using live state (never windowed). Persona voice definitions + routing rules always present.

**Empirical budget** - 06-08-BUDGET.md:11-19 captured live from promptBudget.test.ts:
- systemPromptTokens: 5124
- maxHistoryTokensEstimate: 1600 (2 x 800)
- totalCeilingEstimate: 6724
- safeCeiling: 7500
- withinLimit: true -> 776-token headroom under gpt-4 8k ceiling.

**CTX-03 non-silent enforcement** - gameStore.ts:380-397:
- initGame calls reportPromptBudget in import.meta.env.DEV.
- console.info if within budget; console.error with CTX-03 BUDGET EXCEEDED tag if not - impossible to miss in DevTools.

**Pinned constants** - promptBudget.test.ts + contextWindow.test.ts assert TOKENS_PER_TURN_ESTIMATE === 800 and HISTORY_WINDOW_N === 2 so future drift is caught at test time.

**Live verification** - 06-08-SUMMARY.md:88 smoke test step 5: messages[] capped at 5 (2N+1 with N=2), starts on user, pair-aligned. Steps 4-6 exercised Round 2 + debrief with intact persona voice and JSON structure.

---

## Required Artifacts - Three-Level Check

| Artifact | Exists | Substantive | Wired | Status |
|----------|--------|-------------|-------|--------|
| backend/app/config.py (configurable auth header) | Yes | Yes (55 lines, llm_auth_header_name + llm_auth_value_prefix with defaults) | Yes (used by routers/llm.py:79-84) | VERIFIED |
| backend/app/routers/llm.py | Yes | Yes (155 lines, 5 error-code branches, no hardcoded Authorization) | Yes (mounted in main.py; backend tests green) | VERIFIED |
| src/types/game.ts (ChatMessage extensions) | Yes | Yes (errorCode, retryInput, rawResponse, revealDelay fields at lines 124-131) | Yes (consumed by ErrorMessage + PersonaMessage + gameStore) | VERIFIED |
| src/types/llm.ts (control, ParseResult, LLMCallResult, HistoryEntry) | Yes | Yes (66 lines, all shared discriminated unions) | Yes (imported across llmClient/responseParser/contextWindow/gameStore) | VERIFIED |
| src/lib/stateUpdater.ts | Yes | Yes (143 lines, CLAMP_RANGES + pure function + structuredClone) | Yes (called in gameStore.ts lines 217, 305) | VERIFIED |
| src/lib/promptBuilder.ts | Yes | Yes (277 lines, 10-block prompt, PERSONA_PROMPT_DEFS, measurePromptTokens) | Yes (called in gameStore.ts:157 and promptBudget.ts:56) | VERIFIED |
| src/lib/responseParser.ts | Yes | Yes (169 lines, 4-layer defensive, never-throws contract) | Yes (called in gameStore.ts:190) | VERIFIED |
| src/lib/contextWindow.ts | Yes | Yes (60 lines, HISTORY_WINDOW_N=2 with pair-alignment guard) | Yes (called in gameStore.ts:158) | VERIFIED |
| src/lib/llmClient.ts | Yes | Yes (103 lines, AbortController + full error mapping + LLM_FRONTEND_TIMEOUT_MS) | Yes (called in gameStore.ts:160) | VERIFIED |
| src/lib/gameStore.ts (full LLM turn orchestration) | Yes | Yes (570 lines; atomic runLLMTurn; newGame abort; 2N+1 cap) | Yes (consumed by all chat/input/state components) | VERIFIED |
| src/lib/promptBudget.ts | Yes | Yes (68 lines, reportPromptBudget with SAFE_CONTEXT_CEILING_TOKENS) | Yes (called in gameStore.ts:385) | VERIFIED |
| src/components/game/ChatFeed/ErrorMessage.tsx | Yes | Yes (66 lines, red bubble + raw disclosure + Retry) | Yes (rendered in ChatFeed.tsx:62 for msg.type=error) | VERIFIED |
| src/components/game/ChatFeed/PersonaMessage.tsx | Yes | Yes (69 lines, persona colour + revealDelay + optional flag) | Yes (rendered in ChatFeed.tsx:52 for msg.type=persona) | VERIFIED |
| src/components/game/FacilitatorInput/ControlBanner.tsx | Yes | Yes (53 lines, confirm/dismiss wired) | Yes (rendered inside FacilitatorInput.tsx:29) | VERIFIED |
| src/components/game/FacilitatorInput/ActionToolbar.tsx | Yes | Yes (87 lines, advance/debrief/insert controls) | Yes (rendered inside FacilitatorInput.tsx:30) | VERIFIED |
| src/components/game/StatePanel/StatePanel.tsx (delta ghosts) | Yes | Yes (129 lines; computes severity/legitimacy/team deltas; passes to TrackBar/TeamCard) | Yes (mounted in GameScreen) | VERIFIED |
| src/components/game/StatePanel/TeamCard.tsx (cell pulse) | Yes | Yes (animate-[cellPulse_800ms]) | Yes (rendered per-team in StatePanel.tsx:119) | VERIFIED |
| src/styles/index.css (cellPulse + ghostFade keyframes) | Yes | Yes (keyframes at lines 84-93) | Yes (referenced via animate-[...] classes in TrackBar/TeamCard) | VERIFIED |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| MessageInput | gameStore | sendFacilitatorMessage call | WIRED | MessageInput.tsx:13,33 + Enter handler |
| gameStore.runLLMTurn | llmClient | callLLMProxy | WIRED | gameStore.ts:17,160-164 forwards signal + body |
| gameStore.runLLMTurn | responseParser | parsePersonaResponse | WIRED | gameStore.ts:18,190 |
| gameStore.runLLMTurn | stateUpdater | applyStateUpdatePure | WIRED | gameStore.ts:19,217 reduce |
| gameStore.runLLMTurn | contextWindow | windowHistory | WIRED | gameStore.ts:15,158 |
| gameStore.runLLMTurn | promptBuilder | buildSystemPrompt | WIRED | gameStore.ts:14,157 |
| gameStore.initGame | promptBudget | reportPromptBudget (DEV only) | WIRED | gameStore.ts:16,385 |
| ErrorMessage | gameStore | retryLastMessage | WIRED | ErrorMessage.tsx:3,20,54 |
| ControlBanner | gameStore | confirmControlBanner / dismissControlBanner | WIRED | ControlBanner.tsx:1,20-21,39,45 |
| llmClient | backend /api/llm | fetch POST | WIRED | llmClient.ts:36-41 uses relative /api/llm (Vite proxy) |
| backend llm.py | Settings | settings.llm_auth_header_name + settings.llm_auth_value_prefix | WIRED | llm.py:79-84; no hardcoded Authorization string |

No orphan artifacts. All 14 Phase 6 library modules are imported and exercised; all 8 components render in their parent.

---

## Requirements Coverage

All 22 Phase 6 requirements were exercised in the 06-08 live smoke test (approved 2026-04-14, 06-08-SUMMARY.md lines 80-94):

| Requirement group | Count | Status |
|-------------------|-------|--------|
| PROMPT-01..05 | 5 | SATISFIED - promptBuilder.ts 10-block structure + persona defs + routing |
| STATE-01..04 | 4 | SATISFIED - stateUpdater.ts clamping + ID-match + no-op + pure function |
| RESP-01..05 | 5 | SATISFIED - responseParser 4-layer + error bubble + retry + raw disclosure + flag |
| FLOW-01..05 | 5 | SATISFIED - sendFacilitatorMessage, advanceRound, triggerDebrief, ActionToolbar, newGame abort |
| CTX-01..03 | 3 | SATISFIED - rolling history, 2N window, budget enforcement with loud DEV error |

---

## Anti-Pattern Scan

Grep for universal stub patterns (TODO, FIXME, placeholder, not implemented, coming soon) across the Phase 6 delivered files returned zero matches in substantive code paths. Comments referencing Plan 07 / Phase 8 are forward-looking documentation only (e.g. ActionToolbar.tsx:28 noting split semantics deferred to Plan 08), not unfinished work.

No return-null / empty-handler stubs in any wired path. All onClick/onKeyDown handlers dispatch real store actions.

---

## Human Verification Status

Live smoke test (2026-04-14) covered all behaviors that cannot be verified programmatically (persona voice quality, visual attribution colour, animation timing, real LLM timing, credential audit in DevTools Network tab). Results logged in 06-08-SUMMARY.md:80-94:
- All 22 requirements verified end-to-end.
- Credential audit passed (no Authorization header on any browser-originated request).
- Failure-mode drills passed (backend-down -> red bubble + Retry -> success).

No outstanding human-verification items for Phase 6.

---

## Phase 8 Follow-ups (Not Phase 6 Gaps)

Per operator note + 06-08-SUMMARY.md:138-174, the following items are carry-overs to Phase 8 QA, explicitly out of scope for Phase 6 completion:

1. Backend swallows upstream error detail (cosmetic; status code preserved).
2. uvicorn --reload does not watch .env (developer docs only).
3. Vite dev proxy returns 502+HTML when backend down -> mapped to INTERNAL_ERROR not LLM_UNREACHABLE (dev-only; production routes differently - UX identical).
4. Stale localStorage from prior-tenant apps (cosmetic; not security-relevant).
5. TOKENS_PER_TURN_ESTIMATE recalibration against a captured live response (+/-20% band; current 800 confirmed safe-side-conservative).
6. Confirm corporate deployment context window with ops (raise SAFE_CONTEXT_CEILING_TOKENS + HISTORY_WINDOW_N if >8k).
7. Rotate the OpenAI API key that was used during live smoke test.

None of these block Phase 6 goal achievement.

---

## Summary

Phase 6 delivers a complete, hardened LLM turn loop:
- Facilitator Enter -> persona responses in corporate timeout, with correct attribution and colour.
- Three distinct trigger types (plain message, round-start, debrief) routed correctly via 10-block system prompt + canonical Kent -> Finch -> Chen ordering (enforced both in prompt and post-hoc in parser).
- Out-of-range state values clamped silently with dev-only log; null/undefined no-ops; unknown team IDs skipped.
- Malformed JSON never throws - red error bubble with raw disclosure + Retry; session state + llmHistory untouched on failure.
- Empirical context budget (5124 + 1600 = 6724 <= 7500) with pinned constants, 2N+1=5 history cap enforced per turn, CTX-03 loud-fail in DEV.
- Credentials never leave the backend (06-08 DevTools audit confirmed).

All nine plans (06-01 through 06-09) complete. 406/406 frontend + 2/2 backend tests green. Live smoke test approved 2026-04-14.

**Status: PASSED - 5/5 must-haves verified. Ready to proceed to Phase 7.**

---

*Verified: 2026-04-14*
*Verifier: gsd-verifier*
