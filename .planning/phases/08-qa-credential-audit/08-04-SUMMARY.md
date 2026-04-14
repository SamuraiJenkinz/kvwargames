---
phase: 08-qa-credential-audit
plan: 04
subsystem: testing
tags: [pytest, vitest, httpx-mocktransport, pydantic-settings, error-injection, fastapi-testclient]

# Dependency graph
requires:
  - phase: 06-llm-integration
    provides: Frontend gameStore parse-failure seam (gameStore.test.ts line 631); LLMProxyRequest schema; httpx.MockTransport fixture pattern (06-01)
  - phase: 02-fastapi-backend
    provides: LLM router error-envelope contract (LLM_TIMEOUT 504, LLM_UPSTREAM_ERROR 502, INTERNAL_ERROR 500); Settings with required LLM_API_KEY
provides:
  - Backend error-injection coverage for timeout / upstream-error / truncated-body paths
  - Backend startup-failure coverage for missing LLM_API_KEY (ValidationError at settings layer)
  - Verified existing frontend PARSE_FAILURE test at gameStore.test.ts:631 covers all three invariants (red bubble, gameState unchanged, llmHistory unchanged)
affects: [08-02-live-run, 08-03-credential-audit, phase-8-verifier]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "httpx.MockTransport + app.state.http_client swap — established 06-01, extended to error cases"
    - "monkeypatch Settings.model_config['env_file']=None to suppress dev .env fallback in startup-failure tests"
    - "Settings-layer ValidationError assertion instead of TestClient(app) — avoids lifespan crash confusing the expected-exception assertion"

key-files:
  created:
    - backend/tests/test_error_injection.py
    - backend/tests/test_missing_env_var.py
  modified: []

key-decisions:
  - "Task 1 was verify-only: existing gameStore.test.ts:631 already covers all three PARSE_FAILURE invariants; no edit needed"
  - "Task 2 plan template claimed 'upstream 504 -> backend 504' and 'upstream 500 -> backend 500'; actual router maps httpx.TimeoutException (not upstream 504) to 504 LLM_TIMEOUT and maps all non-2xx non-401 upstream responses to 502 LLM_UPSTREAM_ERROR. Test assertions follow actual router behaviour, not the plan template (plan explicitly instructs this — no production code changes)."
  - "Task 3 needed monkeypatch.setitem(Settings.model_config, 'env_file', None) because backend/.env exists and pydantic-settings would load LLM_API_KEY from it even after monkeypatch.delenv"

patterns-established:
  - "Error-injection test shape: build mock AsyncClient, swap app.state.http_client inside TestClient context, restore in finally, assert status + error.code"
  - "Settings-layer negative test: delete env var + patch env_file to None + cache_clear + pytest.raises(ValidationError)"

# Metrics
duration: 4m 11s
completed: 2026-04-14
---

# Phase 08 Plan 04: Error-Injection Test Coverage Summary

**Three backend error paths (504 timeout / 502 upstream-error / 500 truncated-body) plus missing-env-var startup failure now have dedicated pytest coverage; frontend PARSE_FAILURE invariants verified already complete**

## Performance

- **Duration:** 4m 11s
- **Started:** 2026-04-14T21:31:08Z
- **Completed:** 2026-04-14T21:35:19Z
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 0 (Task 1 was verify-only)

## Accomplishments

- Verified existing `src/lib/gameStore.test.ts:631` PARSE_FAILURE test covers all three invariants: (A) red error bubble with `errorCode === 'PARSE_FAILURE'`, (B) `gameState` deep-equal to `beforeGameState`, (C) `llmHistory` deep-equal to `beforeHistory`. No edit required.
- New `backend/tests/test_error_injection.py` (140 lines) with three tests using the `httpx.MockTransport` pattern locked in 06-01:
  - `test_upstream_timeout_returns_504_llm_timeout` — mock raises `httpx.TimeoutException`; asserts backend returns 504 + `LLM_TIMEOUT`
  - `test_upstream_500_returns_502_llm_upstream_error` — mock returns upstream HTTP 500; asserts backend returns 502 + `LLM_UPSTREAM_ERROR` (router's actual mapping, not pass-through)
  - `test_truncated_body_returns_500_internal_error` — mock returns 200 OK with a JSON body missing `choices[0].message.content`; asserts backend returns 500 + `INTERNAL_ERROR` via the generic exception catch-all
- New `backend/tests/test_missing_env_var.py` (51 lines) asserts `get_settings()` raises `pydantic.ValidationError` when `LLM_API_KEY` is unset; honours 08-RESEARCH Pitfall 3 by asserting at the settings layer without entering a test-client context.
- Full backend suite: 8 baseline → 12 passing (4 new). Full frontend suite: 515 passing; typecheck clean.

## Task Commits

1. **Task 1: Verify PARSE_FAILURE test** — *no commit* (verify-only; existing test at gameStore.test.ts:631 already covers all three invariants and passes)
2. **Task 2: Backend error-injection tests** — `2724260` (test)
3. **Task 3: Missing-env-var startup-failure test** — `00a7719` (test)

## Files Created/Modified

- `backend/tests/test_error_injection.py` **(created)** — three error-injection pytest tests using `httpx.MockTransport`
- `backend/tests/test_missing_env_var.py` **(created)** — startup-failure test asserting `ValidationError` at the settings layer
- `src/lib/gameStore.test.ts` — unchanged; existing line-631 PARSE_FAILURE test verified to pass with all three invariants

## Decisions Made

1. **Task 1 verify-only outcome locked.** The existing test at `gameStore.test.ts:631` captures `beforeGameState` / `beforeHistory` and asserts deep-equality after the parse failure runs, covering invariants (B) and (C). Red bubble + `errorCode === 'PARSE_FAILURE'` assertions cover (A). Supplementary "session continues" assertion was NOT added — plan flagged it as optional and the parent test file's adjacent test ("atomicity across both error paths") already exercises the "next message produces a valid response" invariant with a VALIDATION_FAILURE → happy-path transition.
2. **Error-envelope-shape adaptations (Task 2) — assertions tightened to exact shape.** The plan template used defensive `"X" in str(body) or body.get("error", {}).get("code") == "X"` fallbacks because it was unsure of the router's envelope shape. Reading `backend/app/routers/llm.py` confirmed the exact envelope is `{"error": {"code": ..., "message": ...}}` on all error paths; assertions now use `body["error"]["code"] == "LLM_TIMEOUT"` (etc.) directly.
3. **Router behaviour documented in test comments.** The plan template claimed "upstream 504 → backend 504" and "upstream 500 → backend 500". Actual router behaviour: httpx.TimeoutException (NOT upstream 504) triggers the 504 LLM_TIMEOUT branch; any non-2xx non-401 upstream response (including 500) maps to 502 LLM_UPSTREAM_ERROR via HTTPStatusError. Tests assert the actual behaviour per `decisions_locked #3` ("do NOT modify production code"). Test docstrings explain the mapping so future readers don't re-open this discussion.
4. **Missing-env-var test requires `env_file=None` patch.** `backend/.env` exists locally with `LLM_API_KEY` populated; pydantic-settings would load from it even after `monkeypatch.delenv`. Added `monkeypatch.setitem(Settings.model_config, "env_file", None)` so the test simulates a prod environment with no .env fallback. This detail was not anticipated in the plan but is required for the test to be deterministic across developer machines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Task 2 plan template used incorrect status-code assertions**
- **Found during:** Task 2 (backend error-injection tests)
- **Issue:** Plan template asserted "upstream 504 → backend returns 504" and "upstream 500 → backend returns 500". Reading `backend/app/routers/llm.py` showed the router actually maps `httpx.TimeoutException` (not upstream 504) to 504 LLM_TIMEOUT, and maps ALL non-2xx non-401 upstream responses to 502 LLM_UPSTREAM_ERROR.
- **Fix:** Test 1 mock raises `httpx.TimeoutException` instead of returning 504. Test 2 asserts `resp.status_code == 502` and `body["error"]["code"] == "LLM_UPSTREAM_ERROR"`. Test 3 asserts `INTERNAL_ERROR` (matches the router's generic Exception catch-all). Production code unchanged per `decisions_locked #3`.
- **Files modified:** backend/tests/test_error_injection.py (new file with corrected assertions)
- **Verification:** `cd backend && pytest tests/test_error_injection.py -v` — all 3 pass
- **Committed in:** `2724260`

**2. [Rule 3 — Blocking] Missing-env-var test needed `env_file=None` patch**
- **Found during:** Task 3 (first run of `test_missing_env_var.py`)
- **Issue:** First test run failed with "DID NOT RAISE ValidationError" because `backend/.env` exists locally and pydantic-settings's `SettingsConfigDict(env_file=".env")` re-fills `LLM_API_KEY` from the file even after `monkeypatch.delenv("LLM_API_KEY")`.
- **Fix:** Added `monkeypatch.setitem(Settings.model_config, "env_file", None)` before `get_settings()` so pydantic-settings skips the .env file lookup. Simulates the production condition where no .env file exists.
- **Files modified:** backend/tests/test_missing_env_var.py (added env_file patch before cache_clear)
- **Verification:** `cd backend && pytest tests/test_missing_env_var.py -v` — 1 passed
- **Committed in:** `00a7719`

---

**Total deviations:** 2 auto-fixed (1 bug-tolerant test-assertion correction per plan's explicit "adjust assertion, not code" directive; 1 blocking env-file interaction)
**Impact on plan:** Both deviations are test-only and were explicitly anticipated by the plan's adaptation notes ("if a test fails because the actual error envelope differs ... ADJUST the assertion to match reality"). Zero production code touched.

## Issues Encountered

- The literal plan-verify grep `grep -c "TestClient" backend/tests/test_missing_env_var.py == 0` initially reported 1 because the docstring referenced "TestClient(app)" by name when explaining why we don't use it. Rephrased the docstring to "FastAPI test-client context" to satisfy the literal verify command without weakening the documentation.
- The plan-verify grep `grep -c "monkeypatch.delenv" backend/tests/test_missing_env_var.py == 1` initially reported 3 because the first draft deleted all three required env vars defensively. Simplified to delete only `LLM_API_KEY` (the test's focus), since the `env_file=None` patch handles the file-fallback concern and other env vars being present doesn't affect the missing-key assertion.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 8 success criterion #3 ("Injecting a malformed LLM response produces a red error bubble; the session continues") is covered by:
  - Frontend side: existing `gameStore.test.ts:631` PARSE_FAILURE test (verified) plus adjacent "atomicity across both error paths" test that exercises VALIDATION_FAILURE → happy-path continuity
  - Backend side: new `test_error_injection.py` covers the backend error paths the frontend test mocks
- Phase 8 success criterion on startup behaviour (missing env var failing loudly) is covered by `test_missing_env_var.py` asserting `ValidationError` at the settings layer
- 08-02 (live run) can now rely on: 12/12 backend tests green, 515/515 frontend tests green, zero production changes in this plan
- No coverage gap surfaced for the timeout/abort frontend path (decisions_locked #6 anticipated this — `llmClient.test.ts` already covers the ABORTED path at the controller layer)

---
*Phase: 08-qa-credential-audit*
*Completed: 2026-04-14*
