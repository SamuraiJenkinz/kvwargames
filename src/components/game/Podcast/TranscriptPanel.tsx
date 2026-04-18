import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useGameStore } from '@/lib/gameStore'
import { generateDebriefMarkdown } from '@/lib/debriefExporter'
import type { DebriefSnapshot } from '@/lib/debriefExporter'

/**
 * Collapsible transcript panel — renders the same markdown string as
 * "Download Debrief (.md)" in a scrollable <pre> block. Collapsed by default.
 *
 * Uses the existing generateDebriefMarkdown path — no new markdown dependency
 * (CONTEXT.md "existing markdown rendering path" / RESEARCH.md "Don't Hand-Roll").
 */
export default function TranscriptPanel() {
  const [expanded, setExpanded] = useState(false)

  // Lazily generate markdown only when expanded
  const generateMarkdown = () => {
    const s = useGameStore.getState()
    if (!s.gameConfig || !s.gameState) return ''
    const snapshot: DebriefSnapshot = {
      gameConfig: s.gameConfig,
      gameState: s.gameState,
      stateSnapshots: s.stateSnapshots,
      messages: s.messages,
      exportedAt: new Date(),
    }
    return generateDebriefMarkdown(snapshot)
  }

  return (
    <div className="border-t border-border-subtle pt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {expanded ? 'Hide transcript' : 'Show transcript'}
      </button>

      {expanded && (
        <pre className="mt-2 whitespace-pre-wrap text-sm font-mono text-text-secondary max-h-96 overflow-auto p-3 bg-bg-elevated rounded">
          {generateMarkdown()}
        </pre>
      )}
    </div>
  )
}
