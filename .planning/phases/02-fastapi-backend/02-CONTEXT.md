# Phase 2: FastAPI Backend - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Credential proxy backend: two POST endpoints (`/api/llm`, `/api/generate-config`), static file serving for the React SPA, and environment-based configuration. All LLM credentials stay server-side. No business logic beyond forwarding requests with injected credentials.

</domain>

<decisions>
## Implementation Decisions

### Error responses
- All error responses use a consistent JSON shape: `{"error": {"code": string, "message": string}}` — frontend can pattern-match on `code`
- Status codes map directly to cause:
  - `400` — malformed request body (missing fields, wrong types)
  - `401` — API key missing or rejected by upstream LLM
  - `502` — upstream LLM returned non-2xx (include upstream status in message)
  - `504` — upstream LLM timed out
  - `500` — unexpected server error (generic, no internal details leaked)
- Error `message` is human-readable and safe to display in a chat error bubble
- Never forward raw upstream error bodies — extract and sanitize

### Request/response contract
- `POST /api/llm` request: `{"systemPrompt": string, "messages": [{"role": "user"|"assistant", "content": string}], "maxTokens": int (optional, server defaults from env)}`
- `POST /api/llm` response: `{"text": string}` — raw LLM text content, no metadata
- `POST /api/generate-config` request: `{"brief": string}`
- `POST /api/generate-config` response: `{"text": string}` — raw LLM text, JSON parsing is client-side
- Content-Type: `application/json` for all API endpoints
- No authentication on API endpoints — this is a local-network tool, not a public service

### Timeout & retry policy
- Single timeout value from env var `LLM_TIMEOUT_SECONDS`, default 60s — generous for corporate proxies
- No automatic retries — fail fast and let the facilitator retry via the UI (retries on a slow LLM just compound the wait)
- Use `httpx.AsyncClient` with the configured timeout on both connect and read
- On timeout: return `504` with message "LLM request timed out after {N}s"
- No streaming — request/response is simpler and the game doesn't need token-by-token display

### Startup & health checks
- On startup, validate all required env vars exist: `LLM_API_KEY`, `LLM_ENDPOINT_URL`, `LLM_MODEL` — fail fast with a clear error naming the missing var(s)
- Optional env vars with defaults: `LLM_TIMEOUT_SECONDS` (60), `LLM_MAX_TOKENS` (2048), `LLM_EXTRA_HEADERS` (empty JSON object)
- No health endpoint — this is a single-user local tool, not a deployed service; startup validation is sufficient
- Use pydantic-settings for env var loading with type validation
- `.env.example` documents every var with comments explaining purpose and format

### Claude's Discretion
- httpx client configuration details (connection pooling, keep-alive)
- FastAPI middleware ordering
- Static file mount path and SPA fallback implementation
- Pydantic model field naming (camelCase vs snake_case in Python internals)
- Logging format and verbosity level
- CORS configuration for dev mode (Vite proxy handles this, but if needed)

</decisions>

<specifics>
## Specific Ideas

- Error shape `{"error": {"code", "message"}}` chosen to match what the frontend error bubble needs — a displayable string and a machine-readable code for conditional logic
- No retries is deliberate: the facilitator is running a live exercise and needs fast feedback, not silent waiting. If the LLM is down, they need to know immediately
- 60s default timeout accounts for corporate proxy chains where cold-start latency can be 30-40s

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-fastapi-backend*
*Context gathered: 2026-04-13*
