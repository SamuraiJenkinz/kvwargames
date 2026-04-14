import type { StateUpdate } from '@/types/game'

export interface LLMRequest {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
}

export interface LLMResponse {
  text: string
  error?: string
}

// The structured JSON the LLM returns (parsed from text)
export interface PersonaResponse {
  speaker: 'kent' | 'finch' | 'chen'
  message: string
  stateUpdate: StateUpdate | null
  flag: string | null
}

export interface LLMStructuredResponse {
  responses: PersonaResponse[]
  /**
   * Optional control signals from the LLM that trigger a non-blocking facilitator
   * confirmation banner. The banner offers [Advance]/[Enter Debrief]/[Dismiss] — the
   * store never auto-applies these. Only one of advanceRound / triggerDebrief should
   * be set per response; the store resolves conflicts by preferring `triggerDebrief`.
   */
  control?: {
    advanceRound?: boolean
    triggerDebrief?: boolean
  }
}

// ─── Parse result (responseParser.ts — plan 06-05) ───────────────────────────

export type ParseErrorKind = 'PARSE_FAILURE' | 'VALIDATION_FAILURE'

export type ParseResult =
  | { ok: true; value: LLMStructuredResponse }
  | { ok: false; errorKind: ParseErrorKind; raw: string; detail: string }

// ─── LLM client result (llmClient.ts — plan 06-06) ───────────────────────────

export type LLMClientErrorCode =
  | 'LLM_TIMEOUT'
  | 'LLM_AUTH_ERROR'
  | 'LLM_UPSTREAM_ERROR'
  | 'LLM_UNREACHABLE'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'ABORTED'

export type LLMCallResult =
  | { ok: true; text: string }
  | { ok: false; errorCode: LLMClientErrorCode; message: string }

// ─── Shared history entry (contextWindow.ts 06-05 + llmClient.ts 06-06) ──────

/**
 * A single role-tagged message in the rolling LLM conversation history.
 * Consumed by `windowHistory` (contextWindow.ts) and `callLLMProxy` (llmClient.ts).
 * Defined here so 06-06 does not depend on 06-05 at the type level.
 */
export type HistoryEntry = { role: 'user' | 'assistant'; content: string }
