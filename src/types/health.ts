// Frontend-side types for GET /api/health/llm
// Backend authority: backend/app/routers/health.py (Phase 9)
// The endpoint always returns HTTP 200; ok flag carries the signal.

export type HealthStatus = 'checking' | 'ok' | 'failed'

export type LLMHealthErrorCode =
  | 'timeout'
  | 'auth_error'
  | 'not_found'
  | 'rate_limited'
  | 'upstream_error'
  | 'network_error'
  | 'tls_error'
  | 'invalid_response'

export interface LLMHealthOk {
  ok: true
  latencyMs: number
}

export interface LLMHealthFail {
  ok: false
  code: LLMHealthErrorCode
  status: number | null // HTTP upstream status, null for timeout/network/tls
  hint: string
  latencyMs: number
}

export type LLMHealthResponse = LLMHealthOk | LLMHealthFail

// Backend authority: backend/app/routers/health_tts.py (Phase 15 — plan 15-01)
// The endpoint always returns HTTP 200; ok flag carries the signal.
// 8-code taxonomy is IDENTICAL to LLMHealthErrorCode — both health endpoints
// share the same reason codes. Reusing the alias keeps divergence impossible.

export type TTSHealthErrorCode = LLMHealthErrorCode

export interface TTSHealthOk {
  ok: true
  latencyMs: number
}

export interface TTSHealthFail {
  ok: false
  code: TTSHealthErrorCode
  status: number | null
  hint: string
  latencyMs: number
}

export type TTSHealthResponse = TTSHealthOk | TTSHealthFail
