import { useGameStore } from '@/lib/gameStore'
import TrackBar from './TrackBar'
import TeamCard from './TeamCard'
import PersonaDots from './PersonaDots'

export default function StatePanel() {
  const gameState = useGameStore((s) => s.gameState)
  if (!gameState) return null

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
      />

      {/* Legitimacy track (-2 to +2, centre-zero, blue) */}
      <TrackBar
        label="Legitimacy"
        value={gameState.edipLegitimacy}
        min={-2}
        max={2}
        colorClass="bg-track-legitimacy"
        mode="center-zero"
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
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
    </div>
  )
}
