import type { GameConfig } from '@/types/game'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParseError {
  message: string
  line: number
  col: number
  offset: number | null
}

export type ParseResult =
  | { ok: true; value: GameConfig }
  | { ok: false; error: ParseError }

// ─── offsetToLineCol ──────────────────────────────────────────────────────────

/**
 * Converts a 0-based character offset into a 1-based { line, col } position.
 * Handles out-of-bounds offset by clamping to the last character position.
 * Offset 0 → { line: 1, col: 1 }
 */
export function offsetToLineCol(
  text: string,
  offset: number,
): { line: number; col: number } {
  if (text.length === 0) return { line: 1, col: 1 }

  // Clamp offset to valid range
  const clampedOffset = Math.max(0, Math.min(offset, text.length - 1))

  let line = 1
  let col = 1

  for (let i = 0; i < clampedOffset; i++) {
    if (text[i] === '\n') {
      line++
      col = 1
    } else {
      col++
    }
  }

  return { line, col }
}

// ─── parseConfigJson ──────────────────────────────────────────────────────────

/**
 * Parses a JSON string into a GameConfig.
 *
 * Returns { ok: true, value } on success (after minimal structural check),
 * or { ok: false, error } on JSON parse failure or structural validation failure.
 *
 * Structural check: must be an object with a `scenarios` array (length >= 1)
 * and a `teams` array (length >= 1). Deep validation is NOT performed — this
 * is a facilitator tool, not a hostile-input firewall.
 *
 * JSON.parse error offsets are extracted via the V8/modern-browser regex
 * `/at position (\d+)/`. If the regex doesn't match, line/col default to 1,1.
 */
export function parseConfigJson(text: string): ParseResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // Extract offset from V8-style "SyntaxError: Unexpected token } in JSON at position 45"
    const match = /at position (\d+)/.exec(message)
    if (match) {
      const offset = parseInt(match[1], 10)
      const { line, col } = offsetToLineCol(text, offset)
      return {
        ok: false,
        error: { message, line, col, offset },
      }
    }

    return {
      ok: false,
      error: { message, line: 1, col: 1, offset: null },
    }
  }

  // Minimal structural check
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).scenarios) ||
    ((parsed as Record<string, unknown>).scenarios as unknown[]).length < 1 ||
    !Array.isArray((parsed as Record<string, unknown>).teams) ||
    ((parsed as Record<string, unknown>).teams as unknown[]).length < 1
  ) {
    return {
      ok: false,
      error: {
        message: 'Config missing required fields (scenarios, teams)',
        line: 1,
        col: 1,
        offset: null,
      },
    }
  }

  return { ok: true, value: parsed as GameConfig }
}
