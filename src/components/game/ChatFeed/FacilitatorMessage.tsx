import type { ChatMessage } from '@/types/game'

interface Props {
  message: ChatMessage
}

export default function FacilitatorMessage({ message }: Props) {
  return (
    <div className="flex justify-end animate-[messageIn_180ms_ease-out_both] motion-reduce:animate-none">
      <div className="flex flex-col items-end gap-1 max-w-[75%]">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wide text-text-muted">
            FACILITATOR
          </span>
          <span className="font-mono text-xs text-text-muted">
            {message.timestamp}
          </span>
        </div>

        {/* Bubble */}
        <div className="bg-bg-elevated border border-border-subtle rounded-sm px-3 py-2 text-sm text-text-primary">
          {message.text}
        </div>
      </div>
    </div>
  )
}
