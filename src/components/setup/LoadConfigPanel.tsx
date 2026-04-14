import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useGameStore } from '@/lib/gameStore'
import { parseConfigJson } from '@/lib/jsonValidation'
import type { ParseResult } from '@/lib/jsonValidation'
import { validateGameConfig, type ValidationError } from '@/lib/configValidator'
import JsonEditor from './JsonEditor'
import ScenarioSummary from './ScenarioSummary'

// ─── LoadConfigPanel ──────────────────────────────────────────────────────────

/**
 * Load Config panel — two-column layout (editor left, summary right).
 *
 * - Reads configJson from store; changes update the store immediately.
 * - 300ms debounced parse feeds the right-side ScenarioSummary.
 * - Launch buttons are always rendered once a valid parse has established a
 *   scenario count. When parse is invalid they appear disabled (not hidden).
 * - Launch handler re-parses synchronously at click time (guards against the
 *   300ms debounce window where debounced parseResult may be stale).
 * - Back button returns to 'home' setupMode.
 */
export default function LoadConfigPanel() {
  const configJson = useGameStore((s) => s.configJson)
  const setConfigJson = useGameStore((s) => s.setConfigJson)
  const setSetupMode = useGameStore((s) => s.setSetupMode)
  const draftSource = useGameStore((s) => s.draftSource)
  const initGame = useGameStore((s) => s.initGame)
  const navigate = useNavigate()

  // Initialise parse result eagerly on mount so summary appears immediately
  // without waiting for the first 300ms debounce tick.
  const [parseResult, setParseResult] = useState<ParseResult>(() =>
    parseConfigJson(configJson),
  )

  // Initialise deep validation errors eagerly — chained after parseConfigJson on mount.
  // Re-evaluated inside the existing 300ms debounce (no second timer created).
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(() => {
    const initial = parseConfigJson(configJson)
    if (!initial.ok) return []
    const v = validateGameConfig(initial.value as unknown)
    return v.ok ? [] : v.errors
  })

  // Track the last successfully-parsed scenario count so we can render
  // disabled (not hidden) Launch buttons even when JSON is currently invalid.
  const lastValidScenarioCount = useRef<number | null>(
    parseResult.ok ? parseResult.value.scenarios.length : null,
  )

  // Keep lastValidScenarioCount in sync whenever parse succeeds
  useEffect(() => {
    if (parseResult.ok) {
      lastValidScenarioCount.current = parseResult.value.scenarios.length
    }
  }, [parseResult])

  // 300ms debounced re-parse + deep validation whenever configJson changes.
  // validateGameConfig is chained inside the SAME debounce timer — no second timer.
  // When parse fails, validation errors are cleared (parse-level error takes precedence;
  // no double-banner scenario).
  useEffect(() => {
    const id = setTimeout(() => {
      const result = parseConfigJson(configJson)
      setParseResult(result)
      if (result.ok) {
        const v = validateGameConfig(result.value as unknown)
        setValidationErrors(v.ok ? [] : v.errors)
      } else {
        setValidationErrors([])
      }
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

  // Derive scenario count: use live valid parse, or fall back to last known count
  const scenarioCount = parseResult.ok
    ? parseResult.value.scenarios.length
    : lastValidScenarioCount.current

  // Launch is disabled when JSON fails to parse OR when deep schema validation errors remain.
  // "disabled-not-hidden" invariant from plan 04-04 is preserved — buttons always render.
  const launchDisabled = !parseResult.ok || validationErrors.length > 0

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] p-6 text-[var(--color-text-primary)]">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSetupMode('home')}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ← Back
          </button>
          {draftSource === 'brief' && (
            <button
              type="button"
              onClick={() => setSetupMode('brief')}
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              ← Back to Brief
            </button>
          )}
        </div>
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
          {/* Structured inline validation error alert — JSON parse failure */}
          {parseResult && !parseResult.ok && (
            <div
              role="alert"
              className="rounded-md border border-[var(--color-category-crisis)]/50 bg-[var(--color-category-crisis)]/10 p-3"
            >
              <div className="text-sm font-semibold text-[var(--color-category-crisis)]">
                JSON parse error
              </div>
              <div className="mt-1 text-sm text-[var(--color-text-primary)]">
                {parseResult.error.message}
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Line {parseResult.error.line}, column {parseResult.error.col}
              </div>
            </div>
          )}

          {/* Schema validation error banner — shown ONLY when source is 'brief'.
              For user-pasted configs the JSON parse error above is the primary signal.
              CONTEXT.md: "a generated config that fails schema validation shows a specific
              field-level error, not a generic 'invalid JSON' message." (SETUP-05) */}
          {draftSource === 'brief' && parseResult.ok && validationErrors.length > 0 && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3"
            >
              <p className="text-sm font-medium text-amber-400 mb-2">
                Structure OK but {validationErrors.length}{' '}
                {validationErrors.length === 1 ? 'field needs' : 'fields need'} attention
              </p>
              <ul className="text-xs font-mono space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>
                    <span className="text-amber-300">{err.path}</span>
                    <span className="text-amber-400/70">: {err.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Right: scenario summary + launch buttons */}
        <section>
          {parseResult?.ok ? (
            <ScenarioSummary config={parseResult.value} />
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Fix the JSON to see the scenario summary.
            </p>
          )}

          {/* Launch buttons — always rendered once scenarioCount is known;
              disabled (not hidden) when JSON is invalid */}
          {scenarioCount !== null && (
            <div className="mt-4 flex flex-wrap gap-3">
              {Array.from({ length: scenarioCount }, (_, i) => {
                // Use scenario id from live parse if available
                const scenarioId =
                  parseResult.ok
                    ? (parseResult.value.scenarios[i]?.id ?? i)
                    : i
                return (
                  <button
                    key={scenarioId}
                    onClick={() => handleLaunch(i)}
                    disabled={launchDisabled}
                    aria-disabled={launchDisabled}
                    title={launchDisabled ? 'Fix JSON errors to launch' : undefined}
                    className={
                      !launchDisabled
                        ? 'rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] px-4 py-2 text-[var(--color-text-primary)] transition hover:border-[var(--color-border-muted)]'
                        : 'cursor-not-allowed rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]/50 px-4 py-2 text-[var(--color-text-muted)] transition'
                    }
                  >
                    Launch Scenario {i + 1}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
