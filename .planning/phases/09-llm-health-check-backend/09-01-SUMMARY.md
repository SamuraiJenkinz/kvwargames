---
phase: 09-llm-health-check-backend
plan: 01
subsystem: api
tags: [fastapi, httpx, health-check, llm, observability, azure-openai]

# Dependency graph
requires:
  - phase: 02-backend-foundation
    provides: Settings (llm_auth_header_name, llm_auth_value_prefix, get_extra_headers), shared httpx.AsyncClient on app.state.http_client, routers/llm.py auth pattern
provides:
  - GET /api/health/llm endpoint returning stable success/failure JSON shapes
  - Full 8-code error taxonomy (timeout, auth_error, not_found, rate_limited, upstream_error, network_error, tls_error, invalid_response)
  - 15-second SLA enforced via per-request httpx.Timeout override
  - Azure- and OpenAI-compatible auth reuse (no separate credentials)
affects: [09-02 health-endpoint tests, 10 frontend health indicator, 10 launch gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-request timeout override pattern for SLAs tighter than the shared client default"
    - "Shared failure return path: all except blocks assign (code, status, hint), single post-except block handles latency + logging + JSONResponse"
    - "HTTP 200 for all responses — endpoint health decoupled from upstream health"
    - "Exception handler ordering by inheritance (TimeoutException/ConnectError before RequestError)"

key-files:
  created:
    - backend/app/routers/health.py
  modified:
    - backend/app/main.py

key-decisions:
  - "TLS-vs-network discrimination via exc.__cause__ isinstance ssl.SSLError was RETAINED despite the httpx-private-API risk flagged in RESEARCH.md Q8 — the tls_error hint ('check LLM_EXTRA_HEADERS and corporate proxy settings') is materially more actionable than a generic network_error for facilitators behind corporate proxies"
  - "Auth helper was INLINED in health.py rather than extracted into a shared module — only two call sites (llm.py, health.py), both 3 lines, extraction would have added a file without reducing complexity"
  - "Used a named module constant _HEALTH_TIMEOUT_SECONDS = 15.0 instead of an inline literal — same runtime behaviour, clearer intent, single source of truth if the SLA ever changes"
  - "Handler order Timeout→HTTPStatus→Connect→Request→Exception is explicitly commented in-code because it is load-bearing and invisible to linters"

patterns-established:
  - "Health endpoints always return HTTP 200 (body.ok carries the real signal) so monitoring tools treating any non-2xx as an outage of the endpoint itself are not misled"
  - "Auth construction must flow through settings.llm_auth_header_name / llm_auth_value_prefix / get_extra_headers() — never hardcode Authorization: Bearer (that assumption breaks Azure deployments)"
  - "Shared httpx.AsyncClient from lifespan is reused via request.app.state.http_client; new clients are NOT instantiated per-request"

# Metrics
duration: ~6min
completed: 2026-04-15
---

# Phase 09 Plan 01: LLM Health-Check Endpoint Summary

**GET /api/health/llm with full 8-code error taxonomy, 15s per-request timeout override, and Azure/OpenAI-compatible auth reuse**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-15T16:50:00Z (approx — plan load)
- **Completed:** 2026-04-15T16:56:06Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 edited)

## Accomplishments

- New `backend/app/routers/health.py` (211 lines) implementing `GET /api/health/llm`
- Full 8-code error taxonomy with actionable hints matching CONTEXT.md requirements
- Per-request `timeout=httpx.Timeout(_HEALTH_TIMEOUT_SECONDS)` override enforces the 15s SLA regardless of `LLM_TIMEOUT_SECONDS` (60s default)
- Auth construction copied verbatim from `routers/llm.py` lines 79-84 (uses `settings.llm_auth_header_name` / `llm_auth_value_prefix` / `get_extra_headers()`); no hardcoded `Authorization: Bearer` anywhere in the code
- Exception handlers ordered Timeout → HTTPStatusError → ConnectError → RequestError → Exception (subclass-safety is load-bearing and commented in-code)
- TLS-vs-network discrimination via `exc.__cause__` isinstance `ssl.SSLError` — retained with a clear collapse-to-network_error fallback noted in comments
- `backend/app/main.py` imports and registers the router at line 114, safely before the SPA static mount at line 121

## Task Commits

1. **Task 1: Create backend/app/routers/health.py with GET /api/health/llm endpoint** — `e34b91d` (feat)
2. **Task 2: Wire the health router into backend/app/main.py** — `8f79641` (feat)

**Plan metadata:** pending (will be appended after SUMMARY commit)

## Files Created/Modified

- `backend/app/routers/health.py` — New router (211 lines). Defines `_HEALTH_PROBE_MESSAGES`, `_HEALTH_TIMEOUT_SECONDS = 15.0`, and the async `llm_health_check(request)` handler. Single `@router.get("/api/health/llm")` route.
- `backend/app/main.py` — Two edits: (1) import line 36 now imports `config_gen, health, llm` (alphabetised); (2) router block expanded with `app.include_router(health.router)` at line 114 plus an expanded comment making the "API routers before SPA mount" invariant explicit.

## Decisions Made

- **TLS vs network discrimination RETAINED.** `exc.__cause__ isinstance ssl.SSLError` is an undocumented-stable httpx behaviour per RESEARCH.md Q8, but the actionability of the `tls_error` hint ("check LLM_EXTRA_HEADERS and corporate proxy settings") is high-value for facilitators operating behind corporate proxies with custom CAs. The in-code comment explicitly instructs future maintainers to collapse both branches to `network_error` if the discrimination proves flaky.
- **Auth helper INLINED, not extracted.** Only two call sites (`llm.py`, `health.py`), both 3 lines. CONTEXT.md left this to planner discretion; extraction would have added a shared module without reducing real complexity. If a third consumer appears (e.g. a smoke-test script in Phase 11), reconsider.
- **Module-level timeout constant.** Used `_HEALTH_TIMEOUT_SECONDS = 15.0` instead of an inline `httpx.Timeout(15.0)`. Same runtime behaviour, single source of truth, clearer intent. Minor deviation from the literal pattern in the plan's `<verify>` step — verified via `timeout=httpx.Timeout` grep instead of `timeout=httpx.Timeout(15`.
- **Shared failure return path.** Each `except` block only assigns `code`, `status`, and `hint`; a single block after the except chain handles latency computation, structured logging, and the `JSONResponse(status_code=200, ...)` return. Eliminates duplication across the five failure branches and guarantees the response shape stays consistent.
- **Logging format.** Used `logger.info("llm_health_check code=%s status=%s latencyMs=%d", ...)` — matches existing `routers/llm.py` style (plain log strings, no `extra=`). Does NOT log the probe payload, the upstream response body, or the API key.

## Deviations from Plan

### Minor stylistic deviations (all within planner discretion)

**1. [Stylistic] Used a named timeout constant**
- **Found during:** Task 1 authoring
- **Issue:** Plan prescribed inline literal `timeout=httpx.Timeout(15.0)`; verify step greps for `timeout=httpx.Timeout(15`
- **Fix:** Defined `_HEALTH_TIMEOUT_SECONDS = 15.0` at module scope and used it in `httpx.Timeout(_HEALTH_TIMEOUT_SECONDS)`
- **Files modified:** backend/app/routers/health.py
- **Verification:** `grep "timeout=httpx.Timeout" health.py` returns the call site on line 103; runtime value is identical to `15.0`
- **Committed in:** e34b91d (Task 1 commit)

**2. [Stylistic] Collapsed per-branch return into a shared post-except block**
- **Found during:** Task 1 authoring
- **Issue:** Plan suggested each except block should log+return; duplicating the 5-line response construction 5 times felt like a maintenance hazard
- **Fix:** Each except assigns `(code, status, hint)`; single block after the except chain computes latency, logs, and returns. Success path still returns inline in the `try` block.
- **Files modified:** backend/app/routers/health.py
- **Verification:** Both `JSONResponse(` calls have `status_code=200`; all 8 error codes present; `grep JSONResponse health.py` shows exactly 2 call sites
- **Committed in:** e34b91d (Task 1 commit)

**3. [Stylistic] Expanded router-block comment in main.py**
- **Found during:** Task 2 authoring
- **Issue:** Original comment ("Routers — order matters if paths overlap") did not call out the load-bearing API-before-SPA invariant that this plan depends on
- **Fix:** Expanded the comment to explicitly state "All API routers MUST be registered before the SPA static mount below"
- **Files modified:** backend/app/main.py
- **Verification:** Comment is above the three `include_router` calls, which all appear before `app.mount` on line 121
- **Committed in:** 8f79641 (Task 2 commit)

---

**Total deviations:** 3 minor stylistic (0 auto-fixes under Rules 1-3, 0 architectural under Rule 4)
**Impact on plan:** All deviations are within planner discretion as stated in the plan's `<output>` section ("Whether the shared auth helper was extracted..."). Runtime behaviour, response shapes, and all success criteria are identical to the plan specification. No scope creep.

## Issues Encountered

None. Both tasks executed cleanly, both import-check and route-registration smoke verifications passed on first run.

## User Setup Required

None — no new environment variables, no external service configuration. The endpoint reuses `LLM_API_KEY`, `LLM_ENDPOINT_URL`, `LLM_MODEL`, `LLM_AUTH_HEADER_NAME`, `LLM_AUTH_VALUE_PREFIX`, and `LLM_EXTRA_HEADERS` already required by `POST /api/llm`.

## Open Question Flagged for Phase 09-02 / Phase 10

**TLS discrimination stability.** `exc.__cause__ isinstance ssl.SSLError` was retained but relies on undocumented httpx behaviour. Plan 09-02 test design should either (a) mock the `__cause__` chain explicitly and pin behaviour, or (b) accept that the `tls_error` branch is validated by integration test only and document the fallback. If the test is flaky or impossible to write against the public httpx API, collapse `ConnectError` into `network_error` in this file — the in-code comment explicitly authorises that change.

## Next Phase Readiness

- **Plan 09-02 (health-endpoint tests)** ready. Response shapes are stable; all 8 error codes are implemented; every failure path exercises the shared `(code, status, hint)` assembly so tests can assert body structure deterministically.
- **Phase 10 (frontend indicator + launch gate)** ready. The contract (`{ok, latencyMs}` / `{ok, code, status, hint, latencyMs}`, always HTTP 200) is locked and documented in the module docstring.
- **No blockers.**

---
*Phase: 09-llm-health-check-backend*
*Completed: 2026-04-15*
