# Phase 9: LLM Health Check — Backend - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `GET /api/health/llm` to the FastAPI backend. The endpoint performs a cheap, authenticated round-trip to the configured LLM endpoint using the same env config as `/api/llm`, and returns a structured success/failure result the frontend (Phase 10) can render as a green/red status with actionable hint text.

Scope is backend-only. Frontend indicator, auto-check, and Launch gate are Phase 10.

</domain>

<decisions>
## Implementation Decisions

### Probe prompt design
- Send a minimal chat-completions request: single user message `"Reply with: OK"`, `max_tokens: 5`, `temperature: 0`.
- Estimated cost: ~6 input + ≤5 output ≈ 11 tokens per check (well under the 50-token ceiling).
- **Do not content-validate the response.** If the upstream returns HTTP 200 with a parseable chat-completions body containing a non-empty `choices[0].message.content`, the check passes. Content-matching (e.g., checking for literal "OK") is brittle across model variants and adds no real signal — auth + connectivity + a valid response shape is what we actually care about.
- Use the same request construction path as `/api/llm` where practical, so auth-mode (Bearer vs Azure api-key) and `LLM_EXTRA_HEADERS` behavior stay in sync automatically.

### Error taxonomy & hints
Failure response `code` is a stable string enum. Each code maps to a hint tuned for the facilitator (non-developer) reading it on the setup screen.

| `code` | Trigger | `status` | `hint` |
|---|---|---|---|
| `network_error` | DNS failure, connection refused, socket error | `null` | "Cannot reach LLM endpoint — check LLM_URL in .env and network connectivity" |
| `tls_error` | TLS handshake / certificate error | `null` | "TLS handshake failed — check LLM_EXTRA_HEADERS and corporate proxy settings" |
| `auth_error` | Upstream 401 or 403 | `401`/`403` | "Authentication failed — check LLM_API_KEY in .env" |
| `not_found` | Upstream 404 | `404` | "LLM endpoint not found — check LLM_URL path in .env" |
| `rate_limited` | Upstream 429 | `429` | "Rate limited by LLM provider — retry in a moment" |
| `upstream_error` | Upstream 5xx | `5xx` | "LLM provider error (HTTP {status}) — try again or check provider status" |
| `timeout` | 15s deadline exceeded | `null` | "LLM did not respond within 15 seconds — check network or provider latency" |
| `invalid_response` | Upstream 200 but body is not parseable chat-completions JSON or missing `choices[0].message.content` | `200` | "LLM returned an unexpected response shape — check LLM_URL points to a chat-completions endpoint" |

The codes are stable for frontend consumers. Hint text is human-readable and may be adjusted without breaking the contract.

### Response shape & HTTP semantics
- **Always HTTP 200.** The endpoint itself is healthy even when its downstream dependency is not. Using 503 for failures would force the frontend to handle two parallel error layers (HTTP + JSON body) for no benefit — facilitators need the hint text rendered either way.
- **Success:** `{ "ok": true, "latencyMs": <int> }`
- **Failure:** `{ "ok": false, "code": <enum>, "status": <int|null>, "hint": <string>, "latencyMs": <int> }`
  - `latencyMs` is included on failure too — useful for diagnosing slow-but-timed-out vs instant-refused scenarios.
  - `status` is the upstream HTTP status when applicable, `null` for network/TLS/timeout errors.
- No `ok: true` failure cases — binary green/red is what Phase 10 gates on.

### Caching & invocation policy
- **No caching, no rate limiting on the backend.** Every call to `/api/health/llm` fires a real probe. Cost per probe is negligible (~11 tokens) and facilitators invoke this a handful of times per session at most (auto-check on mount + occasional Re-check).
- Keeps the endpoint honest — a cached "green" could hide a freshly-broken config.
- Frontend is responsible for not double-firing (React dev-mode StrictMode double-invocation is acceptable; production won't do it).

### Logging
- Log every probe at `INFO` with structured fields: `{ code, status, latencyMs }`. Success is `code: "ok"`.
- Do not log the probe prompt (trivial, adds noise).
- Do not log the upstream response body at `INFO`. Upstream error text may be logged at `DEBUG` for troubleshooting.
- No PII concerns — the probe is a fixed string and the response is a fixed completion.

### Claude's Discretion
- Exact HTTP client: reuse whatever the existing `/api/llm` route uses (likely `httpx.AsyncClient`) rather than introducing a new client.
- Route file organization: new `routers/health.py` vs extending an existing router — planner decides based on current backend layout.
- Exception-to-code mapping implementation detail (try/except chain vs handler registry).
- Whether to expose a sync or async endpoint — follow existing backend convention.

</decisions>

<specifics>
## Specific Ideas

- The `LLM_EXTRA_HEADERS` / auth-mode parity is the whole point of this endpoint — if the health check doesn't use the *exact* same auth path as `/api/llm`, a green check could ship with a broken real path. Share code, don't duplicate header construction.
- This phase exists because the v1.0 live run surfaced config-mismatch failures only after Launch — the facilitator should be able to tell before starting a session that the pipeline is good.

</specifics>

<deferred>
## Deferred Ideas

- Cached/last-known health status surfaced on other screens (e.g., during a live game) — out of scope; Phase 10 only gates Launch.
- Structured health metrics endpoint for external monitoring (Prometheus-style) — not needed for a facilitator tool.
- Rate limiting / debouncing on the backend — revisit only if a real abuse pattern emerges.

</deferred>

---

*Phase: 09-llm-health-check-backend*
*Context gathered: 2026-04-15*
