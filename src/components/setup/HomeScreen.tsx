import { useState } from 'react'
import { useGameStore } from '@/lib/gameStore'

export default function HomeScreen() {
  const setSetupMode = useGameStore((s) => s.setSetupMode)
  const [briefMessageVisible, setBriefMessageVisible] = useState(false)

  return (
    <main className="min-h-screen bg-bg-base text-text-primary flex flex-col items-center justify-center px-6 py-12">
      {/* Header */}
      <div className="text-center max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight font-display">
          EDIP Wargame Facilitator
        </h1>
        <p className="text-text-secondary mt-2 text-sm">
          Choose how to start a session.
        </p>
      </div>

      {/* Cards */}
      <div className="mt-10 grid w-full max-w-5xl gap-6 grid-cols-1 lg:grid-cols-2">

        {/* Card 1 — Load Config (ACTIVE) */}
        <button
          onClick={() => setSetupMode('load')}
          className="group flex flex-col items-start gap-3 rounded-2xl border border-border-default bg-bg-panel p-8 text-left transition min-h-[180px] hover:border-border-muted hover:bg-bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-persona-kent)]"
        >
          <div className="flex flex-col gap-2 w-full">
            <h2 className="text-lg font-semibold text-text-primary">
              Load Config
            </h2>
            <p className="text-sm text-text-secondary">
              Use the EDIP default or paste your own JSON.
            </p>
          </div>
          <div className="mt-auto">
            <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs text-persona-kent border border-border-dim">
              Recommended
            </span>
          </div>
        </button>

        {/* Card 2 — Generate from Brief (STUB / DISABLED) */}
        <div className="flex flex-col gap-0">
          <button
            aria-disabled="true"
            onClick={() => setBriefMessageVisible(true)}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-border-default bg-bg-panel p-8 text-left min-h-[180px] opacity-60 cursor-not-allowed"
          >
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold text-text-primary">
                  Generate from Brief
                </h2>
                <span className="shrink-0 rounded-full bg-bg-elevated px-2 py-0.5 text-xs text-text-secondary">
                  Coming in Phase 7
                </span>
              </div>
              <p className="text-sm text-text-secondary">
                Describe a domain in plain English; the engine builds a config.
              </p>
            </div>
            <span className="sr-only">Disabled — coming in Phase 7</span>
          </button>
          {briefMessageVisible && (
            <p className="mt-3 text-xs text-text-secondary px-1">
              Brief generation arrives in Phase 7. Use Load Config for now.
            </p>
          )}
        </div>

      </div>
    </main>
  )
}
