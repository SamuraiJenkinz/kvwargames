import { useEffect, useRef } from 'react'
import { useGameStore } from '@/lib/gameStore'
import type { GameState, TeamState } from '@/types/game'
import TrackBar from './TrackBar'
import TeamCard from './TeamCard'
import PersonaDots from './PersonaDots'

/**
 * Favourability direction per tracked field.
 * 'up'   → higher is better; positive delta tints favourable (green).
 * 'down' → lower is better;   negative delta tints favourable (green).
 *
 * Literal class strings 'text-track-readiness' and 'text-crisis-security' appear
 * verbatim in the source of this file and TeamCard.tsx so Tailwind v4's static
 * scan picks them up. Do NOT compose these class names via template literal or
 * dynamic key lookup — doing so causes the emitted CSS bundle to drop them.
 */
const FAVORABILITY: Record<string, 'up' | 'down'> = {
  crisisSeverity: 'down', // lower is better
  edipLegitimacy: 'up',
  pc: 'up',
  po: 'up',
  readiness: 'up',
  stock: 'up',
  crm: 'up',
  ic: 'up',
}

/**
 * Tailwind v4 static class-scan anchors.
 * These literal strings must appear verbatim in this file so Tailwind picks them
 * up during its source scan. Actual class application happens in TrackBar /
 * TeamCard via the same literal ternary. Exporting keeps them usable and
 * prevents a "declared but never read" warning.
 */
export const TAILWIND_FAVOURABLE_CLASS = 'text-track-readiness'
export const TAILWIND_UNFAVOURABLE_CLASS = 'text-crisis-security'

type TeamDeltaKey = 'pc' | 'po' | 'readiness' | 'stock' | 'crm' | 'ic'
const TEAM_FIELDS: TeamDeltaKey[] = ['pc', 'po', 'readiness', 'stock', 'crm', 'ic']

function diffTeam(curr: TeamState, prev: TeamState | undefined): Partial<Record<TeamDeltaKey, number>> {
  if (!prev) return {}
  const out: Partial<Record<TeamDeltaKey, number>> = {}
  for (const k of TEAM_FIELDS) {
    const d = curr[k] - prev[k]
    if (d !== 0) out[k] = d
  }
  return out
}

export { FAVORABILITY }

export default function StatePanel() {
  const gameState = useGameStore((s) => s.gameState)
  const prevStateRef = useRef<GameState | null>(null)

  useEffect(() => {
    // Update AFTER render so the current pass can still read the previous value.
    prevStateRef.current = gameState
  }, [gameState])

  if (!gameState) return null

  const prev = prevStateRef.current
  const severityDelta =
    prev != null ? gameState.crisisSeverity - prev.crisisSeverity : undefined
  const legitimacyDelta =
    prev != null ? gameState.edipLegitimacy - prev.edipLegitimacy : undefined

  const teamDeltasById = new Map<string, Partial<Record<TeamDeltaKey, number>>>()
  if (prev) {
    for (const team of gameState.teams) {
      const prevTeam = prev.teams.find((t) => t.id === team.id)
      teamDeltasById.set(team.id, diffTeam(team, prevTeam))
    }
  }

  return (
    <div
      data-testid="state-panel"
      className="w-[210px] flex-none overflow-y-auto border-r border-border-subtle p-3 space-y-4"
    >
      {/* Severity track (0–5, left-growing, red) */}
      <TrackBar
        label="Severity"
        value={gameState.crisisSeverity}
        min={0}
        max={5}
        colorClass="bg-track-severity"
        mode="simple"
        delta={severityDelta}
        favourability={FAVORABILITY.crisisSeverity}
      />

      {/* Legitimacy track (-2 to +2, centre-zero, blue) */}
      <TrackBar
        label="Legitimacy"
        value={gameState.edipLegitimacy}
        min={-2}
        max={2}
        colorClass="bg-track-legitimacy"
        mode="center-zero"
        delta={legitimacyDelta}
        favourability={FAVORABILITY.edipLegitimacy}
      />

      {/* Persona indicator dots */}
      <div className="pt-2 border-t border-border-subtle">
        <div className="text-[10px] text-text-muted font-mono uppercase tracking-wide mb-2">
          Personas this round
        </div>
        <PersonaDots />
      </div>

      {/* Team cards */}
      <div className="pt-2 border-t border-border-subtle space-y-2">
        {gameState.teams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            deltas={prev ? teamDeltasById.get(team.id) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
