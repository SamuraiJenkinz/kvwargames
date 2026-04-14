import { useGameStore } from '@/lib/gameStore'
import type { CrisisState } from '@/types/game'

// ─── Crisis Badge ─────────────────────────────────────────────────────────────

interface CrisisBadgeProps {
  crisisState: CrisisState
}

function crisisBadgeClasses(crisisState: CrisisState): string {
  const base = 'border rounded-sm px-2 py-0.5 font-mono text-xs uppercase'
  if (crisisState === 'Supply Crisis')
    return `${base} bg-crisis-supply/20 text-crisis-supply border-crisis-supply/30`
  if (crisisState === 'Security-Related Supply Crisis')
    return `${base} bg-crisis-security/20 text-crisis-security border-crisis-security/30`
  // 'No Crisis'
  return `${base} bg-crisis-none/20 text-crisis-none border-crisis-none/30`
}

function CrisisBadge({ crisisState }: CrisisBadgeProps) {
  return (
    <span className={crisisBadgeClasses(crisisState)}>
      {crisisState}
    </span>
  )
}

// ─── GameHeader ───────────────────────────────────────────────────────────────

export default function GameHeader() {
  const gameState = useGameStore((s) => s.gameState)
  const gameConfig = useGameStore((s) => s.gameConfig)
  const resetGame = useGameStore((s) => s.resetGame)

  const scenarioName =
    gameConfig?.scenarios?.[gameState?.scenarioIndex ?? 0]?.name ?? null
  const round = gameState?.round ?? null
  const crisisState = gameState?.crisisState ?? 'No Crisis'
  const gameTitle = gameConfig?.title ?? gameConfig?.name ?? 'Untitled Game'

  return (
    <header className="flex-none h-14 bg-bg-panel border-b border-border-subtle px-4 flex items-center justify-between">
      {/* Left: wordmark + game title */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-display uppercase tracking-wide text-sm text-text-primary whitespace-nowrap">
          KV WAR GAME
        </span>
        <span className="text-text-muted text-xs truncate">
          {gameTitle}
        </span>
      </div>

      {/* Center: scenario + round */}
      <div className="flex items-center gap-4">
        {scenarioName && (
          <span className="text-text-muted text-xs truncate max-w-[200px]">
            {scenarioName}
          </span>
        )}
        {round !== null && (
          <span className="font-mono text-sm text-text-primary whitespace-nowrap">
            Round {round}
          </span>
        )}
      </div>

      {/* Right: crisis badge + new game */}
      <div className="flex items-center gap-3">
        <CrisisBadge crisisState={crisisState} />
        <button
          type="button"
          className="text-xs text-text-muted hover:text-text-primary transition-colors"
          onClick={() => resetGame()}
        >
          New Game
        </button>
      </div>
    </header>
  )
}
