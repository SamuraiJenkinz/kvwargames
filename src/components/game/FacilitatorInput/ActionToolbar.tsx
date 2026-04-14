import { useGameStore } from '@/lib/gameStore'
import {
  generateDebriefMarkdown,
  downloadDebrief,
  buildDebriefFilename,
  type DebriefSnapshot,
} from '@/lib/debriefExporter'

interface ActionToolbarProps {
  disabled: boolean
  onInsert: (text: string) => void
}

export default function ActionToolbar({ disabled, onInsert }: ActionToolbarProps) {
  const advanceRound = useGameStore((s) => s.advanceRound)
  const triggerDebrief = useGameStore((s) => s.triggerDebrief)
  const endGame = useGameStore((s) => s.endGame)
  const loading = useGameStore((s) => s.loading)
  const gameEnded = useGameStore((s) => s.gameEnded)
  const gameConfig = useGameStore((s) => s.gameConfig)
  const gameState = useGameStore((s) => s.gameState)
  const hasDebrief = useGameStore((s) =>
    s.messages.some((m) => m.type === 'debrief_divider'),
  )

  const nextRound = (gameState?.round ?? 0) + 1

  // Read store state once per click via getState() — avoids re-render storms
  // when the Download button is visible (decision 6: no subscription hook in handler).
  const handleDownload = () => {
    const s = useGameStore.getState()
    if (!s.gameConfig || !s.gameState) return
    const snapshot: DebriefSnapshot = {
      gameConfig: s.gameConfig,
      gameState: s.gameState,
      stateSnapshots: s.stateSnapshots,
      messages: s.messages,
      exportedAt: new Date(),
    }
    const md = generateDebriefMarkdown(snapshot)
    const filename = buildDebriefFilename(s.gameConfig.name, new Date())
    downloadDebrief(md, filename)
  }

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <button
        onClick={() => advanceRound()}
        disabled={disabled || gameEnded}
        className="text-xs font-mono uppercase px-2 py-1 rounded-sm border border-border-default hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Advance to Round {nextRound}
      </button>

      {/*
        LAYOUT-04 / FLOW-03: interim debrief, does NOT end the game.
        Gated on loading and gameEnded (cannot request interim debrief post-game).
      */}
      <button
        onClick={() => triggerDebrief()}
        disabled={loading || gameEnded}
        className="text-xs font-mono uppercase px-2 py-1 rounded-sm border border-border-default hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Request Debrief Now
      </button>

      {/*
        FLOW-04b: final debrief via endGame(). Sets gameEnded=true + fires LLM turn.
        Also gated on gameEnded — cannot end the game twice (decision 4).
      */}
      <button
        onClick={() => endGame()}
        disabled={loading || gameEnded}
        className="text-xs font-mono uppercase px-2 py-1 rounded-sm border border-border-default hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
      >
        End Game + Debrief
      </button>

      {/*
        DEB-01: Download button appears once at least one debrief_divider exists.
        Conditionally rendered (not just disabled) to avoid flash of disabled state.
        Each click regenerates from current store state (idempotent, no caching).
      */}
      {hasDebrief && (
        <button
          type="button"
          onClick={handleDownload}
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          disabled={loading}
        >
          Download Debrief (.md)
        </button>
      )}

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
