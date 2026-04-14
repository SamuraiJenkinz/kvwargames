import type { GameConfig } from '@/types/game'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationError {
  /** Dot/bracket path to the offending field, e.g. "scenarios[0].injects", "teams[1].pc", "(root)". */
  path: string
  /** Human-readable message describing why the field failed validation. */
  message: string
}

export type ValidationResult =
  | { ok: true; value: GameConfig }
  | { ok: false; errors: ValidationError[] }

// ─── validateGameConfig ───────────────────────────────────────────────────────

/**
 * Deep field-level validator for a parsed GameConfig candidate.
 *
 * Scope (v1 — per Phase 7 CONTEXT.md):
 * - Required string fields: `name`, `pcThresholds`
 * - `scenarios[]` non-empty; each scenario must have an `injects[]` array
 * - `teams[]` non-empty; each team's `pc`/`po`/`readiness` must be numbers
 *   (type check only — range validation deferred to Phase 8 boundary-value suite)
 * - `cards[]` each card must have `id`/`name`/`cat`/`timing`/`effect` strings
 * - `nationalActions[]` each action must have `id`/`name`/`summary` strings
 *
 * Notes:
 * - `crisisState` enum membership NOT validated here — LLM briefs emit non-canonical
 *   values ("Heightened Alert", "Alert", etc.) that render as fallback badges in the UI
 *   without crashing. Lenient by design; tighten in Phase 8 if needed.
 * - `cat` on GameCard is free-form string per spec — NOT validated against an allowlist.
 * - `teams[].po` type check accepts 3 (out of -2..2 range) because v1 scope is types
 *   only; range validation is Phase 8.
 * - Optional-field type checking (description, objective, domain, etc.) deferred to
 *   Phase 8 QA boundary-value suite.
 * - Array items that are not objects short-circuit per-field checks to avoid noise.
 */
export function validateGameConfig(parsed: unknown): ValidationResult {
  const errors: ValidationError[] = []

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, errors: [{ path: '(root)', message: 'expected object' }] }
  }
  const cfg = parsed as Record<string, unknown>

  // ── name ──────────────────────────────────────────────────────────────────
  if (typeof cfg.name !== 'string' || cfg.name.trim() === '') {
    errors.push({
      path: 'name',
      message: `required non-empty string, got ${JSON.stringify(cfg.name)}`,
    })
  }

  // ── pcThresholds ──────────────────────────────────────────────────────────
  if (typeof cfg.pcThresholds !== 'string' || cfg.pcThresholds.trim() === '') {
    errors.push({ path: 'pcThresholds', message: 'required non-empty string' })
  }

  // ── scenarios ─────────────────────────────────────────────────────────────
  if (!Array.isArray(cfg.scenarios) || cfg.scenarios.length === 0) {
    errors.push({ path: 'scenarios', message: 'required non-empty array' })
  } else {
    ;(cfg.scenarios as unknown[]).forEach((sc, si) => {
      if (typeof sc !== 'object' || sc === null || Array.isArray(sc)) {
        errors.push({ path: `scenarios[${si}]`, message: 'expected object' })
        return
      }
      const s = sc as Record<string, unknown>
      if (!Array.isArray(s.injects)) {
        errors.push({ path: `scenarios[${si}].injects`, message: 'required array' })
      }
    })
  }

  // ── teams ─────────────────────────────────────────────────────────────────
  if (!Array.isArray(cfg.teams) || cfg.teams.length === 0) {
    errors.push({ path: 'teams', message: 'required non-empty array' })
  } else {
    ;(cfg.teams as unknown[]).forEach((tm, ti) => {
      if (typeof tm !== 'object' || tm === null || Array.isArray(tm)) {
        errors.push({ path: `teams[${ti}]`, message: 'expected object' })
        return
      }
      const t = tm as Record<string, unknown>
      // Type-only check for numerics; range validation (pc 0–6, po -2..2, readiness 0–5)
      // is deferred to Phase 8 boundary-value suite.
      const numFields: { key: string; min: number; max: number }[] = [
        { key: 'pc', min: 0, max: 6 },
        { key: 'po', min: -2, max: 2 },
        { key: 'readiness', min: 0, max: 5 },
      ]
      for (const { key, min, max } of numFields) {
        if (typeof t[key] !== 'number') {
          errors.push({
            path: `teams[${ti}].${key}`,
            message: `expected number ${min}–${max}, got ${JSON.stringify(t[key])}`,
          })
        }
      }
    })
  }

  // ── cards ─────────────────────────────────────────────────────────────────
  if (!Array.isArray(cfg.cards)) {
    errors.push({ path: 'cards', message: 'required array' })
  } else {
    ;(cfg.cards as unknown[]).forEach((c, ci) => {
      if (typeof c !== 'object' || c === null || Array.isArray(c)) {
        errors.push({ path: `cards[${ci}]`, message: 'expected object' })
        return
      }
      const card = c as Record<string, unknown>
      for (const field of ['id', 'name', 'cat', 'timing', 'effect'] as const) {
        if (typeof card[field] !== 'string') {
          errors.push({ path: `cards[${ci}].${field}`, message: 'required string' })
        }
      }
    })
  }

  // ── nationalActions ───────────────────────────────────────────────────────
  if (!Array.isArray(cfg.nationalActions)) {
    errors.push({ path: 'nationalActions', message: 'required array' })
  } else {
    ;(cfg.nationalActions as unknown[]).forEach((na, ni) => {
      if (typeof na !== 'object' || na === null || Array.isArray(na)) {
        errors.push({ path: `nationalActions[${ni}]`, message: 'expected object' })
        return
      }
      const a = na as Record<string, unknown>
      for (const field of ['id', 'name', 'summary'] as const) {
        if (typeof a[field] !== 'string') {
          errors.push({ path: `nationalActions[${ni}].${field}`, message: 'required string' })
        }
      }
    })
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: parsed as GameConfig }
}
