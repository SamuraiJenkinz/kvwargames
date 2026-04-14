import { useGameStore } from '@/lib/gameStore'
import { PERSONA_META, PERSONA_ORDER } from '@/lib/personaConfig'
import { getPersonasThisRound } from '@/lib/pcThresholds'
import type { PersonaId } from '@/types/game'
import { useStickyBottomScroll } from '@/hooks/useStickyBottomScroll'
import PersonaMessage from './PersonaMessage'
import FacilitatorMessage from './FacilitatorMessage'
import RoundDivider from './RoundDivider'
import DebriefDivider from './DebriefDivider'
import ErrorMessage from './ErrorMessage'
import LoadingIndicator from './LoadingIndicator'
import NewMessagePill from './NewMessagePill'

/**
 * Determine which persona should be attributed to the loading indicator.
 * Returns the first persona in PERSONA_ORDER who has NOT spoken this round.
 * Falls back to 'chen' if all three have spoken.
 */
function getLoadingSpeaker(messages: ReturnType<typeof useGameStore.getState>['messages']): PersonaId {
  const spoken = getPersonasThisRound(messages)
  for (const id of PERSONA_ORDER) {
    if (!spoken.has(id)) return id
  }
  return 'chen'
}

export default function ChatFeed() {
  const messages = useGameStore((s) => s.messages)
  const loading = useGameStore((s) => s.loading)

  const { containerRef, sentinelRef, showPill, handleScroll, scrollToBottom } =
    useStickyBottomScroll(messages, loading)

  const loadingSpeaker = getLoadingSpeaker(messages)

  // Verify PERSONA_META has all personas (used by LoadingIndicator)
  void PERSONA_META

  return (
    <div
      data-testid="chat-feed"
      className="relative flex-1 min-h-0 flex flex-col"
    >
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.map((msg) => {
          switch (msg.type) {
            case 'persona':
              return <PersonaMessage key={msg.id} message={msg} />
            case 'facilitator':
              return <FacilitatorMessage key={msg.id} message={msg} />
            case 'round_divider':
              return <RoundDivider key={msg.id} label={msg.label ?? ''} />
            case 'debrief_divider':
              return (
                <DebriefDivider key={msg.id} label={msg.label ?? 'DEBRIEF'} />
              )
            case 'error':
              return <ErrorMessage key={msg.id} message={msg} />
            default:
              return null
          }
        })}

        {loading && <LoadingIndicator speaker={loadingSpeaker} />}

        {/* Scroll sentinel — stays at the bottom of the list */}
        <div ref={sentinelRef} />
      </div>

      {showPill && <NewMessagePill onClick={() => scrollToBottom(true)} />}
    </div>
  )
}
