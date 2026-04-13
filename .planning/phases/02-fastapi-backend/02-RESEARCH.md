# Phase 2: FastAPI Backend - Research

**Researched:** 2026-04-13
**Domain:** FastAPI credential proxy, httpx async HTTP client, pydantic-settings, static file serving
**Confidence:** HIGH (all core findings verified against official docs or PyPI)

---

## Summary

Phase 2 builds a thin credential proxy: two POST endpoints that inject LLM credentials from environment variables and forward requests to a corporate OpenAI-compatible endpoint, plus static file serving for the React SPA. No business logic, no database, no auth — just a well-structured proxy with clean error handling.

The standard stack is FastAPI 0.135.x + httpx 0.28.x + pydantic-settings 2.13.x. These are the current stable versions as of April 2026. All three have mature async support, play well together, and are the de-facto choices for this problem. There are no meaningful alternatives to consider — these are locked.

The main non-obvious decisions are: (1) how to serve the React SPA with client-side routing from FastAPI — requires either a `SPAStaticFiles` custom subclass or a catch-all `/{path:path}` route; (2) how to share one `httpx.AsyncClient` instance across all requests — use the lifespan context manager + `app.state`; (3) how to make startup fail fast on missing env vars — instantiate `Settings()` inside the lifespan before `yield`.

**Primary recommendation:** Use lifespan context manager to validate settings + create the httpx client at startup. Use a `SPAStaticFiles` subclass for SPA routing. Mount it last, after all API routes.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastapi[standard] | 0.135.3 | Web framework + Uvicorn bundled | De-facto Python async API framework; `[standard]` includes uvicorn |
| httpx | 0.28.1 | Async HTTP client for LLM proxy calls | Official async-first HTTP client; connection pooling; clean exception hierarchy |
| pydantic-settings | 2.13.1 | Env var loading with type validation | Ships with pydantic v2; BaseSettings auto-reads from env + .env file |
| python-dotenv | (bundled with pydantic-settings) | .env file loading | Pulled in automatically by pydantic-settings |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uvicorn[standard] | included via fastapi[standard] | ASGI server | Already included; use `uvicorn app.main:app --reload` for dev |
| starlette | included via fastapi | ASGI foundation, StaticFiles | Use `StaticFiles` from `fastapi.staticfiles` (re-exported) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| httpx | aiohttp | httpx has cleaner API, typed, officially recommended for FastAPI docs |
| pydantic-settings | python-decouple, environs | pydantic-settings integrates with existing pydantic models natively |
| fastapi | Flask + async extensions | FastAPI is the right tool; no reason to deviate |

### Installation
```bash
pip install "fastapi[standard]" httpx pydantic-settings
```

For `requirements.txt`:
```
fastapi[standard]>=0.135.0
httpx>=0.28.0
pydantic-settings>=2.13.0
```

---

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app instance, lifespan, mounts
│   ├── config.py        # Settings class (pydantic-settings)
│   ├── dependencies.py  # get_settings(), get_http_client() DI helpers
│   └── routers/
│       ├── __init__.py
│       ├── llm.py       # POST /api/llm
│       └── config_gen.py # POST /api/generate-config
├── requirements.txt
└── .env                 # gitignored, copied from root .env.example
```

The `backend/` directory lives at project root alongside `src/` (React). The FastAPI process is started from `backend/` with `uvicorn app.main:app`.

### Pattern 1: Settings with pydantic-settings
**What:** BaseSettings auto-reads from environment + .env file. Required fields (no default) raise ValidationError if missing — which is exactly how startup validation works.
**When to use:** Always; this is the only pattern for env-based config.

```python
# Source: https://fastapi.tiangolo.com/advanced/settings/
# backend/app/config.py
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
import json

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Required — startup fails with clear error if missing
    llm_api_key: str
    llm_endpoint_url: str
    llm_model: str

    # Optional with defaults
    llm_timeout_seconds: int = 60
    llm_max_tokens: int = 2048
    llm_extra_headers: str = "{}"  # JSON string; parse at use-site

    def get_extra_headers(self) -> dict:
        return json.loads(self.llm_extra_headers)

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

**Key insight:** pydantic-settings field names are lowercased env var names. `llm_api_key` reads from `LLM_API_KEY`. No prefix needed unless configured.

### Pattern 2: Lifespan for startup validation + httpx client
**What:** Use FastAPI's `lifespan` context manager (the current, non-deprecated approach) to validate settings and create the shared httpx.AsyncClient at startup, store on `app.state`, close on shutdown.
**When to use:** Always — `@app.on_event("startup")` is deprecated as of FastAPI 0.93+.

```python
# Source: https://fastapi.tiangolo.com/advanced/events/
# backend/app/main.py
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI
from .config import get_settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: validate settings (raises ValidationError if env vars missing)
    settings = get_settings()
    # Create shared httpx client — single instance, connection pooling
    timeout = httpx.Timeout(settings.llm_timeout_seconds)
    app.state.http_client = httpx.AsyncClient(timeout=timeout)
    yield
    # Shutdown: close client cleanly
    await app.state.http_client.aclose()

app = FastAPI(lifespan=lifespan)
```

**Key insight:** If `LLM_API_KEY`, `LLM_ENDPOINT_URL`, or `LLM_MODEL` are missing, pydantic raises `ValidationError` before `yield`, which means the server fails to start with a clear message naming the missing variable. This is the "fail fast" behavior required by the spec.

### Pattern 3: httpx proxy request with credential injection
**What:** Accept the frontend request body, merge with credentials from env, POST to upstream LLM endpoint, return text.
**When to use:** Both `/api/llm` and `/api/generate-config` follow this pattern.

```python
# Source: https://www.python-httpx.org/async/ + exception hierarchy
# backend/app/routers/llm.py
import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from ..config import get_settings

router = APIRouter()

class Message(BaseModel):
    role: str  # "user" | "assistant"
    content: str

class LLMProxyRequest(BaseModel):
    systemPrompt: str
    messages: list[Message]
    maxTokens: Optional[int] = None

@router.post("/api/llm")
async def llm_proxy(body: LLMProxyRequest, request: Request):
    settings = get_settings()
    client: httpx.AsyncClient = request.app.state.http_client
    max_tokens = body.maxTokens or settings.llm_max_tokens

    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": body.systemPrompt},
            *[m.model_dump() for m in body.messages],
        ],
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
        **settings.get_extra_headers(),
    }

    try:
        response = await client.post(settings.llm_endpoint_url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        text = data["choices"][0]["message"]["content"]
        return {"text": text}

    except httpx.TimeoutException:
        return JSONResponse(
            status_code=504,
            content={"error": {"code": "LLM_TIMEOUT", "message": f"LLM request timed out after {settings.llm_timeout_seconds}s"}},
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            return JSONResponse(status_code=401, content={"error": {"code": "LLM_AUTH_ERROR", "message": "API key missing or rejected by upstream LLM"}})
        return JSONResponse(
            status_code=502,
            content={"error": {"code": "LLM_UPSTREAM_ERROR", "message": f"Upstream LLM returned {exc.response.status_code}"}},
        )
    except Exception:
        return JSONResponse(status_code=500, content={"error": {"code": "INTERNAL_ERROR", "message": "Unexpected server error"}})
```

### Pattern 4: SPA static file serving
**What:** FastAPI's `StaticFiles` doesn't natively serve `index.html` for client-side routes (e.g. `/game`, `/config`). The standard solution is a custom `SPAStaticFiles` subclass that catches 404s from static lookup and returns `index.html` instead.
**When to use:** Production mode; in development, Vite's dev server handles this.

```python
# Source: community pattern verified against Starlette staticfiles docs
# backend/app/main.py
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as ex:
            if ex.status_code == 404:
                return await super().get_response("index.html", scope)
            raise ex

# Mount AFTER all API routes — order matters
# dist/ is Vite's build output relative to where uvicorn is run
app.mount("/", SPAStaticFiles(directory="../dist", html=True), name="spa")
```

**Key insight:** Mount order matters in FastAPI/Starlette. API routes (`/api/llm`, `/api/generate-config`) must be registered before the SPA mount, otherwise the catch-all static mount intercepts them.

### Pattern 5: Custom 422 → 400 override for validation errors
**What:** FastAPI returns 422 by default for request body validation failures. The spec requires 400. Override with a custom `RequestValidationError` handler.

```python
# Source: https://fastapi.tiangolo.com/tutorial/handling-errors/
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "VALIDATION_ERROR", "message": str(exc.errors())}},
    )
```

### Anti-Patterns to Avoid
- **Creating a new `httpx.AsyncClient` per request:** Wastes TCP connections, no pooling, much slower. Always reuse via `app.state`.
- **Using `@app.on_event("startup")`:** Deprecated since FastAPI 0.93. Use `lifespan`.
- **Mounting SPAStaticFiles before API routes:** The static mount is a catch-all sub-application; any route registered after it won't be reachable via standard routing.
- **Forwarding raw upstream error bodies to the client:** May leak internal details. Extract the status code and a sanitized message only.
- **Parsing JSON from env `LLM_EXTRA_HEADERS` at settings init:** Can cause confusing startup errors. Parse it lazily (at use-site or in a method) so the error is contextualized.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Env var loading + type validation | Custom os.environ parsing | pydantic-settings BaseSettings | Type coercion, validation errors, .env support, test overrides |
| Async HTTP client | asyncio + aiohttp from scratch | httpx.AsyncClient | Connection pooling, timeout object, clean exception hierarchy |
| SPA fallback routing | Custom ASGI middleware | SPAStaticFiles subclass (8 lines) | Already solved; don't add middleware complexity |
| Request body validation | Manual `if not body.get(...)` checks | Pydantic models on endpoint params | FastAPI does this automatically; just override the 422→400 status |

**Key insight:** The proxy is thin by design. Every complexity problem here already has a library solution. The entire backend is ~150 lines across 4 files.

---

## Common Pitfalls

### Pitfall 1: `.env` file not found at runtime
**What goes wrong:** pydantic-settings silently ignores a missing `.env` file (it doesn't raise an error if the file doesn't exist — it just reads from the environment only). Required fields still validate, so startup fails with "field required" not "file not found".
**Why it happens:** This is intentional — env vars can come from the OS environment, not just `.env`.
**How to avoid:** Document clearly in README: run `cp .env.example .env` and fill values. The startup validation error will name the missing field.
**Warning signs:** `ValidationError: llm_api_key field required` on first run.

### Pitfall 2: Mount order — SPA swallows API routes
**What goes wrong:** If `app.mount("/", SPAStaticFiles(...))` is called before `app.include_router(llm_router)`, the static mount acts as a sub-application and intercepts all paths including `/api/*`.
**Why it happens:** Starlette processes mounts in registration order, and a mount at `/` matches everything.
**How to avoid:** Always `include_router` before `mount`. Enforce this by convention: put all `app.include_router()` calls together before any `app.mount()` calls in `main.py`.
**Warning signs:** `POST /api/llm` returns a 404 with HTML content.

### Pitfall 3: `LLM_EXTRA_HEADERS` JSON parse failure
**What goes wrong:** `LLM_EXTRA_HEADERS={}` (default) is valid JSON but `LLM_EXTRA_HEADERS={"X-Foo": bar}` (unquoted) silently fails or raises at request time.
**Why it happens:** pydantic-settings loads it as a plain string; JSON parsing happens separately.
**How to avoid:** Parse with `json.loads()` and wrap in try/except at the use-site. Log a warning and fall back to empty dict if parse fails. Document valid format explicitly in `.env.example`.
**Warning signs:** `json.JSONDecodeError` on first LLM request after setting extra headers.

### Pitfall 4: httpx.TimeoutException is a base class — catch the right one
**What goes wrong:** Catching `httpx.TimeoutException` catches all timeout subtypes (ConnectTimeout, ReadTimeout, WriteTimeout, PoolTimeout). This is correct behavior for this proxy, but forgetting to catch it as the parent means you might only catch `ReadTimeout` and miss `ConnectTimeout` on cold upstream starts.
**Why it happens:** The exception hierarchy has 4 timeout subclasses under `TimeoutException`.
**How to avoid:** Always catch `httpx.TimeoutException` (the parent) for the proxy — don't enumerate subtypes.

### Pitfall 5: httpx default timeout is 5 seconds
**What goes wrong:** If you create `httpx.AsyncClient()` without a timeout, the default is 5 seconds — which is too short for corporate LLM proxies that can have 30-40s cold-start latency.
**Why it happens:** httpx default is intentionally conservative.
**How to avoid:** Always pass `httpx.Timeout(settings.llm_timeout_seconds)` to the client constructor in lifespan. Default `LLM_TIMEOUT_SECONDS=60` per spec decision.

### Pitfall 6: Env var naming mismatch — `.env.example` uses `LLM_ENDPOINT`, spec uses `LLM_ENDPOINT_URL`
**What goes wrong:** The existing `.env.example` (from Phase 1) uses `LLM_ENDPOINT` but the Phase 2 context decisions specify `LLM_ENDPOINT_URL`. Also missing `LLM_TIMEOUT_SECONDS`.
**Why it happens:** Phase 1 created a preliminary `.env.example` before the Phase 2 decisions were finalized.
**How to avoid:** Phase 2 must update `.env.example` to: rename `LLM_ENDPOINT` → `LLM_ENDPOINT_URL`, add `LLM_TIMEOUT_SECONDS=60`. The pydantic-settings field name `llm_endpoint_url` reads from `LLM_ENDPOINT_URL`.

---

## Code Examples

### Complete config.py
```python
# Source: https://fastapi.tiangolo.com/advanced/settings/ + pydantic-settings docs
from functools import lru_cache
import json
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Required — no defaults; ValidationError on missing = fast startup failure
    llm_api_key: str
    llm_endpoint_url: str
    llm_model: str

    # Optional with defaults
    llm_timeout_seconds: int = 60
    llm_max_tokens: int = 2048
    llm_extra_headers: str = "{}"

    def get_extra_headers(self) -> dict:
        try:
            return json.loads(self.llm_extra_headers)
        except json.JSONDecodeError:
            return {}

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

### Complete main.py skeleton
```python
# Source: FastAPI official docs — lifespan + static files + error handlers
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import get_settings
from .routers import llm, config_gen

class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as ex:
            if ex.status_code == 404:
                return await super().get_response("index.html", scope)
            raise ex

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()  # Raises ValidationError if required vars missing
    timeout = httpx.Timeout(settings.llm_timeout_seconds)
    app.state.http_client = httpx.AsyncClient(timeout=timeout)
    yield
    await app.state.http_client.aclose()

app = FastAPI(lifespan=lifespan)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "VALIDATION_ERROR", "message": "Malformed request body"}},
    )

# API routes first — before static mount
app.include_router(llm.router)
app.include_router(config_gen.router)

# SPA static files last — catch-all
import os
dist_dir = os.path.join(os.path.dirname(__file__), "..", "..", "dist")
if os.path.isdir(dist_dir):
    app.mount("/", SPAStaticFiles(directory=dist_dir, html=True), name="spa")
```

### httpx exception handling pattern
```python
# Source: https://www.python-httpx.org/exceptions/
try:
    response = await client.post(url, json=payload, headers=headers)
    response.raise_for_status()  # Raises HTTPStatusError for 4xx/5xx
    return {"text": response.json()["choices"][0]["message"]["content"]}

except httpx.TimeoutException:
    # Catches ConnectTimeout, ReadTimeout, WriteTimeout, PoolTimeout
    return JSONResponse(504, {"error": {"code": "LLM_TIMEOUT", "message": f"..."}})

except httpx.HTTPStatusError as exc:
    status = exc.response.status_code
    if status == 401:
        return JSONResponse(401, {"error": {"code": "LLM_AUTH_ERROR", "message": "..."}})
    return JSONResponse(502, {"error": {"code": "LLM_UPSTREAM_ERROR", "message": f"Upstream returned {status}"}})

except httpx.RequestError:
    # ConnectError, NetworkError, etc. — couldn't reach upstream
    return JSONResponse(502, {"error": {"code": "LLM_UNREACHABLE", "message": "Could not reach LLM endpoint"}})

except Exception:
    return JSONResponse(500, {"error": {"code": "INTERNAL_ERROR", "message": "Unexpected server error"}})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@app.on_event("startup")` | `lifespan` context manager | FastAPI 0.93 | on_event is deprecated; lifespan is the only correct approach |
| pydantic v1 `BaseSettings` in `pydantic` package | `pydantic_settings.BaseSettings` in separate `pydantic-settings` package | pydantic v2 | Must install `pydantic-settings` separately; import path changed |
| `StaticFiles(directory="dist")` for SPAs | `SPAStaticFiles` subclass | N/A — workaround | Built-in static files don't handle client-side routing |

**Deprecated/outdated:**
- `@app.on_event("startup"/"shutdown")`: deprecated, use `lifespan`
- `from pydantic import BaseSettings`: pydantic v1 only; in v2 it moved to `pydantic_settings`

---

## Open Questions

1. **Where does uvicorn run from — project root or `backend/`?**
   - What we know: `dist/` is at project root (Vite output), FastAPI is in `backend/`
   - What's unclear: The relative path from `backend/app/main.py` to `../../dist` vs running uvicorn from project root with `backend.app.main:app`
   - Recommendation: Run uvicorn from project root (`python -m uvicorn backend.app.main:app`), mount `dist/` with `directory="dist"` — simplest path resolution

2. **CORS in development**
   - What we know: Vite proxy at `/api/*` → `localhost:8000` is already configured (Phase 1). This eliminates CORS for dev.
   - What's unclear: Whether any dev workflow bypasses the Vite proxy (e.g. calling FastAPI directly on port 8000 from the browser)
   - Recommendation: No CORS middleware needed for this tool. If added later, scope to `localhost:5173` only.

3. **`LLM_EXTRA_HEADERS` as JSON string vs pydantic-settings JSON parsing**
   - What we know: pydantic-settings 2.x can parse JSON fields using `model_validator` or explicit JSON type
   - What's unclear: Whether `llm_extra_headers: dict = {}` works with env var `LLM_EXTRA_HEADERS={"X-Foo": "bar"}` automatically
   - Recommendation: Keep as `str` field and parse manually — more explicit, easier to debug, avoids pydantic-settings quirks with JSON env vars

---

## Sources

### Primary (HIGH confidence)
- https://fastapi.tiangolo.com/tutorial/bigger-applications/ — Project structure, APIRouter pattern
- https://fastapi.tiangolo.com/advanced/settings/ — pydantic-settings integration, lru_cache singleton
- https://fastapi.tiangolo.com/advanced/events/ — lifespan context manager, deprecation of on_event
- https://fastapi.tiangolo.com/tutorial/handling-errors/ — HTTPException, RequestValidationError override
- https://fastapi.tiangolo.com/tutorial/static-files/ — StaticFiles mounting
- https://www.starlette.io/staticfiles/ — html=True parameter, SPA behavior
- https://www.python-httpx.org/exceptions/ — Full exception hierarchy
- https://www.python-httpx.org/advanced/timeouts/ — Timeout object, default 5s
- https://pypi.org/project/fastapi/ — Version 0.135.3, Python >=3.10
- https://pypi.org/project/pydantic-settings/ — Version 2.13.1, released 2026-02-19
- https://pypi.org/project/httpx/ — Version 0.28.1

### Secondary (MEDIUM confidence)
- https://gist.github.com/ultrafunkamsterdam/b1655b3f04893447c3802453e05ecb5e — SPAStaticFiles catch-all pattern (community, verified against Starlette docs)
- https://github.com/trondhindenes/fastapi-lifespan-handler — httpx + lifespan + app.state pattern (community, consistent with FastAPI official lifespan docs)

### Tertiary (LOW confidence)
- WebSearch results on FastAPI CORS/Vite proxy — consistent with known patterns, not independently verified via official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against PyPI directly
- Architecture (lifespan, routers, settings): HIGH — verified against fastapi.tiangolo.com
- SPA static serving pattern: MEDIUM — official docs don't show SPAStaticFiles; community pattern verified against Starlette docs for what StaticFiles does on 404
- Pitfalls: HIGH for mount order, timeout default, env naming; MEDIUM for extra_headers JSON parsing quirks
- httpx exception handling: HIGH — hierarchy verified against python-httpx.org/exceptions/

**Research date:** 2026-04-13
**Valid until:** 2026-07-13 (90 days — FastAPI and pydantic-settings release frequently but API is stable)
