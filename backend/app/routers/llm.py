"""
LLM proxy router.

Endpoints added in Plan 02-02:
  POST /api/llm — proxies a completion request to the corporate LLM endpoint,
                  injecting API credentials from environment variables.

Security model:
  The API key NEVER appears in responses or logs. It is read from environment
  via get_settings() and injected into the Authorization header before forwarding.
"""

from typing import Optional

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..config import get_settings

router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class Message(BaseModel):
    role: str
    content: str


class LLMProxyRequest(BaseModel):
    systemPrompt: str
    messages: list[Message]
    maxTokens: Optional[int] = None


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/api/llm")
async def llm_proxy(body: LLMProxyRequest, request: Request) -> JSONResponse:
    """
    Proxy a completion request to the upstream OpenAI-compatible LLM endpoint.

    - Injects LLM credentials from environment (never from the request body).
    - Returns {text: string} on success.
    - Returns a consistent {error: {code, message}} shape on all failure modes.

    Error codes:
      LLM_TIMEOUT        — upstream did not respond within timeout window (504)
      LLM_AUTH_ERROR     — upstream rejected the API key (401)
      LLM_UPSTREAM_ERROR — upstream returned a non-2xx non-401 response (502)
      LLM_UNREACHABLE    — network/connection failure reaching upstream (502)
      INTERNAL_ERROR     — unexpected server-side exception (500)
    """
    settings = get_settings()
    client: httpx.AsyncClient = request.app.state.http_client

    max_tokens = body.maxTokens if body.maxTokens is not None else settings.llm_max_tokens

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
        response = await client.post(
            settings.llm_endpoint_url,
            json=payload,
            headers=headers,
        )
        response.raise_for_status()

        data = response.json()
        text: str = data["choices"][0]["message"]["content"]
        return JSONResponse(status_code=200, content={"text": text})

    except httpx.TimeoutException:
        return JSONResponse(
            status_code=504,
            content={
                "error": {
                    "code": "LLM_TIMEOUT",
                    "message": (
                        f"LLM request timed out after {settings.llm_timeout_seconds}s"
                    ),
                }
            },
        )

    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            return JSONResponse(
                status_code=401,
                content={
                    "error": {
                        "code": "LLM_AUTH_ERROR",
                        "message": "API key missing or rejected by upstream LLM",
                    }
                },
            )
        return JSONResponse(
            status_code=502,
            content={
                "error": {
                    "code": "LLM_UPSTREAM_ERROR",
                    "message": (
                        f"Upstream LLM returned {exc.response.status_code}"
                    ),
                }
            },
        )

    except httpx.RequestError:
        return JSONResponse(
            status_code=502,
            content={
                "error": {
                    "code": "LLM_UNREACHABLE",
                    "message": "Could not reach LLM endpoint",
                }
            },
        )

    except Exception:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Unexpected server error",
                }
            },
        )
