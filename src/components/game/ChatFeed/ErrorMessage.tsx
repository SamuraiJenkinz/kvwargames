import { AlertCircle, RefreshCw } from 'lucide-react'
import type { ChatMessage } from '@/types/game'
import { useGameStore } from '@/lib/gameStore'

interface Props {
  message: ChatMessage
}

/**
 * Red-tinted error bubble for LLM / parse / network failures.
 *
 * Per RESP-02 + CONTEXT.md:
 *   - Plain-English reason (from message.text).
 *   - Collapsible <details> disclosure for message.rawResponse when present
 *     (keeps audit trail visible without cluttering default view).
 *   - Inline Retry button that calls gameStore.retryLastMessage(). Button
 *     only renders when message.retryInput is set.
 */
export default function ErrorMessage({ message }: Props) {
  const retryLastMessage = useGameStore((s) => s.retryLastMessage)
  const loading = useGameStore((s) => s.loading)

  return (
    <div className="flex flex-col gap-2 bg-crisis-security/10 border-l-2 border-crisis-security rounded-sm px-3 py-2 animate-[messageIn_180ms_ease-out_both] motion-reduce:animate-none">
      <div className="flex gap-2 items-start">
        <AlertCircle className="w-4 h-4 text-crisis-security flex-none mt-0.5" />
        <div className="flex-1 text-sm text-crisis-security">
          {message.errorCode && (
            <span className="font-mono text-xs mr-2 opacity-70">
              [{message.errorCode}]
            </span>
          )}
          {message.text}
        </div>
        <span className="font-mono text-xs text-crisis-security/70">
          {message.timestamp}
        </span>
      </div>

      {message.rawResponse && (
        <details className="ml-6 text-xs text-crisis-security/80">
          <summary className="cursor-pointer hover:underline select-none">
            Show raw response
          </summary>
          <pre className="mt-1 whitespace-pre-wrap max-h-48 overflow-auto bg-bg-elevated/60 border border-crisis-security/20 rounded-sm px-2 py-1 font-mono">
            {message.rawResponse}
          </pre>
        </details>
      )}

      {message.retryInput && (
        <div className="ml-6">
          <button
            onClick={() => retryLastMessage()}
            disabled={loading}
            className="inline-flex items-center gap-1 text-xs font-mono uppercase px-2 py-1 rounded-sm border border-crisis-security/40 text-crisis-security hover:bg-crisis-security/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
