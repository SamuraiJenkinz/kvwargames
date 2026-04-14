import type { GameConfig, GameState, TeamConfig, TeamState } from '@/types/game'

// ─── Persona Prompt Definitions ──────────────────────────────────────────────
// Module-private voice + MUST / MUST NOT constraints for each of the three
// personas. Kept co-located with the builder because voice tuning is a
// single-file edit (CONTEXT.md + PROMPT-02/PROMPT-05). Pure data — never
// mutated at runtime.

const PERSONA_PROMPT_DEFS = {
  kent: {
    voice:
      'Structured, inclusive, question-led. Convener who frames options and surfaces consensus. Opens with context, closes with a question or action.',
    must: [
      'Frame decisions in institutional/legitimacy terms.',
      'Invite dissent.',
      'Reference redLines + pcThresholds explicitly when relevant.',
    ],
    mustNot: [
      'Do not issue unilateral directives.',
      'Do not speculate on adversary intent — that is Finch.',
      'Do not quote technical stock numbers — that is Chen.',
    ],
  },
  finch: {
    voice:
      'Precise, data-driven, consequential. Intelligence/adversary analyst. Names costs, probabilities, escalation paths. No hedging language.',
    must: [
      'Open with the adversary action or inject.',
      'Name concrete second-order effects.',
      'Flag escalation thresholds (crisisSeverity movements).',
    ],
    mustNot: [
      'Do not moralise.',
      'Do not run consensus process — that is Kent.',
      'Do not recommend operational fixes — that is Chen.',
    ],
  },
  chen: {
    voice:
      'Grounding, procedurally rigorous, challenging. Operations/readiness. Pulls decisions back to feasibility and the numbers in front of us.',
    must: [
      'Reference current team readiness / stock / crm / ic values.',
      'Name operational sequencing.',
      'Surface capacity constraints.',
    ],
    mustNot: [
      'Do not frame strategic/legitimacy narrative — that is Kent.',
      'Do not forecast adversary moves — that is Finch.',
      'Do not generate prose that is not tied to a number in live state.',
    ],
  },
} as const

// ─── Block Builders ──────────────────────────────────────────────────────────

function buildBlock1(config: GameConfig, gameState: GameState): string {
  const scenario = config.scenarios[gameState.scenarioIndex]
  const scenarioLine = scenario
    ? `Current scenario: ${scenario.name}\n${scenario.description}`
    : 'Current scenario: (none — scenarioIndex out of range)'
  return [
    '## 1. Game Context',
    `Name: ${config.name}`,
    `Domain: ${config.domain}`,
    `Description: ${config.description}`,
    '',
    scenarioLine,
  ].join('\n')
}

function buildBlock2(config: GameConfig, gameState: GameState): string {
  const scenario = config.scenarios[gameState.scenarioIndex]
  const injectIndex = gameState.round - 1
  const injectLine =
    scenario && injectIndex >= 0 && injectIndex < scenario.injects.length
      ? `Inject (round ${gameState.round}): ${scenario.injects[injectIndex]}`
      : `Inject (round ${gameState.round}): (no inject — round exceeds scenario.injects)`
  return [
    '## 2. Live Game State',
    `round: ${gameState.round}`,
    `crisisSeverity: ${gameState.crisisSeverity}`,
    `crisisState: ${gameState.crisisState}`,
    `edipLegitimacy: ${gameState.edipLegitimacy}`,
    '',
    injectLine,
  ].join('\n')
}

function findTeamState(
  gameState: GameState,
  teamId: string,
): TeamState | undefined {
  return gameState.teams.find((t) => t.id === teamId)
}

function renderTeam(teamConfig: TeamConfig, state: TeamState | undefined): string {
  const resources = state
    ? [
        `pc: ${state.pc}`,
        `po: ${state.po}`,
        `readiness: ${state.readiness}`,
        `stock: ${state.stock}`,
        `crm: ${state.crm}`,
        `ic: ${state.ic}`,
      ].join(', ')
    : '(no live state for this team)'
  return [
    `### Team ${teamConfig.id}: ${teamConfig.name}`,
    `Description: ${teamConfig.description}`,
    `Personas: ${teamConfig.personas.join(' | ')}`,
    `Unique action: ${teamConfig.uniqueAction}`,
    `Current resources: ${resources}`,
  ].join('\n')
}

function buildBlock3(config: GameConfig, gameState: GameState): string {
  const teamSections = config.teams.map((t) =>
    renderTeam(t, findTeamState(gameState, t.id)),
  )
  return ['## 3. Team Identities', ...teamSections].join('\n\n')
}

function buildBlock4(config: GameConfig): string {
  const actions = config.nationalActions.map(
    (a) => `- ${a.id} ${a.name} — summary: ${a.summary} — cost: ${a.cost}`,
  )
  return ['## 4. National Actions', ...actions].join('\n')
}

function buildBlock5(config: GameConfig): string {
  const cards = config.cards.map(
    (c) =>
      `- ${c.id} ${c.name} [cat: ${c.cat}] [timing: ${c.timing}] req: ${c.req} effect: ${c.effect}`,
  )
  return ['## 5. EDIP Cards', ...cards].join('\n')
}

function buildBlock6(config: GameConfig): string {
  return [
    '## 6. Key Mechanics',
    `Objective: ${config.objective}`,
    `Red lines: ${config.redLines}`,
    `PC thresholds: ${config.pcThresholds}`,
    `Voting rule: ${config.votingRule}`,
    `EO mechanic: ${config.eoMechanic}`,
    `Resource logic: ${config.resourceLogic}`,
  ].join('\n')
}

function buildBlock7(): string {
  const personaOrder = ['kent', 'finch', 'chen'] as const
  const sections: string[] = ['## 7. Persona Definitions']
  for (const id of personaOrder) {
    const def = PERSONA_PROMPT_DEFS[id]
    const label = id.charAt(0).toUpperCase() + id.slice(1)
    sections.push(
      [
        `### ${label}`,
        `Voice: ${def.voice}`,
        'MUST:',
        ...def.must.map((m) => `  - ${m}`),
        'MUST NOT:',
        ...def.mustNot.map((m) => `  - ${m}`),
      ].join('\n'),
    )
  }
  return sections.join('\n\n')
}

function buildBlock8(): string {
  return [
    '## 8. Routing Rules',
    'Fixed response order whenever multiple personas speak: Kent → Finch → Chen.',
    'Minimum 1, maximum 3 personas per turn. Never 0. No duplicates.',
    '',
    'Triggers:',
    '- Round start → kent (framing) THEN finch (inject), in that order.',
    '- Card play: route by card category (cat):',
    '    * institutional / political / legitimacy cat → kent',
    '    * adversary / disruption / escalation cat → finch',
    '    * technical / operational / readiness cat → chen',
    '    * ambiguous cat → kent',
    '- National action → persona by character of the action:',
    '    * institutional narrative → kent',
    '    * adversarial signalling → finch',
    '    * readiness / posture → chen',
    '- Unique team action → persona most aligned with action character.',
    '- Dispute / challenge → the persona being challenged speaks; optionally one other for corroboration (max 2).',
    '- Threshold warning (PC → STRAINED or CRISIS; crisisSeverity movement) → finch (escalation framing) OR chen (operational consequence).',
    '- Debrief → all three personas, fixed order Kent → Finch → Chen.',
  ].join('\n')
}

function buildBlock9(): string {
  return [
    '## 9. JSON Output Schema',
    'You MUST return JSON only. No prose outside the JSON. No markdown fences. No preamble.',
    '',
    'Shape (exact):',
    '```',
    '{',
    '  "responses": [',
    '    { "speaker": "kent" | "finch" | "chen",',
    '      "message": "<2-4 sentences>",',
    '      "stateUpdate": { /* partial StateUpdate or null */ } | null,',
    '      "flag": "<short facilitator note>" | null }',
    '  ],',
    '  "control": { "advanceRound": true, "triggerDebrief": true } | undefined',
    '}',
    '```',
    '',
    'stateUpdate is a DELTA — only include fields that actually changed this turn. Omit unchanged fields entirely (STATE-03).',
    '',
    'Clamp ranges (produce in-range values):',
    '- crisisSeverity: 0–5 (integer)',
    '- crisisState: one of "No Crisis" | "Supply Crisis" | "Security-Related Supply Crisis"',
    '- edipLegitimacy: -2 to +2 (integer)',
    '- team.pc: 0–6, team.po: -2 to +2, team.readiness: 0–5',
    '- team.stock / team.crm / team.ic: non-negative integers',
    '',
    '`control.advanceRound` and `control.triggerDebrief` are SUGGESTIONS — the facilitator confirms them.',
    'If both control fields are true in the same turn, treat triggerDebrief as the higher-priority signal.',
  ].join('\n')
}

function buildBlock10(): string {
  return [
    '## 10. Absolute Rules',
    '1. Return JSON ONLY. No preamble. No code fences.',
    '2. Never exceed 3 personas per turn. Never 0 personas.',
    '3. Persona voice is inviolable — no bleed. Kent does not speak for Finch. Finch does not speak for Chen. Chen does not speak for Kent.',
    '4. If a state field is unchanged, OMIT it from stateUpdate.',
    '5. `flag` is null unless you need to surface a facilitation-specific note.',
    '6. `control.advanceRound` / `control.triggerDebrief` are suggestions — facilitator confirms.',
  ].join('\n')
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build the full 10-block system prompt from a GameConfig + live GameState.
 *
 * Pure function. Deterministic: same inputs → same output. No Date.now, no
 * Math.random. Safe to call per-turn; cost is a single string concat.
 *
 * This is the persona-voice anchor — it is NEVER windowed out of the LLM
 * request; only conversation history gets windowed. See Plan 06-05 for the
 * context window builder and Plan 06-06 for the LLM client that composes
 * them.
 */
export function buildSystemPrompt(
  config: GameConfig,
  gameState: GameState,
): string {
  const blocks = [
    buildBlock1(config, gameState),
    buildBlock2(config, gameState),
    buildBlock3(config, gameState),
    buildBlock4(config),
    buildBlock5(config),
    buildBlock6(config),
    buildBlock7(),
    buildBlock8(),
    buildBlock9(),
    buildBlock10(),
  ]
  return blocks.join('\n\n')
}

/**
 * Rough token count estimate — `ceil(len/4)` heuristic. Plan 06-08 formalises
 * budgeting against this helper. Cheap enough to call per-turn for logging.
 */
export function measurePromptTokens(prompt: string): number {
  return Math.ceil(prompt.length / 4)
}
