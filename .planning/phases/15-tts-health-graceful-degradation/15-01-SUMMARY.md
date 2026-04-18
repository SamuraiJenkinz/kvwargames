---
phase: 15
plan: "01"
subsystem: backend
tags: [tts, health, elevenlabs, httpx, caching, fastapi, pytest]

dependency_graph:
  requires:
    - "13-01 (TTS service layer + errors.py with TTSErrorCode)"
    - "09-01 (LLM health endpoint — structural template)"
  provides:
    - "GET /api/health/tts — always HTTP 200, 8-code taxonomy, 30s cache, fake short-circuit"
    - "env_tts_elevenlabs pytest fixture"
    - "_make_http_client() factory in health_tts for narrow test patching"
  affects:
    - "15-02 (frontend TTS badge reads this endpoint's response shape)"

tech_stack:
  added: []
  patterns:
    - "_make_http_client() factory pattern: narrow monkeypatch target avoids lifespan collision"
    - "Per-request httpx.AsyncClient for TTS probe (vs shared app.state.http_client for LLM)"
    - "Module-level asyncio.Lock + tuple cache for 30s in-memory debounce"

key_files:
  created:
    - backend/app/routers/health_tts.py
    - backend/tests/test_health_tts.py
  modified:
    - backend/app/main.py
    - backend/tests/conftest.py

decisions:
  - id: D-15-01-A
    description: "_make_http_client() factory extracted for testability"
    rationale: "Patching httpx.AsyncClient globally caused RecursionError (patch replaced the class the factory itself called) and also clobbered main.py lifespan's http_client.aclose(). Extracting a thin _make_http_client() function gives tests a narrow, isolated patch target."
    status: Good

metrics:
  duration: "5 minutes (1776542656 → 1776542996 epoch)"
  completed: "2026-04-18"
  test_count: 14
  test_pass_rate: "14/14 (100%)"
  regression_count: 0
  total_suite_after: "139/139"
---

# Phase 15 Plan 01: TTS Health Endpoint Summary

**One-liner:** `GET /api/health/tts` — always HTTP 200, 8-code ElevenLabs error taxonomy, 30s in-memory cache, `TTS_PROVIDER=fake` zero-latency short-circuit, proven by 14 mocked pytest tests.

## What Was Built

### `backend/app/routers/health_tts.py`

New FastAPI router providing `GET /api/health/tts`. Key properties:

- **Always HTTP 200** — body `ok` boolean carries upstream health signal.
- **`TTS_PROVIDER=fake` short-circuit** — fires before cache/network; returns `{ok: true, latencyMs: 0}` immediately. Prevents false-amber on dev setups.
- **30-second in-memory cache** via module-level `asyncio.Lock` + `(timestamp, body)` tuple. Prevents ElevenLabs quota burn on repeated frontend polls.
- **`?force=true` query param** bypasses cache READ; still WRITES result back to cache on completion.
- **Per-request `httpx.AsyncClient`** via `_make_http_client()` factory — not the shared `app.state.http_client` (which is the LLM client with different timeout/auth defaults).
- **15-second SLA** via `httpx.Timeout(15.0)` on the per-request client.
- **Probe URL:** `https://api.elevenlabs.io/v1/user` (hardcoded — ~200B response vs ~50KB for /v1/voices, same auth surface).
- **Auth header:** `xi-api-key: {settings.elevenlabs_api_key}` — NOT `Authorization: Bearer`.
- **Exception handler order** (load-bearing): `TimeoutException → HTTPStatusError → ConnectError → RequestError → Exception`.
- **Response validation:** asserts `"subscription" in data` after `raise_for_status()` — missing key triggers `invalid_response`.

### `backend/tests/conftest.py`

Added `env_tts_elevenlabs` fixture — sets `TTS_PROVIDER=elevenlabs` + `ELEVENLABS_API_KEY=test-el-key-abc` + all 3 voice IDs. Satisfies `validate_elevenlabs_config` model validator without real ElevenLabs usage.

### `backend/tests/test_health_tts.py`

14 tests, all MockTransport-based (zero real network calls):

| # | Test | What It Proves |
|---|------|----------------|
| 1 | `test_tts_health_success` | 200 body shape, probe URL, xi-api-key header |
| 2 | `test_tts_health_auth_error_401` | 401 → `auth_error`, hint names ELEVENLABS_API_KEY |
| 3 | `test_tts_health_auth_error_403` | 403 → `auth_error`, status=403 |
| 4 | `test_tts_health_not_found_404` | 404 → `not_found` |
| 5 | `test_tts_health_rate_limited_429` | 429 → `rate_limited` |
| 6 | `test_tts_health_upstream_error_500` | 500 → `upstream_error`, hint includes "500" |
| 7 | `test_tts_health_timeout` | TimeoutException → `timeout`, status=null, hint "15 seconds" |
| 8 | `test_tts_health_network_error` | ConnectError (no SSL) → `network_error` |
| 9 | `test_tts_health_tls_error` | ConnectError with SSLError cause → `tls_error` |
| 10 | `test_tts_health_invalid_response` | 200 without `subscription` key → `invalid_response` |
| 11 | `test_tts_health_fake_provider_short_circuit` | fake provider: no mock needed, latencyMs=0 |
| 12 | `test_tts_health_cache_hit_avoids_second_probe` | second call within 30s uses cache, counter=0 |
| 13 | `test_tts_health_force_true_bypasses_cache` | force=true bypasses read + writes back; next plain GET sees cached forced result |
| 14 | `test_tts_health_15s_sla_per_request_override` | TimeoutException surfaces in <2s wall-clock |

### `backend/app/main.py`

Added `health_tts` to imports and `app.include_router(health_tts.router)` after `health.router`. Both `/api/health/llm` and `/api/health/tts` confirmed discoverable via `app.routes`.

## Endpoint Contract Samples

```
# TTS_PROVIDER=fake (dev default)
GET /api/health/tts
-> {"ok": true, "latencyMs": 0}

# ElevenLabs success
GET /api/health/tts
-> {"ok": true, "latencyMs": 142}

# Bad API key
GET /api/health/tts
-> {"ok": false, "code": "auth_error", "status": 401,
    "hint": "Authentication failed — check ELEVENLABS_API_KEY in .env",
    "latencyMs": 88}

# Cache hit
GET /api/health/tts  (within 30s of previous)
-> (same body from cache, no network call)

# Force bypass
GET /api/health/tts?force=true
-> (fresh probe regardless of cache age)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RecursionError when monkeypatching `httpx.AsyncClient`**

- **Found during:** Task 2 (first pytest run)
- **Issue:** Plan specified `monkeypatch.setattr("app.routers.health_tts.httpx.AsyncClient", factory)`. The `_MockedAsyncClient.__init__` called `httpx.AsyncClient(...)` — but since `httpx.AsyncClient` was already patched to `_MockedAsyncClient`, this recursed infinitely. Secondary issue: `main.py` lifespan's `app.state.http_client.aclose()` also called `_MockedAsyncClient.aclose()` which didn't exist, raising `AttributeError`.
- **Fix:** Extracted `_make_http_client()` factory function in `health_tts.py`. Tests monkeypatch `"app.routers.health_tts._make_http_client"` instead — a narrow target that does not affect `httpx.AsyncClient` globally or `main.py`'s lifespan client.
- **Files modified:** `backend/app/routers/health_tts.py`, `backend/tests/test_health_tts.py`
- **Commits:** c153bf6 (router), 04cd101 (tests + factory)

## Next Phase Readiness

Plan 15-02 (frontend TTS badge) can proceed. The endpoint contract is:
- Shape: `{ok: bool, latencyMs: int}` on success; `{ok: false, code: string, status: int|null, hint: string, latencyMs: int}` on failure.
- Always HTTP 200.
- `code` enum: `timeout | auth_error | not_found | rate_limited | upstream_error | network_error | tls_error | invalid_response`.

No blockers. All 139 backend tests passing.
