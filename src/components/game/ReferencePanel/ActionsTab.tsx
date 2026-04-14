import { useGameStore } from '@/lib/gameStore'

export default function ActionsTab() {
  const gameConfig = useGameStore((s) => s.gameConfig)

  return (
    <div>
      {/* Section 1: National Actions */}
      <h3 className="font-display text-sm uppercase tracking-wide mb-2">National Actions</h3>
      {(gameConfig?.nationalActions ?? []).map((action) => (
        <div key={action.id} className="mb-3 border-l-2 border-border-subtle pl-3">
          <p className="text-sm font-medium">{action.name}</p>
          <p className="text-xs text-text-muted mt-1">{action.summary}</p>
          <p className="text-xs text-persona-finch mt-1">Cost: {action.cost}</p>
        </div>
      ))}

      {/* Divider */}
      <hr className="border-border-subtle my-4" />

      {/* Section 2: Team Unique Powers */}
      <h3 className="font-display text-sm uppercase tracking-wide mt-6 mb-2">Team Unique Powers</h3>
      {(gameConfig?.teams ?? []).map((team) => (
        <div key={team.id} className="mb-3 border-l-2 border-border-subtle pl-3">
          <span className="font-mono text-xs bg-bg-elevated rounded-sm px-1.5 py-0.5 inline-block">
            Team {team.id}
          </span>
          <p className="text-xs text-text-muted mt-1">{team.uniqueAction}</p>
        </div>
      ))}
    </div>
  )
}
