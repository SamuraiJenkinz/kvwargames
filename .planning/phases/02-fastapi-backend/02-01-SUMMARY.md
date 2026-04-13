---
phase: 02-fastapi-backend
plan: 01
subsystem: api
tags: [fastapi, httpx, pydantic-settings, uvicorn, python]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: project scaffold, TypeScript types, Zustand store — backend builds independently of frontend
provides:
  - FastAPI app instance with lifespan context manager
  - pydantic-settings Settings class reading LLM env vars with startup validation
  - shared httpx.AsyncClient singleton on app.state.http_client
  - RequestValidationError handler returning 400 with consistent error shape
  - empty llm and config_gen router stubs ready for Plans 02-02 and 02-03
  - backend/requirements.txt with pinned fastapi[standard], httpx, pydantic-settings
affects:
  - 02-02-llm-proxy (adds endpoints to llm router, uses get_http_client and get_settings)
  - 02-03-config-gen (adds endpoints to config_gen router, same dependency pattern)
  - 02-04-static-serving (mounts SPA at placeholder comment in main.py)

# Tech tracking
tech-stack:
  added:
    - fastapi[standard]>=0.135.0
    - httpx>=0.28.0
    - pydantic-settings>=2.13.0
  patterns:
    - "Lifespan pattern: asynccontextmanager instead of deprecated @app.on_event"
    - "Settings-as-singleton: @lru_cache on get_settings() — one Settings parse per process"
    - "Shared client: httpx.AsyncClient on app.state, injected via Depends(get_http_client)"
    - "Fail-fast: missing env vars raise ValidationError before server accepts traffic"
    - "Consistent error shape: all validation errors return 400 with {error: {code, message}}"

key-files:
  created:
    - backend/requirements.txt
    - backend/app/__init__.py
    - backend/app/config.py
    - backend/app/dependencies.py
    - backend/app/main.py
    - backend/app/routers/__init__.py
    - backend/app/routers/llm.py
    - backend/app/routers/config_gen.py
  modified: []

key-decisions:
  - "Used asynccontextmanager lifespan over deprecated @app.on_event — FastAPI 0.93+ preferred pattern"
  - "llm_extra_headers stored as JSON string field, parsed lazily in get_extra_headers() — avoids validator complexity"
  - "RequestValidationError overridden to 400 not 422 — consistent with custom error shape used across API"
  - "No CORS middleware added — Vite proxy handles dev, production serves from same origin"
  - "Server port 8001 used in verification to avoid conflict with any running services on 8000"

patterns-established:
  - "Dependency injection: router functions use Depends(get_http_client) and Depends(get_settings)"
  - "Lifespan: startup validation + client creation; shutdown: aclose()"
  - "Error response shape: {error: {code: str, message: str}} for all API errors"

# Metrics
duration: 1.5min
completed: 2026-04-13
---

# Phase 2 Plan 01: FastAPI Project Structure Summary

**FastAPI skeleton with pydantic-settings env-var validation, asynccontextmanager lifespan creating shared httpx.AsyncClient, and 400-override error handler — ready for LLM proxy and config-gen router endpoints**

## Performance

- **Duration:** ~1.5 min
- **Started:** 2026-04-13T20:06:30Z
- **Completed:** 2026-04-13T20:07:59Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- backend/ directory structure created with all package `__init__.py` markers
- pydantic-settings `Settings` class validates 3 required LLM env vars at instantiation; missing any causes `ValidationError` before server accepts traffic
- FastAPI app with `asynccontextmanager` lifespan creates `httpx.AsyncClient` singleton on `app.state` and closes it cleanly on shutdown
- `RequestValidationError` overridden to return 400 with `{"error": {"code": "VALIDATION_ERROR", "message": "Malformed request body"}}` — consistent error shape for all plans
- Empty `llm` and `config_gen` router stubs mounted; placeholder comment marks Plan 02-04 SPA static mount point

## Task Commits

Each task was committed atomically:

1. **Task 1: backend structure, requirements, and settings config** - `39424e6` (feat)
2. **Task 2: main.py lifespan, dependencies, and router stubs** - `9515857` (feat)

**Plan metadata:** _(committed after SUMMARY.md creation)_

## Files Created/Modified

- `backend/requirements.txt` - fastapi[standard]>=0.135.0, httpx>=0.28.0, pydantic-settings>=2.13.0
- `backend/app/__init__.py` - empty package marker
- `backend/app/config.py` - Settings(BaseSettings) with required LLM fields and get_settings() @lru_cache
- `backend/app/dependencies.py` - get_http_client(request) → app.state.http_client
- `backend/app/main.py` - FastAPI app with lifespan, error handler, router mounts
- `backend/app/routers/__init__.py` - empty package marker
- `backend/app/routers/llm.py` - empty APIRouter stub
- `backend/app/routers/config_gen.py` - empty APIRouter stub

## Decisions Made

- Used `asynccontextmanager` lifespan over deprecated `@app.on_event` — FastAPI 0.93+ preferred pattern; cleaner startup/shutdown lifecycle
- `llm_extra_headers` stored as a JSON string field, parsed lazily in `get_extra_headers()` — avoids pydantic validator complexity, allows arbitrary header injection without schema changes
- `RequestValidationError` overridden to return 400 not 422 — aligns with the consistent `{error: {code, message}}` shape used across the API so frontend has one error-handling path
- No CORS middleware — Vite proxy (`/api` → `localhost:8000`) handles CORS in dev; production serves frontend and backend from same origin via Plan 02-04 static mount
- Verification used port 8001 to avoid conflict with any existing service on 8000

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The only incidental output was a google-adk opentelemetry version conflict warning during `pip install`, which is unrelated to this project and has no impact on runtime.

## User Setup Required

None — no external service configuration required. Env vars (`LLM_API_KEY`, `LLM_ENDPOINT_URL`, `LLM_MODEL`) are documented in `backend/app/config.py` and will be wired via `.env` at deployment time.

## Next Phase Readiness

- Plan 02-02 (LLM proxy): add `POST /api/llm/chat` endpoint to `backend/app/routers/llm.py`; use `Depends(get_http_client)` and `Depends(get_settings)` — both already importable
- Plan 02-03 (config gen): add `POST /api/config/generate` endpoint to `backend/app/routers/config_gen.py`; same dependency pattern
- Plan 02-04 (static serving): mount SPA at the comment placeholder in `main.py` line 68

---
*Phase: 02-fastapi-backend*
*Completed: 2026-04-13*
