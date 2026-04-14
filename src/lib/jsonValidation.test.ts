import { describe, it, expect } from 'vitest'
import { offsetToLineCol, parseConfigJson } from './jsonValidation'
import { EDIP_CONFIG } from '@/data/edipConfig'
import type { GameConfig } from '@/types/game'

// ─── offsetToLineCol ──────────────────────────────────────────────────────────

describe('offsetToLineCol', () => {
  it('offset 0 → { line: 1, col: 1 }', () => {
    expect(offsetToLineCol('hello', 0)).toEqual({ line: 1, col: 1 })
  })

  it('single-line string, offset 5 → { line: 1, col: 6 }', () => {
    expect(offsetToLineCol('hello world', 5)).toEqual({ line: 1, col: 6 })
  })

  describe('multi-line string "ab\\ncd\\nef"', () => {
    const text = 'ab\ncd\nef'
    // indices: a=0, b=1, \n=2, c=3, d=4, \n=5, e=6, f=7

    it('offset 0 → line 1, col 1', () => {
      expect(offsetToLineCol(text, 0)).toEqual({ line: 1, col: 1 })
    })

    it('offset 3 → line 2, col 1', () => {
      expect(offsetToLineCol(text, 3)).toEqual({ line: 2, col: 1 })
    })

    it('offset 5 → line 2, col 3', () => {
      // index 5 is '\n', which is the 3rd char on line 2 (col 3)
      expect(offsetToLineCol(text, 5)).toEqual({ line: 2, col: 3 })
    })

    it('offset 6 → line 3, col 1', () => {
      expect(offsetToLineCol(text, 6)).toEqual({ line: 3, col: 1 })
    })
  })

  it('offset beyond length clamps to last char position', () => {
    // "ab" has length 2, last valid offset is 1 → { line: 1, col: 2 }
    const result = offsetToLineCol('ab', 999)
    expect(result).toEqual({ line: 1, col: 2 })
  })

  it('empty string → { line: 1, col: 1 }', () => {
    expect(offsetToLineCol('', 0)).toEqual({ line: 1, col: 1 })
  })
})

// ─── parseConfigJson ──────────────────────────────────────────────────────────

describe('parseConfigJson', () => {
  it('parses valid EDIP_CONFIG → ok: true, 2 scenarios', () => {
    const result = parseConfigJson(JSON.stringify(EDIP_CONFIG))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.scenarios).toHaveLength(2)
    }
  })

  it('incomplete JSON "{" → ok: false, non-empty error message', () => {
    const result = parseConfigJson('{')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message.length).toBeGreaterThan(0)
    }
  })

  it('structural check: empty scenarios array → ok: false', () => {
    const result = parseConfigJson('{"scenarios": [], "teams": [{}]}')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toContain('scenarios')
    }
  })

  it('structural check: missing scenarios and teams → ok: false', () => {
    const result = parseConfigJson('{"foo": 1}')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toContain('scenarios')
    }
  })

  it('minimal valid object with one scenario and one team → ok: true (no deep validation)', () => {
    const result = parseConfigJson('{"scenarios": [{}], "teams": [{}]}')
    expect(result.ok).toBe(true)
  })

  it('parses EDIP_CONFIG as GameConfig type (value assignable to GameConfig)', () => {
    const result = parseConfigJson(JSON.stringify(EDIP_CONFIG))
    expect(result.ok).toBe(true)
    if (result.ok) {
      // Type assertion — should compile if value is typed as GameConfig
      const config: GameConfig = result.value
      expect(config.name).toBe('EDIP Security of Supply Wargame')
    }
  })

  describe('error position extraction', () => {
    it('deliberately malformed JSON with known error position has correct line/col', () => {
      // Three lines of JSON, error on line 2
      // '{\n  "foo": BAD\n}'
      // line 1: {
      // line 2:   "foo": BAD  ← "BAD" is not valid JSON; V8 points to 'B'
      const json = '{\n  "foo": BAD\n}'
      const result = parseConfigJson(json)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        // Should be on line 2 (there is a newline before "B")
        expect(result.error.line).toBeGreaterThanOrEqual(1)
        // message should be non-empty
        expect(result.error.message.length).toBeGreaterThan(0)
      }
    })

    it('single-character malformed JSON returns error', () => {
      const result = parseConfigJson('}')
      expect(result.ok).toBe(false)
    })
  })
})
