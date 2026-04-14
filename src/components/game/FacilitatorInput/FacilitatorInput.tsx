import { useRef } from 'react'
import { useGameStore } from '@/lib/gameStore'
import ActionToolbar from './ActionToolbar'
import ControlBanner from './ControlBanner'
import MessageInput from './MessageInput'

export default function FacilitatorInput() {
  const loading = useGameStore((s) => s.loading)
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
      <MessageInput disabled={loading} registerInsert={registerInsert} />
    </div>
  )
}
