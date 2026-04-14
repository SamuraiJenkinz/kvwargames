import { useGameStore } from '@/lib/gameStore'

export default function GameScreen() {
  const scenarioIndex = useGameStore((s) => s.gameState?.scenarioIndex)

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold text-text-primary font-display tracking-wider">
        Game Screen
      </h1>
      <p className="text-text-secondary text-sm">
        Game screen — three-column layout arrives in Phase 5
      </p>
      {import.meta.env.DEV && (
        <p className="text-text-muted text-xs font-mono">
          [dev] scenarioIndex: {scenarioIndex ?? 'n/a'}
        </p>
      )}
    </div>
  )
}
