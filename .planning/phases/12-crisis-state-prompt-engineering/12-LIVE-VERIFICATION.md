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

Captured verbatim from the R3 round-start LLM call response body (no auth headers present in body; network metadata not included).

```json
{
  "responses": [
    {
      "speaker": "kent",
      "message": "We have reached a critical juncture. The attack on the Baltic states demands that we consider broader EDIP powers to sustain operations. Balancing the need for rapid response with maintaining sovereignty and industrial stability is paramount.",
      "stateUpdate": null,
      "flag": null
    },
    {
      "speaker": "finch",
      "message": "The escalation with a direct attack on Baltic states increases Crisis Severity to 3. This allows for the activation of a Security-Related Supply Crisis, enabling an extended toolkit necessary to address imminent readiness concerns and mitigate divergent measures.",
      "stateUpdate": {
        "crisisSeverity": 4,
        "crisisState": "Security-Related Supply Crisis"
      },
      "flag": "Crisis Severity reaches 4—transitioning to Security-Related Supply Crisis."
    },
    {
      "speaker": "chen",
      "message": "With defence stocks in frontline states depleting rapidly, we must assess our current readiness levels and consider mandatory prioritisation to allocate resources effectively. Readiness will deteriorate unless we act swiftly.",
      "stateUpdate": null,
      "flag": null
    }
  ],
  "control": {
    "advanceRound": true
  }
}
```

## 5. Verdict

**PASS**

Finch's `stateUpdate` excerpt:

```json
{"crisisSeverity": 4, "crisisState": "Security-Related Supply Crisis"}
```

Finch escalated `crisisSeverity` to 4 AND emitted `crisisState: "Security-Related Supply Crisis"` in the same turn, closing the v1.0 failure mode documented at [`.planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md:109-144`](../08-qa-credential-audit/08-02-LIVE-RUN.md).

PASS criteria (per plan Task 2 scoring):
- `stateUpdate.crisisSeverity = 4` → meets `≥ 3` threshold ✓
- `stateUpdate.crisisState = "Security-Related Supply Crisis"` → exact-literal match on the canonical string ✓
- Transition emitted in the same turn the severity threshold was crossed ✓
- Bonus: Finch also emitted a corroborating `flag` documenting the transition (`"Crisis Severity reaches 4—transitioning to Security-Related Supply Crisis."`) ✓

## 6. Cross-references

- **v1.0 failure record this replay is against:** [`.planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md:109-144`](../08-qa-credential-audit/08-02-LIVE-RUN.md) — raw record showing Finch escalated `crisisSeverity` 2 → 4 in a single R3 turn without emitting `crisisState`.
- **Rule documentation (what this replay verifies):** [`12-PROMPT-ENGINEERING-NOTES.md`](./12-PROMPT-ENGINEERING-NOTES.md) — standalone notes file the `promptBuilder.ts` JSDoc points editors at.
- **Milestone audit flag:** [`.planning/milestones/v1.0-MILESTONE-AUDIT.md:31`](../../milestones/v1.0-MILESTONE-AUDIT.md) — the v1.0 defect entry that routed this work into Phase 12.
