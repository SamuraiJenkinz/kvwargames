"""
Config generation router.

Endpoints added in Plan 02-03:
  POST /api/generate-config — generates a JSON scenario config from a facilitator brief,
                              forwarding to the upstream LLM with credentials injected
                              from environment variables.

Security model:
  The API key NEVER appears in responses or logs. It is read from environment
  via get_settings() and injected into the Authorization header before forwarding.

Design note:
  The LLM response is returned as raw text ({text: string}). JSON parsing and
  validation of the generated config is the client's responsibility so that the
  frontend can surface meaningful errors to the facilitator.
"""

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..config import get_settings

router = APIRouter()


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

CONFIG_GEN_SYSTEM_PROMPT = """You are a war-game scenario designer. Given a facilitator's
brief, produce a complete JSON game configuration that can be loaded directly into the
KV War Game engine.

Rules:
- Output ONLY valid JSON. No markdown code fences, no prose, no comments.
- The root object must contain: "scenarioName", "teams", "injectCards",
  "nationalActions", and "winConditions".
- "teams" is an array of objects with fields: "id", "name", "country", "role".
- "injectCards" is an array of crisis/inject events, each with: "id", "title",
  "description", "severity" (low|medium|high|critical), "affectedTeams" (array of team ids).
- "nationalActions" is an array of actions available to teams, each with: "id", "label",
  "description", "availableTo" (array of team ids or "all").
- "winConditions" is a string describing how the exercise concludes successfully.

Generate enough content to make the scenario playable (minimum 3 teams, 5 inject cards,
4 national actions). Infer plausible details from the brief. If the brief is ambiguous,
make reasonable assumptions consistent with a cyber-defence war game context."""


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class ConfigGenRequest(BaseModel):
    brief: str


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/api/generate-config")
async def generate_config(body: ConfigGenRequest, request: Request) -> JSONResponse:
    """
    Generate a JSON game configuration from a facilitator's natural-language brief.

    - Sends the brief as the user message with a config-generation system prompt.
    - Injects LLM credentials from environment (never from the request body).
    - Returns {text: string} containing the raw LLM output — the client parses/validates
      the JSON so that meaningful validation errors can be shown to the facilitator.
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

    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": CONFIG_GEN_SYSTEM_PROMPT},
            {"role": "user", "content": body.brief},
        ],
        "max_tokens": settings.llm_max_tokens,
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
