---
phase: 02-fastapi-backend
status: passed
verified: 2026-04-13
score: 5/5 must-haves verified
gaps: []
---

# Phase 2 Verification: FastAPI Backend

**Phase Goal:** The credential proxy backend is running, tested with curl, and ready for the frontend to wire against — LLM API keys never leave the server.

**Verified:** 2026-04-13
**Status:** passed
**Re-verification:** No — initial verification

---

## Must-Have Checklist

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | POST /api/llm accepts systemPrompt/messages/maxTokens, forwards with credentials injected, returns {text: string}, API key never in response | VERIFIED | Live curl: `{"text":"Test response text"}` returned; grep confirmed `super-secret-key-12345` absent from response body; Authorization header injected server-side only |
| 2 | POST /api/generate-config accepts {brief} and returns {text: string} raw LLM response | VERIFIED | Live curl: 502 (unreachable) with correct JSON shape; code review confirms identical response contract `{"text": text}` at config_gen.py:113 |
| 3 | All LLM params configurable via .env only — no code change required | VERIFIED | config.py:21-33 declares all 6 vars via pydantic-settings; .env.example documents all 6 with comments; maxTokens override confirmed live (LLM_MAX_TOKENS=512 forwarded as max_tokens=512 to upstream) |
| 4 | Missing/wrong API key returns meaningful error with correct status code, not unhandled 500 | VERIFIED | Live 401 mock: returned `{"error":{"code":"LLM_AUTH_ERROR","message":"API key missing or rejected by upstream LLM"}}` with HTTP 401; missing env vars: server refuses to start with pydantic ValidationError naming all 3 missing fields |
| 5 | FastAPI serves React dist/ as SPA static files at http://localhost:8000 in production | VERIFIED | Live test: GET / -> 200, GET /some/spa/route -> 200 (SPA fallback), POST /api/llm -> 502 (API not swallowed); SPAStaticFiles class at main.py:39-56 overrides 404 to return index.html |

**Score:** 5/5 must-haves verified

---

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | API key injected server-side, never returned to browser | VERIFIED | Authorization header set from `settings.llm_api_key` in llm.py:76-80 and config_gen.py:97-101; response body contains only `{"text": ...}` |
| 2 | POST /api/llm returns `{text: string}` on success | VERIFIED | Live test with mock LLM returning choices[0].message.content; llm.py:92 |
| 3 | POST /api/generate-config returns `{text: string}` on success | VERIFIED | config_gen.py:113 — identical return pattern |
| 4 | All 6 env vars present in .env.example with correct names | VERIFIED | LLM_ENDPOINT_URL, LLM_API_KEY, LLM_MODEL, LLM_TIMEOUT_SECONDS, LLM_MAX_TOKENS, LLM_EXTRA_HEADERS — all present at .env.example:12-29 |
| 5 | Startup fails fast with descriptive error when required vars missing | VERIFIED | pydantic ValidationError names missing fields: llm_api_key, llm_endpoint_url, llm_model; "Application startup failed. Exiting." |
| 6 | SPA fallback serves index.html for unknown paths, API routes still first | VERIFIED | SPAStaticFiles mount is last in main.py:114-118; app.include_router() calls at lines 111-112 precede mount |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/config.py` | pydantic-settings with 6 env vars | VERIFIED | 46 lines; Settings class with 3 required + 3 optional fields; lru_cache on get_settings() |
| `backend/app/main.py` | SPAStaticFiles + lifespan + routers | VERIFIED | 119 lines; SPAStaticFiles class, lifespan context manager, RequestValidationError handler returning 400 |
| `backend/app/routers/llm.py` | POST /api/llm with error handling | VERIFIED | 151 lines; 5 error cases handled: timeout(504), auth(401), upstream(502), unreachable(502), unexpected(500) |
| `backend/app/routers/config_gen.py` | POST /api/generate-config with error handling | VERIFIED | 172 lines; identical error handling pattern; CONFIG_GEN_SYSTEM_PROMPT embedded |
| `backend/app/dependencies.py` | get_http_client dependency | VERIFIED | 20 lines; reads from request.app.state.http_client |
| `.env.example` | All 6 vars documented | VERIFIED | All 6 vars present with explanatory comments |
| `backend/requirements.txt` | fastapi, httpx, pydantic-settings | VERIFIED | All 3 packages with minimum versions |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| llm.py | upstream LLM | `client.post()` with injected headers | VERIFIED | llm.py:83-87 |
| config_gen.py | upstream LLM | `client.post()` with injected headers | VERIFIED | config_gen.py:104-109 |
| main.py | lifespan | shared httpx.AsyncClient on app.state | VERIFIED | main.py:73-76 |
| main.py | dist/ | SPAStaticFiles mount (conditional) | VERIFIED | main.py:116-118; only mounts if dir exists |
| routers | config | `get_settings()` (lru_cache) | VERIFIED | Both routers call get_settings() at request time |

---

## Anti-Patterns Found

None. No TODO/FIXME/placeholder/stub patterns found in any backend file. All exception handlers return structured JSON. No raw upstream error bodies forwarded.

---

## Live Test Results (curl)

All tests run against locally started server with Python 3.13.3, FastAPI 0.135.3, httpx 0.28.1, pydantic-settings 2.13.1.

```
POST /api/llm (missing fields)         -> 400 {"error":{"code":"VALIDATION_ERROR","message":"Malformed request body"}}
POST /api/llm (unreachable upstream)   -> 502 {"error":{"code":"LLM_UNREACHABLE","message":"Could not reach LLM endpoint"}}
POST /api/llm (401 from upstream)      -> 401 {"error":{"code":"LLM_AUTH_ERROR","message":"API key missing or rejected by upstream LLM"}}
POST /api/llm (200 from mock LLM)      -> 200 {"text":"Test response text"}
POST /api/generate-config (no body)    -> 400 {"error":{"code":"VALIDATION_ERROR","message":"Malformed request body"}}
POST /api/generate-config (unreachable)-> 502 {"error":{"code":"LLM_UNREACHABLE","message":"Could not reach LLM endpoint"}}
GET / (with dist/ present)             -> 200 (index.html)
GET /some/spa/route (SPA fallback)     -> 200 (index.html)
POST /api/llm (with dist/ present)     -> 502 (API not swallowed by SPA mount)
Server startup (missing env vars)      -> ValidationError listing llm_api_key, llm_endpoint_url, llm_model; exits
```

---

## Human Verification (optional)

The following cannot be verified without a real corporate LLM endpoint. Automated tests confirm structural correctness; end-to-end round-trip with a live LLM requires manual testing.

### 1. Full round-trip with real LLM endpoint

**Test:** Set `LLM_API_KEY`, `LLM_ENDPOINT_URL`, `LLM_MODEL` to real values in `.env`; POST to `/api/llm` with a real system prompt and user message.
**Expected:** HTTP 200, `{"text": "<LLM response string>"}`, no API key visible in browser Network tab.
**Why human:** Requires real corporate LLM credentials not available in this environment.

### 2. LLM_EXTRA_HEADERS forwarded correctly

**Test:** Set `LLM_EXTRA_HEADERS={"X-Corporate-Header": "test-value"}`; use a request-inspection proxy (e.g., ngrok or requestbin) as the endpoint.
**Expected:** The custom header appears in the upstream request alongside Authorization.
**Why human:** Requires an echo-style HTTP server to inspect outbound headers.

---

*Verified: 2026-04-13*
*Verifier: Claude (gsd-verifier)*
