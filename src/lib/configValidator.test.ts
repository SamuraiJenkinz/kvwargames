import { describe, it, expect } from 'vitest'
import { validateGameConfig } from './configValidator'
import { EDIP_CONFIG } from '@/data/edipConfig'

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns a deep clone of EDIP_CONFIG cast to Record<string,unknown> for
 * mutation-in-test patterns.  Uses structuredClone (native, Node 17+) to
 * produce a plain-object copy free of any Immer / as-const narrowing concerns.
 */
function cloneValid(): Record<string, unknown> {
  return structuredClone(EDIP_CONFIG as unknown as Record<string, unknown>)
}

// ─── Group 1: Happy path ──────────────────────────────────────────────────────

describe('validateGameConfig — Group 1: happy path', () => {
  it('returns ok:true with value === input on valid EDIP_CONFIG', () => {
    const result = validateGameConfig(EDIP_CONFIG as unknown)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.name).toBe('EDIP Security of Supply Wargame')
      expect(result.value.scenarios.length).toBeGreaterThan(0)
      expect(result.value.teams.length).toBeGreaterThan(0)
      expect(result.value.cards.length).toBeGreaterThan(0)
      expect(result.value.nationalActions.length).toBeGreaterThan(0)
      expect(typeof result.value.pcThresholds).toBe('string')
    }
  })
})

// ─── Group 2: Top-level type failures ────────────────────────────────────────

describe('validateGameConfig — Group 2: top-level type failures', () => {
  it('rejects null with (root) expected object error', () => {
    const result = validateGameConfig(null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContainEqual({ path: '(root)', message: 'expected object' })
    }
  })

  it('rejects a string with (root) expected object error', () => {
    const result = validateGameConfig('string')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContainEqual({ path: '(root)', message: 'expected object' })
    }
  })

  it('rejects an array with (root) expected object error', () => {
    const result = validateGameConfig([])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContainEqual({ path: '(root)', message: 'expected object' })
    }
  })

  it('rejects a number with (root) expected object error', () => {
    const result = validateGameConfig(42)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContainEqual({ path: '(root)', message: 'expected object' })
    }
  })
})

// ─── Group 3: Single missing required top-level fields ────────────────────────

describe('validateGameConfig — Group 3: missing required top-level fields', () => {
  it('errors on missing name', () => {
    const cfg = cloneValid()
    delete cfg.name
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'name')).toBe(true)
    }
  })

  it('errors on empty name string', () => {
    const cfg = cloneValid()
    cfg.name = ''
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'name')).toBe(true)
    }
  })

  it('errors on missing pcThresholds', () => {
    const cfg = cloneValid()
    delete cfg.pcThresholds
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'pcThresholds')).toBe(true)
    }
  })

  it('errors on missing scenarios', () => {
    const cfg = cloneValid()
    delete cfg.scenarios
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'scenarios')).toBe(true)
    }
  })

  it('errors on missing teams', () => {
    const cfg = cloneValid()
    delete cfg.teams
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'teams')).toBe(true)
    }
  })

  it('errors on missing cards', () => {
    const cfg = cloneValid()
    delete cfg.cards
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'cards')).toBe(true)
    }
  })

  it('errors on missing nationalActions', () => {
    const cfg = cloneValid()
    delete cfg.nationalActions
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'nationalActions')).toBe(true)
    }
  })
})

// ─── Group 4: Empty arrays ────────────────────────────────────────────────────

describe('validateGameConfig — Group 4: empty arrays', () => {
  it('errors when scenarios is empty array', () => {
    const cfg = cloneValid()
    cfg.scenarios = []
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        path: 'scenarios',
        message: 'required non-empty array',
      })
    }
  })

  it('errors when teams is empty array', () => {
    const cfg = cloneValid()
    cfg.teams = []
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        path: 'teams',
        message: 'required non-empty array',
      })
    }
  })

  it('does NOT error when cards is empty array (v1 scope: array required, not non-empty)', () => {
    const cfg = cloneValid()
    cfg.cards = []
    const result = validateGameConfig(cfg)
    // cards array is required but empty array is allowed in v1 scope
    // only check that no "cards" error is in the result
    if (!result.ok) {
      expect(result.errors.every((e) => e.path !== 'cards')).toBe(true)
    }
    // If result is ok, that's fine too (cards just being empty doesn't break it)
  })
})

// ─── Group 5: Field-level scenario errors ────────────────────────────────────

describe('validateGameConfig — Group 5: field-level scenario errors', () => {
  it('errors when scenario has no injects field', () => {
    const cfg = cloneValid()
    cfg.scenarios = [{}]
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'scenarios[0].injects')).toBe(true)
    }
  })

  it('errors when scenario.injects is not an array', () => {
    const cfg = cloneValid()
    cfg.scenarios = [{ injects: 'not-array' }]
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'scenarios[0].injects')).toBe(true)
    }
  })

  it('errors scenarios[0] expected object when scenario item is a string (no cascade)', () => {
    const cfg = cloneValid()
    cfg.scenarios = ['not an object']
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'scenarios[0]')).toBe(true)
      // Must NOT cascade to scenarios[0].injects — short-circuit on non-object
      expect(result.errors.every((e) => e.path !== 'scenarios[0].injects')).toBe(true)
    }
  })

  it('errors only at scenarios[1].injects when second scenario lacks injects', () => {
    const cfg = cloneValid()
    const scenario0 = (cfg.scenarios as unknown[])[0] // valid scenario
    cfg.scenarios = [scenario0, {}] // second scenario missing injects
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      // Must have exactly one injects error, at index 1
      const injectErrors = result.errors.filter((e) => e.path.includes('.injects'))
      expect(injectErrors).toHaveLength(1)
      expect(injectErrors[0].path).toBe('scenarios[1].injects')
    }
  })
})

// ─── Group 6: Field-level team errors ────────────────────────────────────────

describe('validateGameConfig — Group 6: field-level team errors', () => {
  it('errors teams[0].pc when pc is a string', () => {
    const cfg = cloneValid()
    cfg.teams = [{ pc: 'strong', po: 0, readiness: 3 }]
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const pcError = result.errors.find((e) => e.path === 'teams[0].pc')
      expect(pcError).toBeDefined()
      expect(pcError?.message).toContain('got "strong"')
    }
  })

  it('does NOT error teams[0].po when po is 3 (out of range but type is correct — range deferred to Phase 8)', () => {
    // v1 scope: type check only. po:3 is out of the -2..2 range spec, but the
    // validator only checks typeof. Range enforcement is Phase 8.
    const cfg = cloneValid()
    cfg.teams = [{ pc: 3, po: 3, readiness: 3 }]
    const result = validateGameConfig(cfg)
    if (!result.ok) {
      // po should NOT be an error (type is number, which passes the type check)
      expect(result.errors.every((e) => e.path !== 'teams[0].po')).toBe(true)
    }
    // Result may be ok (no other errors) — that's valid too
  })

  it('errors all three numeric fields when team is missing all of them', () => {
    const cfg = cloneValid()
    cfg.teams = [{ id: 'A' }]
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'teams[0].pc')).toBe(true)
      expect(result.errors.some((e) => e.path === 'teams[0].po')).toBe(true)
      expect(result.errors.some((e) => e.path === 'teams[0].readiness')).toBe(true)
    }
  })

  it('errors teams[0] expected object for non-object team item (no cascade to per-field errors)', () => {
    const cfg = cloneValid()
    cfg.teams = ['not-object']
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'teams[0]')).toBe(true)
      // Must NOT cascade
      expect(result.errors.every((e) => e.path !== 'teams[0].pc')).toBe(true)
      expect(result.errors.every((e) => e.path !== 'teams[0].po')).toBe(true)
      expect(result.errors.every((e) => e.path !== 'teams[0].readiness')).toBe(true)
    }
  })
})

// ─── Group 7: Cards / nationalActions shape ───────────────────────────────────

describe('validateGameConfig — Group 7: cards and nationalActions shape', () => {
  it('errors missing name/cat/timing/effect when card only has id', () => {
    const cfg = cloneValid()
    cfg.cards = [{ id: 'C-01' }]
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'cards[0].name')).toBe(true)
      expect(result.errors.some((e) => e.path === 'cards[0].cat')).toBe(true)
      expect(result.errors.some((e) => e.path === 'cards[0].timing')).toBe(true)
      expect(result.errors.some((e) => e.path === 'cards[0].effect')).toBe(true)
    }
  })

  it('accepts a card with all required fields present', () => {
    const cfg = cloneValid()
    // Replace cards with a single minimal valid card (req field is optional in v1 validator)
    cfg.cards = [{ id: 'C-01', name: 'X', cat: 'Y', timing: 'Z', effect: 'E' }]
    const result = validateGameConfig(cfg)
    // Should not produce any cards errors
    if (!result.ok) {
      const cardErrors = result.errors.filter((e) => e.path.startsWith('cards['))
      expect(cardErrors).toHaveLength(0)
    }
  })

  it('errors missing name and summary when nationalAction only has id', () => {
    const cfg = cloneValid()
    cfg.nationalActions = [{ id: 'NA-01' }]
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'nationalActions[0].name')).toBe(true)
      expect(result.errors.some((e) => e.path === 'nationalActions[0].summary')).toBe(true)
    }
  })
})

// ─── Group 8: Multiple errors accumulate (no short-circuit at top level) ──────

describe('validateGameConfig — Group 8: multiple errors accumulate', () => {
  it('collects errors for missing name, pcThresholds, and scenarios simultaneously', () => {
    const cfg = cloneValid()
    delete cfg.name
    delete cfg.pcThresholds
    delete cfg.scenarios
    const result = validateGameConfig(cfg)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(3)
      expect(result.errors.some((e) => e.path === 'name')).toBe(true)
      expect(result.errors.some((e) => e.path === 'pcThresholds')).toBe(true)
      expect(result.errors.some((e) => e.path === 'scenarios')).toBe(true)
    }
  })
})
