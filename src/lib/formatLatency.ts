/**
 * Formats a latency value in milliseconds for human display.
 *
 * Decision locked in CONTEXT.md (Phase 10 — HealthBadge):
 *   - Under 1 second: return "820ms"
 *   - At or over 1 second: return "1.2s" (one decimal place)
 *
 * Shared by HealthBadge (LLM) and TtsHealthBadge (Phase 15). Keeping this
 * single-source prevents format drift across health indicators.
 */
export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
