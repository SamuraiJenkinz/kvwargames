import { useGameStore } from '@/lib/gameStore'

interface ActionToolbarProps {
  disabled: boolean
  onInsert: (text: string) => void
}

export default function ActionToolbar({ disabled, onInsert }: ActionToolbarProps) {
  const advanceRound = useGameStore((s) => s.advanceRound)
  const triggerDebrief = useGameStore((s) => s.triggerDebrief)
  const gameConfig = useGameStore((s) => s.gameConfig)
  const gameState = useGameStore((s) => s.gameState)

  const nextRound = (gameState?.round ?? 0) + 1

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <button
        onClick={() => advanceRound()}
        disabled={disabled}
        className="text-xs font-mono uppercase px-2 py-1 rounded-sm border border-border-default hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Advance to Round {nextRound}
      </button>

      {/*
        LAYOUT-04 / FLOW-04: facilitator can request an interim debrief turn
        at any point. Wired to the same `triggerDebrief` store action; Plan 08
        may split interim vs. end-of-game semantics if needed.
      */}
      <button
        onClick={() => triggerDebrief()}
        disabled={disabled}
        className="text-xs font-mono uppercase px-2 py-1 rounded-sm border border-border-default hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Request Debrief Now
      </button>

      <button
        onClick={() => triggerDebrief()}
        disabled={disabled}
        className="text-xs font-mono uppercase px-2 py-1 rounded-sm border border-border-default hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
      >
        End Game + Debrief
      </button>

      <select
        disabled={disabled}
        value=""
        onChange={(e) => {
          if (e.target.value) {
            onInsert(e.target.value)
            e.target.value = ''
          }
        }}
        className="text-xs font-mono uppercase px-2 py-1 rounded-sm bg-bg-elevated border border-border-default disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Insert card…</option>
        {gameConfig?.cards.map((c) => (
          <option key={c.id} value={`${c.id} ${c.name}`}>
            {c.id} — {c.name}
          </option>
        ))}
      </select>

      <select
        disabled={disabled}
        value=""
        onChange={(e) => {
          if (e.target.value) {
            onInsert(e.target.value)
            e.target.value = ''
          }
        }}
        className="text-xs font-mono uppercase px-2 py-1 rounded-sm bg-bg-elevated border border-border-default disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Insert national action…</option>
        {gameConfig?.nationalActions.map((na) => (
          <option key={na.id} value={`${na.id} ${na.name}`}>
            {na.id} — {na.name}
          </option>
        ))}
      </select>
    </div>
  )
}
