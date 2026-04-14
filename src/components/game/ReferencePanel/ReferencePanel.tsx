import { useLayoutEffect, useRef } from 'react'
import { useGameStore } from '@/lib/gameStore'
import CardsTab from './CardsTab'
import ActionsTab from './ActionsTab'
import GuideTab from './GuideTab'

type TabId = 'cards' | 'actions' | 'guide'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'cards',   label: 'CARDS' },
  { id: 'actions', label: 'ACTIONS' },
  { id: 'guide',   label: 'GUIDE' },
]

export default function ReferencePanel() {
  const activeTab = useGameStore((s) => s.activeTab)
  const setActiveTab = useGameStore((s) => s.setActiveTab)

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollPositions = useRef<Record<string, number>>({ cards: 0, actions: 0, guide: 0 })
  const prevTab = useRef<TabId>(activeTab)

  // Save departing tab's scroll position BEFORE restoring incoming tab's position.
  // Without the save-before-restore step, the departing tab's scroll is lost if the user
  // hasn't actively scrolled since the previous tab switch (onScroll only fires during scroll).
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    // SAVE the departing tab's scrollTop BEFORE we overwrite it
    if (prevTab.current !== activeTab) {
      scrollPositions.current[prevTab.current] = el.scrollTop
    }

    // RESTORE the incoming tab's saved position (default 0 on first visit)
    el.scrollTop = scrollPositions.current[activeTab] ?? 0

    prevTab.current = activeTab
  }, [activeTab])

  // Secondary capture during active scrolling (nice-to-have: keeps the saved value
  // fresh if something else triggers a re-render between tab switches).
  const handleScroll = () => {
    const el = containerRef.current
    if (el) scrollPositions.current[activeTab] = el.scrollTop
  }

  return (
    <div data-testid="reference-panel" className="w-[252px] flex-none border-l border-border-subtle flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex border-b border-border-subtle flex-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={
              'flex-1 py-2 text-xs font-mono uppercase tracking-wide transition-opacity ' +
              (activeTab === t.id
                ? 'opacity-100 border-b-2 border-text-primary'
                : 'opacity-60 hover:opacity-80')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Scrollable tab content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3"
      >
        {activeTab === 'cards'   && <CardsTab />}
        {activeTab === 'actions' && <ActionsTab />}
        {activeTab === 'guide'   && <GuideTab />}
      </div>
    </div>
  )
}
