# Phase 12: Crisis State Prompt Engineering - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Update the 10-block system prompt (`src/lib/promptBuilder.ts`) so the Finch persona reliably emits a `crisisState` transition in its `stateUpdate` JSON when `crisisSeverity` crosses documented thresholds, plus empirically verify the fix against the real LLM by replaying the v1.0 Scenario 2 Round 3 (severity=4) turn. New persona behaviors, new thresholds, or backend auto-state-machine logic are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Transition rule phrasing

- **Hard MUST rule, not guidance.** v1.0 failure mode was the rule being implicit ("flag escalation thresholds") — explicit emission required.
- **Threshold mapping** (aligned with canonical EDIP card requirements CS-01 and CS-02):
  - When `crisisSeverity` reaches **2** and `crisisState` is `"No Crisis"` → set `crisisState` to `"Supply Crisis"`
  - When `crisisSeverity` reaches **3** and `crisisState` is not `"Security-Related Supply Crisis"` → set `crisisState` to `"Security-Related Supply Crisis"`
- **Timing:** transition emitted in the same turn the threshold is crossed, in Finch's `stateUpdate`.
- **Architecture compatibility:** facilitator can still override via direct edit; the rule fixes the *suggestion*, not the *authority*. Consistent with "AI suggests, facilitator decides."
- **Owner:** Finch persona only. Kent and Chen do not emit `crisisState` transitions (their existing routing rules are unchanged).

### Prompt placement

- **Two coordinated edits, no new block** — preserves the empirically-tuned 10-block structure and 5124-token baseline.
- **Block 7 (Persona Definitions, Finch)**: add a fourth `must` item:
  > "Advance crisisState per the threshold rules in Block 9 when crisisSeverity crosses 2 or 3."
- **Block 9 (JSON Output Schema)**: insert a new "Crisis State Transition Rules" subsection above the existing clamp ranges, containing the full threshold mapping from above.
- **Why both blocks:** Block 7 = persona behavior (what Finch does), Block 9 = JSON contract (what output must satisfy). Belt-and-suspenders against the ambiguity that caused v1.0 failure.

### Verification methodology

- **Two-tier verification.**
- **Tier A — Automated (CI):**
  - Vitest fixture that builds the system prompt from a synthesized "end of R2 Scenario 2" gameState (severity=2 going to 3–4) and **snapshots** it. Catches accidental rule removal in future prompt edits.
  - Parser/state-updater test confirming a Finch response containing `crisisState: "Security-Related Supply Crisis"` applies correctly through `responseParser` → `stateUpdater`.
- **Tier B — Live LLM replay (manual, one-shot):**
  - Replay the R3 facilitator input from `.planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md:109-144` against the real LLM with the updated prompt.
  - Capture the raw JSON response to `.planning/phases/12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md` as evidence.
- **Pass criterion:** Finch's `stateUpdate` JSON contains `crisisState: "Security-Related Supply Crisis"` when severity reaches 3–4. Not exact-match — Finch's prose will vary; only the transition presence is checked.

### Documentation & guardrails

- **Three-layer documentation.**
- **Layer 1 — Inline JSDoc** at the top of `src/lib/promptBuilder.ts`: short notice that the crisisState transition rule is load-bearing and points to the standalone notes file.
- **Layer 2 — Standalone notes:** `.planning/phases/12-crisis-state-prompt-engineering/12-PROMPT-ENGINEERING-NOTES.md` containing full reasoning, threshold mapping, link to v1.0 live-run evidence, and Tier B replay instructions. This file satisfies success criterion #3 ("documented in the prompt engineering notes").
- **Layer 3 — Snapshot test from Tier A** doubles as a mechanical guardrail. Failure message references the notes file path so future maintainers know where to read before changing the rule.

### Claude's Discretion

- Exact JSDoc wording at top of `promptBuilder.ts` (kept short)
- Exact section title and ordering of subsections inside the standalone notes file
- Choice of Vitest snapshot format (inline vs. external `.snap`)
- Whether the fixture-based parser test is added to existing `responseParser.test.ts` / `stateUpdater.test.ts` or split into a new `crisisStateTransition.test.ts`
- Token-impact verification approach (the new rule adds ~80–120 tokens; Claude can re-measure against the 7500-token ceiling)

</decisions>

<specifics>
## Specific Ideas

- **Threshold values come from canonical EDIP cards**, not invention: CS-01 ("Activate Supply Crisis") requires `crisisSeverity ≥ 2`, CS-02 ("Activate Security-Related Supply Crisis") requires `crisisSeverity ≥ 3` — see `src/data/edipConfig.ts:113-124`. Encoding these as the Finch transition rule keeps prompt and game logic mutually consistent.
- **The v1.0 failure to reproduce/fix** is documented in `.planning/phases/08-qa-credential-audit/08-02-LIVE-RUN.md:109-144` (R3 turn) and called out in `.planning/milestones/v1.0-MILESTONE-AUDIT.md:31`. Finch reported severity escalating to 4 in prose but never emitted `crisisState` in `stateUpdate`.
- **No raw LLM JSON** for the v1.0 severity=4 turn was captured — only the parsed transcript text. Tier B replay is the only way to obtain comparable evidence post-fix.
- **System prompt is runtime-composed TypeScript**, not a template file (`src/lib/promptBuilder.ts:1-277`). All edits land in that single module.
- **Always-present:** the system prompt is never windowed (only conversation history is sliding-window N=2). Any rule added affects every turn for the rest of the game.

</specifics>

<deferred>
## Deferred Ideas

- **Backend auto state machine** that advances `crisisState` in `stateUpdater.ts` based on severity without LLM involvement — would conflict with "AI suggests, facilitator decides" and is a larger architectural change. Not needed if prompt rule is reliable.
- **Wind-down transitions** (e.g., severity dropping back to 1 → revert `crisisState` to "No Crisis") — Scenario 2 R5 inject mentions wind-down possibility but v1.1 only fixes the *forward* transition. Reverse transitions = future phase if needed.
- **Kent/Chen crisisState emission** — currently Finch-only. If future scenarios need other personas to advance state, that's its own design conversation.
- **Replay harness as a permanent test fixture** that hits the real LLM in CI — Tier B is one-shot manual for v1.1; automating live-LLM regression tests is a separate operational decision (cost, flakiness, credential management).
- **Token budget re-tuning** if the new rule pushes us close to the 7500-token ceiling — current measurement is 5124 tokens for the prompt; ~80–120 token addition leaves comfortable headroom, so no re-tuning planned, but flagged if measurement surprises.

</deferred>

---

*Phase: 12-crisis-state-prompt-engineering*
*Context gathered: 2026-04-15*
