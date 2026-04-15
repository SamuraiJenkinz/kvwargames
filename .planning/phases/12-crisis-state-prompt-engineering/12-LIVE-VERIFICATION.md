# Phase 12 — Tier B Live-LLM Verification Record

One-shot empirical replay of the Scenario 2 Round 3 severity escalation against the real corporate LLM endpoint, with the Plan 12-01 prompt edits in place. Closes Phase 12 success criterion #2 (`empirical verification`) and requirement PROMPT-03.

This file is the evidence record the notes file ([`12-PROMPT-ENGINEERING-NOTES.md`](./12-PROMPT-ENGINEERING-NOTES.md) §5) points to.

---

## 1. Replay metadata

| Field | Value |
|---|---|
| Replay date | *To be captured by Task 2 operator* (expected: 2026-04-15 or 2026-04-16) |
| Git SHA carrying Plan 12-01 prompt edits | `db693f2` (HEAD of 12-01: `docs(12-01): complete crisis-state prompt-engineering rule encoding plan`) |
| Plan 12-01 source commits | `c403b90` (prompt edits) → `ff7ff99` (tests) → `db693f2` (docs) |
| LLM endpoint | Corporate endpoint per backend `.env` `LLM_BASE_URL` (captured in Task 2 without leaking auth). Model name captured from backend config. |
| Test suite state at time of replay | 534 tests green (Plan 12-01 exit state) |

## 2. Replay payload

### 2a. Pre-state (`gameState`)

Baseline `gameState` values fed into the R3 round-start LLM call. Derived from v1.0 live-run telemetry: post-R2 severity was 2; `crisisState` never escalated to `"Supply Crisis"` during that run, so the R3 call enters with:

```
scenarioIndex: 1        // Scenario 2: Eastern Flank — Hybrid to Hot War
round: 3
crisisSeverity: 2
crisisState: "No Crisis"
edipLegitimacy: 0
// Team states at their edipConfig.ts starting values
```

### 2b. R3 inject text

The facilitator-side input that R3 Turn 1 feeds to the LLM, captured verbatim from `src/data/edipConfig.ts scenarios[1].injects[2]`:

```
ROUND 3 — ATTACK ON BALTIC STATES: Russia launches a large-scale attack on one or more Baltic states; heavy kinetic operations and mobilisations begin; NATO and EU invoke high-level responses. Crisis Severity jumps to 3–4; defence stocks in frontline states begin to deplete rapidly. KEY TENSION: willingness to accept far-reaching EDIP powers under existential threat vs concerns about sovereignty and industrial disruption.
```

Note the inject is a plain string in `edipConfig.ts`, not an object — `scenarios[1].injects[2]` returns this exact literal.

## 3. System prompt in use

Proof that the prompt being replayed is the **post-edit** prompt (containing the Block 7 Finch cross-reference and the Block 9 "Crisis State Transition Rules" subsection), captured from the Plan 12-01 exit test run:

- `src/lib/promptBudget.test.ts` empirical-capture case emits a full `reportPromptBudget(EDIP_CONFIG, freshGameState)` via `console.info` when run with `--reporter=verbose`.
- Plan 12-01 exit values (from `12-01-SUMMARY.md` and STATE.md):
  - `systemPromptTokens`: **5258**
  - `maxHistoryTokensEstimate`: **1600** (HISTORY_WINDOW_N × per-turn estimate, unchanged from Phase 6)
  - `totalCeilingEstimate`: **6858**
  - `safeCeiling`: **7500**
  - `withinLimit`: **true** (642-token headroom)
- Inline snapshot tests in `src/lib/promptBuilder.test.ts` pin the Block 7 Finch MUST cross-reference (`"Advance crisisState per the threshold rules in Block 9 when crisisSeverity crosses 2 or 3."`) and the Block 9 "Crisis State Transition Rules" subsection verbatim.

If the Task 2 operator wants to re-confirm before running the replay:

```bash
npx vitest run src/lib/promptBudget.test.ts --reporter=verbose
npx vitest run src/lib/promptBuilder.test.ts
```

Both must pass with the same numbers above.

## 4. Raw LLM response

TODO (Task 2): paste the full JSON returned by the backend for the R3 round-start LLM call, verbatim, inside a fenced `json` code block. Redact API keys, Bearer tokens, or any `Authorization:` headers if they appear in captured network metadata — the response body itself should not contain secrets but double-check before committing.

```json
TODO: live response JSON goes here
```

## 5. Verdict

TODO (Task 2):

- **PASS** if Finch's `stateUpdate` contains `crisisState: "Security-Related Supply Crisis"` when `crisisSeverity` reaches 3 or 4 in the same turn. (Alternative PASS: if severity only reaches 2, `crisisState: "Supply Crisis"` — less likely given R3 inject magnitude but valid per the threshold mapping.)
- **FAIL** if Finch escalates `crisisSeverity ≥ 2` but does not emit `crisisState`, or emits a malformed literal.

Fill this section with:

1. A bold **PASS** or **FAIL** line.
2. The specific `stateUpdate` JSON excerpt from Finch (`responses[].speaker === "finch"`).
3. A one-sentence narrative describing what happened (e.g. "Finch escalated severity to 4 AND emitted `crisisState: 'Security-Related Supply Crisis'` in the same turn, closing the v1.0 failure mode.").

## 6. Cross-references

- **v1.0 failure record this replay is against:** [`.planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md:109-144`](../08-qa-credential-audit/08-02-LIVE-RUN.md) — raw record showing Finch escalated `crisisSeverity` 2 → 4 in a single R3 turn without emitting `crisisState`.
- **Rule documentation (what this replay verifies):** [`12-PROMPT-ENGINEERING-NOTES.md`](./12-PROMPT-ENGINEERING-NOTES.md) — standalone notes file the `promptBuilder.ts` JSDoc points editors at.
- **Milestone audit flag:** [`.planning/milestones/v1.0-MILESTONE-AUDIT.md:31`](../../milestones/v1.0-MILESTONE-AUDIT.md) — the v1.0 defect entry that routed this work into Phase 12.
