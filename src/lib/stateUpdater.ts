import type { GameState, StateUpdate, TeamState } from '@/types/game'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Entry recorded whenever an incoming value was outside the allowed range and
 * had to be clamped. The store forwards these to the dev console so LLM drift
 * is visible without surfacing to end users (CONTEXT.md "clamping is silent
 * but logged").
 */
export interface ClampLog {
  field: string // e.g. 'crisisSeverity' or 'teams[A].pc'
  raw: number
  clamped: number
}

// ─── Canonical clamp ranges ──────────────────────────────────────────────────

/**
 * Single source of truth for numeric field bounds. Values match the inline
 * clamps previously embedded in gameStore.applyStateUpdate; extracted here so
 * tests can pin boundary behaviour and Plan 06-07 can swap the store over to
 * this module without duplicating magic numbers.
 */
export const CLAMP_RANGES = {
  crisisSeverity: [0, 5],
  edipLegitimacy: [-2, 2],
  pc: [0, 6],
  po: [-2, 2],
  readiness: [0, 5],
  stock: [0, 99],
  crm: [0, 99],
  ic: [0, 99],
} as const

type ClampRangeKey = keyof typeof CLAMP_RANGES
type TeamClampKey = Extract<ClampRangeKey, 'pc' | 'po' | 'readiness' | 'stock' | 'crm' | 'ic'>

const TEAM_CLAMP_FIELDS: readonly TeamClampKey[] = [
  'pc',
  'po',
  'readiness',
  'stock',
  'crm',
  'ic',
] as const

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Clamp a numeric value against its range, pushing a ClampLog entry when the
 * value had to be adjusted. Returns the value the caller should actually
 * assign (raw if in range, clamped if not).
 */
function clampField(
  raw: number,
  range: readonly [number, number],
  fieldPath: string,
  clampLog: ClampLog[],
): number {
  const [min, max] = range
  const clamped = Math.max(min, Math.min(max, raw))
  if (clamped !== raw) {
    clampLog.push({ field: fieldPath, raw, clamped })
  }
  return clamped
}

/**
 * Apply a single team update in-place on the already-cloned team object.
 * Only fields present on `tu` (non-null, non-undefined) are written; each
 * numeric field is clamped via `clampField` with a `teams[ID].field` path.
 */
function applyTeamUpdate(
  team: TeamState,
  tu: Partial<TeamState & { id: string }>,
  clampLog: ClampLog[],
): void {
  for (const field of TEAM_CLAMP_FIELDS) {
    const value = tu[field]
    if (value == null) continue
    team[field] = clampField(value, CLAMP_RANGES[field], `teams[${team.id}].${field}`, clampLog)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Apply a StateUpdate payload to a GameState without mutating the input.
 *
 * - Top-level numeric fields (crisisSeverity, edipLegitimacy) are clamped to
 *   CLAMP_RANGES; out-of-range values produce ClampLog entries.
 * - `crisisState` is a string enum and passes through unclamped.
 * - `teamUpdates` match teams by `id`, never by array index (STATE-02).
 *   Unknown IDs are silently skipped with no clampLog entry.
 * - `null`/`undefined`/missing fields are no-ops (STATE-03) — only keys
 *   actually present on the payload mutate state.
 * - Returns a new state reference and a fresh `teams` array; the input is
 *   never touched (verified via `structuredClone`).
 *
 * Plan 06-07 calls this inside the store's atomic `set()` and forwards
 * `clampLog` to the dev console.
 */
export function applyStateUpdatePure(
  state: GameState,
  update: StateUpdate,
): { nextState: GameState; clampLog: ClampLog[] } {
  const nextState = structuredClone(state)
  const clampLog: ClampLog[] = []

  if (update.crisisSeverity != null) {
    nextState.crisisSeverity = clampField(
      update.crisisSeverity,
      CLAMP_RANGES.crisisSeverity,
      'crisisSeverity',
      clampLog,
    )
  }

  if (update.crisisState != null) {
    nextState.crisisState = update.crisisState
  }

  if (update.edipLegitimacy != null) {
    nextState.edipLegitimacy = clampField(
      update.edipLegitimacy,
      CLAMP_RANGES.edipLegitimacy,
      'edipLegitimacy',
      clampLog,
    )
  }

  if (update.teamUpdates) {
    for (const tu of update.teamUpdates) {
      const team = nextState.teams.find((t) => t.id === tu.id)
      if (!team) continue // STATE-02: unknown team ID → silent skip
      applyTeamUpdate(team, tu, clampLog)
    }
  }

  return { nextState, clampLog }
}
