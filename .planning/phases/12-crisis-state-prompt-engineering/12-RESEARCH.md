# Phase 12: Crisis State Prompt Engineering - Research

**Researched:** 2026-04-15
**Domain:** Prompt engineering (promptBuilder.ts) + Vitest test patterns
**Confidence:** HIGH — all findings sourced from direct source file inspection and live test run

---

## Summary

Phase 12 requires two coordinated edits to `src/lib/promptBuilder.ts` (Block 7 Finch MUST list and Block 9 JSON Output Schema), plus Tier A automated tests and Tier B live-LLM replay. The codebase is well-understood: all source files were read directly, the existing test suite was run and confirmed passing, and the empirical token count was captured from the live test output.

The primary risk is none of a structural kind — the codebase is clean and the edit targets are precise. The one material planning concern is that `stateUpdater.ts` passes `crisisState` through to `GameState` without any enum validation: if Finch emits a misspelled string (e.g., `"Supply crisis"` with lowercase 'c'), it silently corrupts state. The prompt rule must therefore spell the string literals exactly. This is called out in the Risks section.

**Primary recommendation:** Edit `PERSONA_PROMPT_DEFS.finch.must` (line 27–31 of `promptBuilder.ts`) and the string returned by `buildBlock9()` (lines 194–224). Both edits are in a single file. Write the snapshot test against Block 7 + Block 9 extracted substrings; do not snapshot the entire prompt (too volatile to line-level changes in other blocks).

---

## Q1: Exact current structure of Block 7 (Finch) and Block 9

### Block 7 — Finch persona definition

Block 7 is built by `buildBlock7()` at line 150 of `src/lib/promptBuilder.ts`. It reads from the module-private constant `PERSONA_PROMPT_DEFS`. The Finch entry is:

```typescript
// src/lib/promptBuilder.ts lines 24–36
finch: {
  voice:
    'Precise, data-driven, consequential. Intelligence/adversary analyst. Names costs, probabilities, escalation paths. No hedging language.',
  must: [
    'Open with the adversary action or inject.',
    'Name concrete second-order effects.',
    'Flag escalation thresholds (crisisSeverity movements).',     // ← existing item 3
  ],
  mustNot: [
    'Do not moralise.',
    'Do not run consensus process — that is Kent.',
    'Do not recommend operational fixes — that is Chen.',
  ],
},
```

**Edit location:** `must` array, append a fourth element after line 30. The new item is:

```
'Advance crisisState per the threshold rules in Block 9 when crisisSeverity crosses 2 or 3.',
```

The rendered output in the prompt looks like (from `buildBlock7()` lines 153–167):

```
### Finch
Voice: Precise, data-driven, consequential. ...
MUST:
  - Open with the adversary action or inject.
  - Name concrete second-order effects.
  - Flag escalation thresholds (crisisSeverity movements).
  - [NEW ITEM HERE]
MUST NOT:
  - Do not moralise.
  ...
```

### Block 9 — JSON Output Schema

Block 9 is built by `buildBlock9()` at lines 194–224. Current full output:

```
## 9. JSON Output Schema
You MUST return JSON only. No prose outside the JSON. No markdown fences. No preamble.

Shape (exact):
```
{
  "responses": [
    { "speaker": "kent" | "finch" | "chen",
      "message": "<2-4 sentences>",
      "stateUpdate": { /* partial StateUpdate or null */ } | null,
      "flag": "<short facilitator note>" | null }
  ],
  "control": { "advanceRound": true, "triggerDebrief": true } | undefined
}
```

stateUpdate is a DELTA — only include fields that actually changed this turn. Omit unchanged fields entirely (STATE-03).

Clamp ranges (produce in-range values):
- crisisSeverity: 0–5 (integer)
- crisisState: one of "No Crisis" | "Supply Crisis" | "Security-Related Supply Crisis"
- edipLegitimacy: -2 to +2 (integer)
- team.pc: 0–6, team.po: -2 to +2, team.readiness: 0–5
- team.stock / team.crm / team.ic: non-negative integers

`control.advanceRound` and `control.triggerDebrief` are SUGGESTIONS — the facilitator confirms them.
If both control fields are true in the same turn, treat triggerDebrief as the higher-priority signal.
```

**Edit location:** Insert a new "Crisis State Transition Rules" subsection immediately before the `Clamp ranges` line (after the `stateUpdate is a DELTA` paragraph). The new subsection:

```
Crisis State Transition Rules (Finch MUST emit these in stateUpdate):
- When crisisSeverity reaches 2 AND crisisState is "No Crisis":
  set crisisState to "Supply Crisis"
- When crisisSeverity reaches 3 AND crisisState is not "Security-Related Supply Crisis":
  set crisisState to "Security-Related Supply Crisis"
These transitions are emitted in the same turn the threshold is crossed. Kent and Chen do NOT emit crisisState transitions.
```

The `buildBlock9()` function is a single `.join('\n')` call on an array literal. The new lines slot in as additional array elements before the `'Clamp ranges ...'` line.

---

## Q2: Existing test patterns for promptBuilder / responseParser / stateUpdater

### Files

| Test file | What it covers | Relevant pattern |
|-----------|---------------|-----------------|
| `src/lib/promptBuilder.test.ts` | All 10 block headings, live state interpolation, team rendering, config enumeration, persona headings, routing rules, determinism, measurePromptTokens | Slice-and-assert: extract a block by finding its heading and the next heading, then assert substrings within that slice |
| `src/lib/responseParser.test.ts` | Four-layer parser (cleanup, JSON.parse, type guards, normalization) | `makePersona()` factory for typed PersonaResponse; direct JSON.stringify input; assert `result.ok` then branch for value |
| `src/lib/stateUpdater.test.ts` | CLAMP_RANGES constants, applyStateUpdatePure happy paths, clamping, null/undefined no-ops, team matching, immutability | `makeState()` / `makeTeam()` factories; `structuredClone` immutability via JSON snapshot |
| `src/lib/promptBudget.test.ts` | SAFE_CONTEXT_CEILING_TOKENS, reportPromptBudget report shape | Pinned constant tests + `console.info` empirical capture |

### Key helpers available in test files

`promptBuilder.test.ts` exports a reusable `makeMockState(overrides)` factory — the Phase 12 snapshot test can import and reuse this pattern verbatim.

### Vitest config

Vitest is configured inside `vite.config.ts` (no separate vitest config file):

```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
}
```

No special snapshot configuration. Default Vitest snapshot behaviour applies: `expect(value).toMatchSnapshot()` writes external `.snap` files to `__snapshots__/` next to the test file; `expect(value).toMatchInlineSnapshot()` writes inline.

### Block-isolation pattern (from promptBuilder.test.ts line 184–199)

The existing block-isolation pattern uses `prompt.indexOf('## N. Heading')` / `prompt.indexOf('## N+1. Heading')` and slices. This is the exact pattern for the Phase 12 snapshot test to use on Block 7 and Block 9 content.

---

## Q3: Token measurement and budget ceiling

### Current empirical measurement (live test run 2026-04-15)

```
systemPromptTokens:       5124
historyWindowN:           2
maxHistoryTokensEstimate: 1600  (2 × 800 TOKENS_PER_TURN_ESTIMATE)
totalCeilingEstimate:     6724
safeCeiling:              7500
withinLimit:              true
headroom:                 776 tokens
```

### How it is measured

`measurePromptTokens(prompt: string): number` at line 274 of `promptBuilder.ts`:

```typescript
export function measurePromptTokens(prompt: string): number {
  return Math.ceil(prompt.length / 4)
}
```

`reportPromptBudget()` in `src/lib/promptBudget.ts` calls `buildSystemPrompt()` then `measurePromptTokens()` and computes the full budget report. `SAFE_CONTEXT_CEILING_TOKENS = 7500` is a pinned constant in `promptBudget.ts` (line 14), asserted in `promptBudget.test.ts`.

### How the planner confirms ~80–120 token addition stays under 7500

The planner (or executor) runs `npx vitest run src/lib/promptBudget.test.ts --reporter=verbose` and reads the `console.info` output after editing. The `[06-08] empirical capture` test emits the full budget report. Current headroom is 776 tokens against `totalCeilingEstimate`; adding 120 tokens would yield 6844, still within limit.

Alternatively, add a new `it` in `promptBudget.test.ts` that asserts `report.withinLimit === true` by name (the existing test only asserts it is a boolean matching the arithmetic, not that it is true). This makes a budget regression an explicit CI failure.

---

## Q4: Exact R3 facilitator input for Tier B replay

From `.planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md` lines 109–144:

**The turn to replay is Round 3, Turn 1 (advance-triggered, not the typed message).**

From the live run document (lines 113–122):

> Turn 1 (advance to R3 via R2 ControlBanner `[ADVANCE]`): no typed input; store dispatched `advanceRound` → fired R3 round-start LLM turn with `scenarios[1].injects[2]`

The facilitator input is not a typed message — it is the round-start LLM call fired by clicking `[ADVANCE]` on the Round 2 ControlBanner. The actual input text that went to the LLM was the R3 inject from `scenarios[1].injects[2]` (Scenario 2, third inject, zero-indexed).

The R3 inject text is NOT reproduced verbatim in the live run file. The live run document only records the resulting persona responses:

- Finch's response: *"The ongoing attack in the Baltics has escalated our Crisis Severity to level 4. This demands immediate reconsideration..."* with `stateUpdate: {crisisSeverity: 4}`
- crisisState remained `NO CRISIS` despite severity reaching 4 — the confirmed v1.0 failure mode

**What the Tier B replay needs:** Build a GameState with `scenarioIndex: 1` and `round: 3` (to pull `scenarios[1].injects[2]` into Block 2), set `crisisSeverity` to whatever the end-of-R2 state was (the live run shows severity advanced to 4 in a single turn so pre-R3 severity was 2 or lower), then issue a round-start LLM call. The replay verifies that with the updated prompt, Finch's `stateUpdate` now includes `crisisState: "Security-Related Supply Crisis"` when severity reaches 3 or 4.

**To get the exact inject text:** Read `src/data/edipConfig.ts`, find `scenarios[1].injects[2]`. This is the canonical input for Tier B.

---

## Q5: Snapshot tests — existing pattern and recommendation

**No existing snapshot tests in the repo.** The Glob for `**/*.snap` returned zero results. The repo uses only `expect(value).toContain(...)`, `expect(value).toBe(...)`, `expect(value).toEqual(...)` assertions — no `toMatchSnapshot()` or `toMatchInlineSnapshot()` calls exist anywhere.

### Recommendation: inline snapshot for the crisis transition rule

Use `expect(block7FinchSection).toMatchInlineSnapshot(...)` for the Finch MUST block and `expect(block9CrisisSection).toMatchInlineSnapshot(...)` for the Block 9 transition rules subsection.

**Why inline over external `.snap`:**

1. The content being snapshotted is short (5–10 lines of prompt text). Inline is readable in the test file.
2. External `.snap` files in `__snapshots__/` are a new directory that doesn't exist yet — inline avoids introducing new directory structure.
3. The failure message for inline snapshots shows the actual vs. expected inline — reviewers see the diff without opening a second file.
4. The CONTEXT.md decision leaves this to Claude's discretion; inline is the more commonly recommended Vitest pattern for short, deterministic strings.

**What to snapshot:** Not the full prompt. Snapshot only the Finch MUST block (extracted via `block7.slice(finchStart, chenStart)`) and the new "Crisis State Transition Rules" subsection of Block 9 (extracted similarly). This makes the test resilient to changes in other blocks or other personas.

---

## Q6: crisisState string literals in the type system and stateUpdater

### Type definition (confirmed HIGH confidence)

`src/types/game.ts` lines 1–6:

```typescript
export type CrisisState =
  | 'No Crisis'
  | 'Supply Crisis'
  | 'Security-Related Supply Crisis'
```

The string literals are exactly:
- `"No Crisis"` (capital N, capital C)
- `"Supply Crisis"` (capital S, capital C)
- `"Security-Related Supply Crisis"` (capital S, capital R, capital S, capital C — hyphen between Security and Related)

`StateUpdate` (line 99–104 of `game.ts`) types `crisisState` as `CrisisState | undefined`.

### How stateUpdater handles crisisState

`src/lib/stateUpdater.ts` lines 120–122:

```typescript
if (update.crisisState != null) {
  nextState.crisisState = update.crisisState
}
```

`crisisState` is a **pass-through** — it is NOT clamped or validated. It is assigned directly. If the LLM emits a string that is not one of the three canonical values, TypeScript's type guard in `responseParser.ts` does NOT catch it (the parser only checks the structural type of `stateUpdate` as "non-null object", not the inner field values). The invalid string would silently corrupt `gameState.crisisState`.

This means: the prompt rule must use the exact string literals. The test should assert the rule text contains the exact literals as they appear in the type definition.

---

## Q7: Risks, gotchas, and cross-cutting concerns

### Risk 1: crisisState pass-through with no runtime validation (HIGH severity)

As documented in Q6, `stateUpdater` assigns `crisisState` without enum validation. If Finch emits `"supply crisis"` (wrong case) or `"Security Related Supply Crisis"` (missing hyphen), the state is silently corrupted and the StatePanel will display a garbage string. The prompt rule must quote the exact strings. The Tier A parser/state-updater test should feed the exact string literal `"Security-Related Supply Crisis"` and assert it lands correctly.

### Risk 2: Clamp logic ordering — crisisSeverity before crisisState

In `applyStateUpdatePure`, `crisisSeverity` is clamped before `crisisState` is applied (lines 111–122 of `stateUpdater.ts`). This ordering does not cause a problem for Phase 12 because the prompt rule is about what the LLM emits (i.e., when `crisisSeverity` in the incoming `stateUpdate` is 3 or 4, also include `crisisState`). The clamp at the applier layer is irrelevant to the LLM's generation decision.

### Risk 3: Block 9 existing clamp documentation — do not displace

Block 9 currently lists `crisisState` in the clamp ranges section as:

```
- crisisState: one of "No Crisis" | "Supply Crisis" | "Security-Related Supply Crisis"
```

The new "Crisis State Transition Rules" subsection should be inserted **above** this existing clamp line, not replacing it. The clamp line documents the allowed values; the new subsection documents the transition trigger. Both must remain.

### Risk 4: Token budget is not enforced by a dedicated assert

The existing `promptBudget.test.ts` asserts `withinLimit` is a boolean matching the arithmetic, but does NOT assert it equals `true`. A future change that blows the budget would not fail the pinned-constant test — it would only show `withinLimit: false` in the `console.info` output. The planner may want to add `expect(report.withinLimit).toBe(true)` to make budget violations CI failures. Current headroom is 776 tokens; adding ~120 tokens gives ~656 tokens remaining.

### Risk 5: `responseParser` does not validate stateUpdate inner field values

`isPersonaResponse()` in `responseParser.ts` (lines 44–49) checks that `stateUpdate` is either `null` or a non-null object — it does NOT validate the inner fields. A Finch response with `crisisState: "Security-Related Supply Crisis"` will parse successfully; one with `crisisState: 42` would also parse successfully and then corrupt state. The Tier A test must supply the correct string and verify it passes through; it does not need to cover invalid-string cases (that is a separate gap, out of phase scope per CONTEXT.md deferred items).

### Risk 6: Tier B replay state — exact pre-R3 crisisSeverity

The live run document does not record the exact pre-R3 crisisSeverity. The narrative says severity jumped to 4 in R3 Turn 1. For Tier B to be a valid replay, the gameState fed to the LLM must have `crisisSeverity` at the end-of-R2 value and `crisisState: "No Crisis"` (since the whole point is that the transition was not triggered). If Scenario 2 starts with severity 0 and no mid-R2 escalation was recorded, use `crisisSeverity: 0`. The test result is valid as long as the updated prompt causes Finch to include `crisisState: "Security-Related Supply Crisis"` when severity reaches 3 or 4.

---

## Code Examples

### Verified: current Finch must array (source: promptBuilder.ts:27–31)

```typescript
must: [
  'Open with the adversary action or inject.',
  'Name concrete second-order effects.',
  'Flag escalation thresholds (crisisSeverity movements).',
],
```

### Verified: current Block 9 clamp section (source: promptBuilder.ts:212–219)

```typescript
'Clamp ranges (produce in-range values):',
'- crisisSeverity: 0–5 (integer)',
'- crisisState: one of "No Crisis" | "Supply Crisis" | "Security-Related Supply Crisis"',
'- edipLegitimacy: -2 to +2 (integer)',
'- team.pc: 0–6, team.po: -2 to +2, team.readiness: 0–5',
'- team.stock / team.crm / team.ic: non-negative integers',
```

### Verified: block isolation pattern for tests (source: promptBuilder.test.ts:184–199)

```typescript
const block9Start = prompt.indexOf('## 9. JSON Output Schema')
const block10Start = prompt.indexOf('## 10. Absolute Rules')
const block9 = prompt.slice(block9Start, block10Start)
expect(block9).toContain('Crisis State Transition Rules')
```

### Verified: stateUpdate crisisState pass-through (source: stateUpdater.ts:120–122)

```typescript
if (update.crisisState != null) {
  nextState.crisisState = update.crisisState
}
```

### Verified: CrisisState type (source: types/game.ts:3–6)

```typescript
export type CrisisState =
  | 'No Crisis'
  | 'Supply Crisis'
  | 'Security-Related Supply Crisis'
```

---

## State of the Art

No state-of-the-art changes needed. All technology is repo-internal (TypeScript, Vitest). The only relevant observation: Vitest inline snapshots (`toMatchInlineSnapshot`) were introduced well before Vitest 4.1.4 (the version in use) and are fully supported without additional configuration.

---

## Open Questions

1. **Exact inject text for Tier B replay**
   - What we know: Tier B replays `scenarios[1].injects[2]` from `edipConfig.ts`, the R3 inject for Scenario 2
   - What's unclear: The inject text was not reproduced in the live run document and was not in scope of this research pass
   - Recommendation: The plan for Tier B should include reading `edipConfig.ts scenarios[1].injects[2]` before writing the replay instructions to `12-LIVE-VERIFICATION.md`. The planner should direct the executor to print that value in the plan step.

2. **Pre-R3 crisisSeverity baseline for Tier B**
   - What we know: Severity was 2 pre-R3 by inference (it jumped to 4 in a single +2 delta)
   - What's unclear: Not explicitly recorded in the live run document
   - Recommendation: Use `crisisSeverity: 2` for the Tier B gameState. The transition rules trigger at severity 3, so Finch reporting `crisisSeverity: 4` in the same turn should be sufficient to trigger the new rule.

---

## Sources

### Primary (HIGH confidence)

All source code read directly from the working tree:

- `src/lib/promptBuilder.ts` (full file, 277 lines) — Block 7 and Block 9 exact content
- `src/lib/stateUpdater.ts` (full file, 143 lines) — crisisState pass-through, CLAMP_RANGES
- `src/lib/responseParser.ts` (full file, 169 lines) — type guard behavior
- `src/lib/promptBudget.ts` (full file, 68 lines) — SAFE_CONTEXT_CEILING_TOKENS, budget formula
- `src/types/game.ts` (full file) — CrisisState type definition, StateUpdate shape
- `src/types/llm.ts` (full file) — PersonaResponse, LLMStructuredResponse
- `src/data/edipConfig.ts` lines 112–124 — CS-01 and CS-02 canonical thresholds
- `src/lib/promptBuilder.test.ts` (full file, 240 lines) — test patterns
- `src/lib/responseParser.test.ts` (full file, 397 lines) — test patterns
- `src/lib/stateUpdater.test.ts` (full file, 443 lines) — test patterns
- `src/lib/promptBudget.test.ts` (full file, 93 lines) — budget test patterns
- `vite.config.ts` — Vitest configuration (no vitest.config.ts exists)
- `.planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md` lines 100–155 — R3 live run evidence
- `.planning/phases/12-crisis-state-prompt-engineering/12-CONTEXT.md` — phase decisions

### Live test execution (HIGH confidence)

- `npx vitest run src/lib/promptBudget.test.ts --reporter=verbose` — confirmed `systemPromptTokens: 5124`, `withinLimit: true`, `totalCeilingEstimate: 6724`
- `npx vitest run src/lib/promptBuilder.test.ts src/lib/promptBudget.test.ts` — 38 tests passed

### Tertiary

- Glob `**/*.snap` — confirmed zero snapshot files exist in repo

---

## Metadata

**Confidence breakdown:**
- Block 7 / Block 9 edit locations: HIGH — read directly from source
- Test patterns: HIGH — read from test files and verified with live run
- Token budget: HIGH — live test output captured
- R3 facilitator input: MEDIUM — live run document describes the trigger but not the exact inject text (must be read from edipConfig.ts scenarios[1].injects[2])
- Snapshot format recommendation: HIGH — Vitest docs + no existing snapshots confirmed

**Research date:** 2026-04-15
**Valid until:** Stable — no external dependencies; valid until any of the investigated source files change
