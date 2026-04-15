# Crisis-State Prompt Engineering Notes

**Purpose of this file.** `src/lib/promptBuilder.ts` carries a JSDoc banner that points future editors here. If you are about to edit Block 7 (Finch persona MUST list) or Block 9 ("Crisis State Transition Rules" subsection) in `promptBuilder.ts`, read this file **first**. It documents why those sections look the way they do, the v1.0 failure mode they fix, and the Tier B replay procedure that must pass before the rule is considered verified again.

---

## 1. Purpose & scope

One rule lives in `promptBuilder.ts`: **Finch (and only Finch) must advance `crisisState` when `crisisSeverity` crosses the canonical EDIP thresholds.** The rule is doubly-encoded — once as a Finch MUST item in Block 7, once as a dedicated "Crisis State Transition Rules" subsection in Block 9 — so that a single-site edit cannot silently break it.

This rule exists because of a v1.0 live-run failure. During the Scenario 2 R3 turn, Finch escalated `crisisSeverity` from 2 → 4 in a single turn but did **not** emit a `crisisState` field. The canonical EDIP card CS-02 requires the Crisis State marker to move to "Security-Related Supply Crisis" at severity ≥ 3, but the prompt at that time only told the model what the *allowed values* were, not when to *transition between them*. Evidence:

- `.planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md:109-144` — raw failure record. Finch's stateUpdate was `{crisisSeverity: 4}` with `crisisState` still `"NO CRISIS"` post-turn.
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md:31` — milestone audit flagged the same defect: *"crisisState auto-escalation — crisisSeverity reached 4 (ALERT threshold) without LLM triggering crisisState label change."*

Kent and Chen do not emit `crisisState`. The rule is Finch-only by design — Finch is the adversary/escalation analyst, and crisisState is an escalation label, so assigning it matches Finch's existing MUST ("Flag escalation thresholds"). Kent owns legitimacy framing; Chen owns operational/readiness numbers.

## 2. Threshold mapping (exact literals)

The allowed values for `crisisState` are pinned by the type system and by the Block 9 clamp line. They are a closed set of three strings:

- `"No Crisis"`
- `"Supply Crisis"`
- `"Security-Related Supply Crisis"`

The transition rule Finch must apply:

| Condition (both must hold) | Finch must set `crisisState` to |
|---|---|
| `crisisSeverity` reaches **2** AND current `crisisState === "No Crisis"` | `"Supply Crisis"` |
| `crisisSeverity` reaches **3** AND current `crisisState !== "Security-Related Supply Crisis"` | `"Security-Related Supply Crisis"` |

Thresholds align with the canonical EDIP activation cards in `src/data/edipConfig.ts:113-124`:

- **CS-01** (`Activate Supply Crisis`) requires `Crisis Severity ≥ 2`.
- **CS-02** (`Activate Security-Related Supply Crisis`) requires `Crisis Severity ≥ 3` and explicitly links the state transition to defence-product shortages under security threats.

**Why the exact string literals matter.** `src/lib/stateUpdater.ts:120-122` passes `update.crisisState` through without enum validation:

```ts
if (update.crisisState != null) {
  nextState.crisisState = update.crisisState
}
```

There is no runtime guard that rejects a misspelling like `"Security Related Supply Crisis"` (missing hyphen) or `"security-related supply crisis"` (wrong case). A typo propagates into persisted state and corrupts downstream UI rendering. Any prose edit to the transition subsection must preserve the three literals **byte-for-byte**. The inline snapshot test in `promptBuilder.test.ts` (see §4) is the mechanical guard against drift.

The clamp-range line (`crisisState: one of "No Crisis" | "Supply Crisis" | "Security-Related Supply Crisis"`) in Block 9 remains alongside the transition subsection. The clamp documents the **allowed values**; the transition subsection documents the **trigger conditions**. Both serve distinct purposes — do not delete the clamp line thinking it is redundant.

## 3. Where the rule lives in source

Two locations in `src/lib/promptBuilder.ts`, both load-bearing:

### Block 7 — Finch persona MUST list
In `PERSONA_PROMPT_DEFS.finch.must` (around line 36–41). The relevant entry is:

> `'Advance crisisState per the threshold rules in Block 9 when crisisSeverity crosses 2 or 3.'`

This is a **cross-reference**. The full mapping lives in Block 9; Block 7 is the reminder that tells the Finch persona *it* (not Kent or Chen) is responsible. Do not delete the "per the threshold rules in Block 9" phrase — the cross-reference is what binds the two sections together.

### Block 9 — "Crisis State Transition Rules" subsection
In the Block 9 template literal array (around line 224–229 at current HEAD). Shape:

```
Crisis State Transition Rules (Finch MUST emit these in stateUpdate):
- When crisisSeverity reaches 2 AND crisisState is "No Crisis":
  set crisisState to "Supply Crisis"
- When crisisSeverity reaches 3 AND crisisState is not "Security-Related Supply Crisis":
  set crisisState to "Security-Related Supply Crisis"
```

Sits **above** the "Clamp ranges" subsection (clamp line for `crisisState` continues to live inside the clamp subsection at line ~233). Subsection order matters for readability but not for LLM behaviour.

## 4. Mechanical guardrails

Three automated tests guard against regression. All three were added in Plan 12-01:

1. **`src/lib/promptBuilder.test.ts` — Block 7 Finch inline snapshot.** Locks the exact text of the Finch MUST list, including the Block 9 cross-reference. If this snapshot fails, it means Block 7 was edited. Read §3 above before running `vitest --update` — the snapshot may be doing its job.
2. **`src/lib/promptBuilder.test.ts` — Block 9 transition subsection inline snapshot.** Locks the exact threshold mapping with string literals. Same guidance: failure is usually correct, not a stale snapshot.
3. **`src/lib/stateUpdater.test.ts` — parser/applier round-trip.** Verifies that when a mock Finch response sets `crisisState: "Security-Related Supply Crisis"`, the state updater applies it end-to-end through `parsePersonaResponse` → `applyStateUpdate`. This is the contract test proving the downstream pipeline honours the LLM's output.

Additionally, the budget test in `src/lib/promptBudget.test.ts:81-88` promotes `report.withinLimit` to a hard CI assertion. The transition subsection costs tokens; if a future edit pushes `totalCeilingEstimate` past 7500 the CI fails. Current empirical budget (per 12-01-SUMMARY): `systemPromptTokens=5258`, `totalCeilingEstimate=6858`, 642-token headroom.

**Rule of thumb for editors.** If a snapshot test fails, open this notes file, re-read §2 (threshold mapping) and §3 (where the rule lives), and ask: "Did I mean to change the rule, or did I accidentally break it?" If you meant to change it, update the snapshot *and* update this notes file in the same commit. If you did not mean to change it, revert.

## 5. Tier B live-verification procedure

Snapshot tests prove the rule *text* is in the prompt. They cannot prove the *LLM acts on it*. That confirmation requires a one-shot live-LLM replay against the real corporate endpoint, modelled on the v1.0 failure that motivated the rule.

The evidence record lives at [`12-LIVE-VERIFICATION.md`](./12-LIVE-VERIFICATION.md) in this same phase folder. That file captures the exact payload, the raw response, and the PASS/FAIL verdict. Run the replay any time you change Block 7 or Block 9.

**Pre-state** (the `gameState` baseline from which R3 fires, inferred from v1.0 live-run telemetry — post-R2 severity was 2, and `crisisState` never escalated to `"Supply Crisis"` during that run either, so the R3 turn enters with severity=2 and state="No Crisis"):

```
scenarioIndex: 1
round: 3
crisisSeverity: 2
crisisState: "No Crisis"
```

**Trigger.** Fire the R3 round-start LLM call via the live-facilitation path. Preferred: launch Scenario 2 in the UI, advance twice to reach R3, and let the game store's `advanceRound` action issue the round-start turn naturally — this is the same code path the v1.0 live run took. Alternative: seed `gameState` in localStorage and trigger the same advance. The inject the LLM sees is `scenarios[1].injects[2]` from `src/data/edipConfig.ts`, verbatim:

> ROUND 3 — ATTACK ON BALTIC STATES: Russia launches a large-scale attack on one or more Baltic states; heavy kinetic operations and mobilisations begin; NATO and EU invoke high-level responses. Crisis Severity jumps to 3–4; defence stocks in frontline states begin to deplete rapidly. KEY TENSION: willingness to accept far-reaching EDIP powers under existential threat vs concerns about sovereignty and industrial disruption.

**PASS criterion.** Finch's `stateUpdate` JSON contains `crisisState: "Security-Related Supply Crisis"` when Finch escalates `crisisSeverity` to 3 or 4 in the same turn. Prose in Finch's spoken line will vary run-to-run and is **not** asserted — only the structured `stateUpdate` field is scored. If severity lands at 2, PASS condition instead is `crisisState === "Supply Crisis"` (unlikely given the R3 inject magnitude but valid per the threshold mapping).

**FAIL criterion.** Finch escalates `crisisSeverity ≥ 2` but does not emit `crisisState`, or emits a string that is not one of the three literals in §2. This is the exact v1.0 failure mode this rule was written to eliminate. If this happens, do not rubber-stamp requirements complete — write a gap analysis and open a new prompt-engineering planning cycle.

## 6. Deferred / out of scope

The following were explicitly scoped out of Phase 12 (see `12-CONTEXT.md` `<deferred>` section):

- **Wind-down transitions** (severity dropping back across a threshold — e.g. from 3 to 2 should `crisisState` revert to `"Supply Crisis"`?). Not in v1.1; handled by facilitator override for now.
- **Kent / Chen `crisisState` emission.** Rule is Finch-only. If future redesign wants shared responsibility, add MUST items to Kent/Chen deliberately rather than allowing it to leak in accidentally.
- **Backend-side auto state machine** (replacing LLM emission with a deterministic rule enforced in `stateUpdater.ts`). Would solve the reliability problem more robustly but changes the AI-suggests-facilitator-decides design philosophy; deferred to v2+.
- **Permanent live-LLM CI harness.** Tier B is a one-shot manual replay per prompt edit. Continuous LLM-behaviour testing is a v2+ observability concern.
