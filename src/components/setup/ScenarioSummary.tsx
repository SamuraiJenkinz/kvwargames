import type { GameConfig } from '@/types/game'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenarioSummaryProps {
  config: GameConfig
}

// ─── ScenarioSummary ──────────────────────────────────────────────────────────

/**
 * Read-only summary of a parsed GameConfig.
 * Shows game title, domain, description, per-scenario cards, and resource counts.
 */
export default function ScenarioSummary({ config }: ScenarioSummaryProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {config.name}
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {config.domain}
        </p>
      </div>

      {/* Description */}
      {config.description && (
        <p className="line-clamp-3 text-sm text-[var(--color-text-secondary)]">
          {config.description}
        </p>
      )}

      {/* Scenarios */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Scenarios
        </h3>
        {config.scenarios.map((scenario, i) => (
          <div
            key={scenario.id ?? i}
            className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3"
          >
            <p className="font-medium text-[var(--color-text-primary)]">
              {scenario.name}
            </p>
            {scenario.description && (
              <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                {scenario.description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)]">
              {scenario.rounds != null && (
                <span>Rounds: {scenario.rounds}</span>
              )}
              {scenario.startState?.crisisSeverity != null && (
                <span>
                  Crisis severity: {scenario.startState.crisisSeverity}
                </span>
              )}
              {scenario.startState?.edipLegitimacy != null && (
                <span>
                  EDIP legitimacy: {scenario.startState.edipLegitimacy}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Resource counts */}
      <div className="flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
        <span>{config.teams.length} teams configured</span>
        {config.cards && (
          <span>{config.cards.length} cards configured</span>
        )}
      </div>
    </div>
  )
}
