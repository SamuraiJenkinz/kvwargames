import type {
  ParseResult,
  LLMStructuredResponse,
  PersonaResponse,
} from '@/types/llm'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Canonical persona ordering for rendering. The parser re-sorts the LLM's
 * `responses` array into this order regardless of what the model returned
 * (Layer 4 normalization).
 */
const PERSONA_ORDER: ReadonlyArray<PersonaResponse['speaker']> = [
  'kent',
  'finch',
  'chen',
] as const

/**
 * Matches markdown code fences at the start or end of a string. Handles:
 *   ```json\n  (opening, language tag optional)
 *   ```        (opening, no language tag)
 *   \n```      (closing, with optional leading whitespace/newline)
 *
 * The `gm` flags let us strip both opening and closing fences in one pass.
 */
const FENCE_PATTERN = /^```(?:json)?\s*\n?|\n?\s*```$/gm

/**
 * Matches the literal word `undefined` used as a JSON value: after `:` or `,`
 * or `[`, surrounded by optional whitespace, and followed by `,` / `}` / `]`
 * / end-of-string. LLMs sometimes emit `"control": undefined` verbatim despite
 * prompt guidance — `undefined` is not valid JSON and crashes JSON.parse, so
 * we rewrite it to `null` before parsing. Intentionally conservative: will not
 * touch the string `"undefined"` (quoted) or `undefined` inside a string value.
 */
const UNDEFINED_VALUE_PATTERN = /([:,\[]\s*)undefined(\s*[,}\]]|\s*$)/g

// ─── Type Guards (Layer 3) ────────────────────────────────────────────────────

function isPersonaResponse(x: unknown): x is PersonaResponse {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>

  // speaker must be one of the three literal strings (case-sensitive)
  if (r.speaker !== 'kent' && r.speaker !== 'finch' && r.speaker !== 'chen') {
    return false
  }

  // message must be a string
  if (typeof r.message !== 'string') return false

  // stateUpdate must be either null or a non-null object (not undefined, not a primitive)
  if (r.stateUpdate !== null) {
    if (typeof r.stateUpdate !== 'object' || r.stateUpdate === null) {
      return false
    }
  }

  // flag must be either null or a string
  if (r.flag !== null && typeof r.flag !== 'string') return false

  return true
}

function isLLMStructuredResponse(x: unknown): x is LLMStructuredResponse {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>

  if (!Array.isArray(r.responses)) return false
  if (r.responses.length < 1 || r.responses.length > 3) return false
  if (!r.responses.every(isPersonaResponse)) return false

  // control is optional; null is treated the same as absent (the Layer 1
  // sanitizer rewrites the literal `undefined` to `null`, and some LLMs emit
  // `"control": null` directly). If a non-null object is present, its
  // optional flags must be booleans.
  if (r.control !== undefined && r.control !== null) {
    if (typeof r.control !== 'object') return false
    const c = r.control as Record<string, unknown>
    if (c.advanceRound !== undefined && typeof c.advanceRound !== 'boolean') {
      return false
    }
    if (
      c.triggerDebrief !== undefined &&
      typeof c.triggerDebrief !== 'boolean'
    ) {
      return false
    }
  }

  return true
}

// ─── parsePersonaResponse ─────────────────────────────────────────────────────

/**
 * Four-layer defensive parser for the LLM's structured JSON response.
 *
 * This function is the ONLY barrier between a malformed LLM output and the
 * game state. It NEVER throws — all failure modes are captured as
 * `{ ok: false, errorKind, raw, detail }` with the original (uncleaned)
 * input preserved in `raw` for diagnostics.
 *
 * Layers:
 *   1. Pre-parse cleanup (BOM, whitespace, markdown fences).
 *   2. JSON.parse inside try/catch → PARSE_FAILURE on throw.
 *   3. Manual type guards (no Zod) → VALIDATION_FAILURE on shape mismatch.
 *   4. Normalization: re-sort responses into Kent/Finch/Chen order and
 *      de-duplicate by speaker (keep first occurrence).
 */
export function parsePersonaResponse(raw: string): ParseResult {
  // Layer 1: Pre-parse cleanup ------------------------------------------------
  let cleaned = raw

  // Strip leading BOM (U+FEFF)
  if (cleaned.charCodeAt(0) === 0xfeff) {
    cleaned = cleaned.slice(1)
  }

  cleaned = cleaned.trim()
  cleaned = cleaned.replace(FENCE_PATTERN, '')
  cleaned = cleaned.trim()
  cleaned = cleaned.replace(UNDEFINED_VALUE_PATTERN, '$1null$2')

  // Layer 2: JSON.parse -------------------------------------------------------
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    return {
      ok: false,
      errorKind: 'PARSE_FAILURE',
      raw,
      detail: err instanceof Error ? err.message : 'JSON parse error',
    }
  }

  // Layer 3: Structural validation --------------------------------------------
  if (!isLLMStructuredResponse(parsed)) {
    return {
      ok: false,
      errorKind: 'VALIDATION_FAILURE',
      raw,
      detail:
        'Parsed JSON does not match LLMStructuredResponse shape (responses: 1-3 valid PersonaResponse entries)',
    }
  }

  // Layer 4: Normalization (sort + de-duplicate) ------------------------------
  const seen = new Set<PersonaResponse['speaker']>()
  const deduped: PersonaResponse[] = []
  for (const r of parsed.responses) {
    if (!seen.has(r.speaker)) {
      seen.add(r.speaker)
      deduped.push(r)
    }
  }

  // Defensive: de-dup should never produce zero entries (Layer 3 enforces
  // responses.length >= 1), but guard regardless.
  if (deduped.length === 0) {
    return {
      ok: false,
      errorKind: 'VALIDATION_FAILURE',
      raw,
      detail: 'All responses collapsed during de-duplication',
    }
  }

  const sorted = deduped.slice().sort((a, b) => {
    return PERSONA_ORDER.indexOf(a.speaker) - PERSONA_ORDER.indexOf(b.speaker)
  })

  const normalized: LLMStructuredResponse = {
    ...parsed,
    responses: sorted,
  }

  return { ok: true, value: normalized }
}
