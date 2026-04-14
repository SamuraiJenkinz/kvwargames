---
phase: 06-llm-integration
plan: 04
subsystem: llm
tags: [prompt-engineering, system-prompt, personas, typescript, vitest, determinism]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: GameConfig/GameState type definitions in src/types/game.ts
  - phase: 06-llm-integration
    provides: HistoryEntry + LLMStructuredResponse types (06-02) — not directly imported, but JSON schema in Block 9 must match
provides:
  - buildSystemPrompt(config, gameState): deterministic 10-block system prompt
  - measurePromptTokens(prompt): ceil(len/4) heuristic token counter
  - PERSONA_PROMPT_DEFS (module-private): kent/finch/chen voice + MUST + MUST NOT constants
  - Empirical baseline: 5124 tokens / 20496 chars for full EDIP prompt
affects: [06-06-llm-client, 06-07-store-and-ui-wiring, 06-08-token-budget, 07-config-generation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure config-in → string-out prompt builder (no EDIP_CONFIG import inside module)
    - Module-private PERSONA_PROMPT_DEFS with `as const` for literal type narrowing
    - Per-block builder functions composed into array joined by '\n\n' (legible, testable)
    - Structural tests pin every block heading, routing trigger, and constraint keyword

key-files:
  created:
    - src/lib/promptBuilder.ts
    - src/lib/promptBuilder.test.ts
  modified: []

key-decisions:
  - "No EDIP_CONFIG import in promptBuilder.ts — config always passed as parameter so Phase 7 generated configs work unchanged"
  - "PERSONA_PROMPT_DEFS kept module-private — not exported; future voice tuning is a single-file edit with no cross-file ripple"
  - "Block 9 JSON schema stated verbatim with clamp ranges inline — nudges the LLM to produce in-range values without an extra validator round-trip"
  - "Block 9 documents the advanceRound/triggerDebrief conflict rule (triggerDebrief wins) matching 06-02 decision"
  - "Test isolates Block 2 via substring slice between headings — pins assertions to the correct section so later block reordering fails loudly"
  - "Test fixture uses EDIP_CONFIG cast as GameConfig (same pattern as 05-01 seedMockState) — 'as const satisfies' narrows too much for GameConfig parameter"
  - "Empirical token log test asserts only > 0 — Plan 06-08 owns the formal budget threshold"

patterns-established:
  - "Block builder pattern: one helper per numbered block; top-level buildSystemPrompt composes via array.join('\\n\\n')"
  - "Deterministic prompt invariant: no Date.now, no Math.random, no uuid — same inputs → same bytes (tested explicitly)"
  - "Structural test style: isolate section via indexOf heading + slice, assert within slice — robust to block reordering"

# Metrics
duration: 2m 43s
completed: 2026-04-14
---

# Phase 6 Plan 04: Prompt Builder Summary

**Deterministic 10-block system prompt builder with per-persona MUST/MUST NOT voice anchors and empirical 5124-token baseline on the EDIP config.**

## Performance

- **Duration:** 2m 43s
- **Started:** 2026-04-14T13:00:11Z
- **Completed:** 2026-04-14T13:02:54Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- `buildSystemPrompt(config, gameState)` composes a 10-block system prompt covering game context, live state, team identities, national actions, EDIP cards, key mechanics, persona definitions (kent/finch/chen with voice + MUST + MUST NOT), routing rules, JSON output schema, and absolute rules.
- `measurePromptTokens(prompt)` provides the `ceil(len/4)` heuristic Plan 06-08 will use as its budget metric.
- `PERSONA_PROMPT_DEFS` module-private constant encodes the three personas' voice rules and negative constraints (Kent must not sound like Finch, etc.) satisfying PROMPT-02 / PROMPT-05.
- Structural test suite (28 tests) pins every block heading, live-state interpolation path, all 4 team IDs + 11 card IDs + 4 national action IDs, all three persona subheadings, MUST NOT occurrences (≥3), routing trigger keywords, the JSON-only rule, determinism, and the token measurement helper.
- **Empirical token count logged for 06-08:** `measurePromptTokens(buildSystemPrompt(EDIP_CONFIG, mockState)) = 5124 tokens (prompt length 20496 chars)`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build `buildSystemPrompt` with all 10 blocks and persona definitions** — `e8143f5` (feat)
2. **Task 2: Structural test suite for the prompt builder** — `5f54126` (test)

**Plan metadata:** (to be added as final commit — `docs(06-04): complete prompt builder plan`)

## Files Created/Modified

- `src/lib/promptBuilder.ts` — 276 lines. Exports `buildSystemPrompt` and `measurePromptTokens`; module-private `PERSONA_PROMPT_DEFS`, ten `buildBlockN` helpers, pure function composition.
- `src/lib/promptBuilder.test.ts` — 211 lines. 28 vitest tests grouped into 7 describe blocks (block presence, live state, teams, enumeration, personas, routing+JSON, determinism, token measurement).

## Decisions Made

- **No `EDIP_CONFIG` import inside `promptBuilder.ts`** — config always arrives via the `config` parameter so Phase 7-generated configs work identically. Keeps the module testable against arbitrary fixtures and makes the public contract `(config, gameState) → string` the only coupling point.
- **`PERSONA_PROMPT_DEFS` is module-private** — not exported. Voice tuning is a single-file edit, and no downstream code depends on the literal shape, so keeping it internal matches YAGNI.
- **Block 9 embeds clamp ranges inline** — rather than forcing the LLM to re-read the type shapes via a schema URL, the prompt states `crisisSeverity: 0–5`, `pc: 0–6`, etc. directly. Evidence-based choice: reduces validation round-trips at the cost of ~300 chars of prompt.
- **Block 9 documents the control-conflict rule** — `triggerDebrief` wins over `advanceRound` when both true, matching the 06-02 `LLMStructuredResponse` JSDoc. Keeps the semantic contract visible to both the model and the store.
- **Block 2 renders the round-1-indexed inject** — `scenario.injects[gameState.round - 1]` with graceful fallback if the round overshoots `injects.length`. The fallback message is deterministic so tests remain stable across scenario-end edge cases.
- **Empirical token test asserts only `> 0`** — Plan 06-08 owns the formal budget. This test exists to ensure the helper works end-to-end on real inputs and to log a baseline (5124) into this summary for downstream use.
- **Test sections isolated via `indexOf(heading) + slice(next heading)`** — makes assertions robust to future block reordering: if Block 3 moves ahead of Block 2, the Block 2 substring still correctly scopes the `round:` / `crisisSeverity:` checks.
- **Test fixture uses `EDIP_CONFIG as unknown as GameConfig`** — same pattern as Plan 05-01's `seedMockState`. The `as const satisfies GameConfig` in `edipConfig.ts` narrows to literal types, which are incompatible with the `GameConfig` parameter shape. Double-cast documents the intent without weakening `promptBuilder.ts` itself (which has proper typing).

## Deviations from Plan

None — plan executed exactly as written.

The plan's illustrative JSON schema in Block 9 stated `"control": { ... } | undefined` without spelling out the conflict rule; this summary documents the minor addition of the `triggerDebrief`-wins tie-breaker line, which mirrors the 06-02 JSDoc contract and is not a scope change.

## Issues Encountered

None. `pnpm typecheck` and `pnpm test` both passed on first run. All 28 new tests green; all 310 project-wide tests green (no regression).

## User Setup Required

None — pure frontend library code, no external services.

## Next Phase Readiness

- **Plan 06-06 (LLM Client)** can now compose `buildSystemPrompt(config, gameState)` + the windowed history (06-05) into the upstream request payload. `measurePromptTokens` is the token accounting primitive.
- **Plan 06-08 (Token Budget)** now has the empirical baseline: **5124 tokens for the full EDIP prompt.** With a typical 8K-16K context budget this leaves ~3K-11K for windowed history + response, confirming the CONTEXT.md estimate of 3,000-4,000 prompt tokens was low. 06-08 should window history tightly and consider a summary-compaction pass if scenarios grow beyond EDIP's 11 cards / 2 scenarios.
- **Plan 06-07 (Store + UI Wiring)** will wire `buildSystemPrompt` into the `sendFacilitatorMessage` store action; no further changes to this module are anticipated.
- **Phase 7 (Config Generation)** will NOT touch `promptBuilder.ts` — it has its own prompt. Confirmed by the `config` parameter contract: any valid `GameConfig` works, whether EDIP_CONFIG or a generated one.

**Blockers / concerns:**
- 5124 tokens is above the "estimated 3,000-4,000" flagged in STATE.md blockers. Plan 06-08 must re-check the corporate LLM endpoint's context window against this number. If the endpoint caps at 8K context, the margin for history + response is thin and windowing/summarisation must be aggressive.

---
*Phase: 06-llm-integration*
*Completed: 2026-04-14*
