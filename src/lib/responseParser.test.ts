import { describe, it, expect } from 'vitest'
import { parsePersonaResponse } from './responseParser'
import type { PersonaResponse } from '@/types/llm'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePersona(
  speaker: PersonaResponse['speaker'],
  overrides: Partial<PersonaResponse> = {},
): PersonaResponse {
  return {
    speaker,
    message: `${speaker} says something`,
    stateUpdate: null,
    flag: null,
    ...overrides,
  }
}

// ─── Happy paths ──────────────────────────────────────────────────────────────

describe('parsePersonaResponse — happy paths', () => {
  it('parses valid JSON with a single persona', () => {
    const raw = JSON.stringify({ responses: [makePersona('kent')] })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.responses).toHaveLength(1)
      expect(result.value.responses[0].speaker).toBe('kent')
    }
  })

  it('parses valid JSON with 3 personas and re-sorts into Kent/Finch/Chen order', () => {
    const raw = JSON.stringify({
      responses: [
        makePersona('chen'),
        makePersona('finch'),
        makePersona('kent'),
      ],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.responses.map((r) => r.speaker)).toEqual([
        'kent',
        'finch',
        'chen',
      ])
    }
  })

  it('preserves stateUpdate object payload', () => {
    const raw = JSON.stringify({
      responses: [
        makePersona('kent', {
          // Arbitrary JSON payload for the parser's round-trip preservation test —
          // the parser does not validate the inner shape of stateUpdate beyond
          // "non-null object", so we cast through unknown.
          stateUpdate: {
            teams: { team1: { po: { legitimacy: 2 } } },
          } as unknown as PersonaResponse['stateUpdate'],
        }),
      ],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.responses[0].stateUpdate).toEqual({
        teams: { team1: { po: { legitimacy: 2 } } },
      })
    }
  })

  it('preserves optional control.advanceRound = true', () => {
    const raw = JSON.stringify({
      responses: [makePersona('kent')],
      control: { advanceRound: true },
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.control?.advanceRound).toBe(true)
    }
  })

  it('preserves optional control.triggerDebrief = true', () => {
    const raw = JSON.stringify({
      responses: [makePersona('kent')],
      control: { triggerDebrief: true },
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.control?.triggerDebrief).toBe(true)
    }
  })

  it('accepts string flag field', () => {
    const raw = JSON.stringify({
      responses: [makePersona('kent', { flag: 'RULE_CHALLENGE' })],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
  })

  it('accepts null stateUpdate and null flag', () => {
    const raw = JSON.stringify({
      responses: [makePersona('kent', { stateUpdate: null, flag: null })],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
  })
})

// ─── Layer 1: Markdown fence + BOM stripping ─────────────────────────────────

describe('parsePersonaResponse — Layer 1 cleanup', () => {
  it('strips markdown fence with json tag', () => {
    const inner = JSON.stringify({ responses: [makePersona('kent')] })
    const raw = '```json\n' + inner + '\n```'
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
  })

  it('strips markdown fence without json tag', () => {
    const inner = JSON.stringify({ responses: [makePersona('kent')] })
    const raw = '```\n' + inner + '\n```'
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
  })

  it('strips leading BOM (U+FEFF)', () => {
    const inner = JSON.stringify({ responses: [makePersona('kent')] })
    const raw = '\uFEFF' + inner
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
  })

  it('strips BOM + fence + surrounding whitespace all together', () => {
    const inner = JSON.stringify({ responses: [makePersona('kent')] })
    const raw = '\uFEFF   \n```json\n' + inner + '\n```   '
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
  })

  // Regression: LLMs sometimes emit `"control": undefined` verbatim from
  // reading "| undefined" in the schema. The sanitizer rewrites the literal
  // `undefined` to `null` before JSON.parse so the rest of the response
  // (including stateUpdate) is preserved instead of being discarded as
  // PARSE_FAILURE.
  it('rewrites literal `undefined` to null so the response parses', () => {
    const raw = `{
      "responses": [
        { "speaker": "chen",
          "message": "Team B spends 1 PC.",
          "stateUpdate": { "teamUpdates": [{ "id": "teamB", "pc": 2 }] },
          "flag": null }
      ],
      "control": undefined
    }`
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.responses[0].stateUpdate).toEqual({
        teamUpdates: [{ id: 'teamB', pc: 2 }],
      })
    }
  })

  it('does not rewrite the quoted string "undefined" inside a message', () => {
    const inner = JSON.stringify({
      responses: [
        {
          speaker: 'kent',
          message: 'The value was "undefined" in the source data.',
          stateUpdate: null,
          flag: null,
        },
      ],
    })
    const result = parsePersonaResponse(inner)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.responses[0].message).toContain('"undefined"')
    }
  })
})

// ─── Layer 2: JSON.parse failures ─────────────────────────────────────────────

describe('parsePersonaResponse — Layer 2 (JSON parse failures)', () => {
  it('returns PARSE_FAILURE for empty string', () => {
    const result = parsePersonaResponse('')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('PARSE_FAILURE')
      expect(result.raw).toBe('')
    }
  })

  it('returns PARSE_FAILURE for malformed JSON (missing brace)', () => {
    const raw = '{ "responses": [ { "speaker": "kent" '
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('PARSE_FAILURE')
      // raw field preserves the ORIGINAL (uncleaned) input
      expect(result.raw).toBe(raw)
    }
  })

  it('returns PARSE_FAILURE for non-JSON prose', () => {
    const raw = 'I cannot comply with that request.'
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('PARSE_FAILURE')
      expect(result.raw).toBe(raw)
    }
  })
})

// ─── Layer 3: Structural validation failures ─────────────────────────────────

describe('parsePersonaResponse — Layer 3 (validation failures)', () => {
  it('rejects JSON missing responses field', () => {
    const raw = JSON.stringify({ foo: 'bar' })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('VALIDATION_FAILURE')
    }
  })

  it('rejects empty responses array (length < 1)', () => {
    const raw = JSON.stringify({ responses: [] })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('VALIDATION_FAILURE')
    }
  })

  it('rejects responses array of length 4', () => {
    const raw = JSON.stringify({
      responses: [
        makePersona('kent'),
        makePersona('finch'),
        makePersona('chen'),
        makePersona('kent'),
      ],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('VALIDATION_FAILURE')
    }
  })

  it('rejects wrong-case speaker "KENT"', () => {
    const raw = JSON.stringify({
      responses: [{ speaker: 'KENT', message: 'hi', stateUpdate: null, flag: null }],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('VALIDATION_FAILURE')
    }
  })

  it('rejects unknown speaker "sam"', () => {
    const raw = JSON.stringify({
      responses: [{ speaker: 'sam', message: 'hi', stateUpdate: null, flag: null }],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('VALIDATION_FAILURE')
    }
  })

  it('rejects numeric message', () => {
    const raw = JSON.stringify({
      responses: [{ speaker: 'kent', message: 42, stateUpdate: null, flag: null }],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('VALIDATION_FAILURE')
    }
  })

  it('rejects missing stateUpdate (undefined, not null)', () => {
    // stateUpdate must be null or an object, NOT undefined
    const raw = JSON.stringify({
      responses: [{ speaker: 'kent', message: 'hi', flag: null }],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('VALIDATION_FAILURE')
    }
  })

  it('accepts null stateUpdate', () => {
    const raw = JSON.stringify({
      responses: [{ speaker: 'kent', message: 'hi', stateUpdate: null, flag: null }],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
  })

  it('accepts null flag', () => {
    const raw = JSON.stringify({
      responses: [{ speaker: 'kent', message: 'hi', stateUpdate: null, flag: null }],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
  })

  it('rejects numeric flag', () => {
    const raw = JSON.stringify({
      responses: [{ speaker: 'kent', message: 'hi', stateUpdate: null, flag: 123 }],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('VALIDATION_FAILURE')
    }
  })

  it('rejects non-boolean control.advanceRound ("yes")', () => {
    const raw = JSON.stringify({
      responses: [makePersona('kent')],
      control: { advanceRound: 'yes' },
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorKind).toBe('VALIDATION_FAILURE')
    }
  })

  it('rejects non-object control (string)', () => {
    const raw = JSON.stringify({
      responses: [makePersona('kent')],
      control: 'advance',
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(false)
  })

  it('preserves raw on validation failures', () => {
    const raw = JSON.stringify({ responses: [] })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.raw).toBe(raw)
    }
  })
})

// ─── Layer 4: Normalization (sort + dedupe) ──────────────────────────────────

describe('parsePersonaResponse — Layer 4 normalization', () => {
  it('de-duplicates responses by speaker, keeping first occurrence', () => {
    const raw = JSON.stringify({
      responses: [
        makePersona('kent', { message: 'first kent' }),
        makePersona('kent', { message: 'second kent' }),
      ],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.responses).toHaveLength(1)
      expect(result.value.responses[0].message).toBe('first kent')
    }
  })

  it('preserves sort when input is already in canonical order', () => {
    const raw = JSON.stringify({
      responses: [
        makePersona('kent'),
        makePersona('finch'),
        makePersona('chen'),
      ],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.responses.map((r) => r.speaker)).toEqual([
        'kent',
        'finch',
        'chen',
      ])
    }
  })

  it('sorts 2 personas given in reverse order', () => {
    const raw = JSON.stringify({
      responses: [makePersona('chen'), makePersona('kent')],
    })
    const result = parsePersonaResponse(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.responses.map((r) => r.speaker)).toEqual([
        'kent',
        'chen',
      ])
    }
  })
})

// ─── Never-throws invariant ──────────────────────────────────────────────────

describe('parsePersonaResponse — never throws', () => {
  const cases: Array<[string, string]> = [
    ['empty string', ''],
    ['whitespace only', '   \n\t  '],
    ['non-JSON prose', 'hello world'],
    ['truncated JSON', '{"responses":['],
    ['BOM only', '\uFEFF'],
    ['fence only', '```json\n```'],
    ['nested nonsense', JSON.stringify({ responses: [[[null]]] })],
    ['null top-level', 'null'],
    ['array top-level', '[]'],
    ['number top-level', '42'],
    ['boolean top-level', 'true'],
    ['deeply nested object', JSON.stringify({ a: { b: { c: 1 } } })],
  ]

  for (const [label, input] of cases) {
    it(`does not throw on ${label}`, () => {
      expect(() => parsePersonaResponse(input)).not.toThrow()
    })
  }
})
