---
phase: 09-llm-health-check-backend
plan: 02
subsystem: testing
tags: [pytest, httpx, mocktransport, fastapi, testclient, health-check]

# Dependency graph
requires:
  - phase: 09-llm-health-check-backend (Plan 01)
    provides: GET /api/health/llm endpoint with 8-code taxonomy + auth/extra-headers reuse
  - phase: 06-configurable-auth-header
    provides: LLM_AUTH_HEADER_NAME / LLM_AUTH_VALUE_PREFIX settings that health.py must honour
  - phase: 08-error-injection-tests
    provides: MockTransport + app.state.http_client swap pattern (copied verbatim)
provides:
  - Regression coverage for /api/health/llm across success, 401 auth failure, and timeout paths
  - Parity guards proving health.py uses settings-driven auth construction (not hardcoded Bearer) and forwards LLM_EXTRA_HEADERS
  - Sanity-verified test file — deliberate break of health.py was confirmed to trip both parity tests
affects: [09-03 (if added), Phase 10 (frontend health indicator — depends on stable response shape)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every app.state.http_client swap paired with try/finally restore (Pitfall 3 guard)"
    - "Local MockTransport handler per test — captured-request list scoped to the test, no cross-test leakage"
    - "Parity tests assert both positive (header present) and negative (opposite header absent) to prevent one-sided regressions"

key-files:
  created:
    - "backend/tests/test_health_llm.py — 5 tests, 208 lines"
  modified: []

key-decisions:
  - "Kept to the required 5-test floor — file is 208 lines with clear structure; adding more scenarios (403/404/429/500/network/invalid_response) would push complexity without materially increasing signal, given 09-01 already covers those branches by construction and the generic Exception handler is covered transitively"
  - "Asserted both `Authorization not in headers` AND `authorization not in headers` (case variants) in auth-mode parity test — belt-and-braces against httpx Headers case-folding behaviour if ever reimplemented"
  - "Hint-string assertion for timeout uses `'15 seconds' in body['hint'] or '15s' in body['hint']` — tolerant of minor wording refactor while still proving the SLA is surfaced"

patterns-established:
  - "Health-endpoint test pattern: TestClient(app) context → swap app.state.http_client → try/finally restore → assert status always 200 + discriminate on body.ok"
  - "Parity-test pattern: captured-request list + MockTransport handler that appends request and returns a minimal valid chat-completions body"

# Metrics
duration: 12min
completed: 2026-04-15
---

# Phase 09 Plan 02: /api/health/llm Pytest Coverage Summary

**5 pytest scenarios for GET /api/health/llm covering success, 401 auth failure, timeout, auth-mode parity, and LLM_EXTRA_HEADERS parity — all using the established httpx.MockTransport + app.state.http_client swap pattern, with try/finally restore on every swap.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-15T16:48Z (approx — session start)
- **Completed:** 2026-04-15T17:00:43Z
- **Tasks:** 1 (single-task plan)
- **Files modified:** 1 (one new test file, no changes outside it)

## Accomplishments
- 5 passing tests in `backend/tests/test_health_llm.py` (208 lines, under the ~250-line ceiling)
- Full backend suite: 17/17 passing (12 baseline + 5 new, no regressions)
- One-shot sanity check PERFORMED: temporarily replaced health.py's auth construction with a hardcoded `Authorization: Bearer <key>` dict — both parity tests (`test_health_check_uses_configurable_auth_header` and `test_health_check_forwards_extra_headers`) failed as required. health.py was then reverted and confirmed green (no diff vs HEAD~1).

## Task Commits

1. **Task 1: Create test_health_llm.py covering success, auth failure, timeout, auth-parity, extra-headers-parity** — `58f9dad` (test)

**Plan metadata:** (pending, committed after this SUMMARY is written)

## Files Created/Modified
- `backend/tests/test_health_llm.py` (created) — 5 tests: `test_health_check_success`, `test_health_check_auth_failure_401`, `test_health_check_timeout`, `test_health_check_uses_configurable_auth_header`, `test_health_check_forwards_extra_headers`. Every app.state.http_client swap has a matching try/finally restore.

## Test Output

```
$ cd backend && pytest tests/test_health_llm.py -v
============================= test session starts =============================
platform win32 -- Python 3.13.3, pytest-9.0.2, pluggy-1.6.0
collected 5 items

tests/test_health_llm.py::test_health_check_success PASSED               [ 20%]
tests/test_health_llm.py::test_health_check_auth_failure_401 PASSED      [ 40%]
tests/test_health_llm.py::test_health_check_timeout PASSED               [ 60%]
tests/test_health_llm.py::test_health_check_uses_configurable_auth_header PASSED [ 80%]
tests/test_health_llm.py::test_health_check_forwards_extra_headers PASSED [100%]

============================== 5 passed in 1.43s ==============================

$ cd backend && pytest tests/ -v
...
============================== 17 passed in 3.50s ==============================
```

## Optional Additional Scenarios

**NOT added.** The plan permitted 403/404/429/500/network/invalid_response coverage if the file stayed under ~250 lines. Judgment call: current file is 208 lines and reads cleanly; adding six more tests with minor variations on the same MockTransport skeleton would push toward 300+ lines without increasing signal materially. The plan's <verification> section explicitly maps the mandatory 5 tests onto HEALTH-01..06 — those requirements are fully satisfied. If a future regression surfaces in a non-covered code path, a targeted test can be added then.

## Decisions Made
See `key-decisions` in frontmatter. In short:
- Held to the required 5-test floor (quality over quantity, file stays readable)
- Case-variant Authorization assertion in parity test (defensive)
- Tolerant hint-string matching for timeout (`'15 seconds'` OR `'15s'`)

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0
**Impact on plan:** No scope creep. The five tests land exactly where the plan's <must_haves> and <success_criteria> blocks specified.

## Issues Encountered

None. The established MockTransport pattern is well-understood; both the `env_base` fixture and the autouse `reset_settings_cache` fixture worked transparently. Monkeypatching `LLM_AUTH_HEADER_NAME`, `LLM_AUTH_VALUE_PREFIX`, and `LLM_EXTRA_HEADERS` in tests 4 and 5 took effect immediately on the next `TestClient(app)` lifespan (no explicit `get_settings.cache_clear()` call needed — the autouse fixture handles it).

## Sanity Check Record

The one-shot sanity check from the plan's <verify> step 5 was performed:

1. Backed up `backend/app/routers/health.py` to `.bak`
2. Replaced the settings-driven auth dict with `{"Authorization": f"Bearer {settings.llm_api_key}", "Content-Type": "application/json"}` (dropped `**settings.get_extra_headers()` and the configurable header name)
3. Ran `pytest tests/test_health_llm.py::test_health_check_uses_configurable_auth_header tests/test_health_llm.py::test_health_check_forwards_extra_headers -v`
4. Both tests FAILED with the expected diagnostics:
   - auth-mode parity: `api-key` header missing; `authorization` present
   - extra-headers parity: `X-Corp-Trace` missing
5. Restored `health.py` from the backup
6. Re-ran the test file: 5/5 pass
7. Confirmed `git diff backend/app/routers/health.py` is empty

The parity tests have real teeth and will catch a future Pitfall-1 regression.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend wave of Phase 09 is complete (endpoint + tests shipped, no outstanding debt)
- Response shape is contractually stable and test-locked — Phase 10 (frontend health indicator) can consume it without fear of shape drift
- No blockers. Accepted risk (still) carried from 09-01: the TLS-vs-network `__cause__` discrimination is untested here because MockTransport does not simulate SSL errors cleanly. Worth revisiting if a real-world TLS failure case surfaces.

---
*Phase: 09-llm-health-check-backend*
*Completed: 2026-04-15*
