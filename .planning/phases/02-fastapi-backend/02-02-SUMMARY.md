---
phase: 02-fastapi-backend
plan: "02-02"
subsystem: backend-api
tags: [fastapi, httpx, llm-proxy, credential-injection, error-handling, pydantic]

dependency-graph:
  requires: ["02-01"]
  provides: ["POST /api/llm endpoint", "LLM credential proxy", "OpenAI-compatible forwarding"]
  affects: ["06-llm-wiring", "frontend LLM calls"]

tech-stack:
  added: []
  patterns: ["credential injection via env", "httpx async proxy", "OpenAI-compatible payload", "structured error codes"]

key-files:
  created: []
  modified:
    - backend/app/routers/llm.py

decisions:
  - "httpx.TimeoutException caught before httpx.RequestError to ensure timeout gets 504 not 502"
  - "httpx.HTTPStatusError status_code check for 401 inline — avoids over-engineering separate branch"
  - "maxTokens falls back to settings.llm_max_tokens when not provided — consistent with config defaults"
  - "JSONResponse used for all returns (success and error) — consistent response shape control"

metrics:
  duration: "54s"
  completed: "2026-04-13"
  tasks: 1/1
---

# Phase 02 Plan 02: LLM Proxy Endpoint Summary

**One-liner:** POST /api/llm credential proxy with httpx forwarding, OpenAI-compatible payload construction, and structured error codes for all 5 failure modes.

## What Was Built

Replaced the empty router stub in `backend/app/routers/llm.py` with the full LLM proxy endpoint. The endpoint:

1. Validates the incoming request with Pydantic (`LLMProxyRequest` with `Message` sub-model)
2. Reads LLM credentials exclusively from environment via `get_settings()`
3. Builds an OpenAI-compatible payload (`model`, `messages` array with system prompt prepended, `max_tokens`)
4. Injects `Authorization: Bearer <api_key>` plus any extra headers from `settings.get_extra_headers()`
5. Forwards via the shared `httpx.AsyncClient` from `request.app.state.http_client`
6. Extracts `choices[0].message.content` and returns `{"text": string}`
7. Maps all failure modes to consistent `{"error": {"code": ..., "message": ...}}` shapes

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement POST /api/llm endpoint | 8381b74 | backend/app/routers/llm.py |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `httpx.TimeoutException` caught before `httpx.RequestError` | `TimeoutException` is a subclass of `RequestError`; catch order ensures 504 not 502 for timeouts |
| Inline `status_code == 401` check inside `HTTPStatusError` handler | Cleanest approach without extra try/except nesting |
| `maxTokens` falls back to `settings.llm_max_tokens` | Consistent with config design; frontend can omit it |
| `JSONResponse` used for success and error returns | Gives full control over status code and body shape |

## Verification Results

Both curl verification tests passed:

- **Test 1** (malformed/empty body): `400 {"error":{"code":"VALIDATION_ERROR","message":"Malformed request body"}}` — from the global handler set up in 02-01
- **Test 2** (valid body, unreachable upstream): `502 {"error":{"code":"LLM_UNREACHABLE","message":"Could not reach LLM endpoint"}}` — correct error code and shape

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

This plan completes the core security goal of the backend: API keys never leave the server. The endpoint is ready for:

- Phase 06 LLM wiring (frontend calling POST /api/llm)
- Integration testing against the actual corporate LLM endpoint (see Phase 6 research flags in STATE.md)

Remaining plans in phase:
- 02-03: Config generation endpoint
- 02-04: Static file mount + SPA fallback
