import { describe, it, expect } from 'vitest'
import {
  windowHistory,
  HISTORY_WINDOW_N,
  type HistoryEntry,
} from './contextWindow'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function u(n: number): HistoryEntry {
  return { role: 'user', content: `u${n}` }
}

function a(n: number): HistoryEntry {
  return { role: 'assistant', content: `a${n}` }
}

/**
 * Builds a history of alternating user/assistant entries: u1,a1,u2,a2,...
 */
function buildAlternating(pairs: number): HistoryEntry[] {
  const out: HistoryEntry[] = []
  for (let i = 1; i <= pairs; i++) {
    out.push(u(i), a(i))
  }
  return out
}

// ─── Constant pin ─────────────────────────────────────────────────────────────

describe('HISTORY_WINDOW_N constant', () => {
  it('equals 6 (pinned — accidental change should fail CI)', () => {
    expect(HISTORY_WINDOW_N).toBe(6)
  })
})

// ─── Basic behaviour ──────────────────────────────────────────────────────────

describe('windowHistory — basic cases', () => {
  it('returns [] for empty history', () => {
    expect(windowHistory([])).toEqual([])
  })

  it('returns single user entry as-is', () => {
    const history: HistoryEntry[] = [u(1)]
    const result = windowHistory(history)
    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('user')
  })

  it('returns exactly 2*N entries when history has exactly 2*N alternating entries', () => {
    const history = buildAlternating(HISTORY_WINDOW_N) // 12 entries
    const result = windowHistory(history)
    expect(result).toHaveLength(2 * HISTORY_WINDOW_N)
    expect(result[0].role).toBe('user')
    expect(result).toEqual(history)
  })

  it('returns full history (no trim) when it fits within the window', () => {
    const history = buildAlternating(3) // 6 entries, N=6 allows 12
    const result = windowHistory(history)
    expect(result).toEqual(history)
  })
})

// ─── Over-cap slicing + pair alignment ───────────────────────────────────────

describe('windowHistory — over-cap with pair alignment', () => {
  it('explicit spec case: 14 alternating entries u1..a7 at N=6 → last 12 entries (u2..a7), starts on user', () => {
    // history: [u1,a1,u2,a2,u3,a3,u4,a4,u5,a5,u6,a6,u7,a7]  (14 entries)
    const history: HistoryEntry[] = [
      u(1), a(1),
      u(2), a(2),
      u(3), a(3),
      u(4), a(4),
      u(5), a(5),
      u(6), a(6),
      u(7), a(7),
    ]
    const result = windowHistory(history, 6)
    // slice(-12) → [u2,a2,u3,a3,u4,a4,u5,a5,u6,a6,u7,a7] — starts on user, length 12
    expect(result).toHaveLength(12)
    expect(result[0]).toEqual(u(2))
    expect(result[result.length - 1]).toEqual(a(7))
    expect(result[0].role).toBe('user')
  })

  it('pair-integrity case: slice(-2N) begins with assistant → drop first entry, length === 2N-1', () => {
    // Construct a history where slice(-12) begins with assistant:
    //   Total length 13, take last 12 → starts on the 2nd entry.
    //   If index 1 (0-based) is assistant, slice(-12) starts on assistant.
    //
    // Build: [a0, u1,a1, u2,a2, ..., u6,a6]  (13 entries: a0 + 6 pairs)
    // slice(-12) = [u1,a1,u2,a2,...,u6,a6] → already starts on user, no drop
    //
    // To force the assistant-start case: [u0, a0, u1, a1, ..., a6] where
    // cutoff lands on an assistant. Simplest: 13 entries where last 12 start
    // with assistant.
    //
    // Example: history = [u1, a1, u1', a1', u2, a2, u3, a3, u4, a4, u5, a5, u6]
    // length = 13, slice(-12) = [a1, u1', a1', u2, a2, u3, a3, u4, a4, u5, a5, u6]
    // → starts with 'assistant' → drop first → length 11.
    const history: HistoryEntry[] = [
      u(1), a(1), u(1), a(1),
      u(2), a(2),
      u(3), a(3),
      u(4), a(4),
      u(5), a(5),
      u(6),
    ]
    expect(history).toHaveLength(13)

    const sliced = history.slice(-12)
    expect(sliced[0].role).toBe('assistant') // sanity check the fixture

    const result = windowHistory(history, 6)
    expect(result).toHaveLength(2 * 6 - 1) // 11
    expect(result[0].role).toBe('user')
  })

  it('2*N + 2 entries → returned slice starts on user', () => {
    // 14 entries alternating u/a → slice(-12) starts on user naturally
    const history = buildAlternating(HISTORY_WINDOW_N + 1) // 14 entries
    const result = windowHistory(history)
    expect(result).toHaveLength(2 * HISTORY_WINDOW_N)
    expect(result[0].role).toBe('user')
  })
})

// ─── Immutability ─────────────────────────────────────────────────────────────

describe('windowHistory — immutability', () => {
  it('does not mutate the input array', () => {
    const history: ReadonlyArray<HistoryEntry> = Object.freeze([
      u(1), a(1), u(2), a(2), u(3), a(3),
    ])
    const snapshot = [...history]
    windowHistory(history as HistoryEntry[], 2)
    expect(history).toEqual(snapshot)
    expect(history.length).toBe(6)
  })
})

// ─── Custom N ────────────────────────────────────────────────────────────────

describe('windowHistory — custom n', () => {
  it('n = 3 returns at most 6 entries', () => {
    const history = buildAlternating(10) // 20 entries
    const result = windowHistory(history, 3)
    expect(result.length).toBeLessThanOrEqual(6)
    expect(result).toHaveLength(6)
    expect(result[0].role).toBe('user')
  })

  it('n = 1 returns at most 2 entries', () => {
    const history = buildAlternating(5)
    const result = windowHistory(history, 1)
    expect(result.length).toBeLessThanOrEqual(2)
    expect(result).toHaveLength(2)
    expect(result[0].role).toBe('user')
  })

  it('n = 0 returns empty array', () => {
    const history = buildAlternating(5)
    const result = windowHistory(history, 0)
    expect(result).toEqual([])
  })
})

// ─── Invariant sweep ─────────────────────────────────────────────────────────

describe('windowHistory — invariant: result.length <= 2*n AND (empty OR starts on user)', () => {
  const fixtures: Array<[string, HistoryEntry[], number]> = [
    ['empty', [], 6],
    ['single user', [u(1)], 6],
    ['single assistant', [a(1)], 6],
    ['one pair', [u(1), a(1)], 6],
    ['exact fit', buildAlternating(6), 6],
    ['over cap even', buildAlternating(10), 6],
    ['over cap odd start', [a(0), ...buildAlternating(10)], 6],
    ['custom n=2', buildAlternating(10), 2],
    ['custom n=4', buildAlternating(10), 4],
  ]

  for (const [label, history, n] of fixtures) {
    it(`${label}: |result| <= 2n and starts-on-user invariant holds`, () => {
      const result = windowHistory(history, n)
      expect(result.length).toBeLessThanOrEqual(2 * n)
      if (result.length > 0) {
        expect(result[0].role).toBe('user')
      }
    })
  }
})
