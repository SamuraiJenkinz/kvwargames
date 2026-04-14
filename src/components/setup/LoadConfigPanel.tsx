import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useGameStore } from '@/lib/gameStore'
import { parseConfigJson } from '@/lib/jsonValidation'
import type { ParseResult } from '@/lib/jsonValidation'
import JsonEditor from './JsonEditor'
import ScenarioSummary from './ScenarioSummary'

// ─── LoadConfigPanel ──────────────────────────────────────────────────────────

/**
 * Load Config panel — two-column layout (editor left, summary right).
 *
 * - Reads configJson from store; changes update the store immediately.
 * - 300ms debounced parse feeds the right-side ScenarioSummary.
 * - Launch buttons re-parse at click time (debounce window is ~300ms;
 *   the user may click before the debounced state settles).
 * - Back button returns to 'home' setupMode.
 */
export default function LoadConfigPanel() {
  const configJson = useGameStore((s) => s.configJson)
  const setConfigJson = useGameStore((s) => s.setConfigJson)
  const setSetupMode = useGameStore((s) => s.setSetupMode)
  const initGame = useGameStore((s) => s.initGame)
  const navigate = useNavigate()

  // Initialise parse result eagerly on mount so summary appears immediately
  // without waiting for the first 300ms debounce tick.
  const [parseResult, setParseResult] = useState<ParseResult>(() =>
    parseConfigJson(configJson),
  )

  // 300ms debounced re-parse whenever configJson changes
  useEffect(() => {
    const id = setTimeout(() => {
      setParseResult(parseConfigJson(configJson))
    }, 300)
    return () => clearTimeout(id)
  }, [configJson])

  const handleLaunch = (scenarioIndex: number) => {
    // Re-parse at click time — debounced state may be stale (300ms window)
    const fresh = parseConfigJson(configJson)
    if (!fresh.ok) {
      // Sync local error display in case user clicked during the debounce window
      setParseResult(fresh)
      return
    }
    initGame(fresh.value, scenarioIndex)
    navigate('/game')
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] p-6 text-[var(--color-text-primary)]">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setSetupMode('home')}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          ← Back
        </button>
        <h1 className="text-xl font-semibold">Load Configuration</h1>
        {/* Spacer to keep heading centered */}
        <div className="w-12" />
      </header>

      {/* Two-column layout: editor left, summary right */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: JSON editor */}
        <section className="flex flex-col gap-3">
          <label className="text-sm text-[var(--color-text-secondary)]">
            Configuration JSON
          </label>
          <JsonEditor
            value={configJson}
            onChange={setConfigJson}
            errorLine={
              parseResult && !parseResult.ok
                ? parseResult.error.line
                : undefined
            }
            ariaLabel="Game configuration JSON"
          />
          {/* Inline validation error — minimal display; plan 04-04 polishes */}
          {parseResult && !parseResult.ok && (
            <p
              role="alert"
              className="text-sm text-[var(--color-category-crisis)]"
            >
              Line {parseResult.error.line}, col {parseResult.error.col}:{' '}
              {parseResult.error.message}
            </p>
          )}
        </section>

        {/* Right: scenario summary + launch buttons */}
        <section>
          {parseResult?.ok ? (
            <>
              <ScenarioSummary config={parseResult.value} />
              <div className="mt-4 flex flex-wrap gap-3">
                {parseResult.value.scenarios.map((s, i) => (
                  <button
                    key={s.id ?? i}
                    onClick={() => handleLaunch(i)}
                    className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] px-4 py-2 text-[var(--color-text-primary)] hover:border-[var(--color-border-muted)]"
                  >
                    Launch Scenario {i + 1}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Fix the JSON to see the scenario summary.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
