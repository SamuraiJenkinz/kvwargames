import type { GameConfig, GameState, ChatMessage } from '@/types/game'
import { PERSONA_META } from '@/lib/personaConfig'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DebriefSnapshot {
  gameConfig: GameConfig
  gameState: GameState
  stateSnapshots: Record<number, GameState>
  messages: ChatMessage[]
  exportedAt: Date
  /** Optional ISO timestamp of initGame — if unavailable, metadata omits "Session start" */
  sessionStart?: Date
}

// ─── Filename helpers ─────────────────────────────────────────────────────────

/**
 * Converts a game name to a kebab-case filename-safe string.
 * Strips non-word characters, collapses whitespace/underscores to hyphens,
 * trims edge hyphens, and falls back to 'game' for empty/invalid input.
 */
export function toKebabFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'game'
  )
}

/**
 * Builds the debrief download filename in format:
 * `debrief-{kebab-game-name}-{YYYY-MM-DD-HHmm}.md`
 */
export function buildDebriefFilename(gameName: string, date: Date): string {
  const kebab = toKebabFilename(gameName)
  // Produce YYYY-MM-DD-HHmm from ISO string
  // slice(0,16) = 'YYYY-MM-DDTHH:MM', then T->- and strip the colon between HH and MM
  const isoSlice = date.toISOString().slice(0, 16) // 'YYYY-MM-DDTHH:MM'
  const ts = isoSlice.replace('T', '-').replace(':', '') // 'YYYY-MM-DD-HHmm'
  return `debrief-${kebab}-${ts}.md`
}

// ─── Internal rendering helpers ───────────────────────────────────────────────

function renderMetadata(snapshot: DebriefSnapshot): string {
  const { gameConfig, gameState, messages, exportedAt, sessionStart } = snapshot

  const scenario = gameConfig.scenarios[gameState.scenarioIndex]

  // Find the last debrief_divider to compute "debrief triggered at round"
  const lastDebriefMsg = messages.reduceRight<ChatMessage | null>(
    (found, m) => (found === null && m.type === 'debrief_divider' ? m : found),
    null,
  )

  // Determine round when debrief was triggered — look for the round before last debrief_divider
  let debriefRound = 'N/A'
  if (lastDebriefMsg) {
    // Count round_dividers before the last debrief_divider
    const debriefIdx = messages.lastIndexOf(lastDebriefMsg)
    let round = 1
    for (let i = 0; i < debriefIdx; i++) {
      if (messages[i].type === 'round_divider') {
        round++
      }
    }
    debriefRound = String(round)
  }

  const lines: string[] = [
    `- Game: ${gameConfig.name}`,
    `- Domain: ${gameConfig.domain}`,
    `- Scenario: ${scenario.name} (index ${gameState.scenarioIndex})`,
  ]

  if (sessionStart) {
    lines.push(`- Session start: ${sessionStart.toISOString()}`)
  }

  lines.push(`- Session end: ${exportedAt.toISOString()}`)
  lines.push(`- Rounds played: ${gameState.round}`)
  lines.push(`- Debrief triggered at round: ${debriefRound}`)
  lines.push(`- Facilitator notes: `)

  return lines.join('\n')
}

function renderStateSnapshot(state: GameState): string {
  const crisisLine = `Crisis: **${state.crisisState}** (Severity ${state.crisisSeverity}) | EDIP Legitimacy: **${state.edipLegitimacy}**`

  const tableHeader = '| Team | PC | PO | RDY | STK | CRM | IC |'
  const tableSep = '|------|----|----|-----|-----|-----|-----|'

  const tableRows = state.teams
    .map(
      (t) =>
        `| ${t.id} | ${t.pc} | ${t.po} | ${t.readiness} | ${t.stock} | ${t.crm} | ${t.ic} |`,
    )
    .join('\n')

  return `${crisisLine}\n\n${tableHeader}\n${tableSep}\n${tableRows}`
}

function renderMessage(msg: ChatMessage): string | null {
  if (msg.type === 'facilitator') {
    return `**Facilitator:** ${msg.text ?? ''}`
  }

  if (msg.type === 'persona') {
    const speaker = msg.speaker as keyof typeof PERSONA_META | undefined
    const displayName =
      speaker && speaker in PERSONA_META ? PERSONA_META[speaker].displayName : String(speaker)
    // ChatMessage does not carry a teamId field; use '—' as the team placeholder.
    // Plan 07-02 may extend ChatMessage with teamId if personas are team-specific.
    const team = '—'
    return `**${displayName} (${team}):** ${msg.text ?? ''}`
  }

  if (msg.type === 'error') {
    return `_[Error ${msg.errorCode ?? 'UNKNOWN'}: ${msg.text ?? ''}]_`
  }

  // loading, round_divider, debrief_divider — omit from transcript
  return null
}

function renderRound(
  n: number,
  roundMessages: ChatMessage[],
  stateSnapshots: Record<number, GameState>,
): string {
  const snapshot = stateSnapshots[n]
  const stateSection = snapshot
    ? renderStateSnapshot(snapshot)
    : '_(State snapshot unavailable)_'

  const transcriptLines = roundMessages
    .map(renderMessage)
    .filter((line): line is string => line !== null)

  const transcript =
    transcriptLines.length > 0 ? transcriptLines.join('\n\n') : '_(No messages in this round.)_'

  return [
    `## Round ${n}`,
    '',
    `### State at start of Round ${n}`,
    '',
    stateSection,
    '',
    '### Transcript',
    '',
    transcript,
  ].join('\n')
}

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Produces the full debrief markdown report from a store snapshot.
 *
 * Section order:
 *   1. H1 title
 *   2. Metadata block (game name, domain, scenario name + index, session start/end,
 *      rounds played, round when debrief triggered, facilitator notes placeholder)
 *   3. Per-round sections: ## Round N -> ### State at start of Round N -> ### Transcript
 *   4. ## Debrief — messages AFTER THE LAST `debrief_divider` (see anchor note below)
 *   5. ## Final State — snapshot of current gameState
 *   6. ## Appendix: Raw Config — one-line config name + scenario name + index
 *
 * **Snapshot-keying contract** (must match gameStore): `stateSnapshots[n]` is
 * "state at the start of Round N" for every N >= 1. Seeded at initGame for
 * N=1; captured in advanceRound under `newRound` key post-mutation. The
 * exporter reads `stateSnapshots[n]` directly — NO off-by-one adjustment.
 *
 * **`## Debrief` anchor decision**: uses the LAST `debrief_divider`, not the first.
 * Rationale: if an interim debrief fires in Round 1 and play continues into Round 3,
 * anchoring on the FIRST divider would incorrectly include Round 2/3 round-content
 * messages in the Debrief section. Last-divider correctly captures "what the final
 * debrief content was" in both interim-only and end-game-only flows.
 */
export function generateDebriefMarkdown(snapshot: DebriefSnapshot): string {
  const { gameConfig, gameState, stateSnapshots, messages } = snapshot

  // ── 1. H1 title ────────────────────────────────────────────────────────────
  const title = `# ${gameConfig.name} — Debrief Report`

  // ── 2. Metadata ────────────────────────────────────────────────────────────
  const metadata = renderMetadata(snapshot)

  // ── 3. Per-round sections ──────────────────────────────────────────────────
  // Bucket messages by round. Track currentRound as we see round_dividers.
  const roundBuckets = new Map<number, ChatMessage[]>()
  let currentRound = 1
  roundBuckets.set(1, [])

  for (const msg of messages) {
    if (msg.type === 'round_divider') {
      // Parse next round from label or increment
      const match = msg.label ? /(\d+)/.exec(msg.label) : null
      currentRound = match ? parseInt(match[1], 10) : currentRound + 1
      if (!roundBuckets.has(currentRound)) {
        roundBuckets.set(currentRound, [])
      }
    } else {
      const bucket = roundBuckets.get(currentRound)
      if (bucket) {
        bucket.push(msg)
      }
    }
  }

  // Sort rounds numerically and render each
  const sortedRounds = Array.from(roundBuckets.keys()).sort((a, b) => a - b)
  const roundSections = sortedRounds.map((n) =>
    renderRound(n, roundBuckets.get(n) ?? [], stateSnapshots),
  )

  // ── 4. Debrief section ─────────────────────────────────────────────────────
  // Use the LAST debrief_divider as the anchor (not the first).
  // reduce() scans all messages, accumulating the index of each debrief_divider;
  // the final value is the LAST such index. This correctly handles interim debriefs
  // followed by continued play and a final debrief.
  const lastDebriefIdx = messages.reduce<number>(
    (acc, m, i) => (m.type === 'debrief_divider' ? i : acc),
    -1,
  )

  let debriefContent: string
  if (lastDebriefIdx === -1) {
    debriefContent = '_(No debrief was triggered during this session.)_'
  } else {
    const debriefMessages = messages
      .slice(lastDebriefIdx + 1)
      .filter((m) => m.type === 'persona' || m.type === 'error')
      .map(renderMessage)
      .filter((line): line is string => line !== null)

    debriefContent =
      debriefMessages.length > 0
        ? debriefMessages.join('\n\n')
        : '_(No persona responses in debrief section.)_'
  }

  // ── 5. Final State ─────────────────────────────────────────────────────────
  const finalStateContent = renderStateSnapshot(gameState)

  // ── 6. Appendix: Raw Config ────────────────────────────────────────────────
  const scenario = gameConfig.scenarios[gameState.scenarioIndex]
  const appendixContent = `Config: ${gameConfig.name} | Scenario: ${scenario.name} (index ${gameState.scenarioIndex})`

  // ── Assemble ───────────────────────────────────────────────────────────────
  const sections: string[] = [
    title,
    '',
    metadata,
    '',
    roundSections.join('\n\n'),
    '',
    '## Debrief',
    '',
    debriefContent,
    '',
    '## Final State',
    '',
    finalStateContent,
    '',
    '## Appendix: Raw Config',
    '',
    appendixContent,
  ]

  return sections.join('\n')
}

// ─── Download side-effect ─────────────────────────────────────────────────────

/**
 * Triggers a browser file-save for the given markdown string.
 * Uses the Blob + URL.createObjectURL + synthetic anchor pattern.
 * Defers URL.revokeObjectURL by one event-loop tick (setTimeout 0ms) so
 * Firefox has time to start reading the blob before revocation.
 */
export function downloadDebrief(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown; charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Defer revokeObjectURL by one event loop tick — Firefox needs the click
  // event to start reading the blob before revocation.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
