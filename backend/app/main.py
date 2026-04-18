"""
FastAPI application entry point.

Start with valid env vars:
    LLM_API_KEY=... LLM_ENDPOINT_URL=... LLM_MODEL=... uvicorn backend.app.main:app

Lifespan:
  - Validates settings at startup (fails fast on missing env vars)
  - Creates a shared httpx.AsyncClient stored on app.state.http_client
  - Closes the client cleanly on shutdown

Error handling:
  - RequestValidationError returns 400 (not 422) with consistent error shape

Routers:
  - llm router     (endpoints added in Plan 02-02)
  - config_gen router (endpoints added in Plan 02-03)

Static serving:
  - SPAStaticFiles mounts dist/ as a catch-all SPA — see Plan 02-04
  - Only activates if dist/ directory exists (skipped in dev mode)
  - Mount is LAST so API routes are registered first and never swallowed
"""

import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import get_settings
from .routers import config_gen, debrief, health, health_tts, llm
from .services.audio_generator import PodcastCache, TokenStore


class SPAStaticFiles(StaticFiles):
    """
    StaticFiles subclass that falls back to index.html for unknown paths.

    Standard StaticFiles raises 404 for any path that doesn't map to a file
    on disk.  A React SPA handles its own routing client-side, so we need the
    server to return index.html for every unknown path and let the JS router
    take over.  API routes are registered before this mount, so they are
    matched first and never reach this handler.
    """

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as ex:
            if ex.status_code == 404:
                return await super().get_response("index.html", scope)
            raise ex


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Startup:
      1. Validate settings — raises pydantic ValidationError on missing env vars,
         which prevents the server from starting.
      2. Create a shared httpx.AsyncClient with configured timeout.

    Shutdown:
      1. Close the httpx.AsyncClient gracefully.
    """
    settings = get_settings()
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(settings.llm_timeout_seconds)
    )
    app.state.http_client = http_client
    app.state.podcast_cache = PodcastCache()
    app.state.podcast_tokens = TokenStore()

    yield

    await app.state.http_client.aclose()


app = FastAPI(
    title="KV War Game API",
    description="Backend proxy for AI persona responses and scenario config generation.",
    version="0.1.0",
    lifespan=lifespan,
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc: RequestValidationError) -> JSONResponse:
    """
    Override FastAPI's default 422 validation error with a consistent 400 shape.

    Returns:
        400 JSON: {"error": {"code": "VALIDATION_ERROR", "message": "Malformed request body"}}
    """
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Malformed request body",
            }
        },
    )


# Routers — order matters if paths overlap; LLM, health, and config_gen are distinct prefixes.
# All API routers MUST be registered before the SPA static mount below, otherwise the
# catch-all static handler will shadow them and return index.html for API paths.
app.include_router(llm.router)
app.include_router(health.router)
app.include_router(health_tts.router)
app.include_router(config_gen.router)
app.include_router(debrief.router)

# SPA static files — MUST be last so API routes registered above are never swallowed.
# Only mounted if the React build output exists; skipped in dev mode (no dist/ until pnpm build).
_dist_dir = os.path.join(os.path.dirname(__file__), "..", "..", "dist")
if os.path.isdir(_dist_dir):
    app.mount("/", SPAStaticFiles(directory=_dist_dir, html=True), name="spa")
