import { useRef } from 'react'
import { useGameStore } from '@/lib/gameStore'
import ActionToolbar from './ActionToolbar'
import ControlBanner from './ControlBanner'
import MessageInput from './MessageInput'
import PodcastSection from '../Podcast/PodcastSection'

export default function FacilitatorInput() {
  const loading = useGameStore((s) => s.loading)
  const gameEnded = useGameStore((s) => s.gameEnded)
  const insertRef = useRef<((text: string) => void) | null>(null)

  const handleInsert = (text: string) => {
    insertRef.current?.(text)
  }

  const registerInsert = (fn: (text: string) => void) => {
    insertRef.current = fn
  }

  return (
    <div
      data-testid="facilitator-input"
      className="flex-none border-t border-border-subtle bg-bg-panel p-3 space-y-2"
    >
      {/*
        Non-blocking LLM control banner. Renders null when idle (no layout
        cost); appears above the toolbar when the LLM has signalled an
        advanceRound / triggerDebrief confirmation.
      */}
      <ControlBanner />
      <ActionToolbar disabled={loading} onInsert={handleInsert} />
      <PodcastSection />
      <MessageInput disabled={loading} gameEnded={gameEnded} registerInsert={registerInsert} />
      {gameEnded && (
        <p className="text-xs text-text-secondary/70 mt-1">
          Game ended. Download the debrief to save a record.
        </p>
      )}
    </div>
  )
}
