---
phase: 06-llm-integration
plan: 01
subsystem: api
tags: [fastapi, httpx, pydantic-settings, azure-openai, auth]

# Dependency graph
requires:
  - phase: 02-fastapi-backend
    provides: LLM proxy router (`/api/llm`), settings loader, shared httpx.AsyncClient
provides:
  - Configurable auth header construction (OpenAI Bearer or Azure api-key)
  - First backend test harness (`backend/tests/` + conftest)
  - `backend/.env.example` documenting every backend env var
affects:
  - 06-06-llm-client (frontend proxy call reaches working backend auth)
  - 06-08-token-budget-and-smoke-test (live end-to-end call now possible)
  - All future phases that touch the LLM proxy

# Tech tracking
tech-stack:
  added:
    - pytest (already installed; first test file)
    - httpx.MockTransport (built-in; no new dep)
  patterns:
    - Two-field auth construction: `{prefix}{key}` then `.strip()` so the
      same code path handles both "Bearer <key>" and raw "<key>"
    - Test pattern: TestClient(app) with lifespan, swap `app.state.http_client`
      inside the `with` block so the llm router proxies to an httpx.MockTransport

key-files:
  created:
    - backend/.env.example
    - backend/tests/__init__.py
    - backend/tests/conftest.py
    - backend/tests/test_llm_auth_header.py
  modified:
    - backend/app/config.py
    - backend/app/routers/llm.py

key-decisions:
  - "Default `llm_auth_value_prefix` is 'Bearer ' (with trailing space) so the same f-string + .strip() pattern produces identical output for both styles — no branching logic"
  - "No query-string injection (LLM_API_VERSION, etc.) added this plan — Research flagged it but deferred until ops confirms the corporate Azure endpoint shape"
  - "Test harness uses httpx.MockTransport, not respx — keeps zero new test deps and the pattern carries to every future LLM router test"
  - "app.state.http_client swap happens inside `with TestClient(app)` block — TestClient runs lifespan and creates the real client, we replace it with a mocked one for the duration of the request, then restore for graceful shutdown"

patterns-established:
  - "Environment-based auth configuration: any upstream whose auth differs from OpenAI-Bearer is handled by two env vars, no code change"
  - "Backend test layout: `backend/tests/` with shared conftest (env_base fixture, autouse lru_cache reset on get_settings) — template for every backend test going forward"

# Metrics
duration: 3m 15s
completed: 2026-04-14
---

# Phase 6 Plan 1: Backend Azure Auth Fix Summary

**Configurable LLM auth header via two env vars (`LLM_AUTH_HEADER_NAME`, `LLM_AUTH_VALUE_PREFIX`) — unlocks corporate Azure OpenAI (`api-key: <key>`) without breaking default OpenAI-compatible behaviour (`Authorization: Bearer <key>`).**

## Performance

- **Duration:** 3m 15s
- **Started:** 2026-04-14T12:53:16Z
- **Completed:** 2026-04-14T12:56:31Z
- **Tasks:** 2
- **Files modified:** 6 (2 modified, 4 created)

## Accomplishments

- Added `llm_auth_header_name` and `llm_auth_value_prefix` fields to `Settings` with OpenAI-compatible defaults
- Rewired `backend/app/routers/llm.py` to construct the auth header from settings instead of hardcoding `Authorization: Bearer`
- Created `backend/tests/` — the first backend test package — with `conftest.py` providing `env_base` and autouse `reset_settings_cache`
- Added two regression tests that prove both auth styles work end-to-end through FastAPI's TestClient against an httpx.MockTransport, with zero new third-party test dependencies
- Documented every backend env var in a new `backend/.env.example`, including a ready-to-uncomment Azure OpenAI block

## Task Commits

Each task was committed atomically:

1. **Task 1: Add configurable auth header settings and rewire llm.py** — `fd19d56` (feat)
2. **Task 2: Add regression test + .env.example** — `7198906` (test)

**Plan metadata:** _(added in the docs commit bundling PLAN.md + SUMMARY.md)_

## Files Created/Modified

- `backend/app/config.py` — Two new settings fields with defaults `"Authorization"` and `"Bearer "` (trailing space intentional); docstring updated
- `backend/app/routers/llm.py` — `headers` dict now builds from `settings.llm_auth_header_name` and `settings.llm_auth_value_prefix`; comment explains the OpenAI vs Azure contract
- `backend/.env.example` — Documents all required/optional env vars, includes commented Azure flip block
- `backend/tests/__init__.py` — Marks tests as a package
- `backend/tests/conftest.py` — `env_base` fixture, autouse `reset_settings_cache` clearing `get_settings.cache_clear()`
- `backend/tests/test_llm_auth_header.py` — Two tests using `httpx.MockTransport` to intercept outbound requests and assert header name/value

## Decisions Made

- **Trailing-space Bearer default with `.strip()`** — Lets a single code path handle both auth styles. `f"Bearer {key}".strip()` == `f"Bearer {key}"` and `f"{key}".strip()` == `key`, so no branching logic needed for the Azure case.
- **Query-string auth (e.g. `?api-version=...`) deferred** — Plan scope was strict; Research flagged this but owner decision is to add only if ops confirms needed against the corporate deployment.
- **Test-side http_client swap inside `with TestClient(app)`** — The lifespan creates a real httpx.AsyncClient; we replace `app.state.http_client` with one wired to `httpx.MockTransport`, then restore before the context manager exits so lifespan shutdown closes the real client cleanly.
- **No respx / pytest-httpx added** — `httpx.MockTransport` is built in and gives request-capture semantics that are sufficient for header assertions.

## Deviations from Plan

None — plan executed exactly as written. The two tasks landed in their specified files with the exact field names and default values called out in the plan.

## Issues Encountered

- **`backend/.env.example` did not exist** — plan stated "Update" but the file was missing. Created it fresh with the full documented set of env vars rather than a minimal patch; the spirit of the task is "make ops able to flip to Azure without reading code," which now holds for every env var, not just the two new ones.

## User Setup Required

None — no external service configuration is required for this plan to land.

**Operational note for Azure flip (to capture now while fresh):**
When the backend is pointed at the corporate Azure OpenAI endpoint, set the following in `backend/.env`:
```
LLM_ENDPOINT_URL=https://<resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions?api-version=2024-02-15-preview
LLM_MODEL=<deployment-name>
LLM_AUTH_HEADER_NAME=api-key
LLM_AUTH_VALUE_PREFIX=
```
The `api-version` query string is embedded directly in `LLM_ENDPOINT_URL` — no separate setting field needed unless/until ops says otherwise.

## Next Phase Readiness

- Backend auth is no longer the blocker for live smoke-testing the LLM proxy against the corporate endpoint.
- The remaining Phase 6 research flags from STATE.md are still open:
  - Response extraction path (`choices[0].message.content`) is still hardcoded — may need to become configurable in a later plan if Azure's shape differs. Not touched here (out of scope).
  - Token budget for the system prompt is still unmeasured; plan 06-08 will cover this.
  - Corporate proxy timeout (≈30s) vs LLM generation time (25–35s) is still unverified.
- Plan 06-02 has already started (chat message types extended); 06-01's contract (configurable auth) is independent of it, so no ordering issue.

---
*Phase: 06-llm-integration*
*Completed: 2026-04-14*
