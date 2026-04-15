# Phase 9: LLM Health Check — Backend - Research

**Researched:** 2026-04-15
**Domain:** FastAPI / httpx backend extension — new GET endpoint sharing auth path with existing POST /api/llm
**Confidence:** HIGH — all findings from direct file inspection of the running codebase

---

## Summary

Phase 9 adds `GET /api/health/llm` to an existing FastAPI app. The backend is simple and well-structured: a single `app/` package with two routers, a `pydantic-settings` config module, a shared `httpx.AsyncClient` on `app.state`, and a test suite using `httpx.MockTransport` for all upstream interactions.

The critical finding is that `llm.py` already contains the exact auth construction pattern the health endpoint must reuse (`llm_auth_header_name` / `llm_auth_value_prefix` / `get_extra_headers()`). A new `routers/health.py` file should copy that three-line header dict verbatim — or extract it into a shared helper — to guarantee parity. The `config_gen.py` router hardcodes `Authorization: Bearer` and does **not** use the configurable auth vars; the health endpoint must follow `llm.py`, not `config_gen.py`.

The 15-second timeout is a per-request override (`timeout=httpx.Timeout(15.0)` on the `.post()` call), not a new client — the shared `app.state.http_client` is reused, and the global `llm_timeout_seconds` client timeout is bypassed for this one call. The test pattern is established and uniform across all existing test files; the health tests will follow the same `httpx.MockTransport` + `app.state.http_client` swap pattern.

**Primary recommendation:** Create `app/routers/health.py` with the GET endpoint, extract the shared auth-header construction into a private helper in `llm.py` (or inline it in `health.py`), wire it into `main.py` exactly as the existing routers are wired, and write three focused tests using the established MockTransport pattern.

---

## Q1: Existing /api/llm Route — File, HTTP Client, Auth Construction

**File:** `backend/app/routers/llm.py` (155 lines)

**Route definition:** `@router.post("/api/llm")` at line 46, async function `llm_proxy`.

**HTTP client access:** Retrieved from `request.app.state.http_client` (line 63):
```python
client: httpx.AsyncClient = request.app.state.http_client
```
This is the shared client created in the lifespan (see Q4). No dependency injection via `Depends()` — direct `request.app.state` access. Note that `dependencies.py` exports `get_http_client()` as a `Depends`-ready helper, but `llm.py` does not use it; it accesses `request.app.state` directly.

**Auth construction** (lines 79–84, the pattern health.py MUST replicate):
```python
auth_value = f"{settings.llm_auth_value_prefix}{settings.llm_api_key}".strip()
headers = {
    settings.llm_auth_header_name: auth_value,
    "Content-Type": "application/json",
    **settings.get_extra_headers(),
}
```
This supports both `Authorization: Bearer <key>` (default) and `api-key: <key>` (Azure) modes via `LLM_AUTH_HEADER_NAME` and `LLM_AUTH_VALUE_PREFIX` env vars.

**Warning:** `config_gen.py` (lines 191–196) hardcodes `"Authorization": f"Bearer {settings.llm_api_key}"` and does **not** use `llm_auth_header_name` / `llm_auth_value_prefix`. The health endpoint must follow `llm.py`'s pattern, not `config_gen.py`'s.

**Confidence:** HIGH — read directly from source files.

---

## Q2: Backend Layout — Where Does the New Endpoint Go?

**Current structure:**
```
backend/
├── app/
│   ├── __init__.py           (empty)
│   ├── config.py             (Settings + get_settings)
│   ├── dependencies.py       (get_http_client helper — not used by current routers)
│   ├── main.py               (FastAPI app, lifespan, router wiring)
│   └── routers/
│       ├── __init__.py       (empty)
│       ├── config_gen.py     (POST /api/generate-config)
│       └── llm.py            (POST /api/llm)
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── test_config_gen.py
    ├── test_error_injection.py
    ├── test_llm_auth_header.py
    └── test_missing_env_var.py
```

**Recommendation: new `app/routers/health.py`** — consistent with the existing one-file-per-domain router pattern. `llm.py` and `config_gen.py` are both standalone router files; health belongs in a third.

**Router wiring in `main.py`** (lines 111–112):
```python
from .routers import config_gen, llm

app.include_router(llm.router)
app.include_router(config_gen.router)
```
Adding health requires:
1. Add `from .routers import config_gen, llm, health` to the import line.
2. Add `app.include_router(health.router)` before the SPA static mount.

**Order note:** The SPA static mount at line 117 is last and catches all unknown paths. API routers must be registered before it. The new health router follows the same rule.

**Confidence:** HIGH — read directly from `main.py`.

---

## Q3: Config Loading — How LLM_URL, LLM_API_KEY, LLM_EXTRA_HEADERS, Auth-Mode Are Loaded

**File:** `backend/app/config.py`

**Mechanism:** `pydantic-settings` `BaseSettings` with `SettingsConfigDict(env_file=".env", extra="ignore")`. Loaded via `@lru_cache get_settings()` — single cached instance for the process lifetime. Tests clear it via `get_settings.cache_clear()` in the `autouse` fixture.

**Relevant settings fields:**
| Env Var | Settings field | Default |
|---|---|---|
| `LLM_API_KEY` | `llm_api_key: str` | **required** |
| `LLM_ENDPOINT_URL` | `llm_endpoint_url: str` | **required** |
| `LLM_MODEL` | `llm_model: str` | **required** |
| `LLM_TIMEOUT_SECONDS` | `llm_timeout_seconds: int` | `60` |
| `LLM_EXTRA_HEADERS` | `llm_extra_headers: str` | `"{}"` |
| `LLM_AUTH_HEADER_NAME` | `llm_auth_header_name: str` | `"Authorization"` |
| `LLM_AUTH_VALUE_PREFIX` | `llm_auth_value_prefix: str` | `"Bearer "` |

**`get_extra_headers()` method** (lines 50–55): Parses `llm_extra_headers` JSON string, returns `{}` on parse error. No exceptions propagated.

**Usage in routes:** Both `llm.py` and `config_gen.py` call `get_settings()` at the top of each request handler (not cached at module import time, though the lru_cache means it's effectively a singleton). Health should do the same.

**Confidence:** HIGH — read directly from `config.py`.

---

## Q4: HTTP Client — Shared Instance, Timeout Configuration

**Creation** (`main.py` lines 72–76):
```python
settings = get_settings()
http_client = httpx.AsyncClient(
    timeout=httpx.Timeout(settings.llm_timeout_seconds)
)
app.state.http_client = http_client
```

The client uses a **global timeout** equal to `LLM_TIMEOUT_SECONDS` (default 60s) applied uniformly to connect, read, write, and pool operations.

**Per-request timeout override** (confirmed via httpx inspection): `httpx.AsyncClient.post()` accepts a `timeout=` keyword argument that overrides the client-level default for that call only. The health endpoint should pass `timeout=httpx.Timeout(15.0)` to enforce the 15s requirement independently of `LLM_TIMEOUT_SECONDS`:
```python
response = await client.post(
    settings.llm_endpoint_url,
    json=probe_payload,
    headers=headers,
    timeout=httpx.Timeout(15.0),  # health check SLA, not llm_timeout_seconds
)
```

**Confidence:** HIGH — confirmed via `httpx.AsyncClient.post` signature inspection and `Timeout` constructor behaviour.

---

## Q5: Error Handling Conventions — How /api/llm Surfaces Upstream Errors Today

**Pattern** (`llm.py` lines 86–154): `try/except` chain with four handlers:

| Exception | Maps to | HTTP Status | Code |
|---|---|---|---|
| `httpx.TimeoutException` | timeout | 504 | `LLM_TIMEOUT` |
| `httpx.HTTPStatusError` where `status == 401` | auth error | 401 | `LLM_AUTH_ERROR` |
| `httpx.HTTPStatusError` (any other status) | upstream error | 502 | `LLM_UPSTREAM_ERROR` |
| `httpx.RequestError` | unreachable | 502 | `LLM_UNREACHABLE` |
| `Exception` (catch-all) | internal error | 500 | `INTERNAL_ERROR` |

**Response shape for errors in /api/llm:** `{"error": {"code": "...", "message": "..."}}` — this is the *proxy* error shape, not the health check shape. The health endpoint uses a completely different response shape (`{ok: false, code, status, hint, latencyMs}`) as defined in 09-CONTEXT.md.

**`response.raise_for_status()`** is called before JSON extraction (line 92), which converts non-2xx upstream responses into `httpx.HTTPStatusError`.

**No logging** in the current router handlers — they silently return error JSONResponse. The health endpoint adds structured `INFO` logging per CONTEXT.md decisions.

**Confidence:** HIGH — read directly from `llm.py`.

---

## Q6: Test Infrastructure — Fixtures, MockTransport Pattern, How /api/llm Is Tested

**`conftest.py` fixtures:**
- `env_base` (function-scoped): Sets `LLM_API_KEY`, `LLM_ENDPOINT_URL`, `LLM_MODEL`; deletes auth-mode and extra-headers vars. Required for any test that instantiates Settings.
- `reset_settings_cache` (autouse, function-scoped): Calls `get_settings.cache_clear()` before and after every test. Tests that monkeypatch env vars must use `env_base` (or call cache_clear themselves) to see new values.

**Established MockTransport pattern** (same across `test_llm_auth_header.py`, `test_error_injection.py`, `test_config_gen.py`):
```python
def _build_mock_client(...) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        # raise or return httpx.Response(...)
        ...
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))

def test_something(env_base):
    with TestClient(app) as client:
        original = app.state.http_client
        app.state.http_client = _build_mock_client(...)
        try:
            resp = client.get("/api/health/llm")
        finally:
            app.state.http_client = original
    assert ...
```

**Key detail:** The `TestClient(app)` context manager triggers the FastAPI lifespan (creating a real `httpx.AsyncClient`). After entry, the test immediately replaces `app.state.http_client` with a mock. The `finally` block restores the original so the lifespan's shutdown can close it cleanly.

**Raising exceptions from mock:** `raise httpx.TimeoutException("...", request=request)` — `request=` is required by httpx's exception constructor (verified in `test_error_injection.py` line 41).

**Test file for health should be:** `backend/tests/test_health_llm.py` — following the one-file-per-feature naming convention.

**Confidence:** HIGH — read all four test files.

---

## Q7: Pydantic Response Models — Are Response Shapes Defined as BaseModel?

**Current approach in `llm.py` and `config_gen.py`:** Response shapes are **not** defined as Pydantic `BaseModel` classes. Both endpoints return `JSONResponse(status_code=..., content={...})` with plain dicts.

**Request models only** use Pydantic: `LLMProxyRequest`, `Message`, `ConfigGenRequest` — these are request body validators, not response serializers.

**Implication for health endpoint:** Follow the same convention — return `JSONResponse(status_code=200, content={...})` with plain dicts. No need to define `HealthSuccessResponse(BaseModel)` etc., unless the planner wants to introduce that pattern for the first time here. The CONTEXT.md doesn't require Pydantic response models. Staying consistent with existing code means plain dicts in `JSONResponse`.

**Confidence:** HIGH — read both router files.

---

## Q8: Exception-to-Code Mapping — httpx Exceptions for the Health Error Taxonomy

Verified against live httpx installation:

| Error Code (CONTEXT.md) | httpx Exception | Notes |
|---|---|---|
| `network_error` | `httpx.ConnectError` | DNS failure, connection refused, socket error. Subclass of `httpx.NetworkError` → `httpx.RequestError`. |
| `tls_error` | `httpx.ConnectError` | TLS/SSL handshake failures surface as `ConnectError` wrapping `ssl.SSLError`. No dedicated `TLSError` class in httpx. Distinguished by inspecting `str(exc)` or `exc.__cause__`. |
| `timeout` | `httpx.TimeoutException` | Catches `ConnectTimeout`, `ReadTimeout`, `WriteTimeout`, `PoolTimeout` (all subclasses). Must be caught **before** `httpx.RequestError` since `TimeoutException` is a subclass of `RequestError`. |
| `auth_error` | `httpx.HTTPStatusError` where `exc.response.status_code in (401, 403)` | `response.raise_for_status()` raises this for non-2xx. |
| `not_found` | `httpx.HTTPStatusError` where `exc.response.status_code == 404` | Same mechanism. |
| `rate_limited` | `httpx.HTTPStatusError` where `exc.response.status_code == 429` | Same mechanism. |
| `upstream_error` | `httpx.HTTPStatusError` where `exc.response.status_code >= 500` | Catch-all for remaining 5xx. |
| `invalid_response` | `KeyError` / `json.JSONDecodeError` / `IndexError` | Upstream 200 but missing `choices[0].message.content`. Falls through to a generic `Exception` handler. |

**Critical ordering rule:** `httpx.TimeoutException` is a subclass of `httpx.RequestError`. The `except httpx.TimeoutException` block **must come before** `except httpx.RequestError` in the try/except chain. The existing `llm.py` already does this correctly (line 98 before line 134).

**TLS vs network_error discrimination:** httpx does not provide a dedicated `TLSError`. To implement `tls_error` as a separate code (rather than collapsing it into `network_error`), inspect `exc.__cause__` for `ssl.SSLError`:
```python
except httpx.ConnectError as exc:
    import ssl
    if isinstance(exc.__cause__, ssl.SSLError):
        code, hint = "tls_error", "TLS handshake failed — ..."
    else:
        code, hint = "network_error", "Cannot reach LLM endpoint — ..."
```
This is an implementation detail left to Claude's discretion per CONTEXT.md.

**Confidence:** HIGH for exception class hierarchy (verified via Python REPL). MEDIUM for TLS discrimination (httpx does not document the `__cause__` guarantee, but it is the standard mechanism).

---

## Architecture Patterns

### Recommended Structure for Phase 9

**New file:** `backend/app/routers/health.py`
**Modified file:** `backend/app/main.py` (import + include_router)
**New test file:** `backend/tests/test_health_llm.py`

```
backend/
├── app/
│   ├── routers/
│   │   ├── health.py         ← NEW: GET /api/health/llm
│   │   ├── llm.py            ← possibly extract _build_headers() helper
│   │   └── config_gen.py     ← unchanged
│   └── main.py               ← add health router import + include_router
└── tests/
    └── test_health_llm.py    ← NEW: success, auth failure, timeout tests
```

### Health Endpoint Skeleton (derived from codebase patterns)

```python
# backend/app/routers/health.py
import time
import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from ..config import get_settings

router = APIRouter()

HEALTH_PROBE_PAYLOAD = {
    "messages": [{"role": "user", "content": "Reply with: OK"}],
    "max_tokens": 5,
    "temperature": 0,
}

@router.get("/api/health/llm")
async def llm_health_check(request: Request) -> JSONResponse:
    settings = get_settings()
    client: httpx.AsyncClient = request.app.state.http_client

    # Same auth construction as llm.py lines 79-84
    auth_value = f"{settings.llm_auth_value_prefix}{settings.llm_api_key}".strip()
    headers = {
        settings.llm_auth_header_name: auth_value,
        "Content-Type": "application/json",
        **settings.get_extra_headers(),
    }
    payload = {**HEALTH_PROBE_PAYLOAD, "model": settings.llm_model}

    t0 = time.monotonic()
    try:
        response = await client.post(
            settings.llm_endpoint_url,
            json=payload,
            headers=headers,
            timeout=httpx.Timeout(15.0),  # fixed 15s per HEALTH-06
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        if not content:
            raise ValueError("empty content")
        latency = int((time.monotonic() - t0) * 1000)
        # structured INFO log: code="ok", status=200, latencyMs=...
        return JSONResponse(status_code=200, content={"ok": True, "latencyMs": latency})

    except httpx.TimeoutException:
        latency = int((time.monotonic() - t0) * 1000)
        return JSONResponse(status_code=200, content={
            "ok": False, "code": "timeout", "status": None,
            "hint": "LLM did not respond within 15 seconds ...", "latencyMs": latency
        })
    except httpx.HTTPStatusError as exc:
        latency = int((time.monotonic() - t0) * 1000)
        status = exc.response.status_code
        # map status to code/hint per CONTEXT.md taxonomy
        ...
    except httpx.ConnectError as exc:
        latency = int((time.monotonic() - t0) * 1000)
        # discriminate tls_error vs network_error via exc.__cause__
        ...
    except httpx.RequestError:
        ...
    except Exception:
        # invalid_response: json parse failed or missing choices[0].message.content
        ...
```

### Key Difference from /api/llm Error Handling

`/api/llm` returns non-200 HTTP status codes on errors (401, 502, 504). The health endpoint always returns HTTP 200 — the `ok` boolean in the body is the signal. This is a deliberate design decision from CONTEXT.md, not a mistake.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| HTTP client | New httpx.AsyncClient | `request.app.state.http_client` | Shared client already created in lifespan with connection pooling |
| Auth header construction | Duplicate code | Copy/extract the 3-line pattern from `llm.py` lines 79–84 | Auth-mode parity is the whole point of HEALTH-05 |
| Mock upstream in tests | Custom test server | `httpx.MockTransport` (built-in) | Established pattern across all 3 existing test files; no new deps |
| Timeout | New client | `timeout=httpx.Timeout(15.0)` on `.post()` call | Per-request override, no new client needed |

---

## Common Pitfalls

### Pitfall 1: Copying config_gen.py Auth Instead of llm.py
**What goes wrong:** `config_gen.py` hardcodes `Authorization: Bearer` and ignores `LLM_AUTH_HEADER_NAME`. If health.py copies config_gen.py, the health check passes with default config but fails silently in Azure deployments where `api-key` header is required — the exact failure mode Phase 9 exists to catch.
**How to avoid:** Copy the three-line header dict from `llm.py` lines 79–84.

### Pitfall 2: Wrong except Order (TimeoutException After RequestError)
**What goes wrong:** `httpx.TimeoutException` is a subclass of `httpx.RequestError`. If `except httpx.RequestError` appears first, timeouts are caught there and reported as `network_error` instead of `timeout`.
**How to avoid:** `except httpx.TimeoutException` must come before `except httpx.RequestError` (llm.py already demonstrates this correctly).

### Pitfall 3: Not Restoring app.state.http_client in Tests
**What goes wrong:** If the `finally` block is omitted, the mock client stays on `app.state` for subsequent tests, causing mysterious failures.
**How to avoid:** Always use the try/finally restore pattern from existing tests (conftest does not handle this; each test must restore it).

### Pitfall 4: Creating a New httpx.AsyncClient for the Health Probe
**What goes wrong:** Bypasses connection pooling, leaks connections if not properly closed, and doesn't follow the lifespan-managed pattern.
**How to avoid:** Use `request.app.state.http_client` exactly as llm.py does.

### Pitfall 5: Returning non-200 HTTP Status on Failure
**What goes wrong:** Frontend has to handle two error layers (HTTP status + JSON body). CONTEXT.md explicitly requires always HTTP 200.
**How to avoid:** All `JSONResponse` calls in the health handler use `status_code=200`.

### Pitfall 6: Per-Request Timeout Not Overriding Client Default
**What goes wrong:** If the health probe doesn't pass `timeout=httpx.Timeout(15.0)`, it inherits `llm_timeout_seconds` (default 60s). A 45-second hang would not be caught by the health endpoint's 15s SLA.
**How to avoid:** Always pass `timeout=httpx.Timeout(15.0)` explicitly to the `.post()` call.

---

## Planning Implications for the 3 Plans

### 09-01: GET /api/health/llm endpoint with success/failure response shapes

**Files touched:**
1. **CREATE** `backend/app/routers/health.py` — new router with `GET /api/health/llm`
2. **MODIFY** `backend/app/main.py` (lines 36–37 import block, lines 111–112 include_router block) — add health router

**Specific work:**
- Define `router = APIRouter()` and the GET handler
- Copy auth header construction from `llm.py` lines 79–84 (or extract shared helper)
- Build probe payload: `{"model": ..., "messages": [{"role": "user", "content": "Reply with: OK"}], "max_tokens": 5, "temperature": 0}`
- Call `settings.llm_endpoint_url` via `client.post(...)` using `request.app.state.http_client`
- Return `{"ok": True, "latencyMs": ...}` on success
- Implement full error taxonomy: `httpx.TimeoutException` → timeout, `httpx.HTTPStatusError` with status dispatch (401/403→auth_error, 404→not_found, 429→rate_limited, 5xx→upstream_error), `httpx.ConnectError` with optional TLS discrimination → network_error/tls_error, remaining `httpx.RequestError` → network_error, bare `Exception` → invalid_response
- Always return HTTP 200; failure body has `{ok: False, code, status, hint, latencyMs}`
- Wire into main.py

### 09-02: Timeout handling (15s) and LLM_EXTRA_HEADERS / auth-mode parity

**This is mostly verified by 09-01 implementation, but the plan should verify explicitly:**
- Pass `timeout=httpx.Timeout(15.0)` to `.post()` — not the client default
- Auth parity: `settings.llm_auth_header_name` / `settings.llm_auth_value_prefix` both present
- Extra headers parity: `**settings.get_extra_headers()` present in headers dict
- No new env vars; no changes to `config.py`
- No changes to `llm.py` required (unless extracting shared helper)

**Note:** 09-02 may fold into 09-01 as a checklist rather than separate implementation work — the parity requirements are naturally satisfied if you copy the right pattern from the start.

### 09-03: Backend test coverage (success, auth failure, timeout)

**File:** CREATE `backend/tests/test_health_llm.py`

**Test infrastructure available (no new deps):**
- `env_base` fixture from conftest.py (sets required env vars)
- `reset_settings_cache` autouse fixture (already active)
- `httpx.MockTransport` (built-in)
- `fastapi.testclient.TestClient`

**Three required test scenarios:**
1. **Success:** Mock returns `200` with `{"choices": [{"message": {"role": "assistant", "content": "OK"}}]}` → assert `{"ok": True, "latencyMs": <int>}` and HTTP 200
2. **Auth failure:** Mock returns `401` → assert `{"ok": False, "code": "auth_error", "status": 401, "hint": "...", "latencyMs": <int>}` and HTTP 200
3. **Timeout:** Mock raises `httpx.TimeoutException("...", request=request)` → assert `{"ok": False, "code": "timeout", "status": None, "hint": "...", "latencyMs": <int>}` and HTTP 200

**Additional recommended scenarios** (follow test_error_injection.py's 403, 404, 429, 5xx, network error, invalid_response patterns):
- `403` → auth_error
- `404` → not_found
- `429` → rate_limited
- `500` → upstream_error
- `httpx.ConnectError` → network_error
- Malformed 200 body (missing `choices[0].message.content`) → invalid_response

All use the `try/finally app.state.http_client` swap — copy pattern from `test_error_injection.py` lines 94–107.

---

## Sources

### Primary (HIGH confidence)
- Direct file reads: `backend/app/routers/llm.py`, `backend/app/routers/config_gen.py`, `backend/app/main.py`, `backend/app/config.py`, `backend/app/dependencies.py`
- Direct file reads: `backend/tests/conftest.py`, `backend/tests/test_llm_auth_header.py`, `backend/tests/test_error_injection.py`, `backend/tests/test_config_gen.py`, `backend/tests/test_missing_env_var.py`
- Live Python REPL: httpx exception class hierarchy, `AsyncClient.post()` signature, `Timeout` constructor behaviour — all run against the installed package in the project environment

### Secondary (MEDIUM confidence)
- httpx TLS error discrimination via `exc.__cause__` is standard Python exception chaining but not formally documented in httpx's API reference. Reliable in practice; flag if TLS-specific code differentiation is required in 09-01.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — requirements.txt pins `httpx>=0.28.0`, verified via live import
- Architecture: HIGH — all files read directly; no speculation
- Pitfalls: HIGH — pitfalls 1–5 derived from concrete code evidence; pitfall 6 verified via httpx `.post()` signature inspection

**Research date:** 2026-04-15
**Valid until:** Stable codebase — no expiry concern unless backend router pattern changes
