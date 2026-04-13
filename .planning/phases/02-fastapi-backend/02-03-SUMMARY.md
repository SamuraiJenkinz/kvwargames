---
phase: 02-fastapi-backend
plan: 03
subsystem: api
tags: [fastapi, httpx, pydantic, llm-proxy, config-generation]

# Dependency graph
requires:
  - phase: 02-01
    provides: "FastAPI app with lifespan, app.state.http_client, get_settings(), error shape {error: {code, message}}"
provides:
  - "POST /api/generate-config endpoint accepting {brief: str}, returning {text: string} raw LLM output"
  - "CONFIG_GEN_SYSTEM_PROMPT instructing LLM to produce JSON game config"
affects: [02-04, phase-07-config-gen, phase-06-llm-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side JSON parsing: LLM response returned as raw text; frontend owns validation"
    - "Credential injection: get_settings() injects API key via Authorization header, never from request body"
    - "Shared httpx client: request.app.state.http_client reused across all LLM proxy endpoints"
    - "Explicit error-chain: 5-case httpx exception ladder mirrors /api/llm for consistency"

key-files:
  created: []
  modified:
    - backend/app/routers/config_gen.py

key-decisions:
  - "No server-side JSON parsing of LLM output — client displays raw text and owns validation errors"
  - "Duplication of error-handling chain from llm.py kept explicit — refactor to shared helper deferred to future phase per plan direction"
  - "System prompt kept at ~200 words as placeholder — Phase 7 owns prompt engineering"

patterns-established:
  - "LLM proxy pattern: build payload + headers, POST via app.state.http_client, return {text: string}, 5-case error chain"

# Metrics
duration: 2min
completed: 2026-04-13
---

# Phase 02 Plan 03: Config Generation Endpoint Summary

**POST /api/generate-config proxies facilitator brief to upstream LLM with a JSON-config system prompt, returning raw text for client-side parsing**

## Performance

- **Duration:** 1m 50s
- **Started:** 2026-04-13T06:51:37Z
- **Completed:** 2026-04-13T06:53:27Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Implemented POST /api/generate-config following the same credential injection and error handling pattern as /api/llm
- Defined CONFIG_GEN_SYSTEM_PROMPT (~200 words) instructing the LLM to return only valid JSON config with required fields (scenarioName, teams, injectCards, nationalActions, winConditions)
- Verified: malformed body returns 400 VALIDATION_ERROR; valid brief to unreachable host returns 502 LLM_UNREACHABLE

## Task Commits

1. **Task 1: Implement POST /api/generate-config endpoint** - `1f9c6a9` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/app/routers/config_gen.py` - Full implementation replacing empty stub: ConfigGenRequest model, CONFIG_GEN_SYSTEM_PROMPT, endpoint with 5-case error handling (171 lines)

## Decisions Made

- No server-side JSON parsing of the LLM's config output — the plan explicitly requires client-side parsing so the frontend can display meaningful validation errors to facilitators.
- Error-handling chain duplicated from llm.py rather than extracted to a shared helper — kept explicit per plan direction; refactor is a future-phase concern.
- System prompt is a functional placeholder (~200 words) covering required config fields; Phase 7 owns prompt engineering and will refine based on tested brief types.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Port 8000 and 8001 were held by existing python/uvicorn processes from earlier plan executions. Used port 8080 for verification testing. No impact on deliverable.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- /api/generate-config is ready for use by the frontend (Phase 4/5 setup screen)
- Phase 7 should refine CONFIG_GEN_SYSTEM_PROMPT against 3+ brief types before shipping
- Phase 6 research flag still active: verify corporate LLM response structure matches `data["choices"][0]["message"]["content"]` extraction path

---
*Phase: 02-fastapi-backend*
*Completed: 2026-04-13*
