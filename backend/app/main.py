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

# SPA static files mounted here — see Plan 02-04
"""

from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .config import get_settings
from .routers import config_gen, llm


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


# Routers — order matters if paths overlap; LLM and config_gen are distinct prefixes
app.include_router(llm.router)
app.include_router(config_gen.router)

# SPA static files mounted here — see Plan 02-04
