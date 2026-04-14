import { useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface JsonEditorProps {
  value: string
  onChange: (next: string) => void
  errorLine?: number // 1-based; if provided, highlight that line in the gutter
  ariaLabel?: string
}

// ─── JsonEditor ───────────────────────────────────────────────────────────────

/**
 * Controlled JSON editor: a scrollable textarea with a synchronised line-number
 * gutter. The gutter and textarea share identical font metrics so line numbers
 * stay aligned with text rows at all scroll positions.
 */
export default function JsonEditor({
  value,
  onChange,
  errorLine,
  ariaLabel,
}: JsonEditorProps) {
  const gutterRef = useRef<HTMLPreElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const lineCount = value.split('\n').length

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  return (
    <div className="relative flex h-full min-h-[400px] overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] font-mono text-sm">
      {/* Line-number gutter */}
      <pre
        ref={gutterRef}
        aria-hidden="true"
        className="select-none overflow-hidden bg-[var(--color-bg-surface)] px-3 py-3 text-right leading-6"
      >
        {Array.from({ length: lineCount }, (_, i) => {
          const lineNum = i + 1
          const isError = errorLine === lineNum
          return (
            <span
              key={lineNum}
              className={
                isError
                  ? 'block bg-[var(--color-category-crisis)]/30 text-[var(--color-text-primary)]'
                  : 'block text-[var(--color-text-muted)]'
              }
            >
              {lineNum}
            </span>
          )
        })}
      </pre>

      {/* Editable textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        spellCheck={false}
        aria-label={ariaLabel ?? 'Configuration JSON'}
        className="flex-1 resize-none bg-transparent px-3 py-3 leading-6 text-[var(--color-text-primary)] outline-none"
      />
    </div>
  )
}
