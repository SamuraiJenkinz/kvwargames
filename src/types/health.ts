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
