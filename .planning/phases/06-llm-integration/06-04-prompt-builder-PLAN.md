---
phase: 06-llm-integration
plan: 04
type: execute
wave: 2
depends_on: ["06-02"]
files_modified:
  - src/lib/promptBuilder.ts
  - src/lib/promptBuilder.test.ts
autonomous: true

must_haves:
  truths:
    - "`buildSystemPrompt(config, gameState)` produces a deterministic string containing all 10 required blocks (PROMPT-01)"
    - "Three personas are defined with distinct voice rules AND explicit negative constraints — Kent MUST NOT sound like Finch, etc. (PROMPT-02, PROMPT-05)"
    - "Routing rules are encoded in the prompt covering: round start, card play (by category → persona), national action, unique team action, dispute/challenge, threshold warning, debrief (PROMPT-03)"
    - "JSON output schema is included verbatim in the prompt — `responses: PersonaResponse[]`, optional `control: { advanceRound?, triggerDebrief? }` — with instructions that the model MUST return JSON only (PROMPT-04)"
    - "Live state values (round, crisisSeverity, crisisState, edipLegitimacy, per-team resources) are interpolated from `gameState` — not hardcoded placeholders"
    - "`measurePromptTokens(prompt)` helper returns `Math.ceil(prompt.length / 4)` for empirical token budget logging"
  artifacts:
    - path: "src/lib/promptBuilder.ts"
      provides: "buildSystemPrompt, measurePromptTokens, PERSONA_PROMPT_DEFS constant"
      min_lines: 250
      exports: ["buildSystemPrompt", "measurePromptTokens"]
    - path: "src/lib/promptBuilder.test.ts"
      provides: "Structural tests proving each block present and state interpolated"
      min_lines: 100
  key_links:
    - from: "src/lib/promptBuilder.ts"
      to: "src/types/game.ts, src/data/edipConfig.ts"
      via: "GameConfig + GameState destructuring"
      pattern: "from '@/types/game'"
---

<objective>
Build the frontend prompt constructor: a pure function that takes the live `GameConfig` + `GameState` and returns the full 10-block system prompt string. This is the persona-voice anchor — it never windows out of the LLM call.

Purpose: Phase 6's persona-voice quality stands on this prompt. Encoding routing + voice + negative constraints here (rather than in Zustand actions or UI code) keeps the prompt testable against fixtures and makes future voice tuning a single-file edit. Phase 7 config-gen will NOT touch this — it has its own prompt.
Output: `promptBuilder.ts` with the 10 blocks, persona defs, routing rules, JSON schema, token measurement helper; plus a structural test suite.
</objective>

<execution_context>
@C:\Users\taylo\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\taylo\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-llm-integration/06-CONTEXT.md
@.planning/phases/06-llm-integration/06-RESEARCH.md
@src/types/game.ts
@src/types/llm.ts
@src/data/edipConfig.ts
@WARGAME_ENGINE_DEV_SPEC.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build `buildSystemPrompt` with all 10 blocks and persona definitions</name>
  <files>src/lib/promptBuilder.ts</files>
  <action>
    Create `src/lib/promptBuilder.ts` exporting:

    ```typescript
    import type { GameConfig, GameState } from '@/types/game'

    export function buildSystemPrompt(config: GameConfig, gameState: GameState): string
    export function measurePromptTokens(prompt: string): number
    ```

    The function assembles a template-literal string with these 10 numbered blocks, in order. Each block starts with a heading like `## 1. Game Context` so the structure is legible to both the LLM and to the tests in Task 2:

    1. **Game Context** — `config.name`, `config.domain`, `config.description`. Plus the current scenario's name + description from `config.scenarios[gameState.scenarioIndex]`.

    2. **Live Game State** — current round, crisisSeverity, crisisState, edipLegitimacy. Plus the current scenario's inject for this round if `round - 1 < scenario.injects.length`.

    3. **Team Identities** — for each `config.teams[i]`: ID, name, description, the `personas` array joined, `uniqueAction`, and current resource values pulled from `gameState.teams.find(t => t.id === teamConfig.id)`.

    4. **National Actions** — `config.nationalActions` list, each with name, summary, cost.

    5. **EDIP Cards** — `config.cards` list, each with id, name, cat (category), timing, req, effect.

    6. **Key Mechanics** — `config.objective`, `config.redLines`, `config.pcThresholds`, `config.votingRule`, `config.eoMechanic`, `config.resourceLogic`.

    7. **Persona Definitions** — three personas with voice rules AND negative constraints. Define a module-private const:
       ```typescript
       const PERSONA_PROMPT_DEFS = {
         kent: {
           voice: 'Structured, inclusive, question-led. Convener who frames options and surfaces consensus. Opens with context, closes with a question or action.',
           must: ['Frame decisions in institutional/legitimacy terms.', 'Invite dissent.', 'Reference redLines + pcThresholds explicitly when relevant.'],
           mustNot: ['Do not issue unilateral directives.', 'Do not speculate on adversary intent — that is Finch.', 'Do not quote technical stock numbers — that is Chen.'],
         },
         finch: {
           voice: 'Precise, data-driven, consequential. Intelligence/adversary analyst. Names costs, probabilities, escalation paths. No hedging language.',
           must: ['Open with the adversary action or inject.', 'Name concrete second-order effects.', 'Flag escalation thresholds (crisisSeverity movements).'],
           mustNot: ['Do not moralise.', 'Do not run consensus process — that is Kent.', 'Do not recommend operational fixes — that is Chen.'],
         },
         chen: {
           voice: 'Grounding, procedurally rigorous, challenging. Operations/readiness. Pulls decisions back to feasibility and the numbers in front of us.',
           must: ['Reference current team readiness / stock / crm / ic values.', 'Name operational sequencing.', 'Surface capacity constraints.'],
           mustNot: ['Do not frame strategic/legitimacy narrative — that is Kent.', 'Do not forecast adversary moves — that is Finch.', 'Do not generate prose that is not tied to a number in live state.'],
         },
       } as const
       ```
       The block renders each persona with headings `### Kent` etc. and three sub-sections: Voice / MUST / MUST NOT.

    8. **Routing Rules** — encode trigger → persona(s) rules from CONTEXT.md:
       - Round start → `kent` (framing) + `finch` (inject), in that order.
       - Card play: institutional/political/legitimacy cat → `kent`; adversary/disruption/escalation cat → `finch`; technical/operational/readiness cat → `chen`; ambiguous → `kent`.
       - National action → persona by character of the action (kent for institutional, finch for adversarial signalling, chen for readiness posture).
       - Unique team action → persona most aligned with action character.
       - Dispute/challenge → persona being challenged; optionally one other for corroboration (max 2).
       - Threshold warning (PC → STRAINED or CRISIS, severity movement) → `finch` (escalation) OR `chen` (operational consequence).
       - Debrief → all three, fixed order Kent → Finch → Chen.
       - Fixed response order whenever multiple personas speak: Kent → Finch → Chen.
       - Min 1, max 3 personas per turn. Never 0. No duplicates.

    9. **JSON Output Schema** — verbatim instruction that the LLM MUST return JSON only, no prose, no markdown fences, matching exactly:
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
       Include the clamp ranges in the schema description so the LLM is nudged to produce in-range values. Stress: stateUpdate fields are DELTAS only when the field changes — omit unchanged fields (STATE-03).

    10. **Absolute Rules** — six rules:
        - Return JSON ONLY. No preamble. No code fences.
        - Never exceed 3 personas per turn. Never 0.
        - Persona voice is inviolable — no bleed.
        - If a state field is unchanged, OMIT it from stateUpdate.
        - `flag` is null unless you need to surface a facilitation-specific note.
        - `control.advanceRound` / `control.triggerDebrief` are suggestions — facilitator confirms.

    Also add:

    ```typescript
    export function measurePromptTokens(prompt: string): number {
      return Math.ceil(prompt.length / 4)
    }
    ```

    Implementation notes:
    - Use template literals (backtick strings). Compose via an array of block strings joined by `\n\n`.
    - Do NOT import from `edipConfig.ts` — everything comes from the `config` parameter so different configs (Phase 7 generated ones) work identically.
    - The function must be deterministic — same inputs → same output. No `Date.now()`, no `Math.random()`.
  </action>
  <verify>
    - `pnpm typecheck` passes.
    - `node -e "const { buildSystemPrompt, measurePromptTokens } = require('./src/lib/promptBuilder'); /* ... */"` not possible in ESM; instead `grep -c "^export function buildSystemPrompt" src/lib/promptBuilder.ts` returns `1`.
  </verify>
  <done>
    `buildSystemPrompt` compiles, exports `measurePromptTokens`, defines PERSONA_PROMPT_DEFS internally, and covers the 10 blocks.
  </done>
</task>

<task type="auto">
  <name>Task 2: Structural test suite for the prompt builder</name>
  <files>src/lib/promptBuilder.test.ts</files>
  <action>
    Create `src/lib/promptBuilder.test.ts` covering:

    - **All 10 blocks present:** call `buildSystemPrompt(EDIP_CONFIG, mockGameState)` and assert the returned string `includes` each block heading (`## 1. Game Context`, ..., `## 10. Absolute Rules`).
    - **Live state interpolated:** set `gameState.round = 3`, `gameState.crisisSeverity = 2`, `gameState.edipLegitimacy = -1`; assert all three values appear in the Block 2 output.
    - **Team resources interpolated:** mutate one mock team's `pc = 0`; assert the rendered prompt includes `pc: 0` (or whatever token format you choose) for that team.
    - **All 4 teams appear:** assert each team ID appears.
    - **All 11 EDIP cards appear:** loop `config.cards` asserting each `c.id` appears.
    - **All 4 national actions appear.**
    - **All three personas present:** assert "### Kent", "### Finch", "### Chen" present.
    - **Negative constraints present per persona:** assert `"MUST NOT"` appears at least 3 times in the prompt.
    - **Routing rules present:** assert phrases "round start", "card play", "debrief" all appear (case-insensitive).
    - **JSON-only rule:** assert the prompt contains "JSON ONLY" or equivalent verbatim.
    - **Determinism:** call `buildSystemPrompt(config, state)` twice and assert `result1 === result2`.
    - **Token measurement:** `measurePromptTokens('abcd')` === 1, `measurePromptTokens('abcde')` === 2 (5/4 rounded up), `measurePromptTokens('')` === 0.
    - **Empirical log:** one test runs `measurePromptTokens(buildSystemPrompt(EDIP_CONFIG, mockState))` and logs the number to `console.info`. This is NOT asserted against a threshold (Plan 06-08 does that) but confirms the helper works end-to-end with real inputs.

    Use `EDIP_CONFIG` from `@/data/edipConfig` and build a minimal valid `GameState` mock inline (4 teams with id A/B/C/D, round 1, crisisSeverity 0, crisisState 'No Crisis', edipLegitimacy 0, cardsThisRound []).
  </action>
  <verify>
    - `pnpm test src/lib/promptBuilder.test.ts` — all tests pass.
    - The determinism and token-measurement tests pass.
    - The empirical log test prints a token count when tests run (useful for spot-checking before Plan 06-08 formalises it).
  </verify>
  <done>
    All structural tests pass. The prompt's 10 blocks, 3 personas with negative constraints, routing rules, JSON rule, and live state interpolation are each pinned by a passing test.
  </done>
</task>

</tasks>

<verification>
- `pnpm test src/lib/promptBuilder.test.ts && pnpm typecheck` pass.
- Prompt is deterministic, contains all 10 blocks, uses live state, covers all routing triggers, encodes negative constraints.
</verification>

<success_criteria>
- `buildSystemPrompt(config, gameState)` satisfies PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05.
- `measurePromptTokens(s)` returns `ceil(s.length/4)`.
- Prompt is pure — no dates, no randomness.
- Tests pin each block, each persona's MUST NOT, each routing trigger keyword.
</success_criteria>

<output>
After completion, create `.planning/phases/06-llm-integration/06-04-SUMMARY.md`. Include the empirical token count reported by the test for downstream reference.
</output>
