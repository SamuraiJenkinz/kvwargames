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

CONFIG_GEN_SYSTEM_PROMPT = """You are a war-game scenario designer for the KV War Game engine.
Given a facilitator's brief, produce a complete JSON game configuration.

RULES:
- Output ONLY valid JSON. No markdown code fences, no prose, no comments.
- The word JSON must appear in your output (engine requirement).
- Every field below is required. Do not omit or rename any field.
- Invent plausible domain-appropriate content from the brief; do not leave placeholder strings.

REQUIRED SHAPE:
{
  "name": string,
  "domain": string,
  "description": string,
  "objective": string,
  "redLines": string,
  "pcThresholds": string,
  "votingRule": string,
  "eoMechanic": string,
  "resourceLogic": string,
  "facilitation": string,
  "scenarios": [
    {
      "id": string,
      "name": string,
      "description": string,
      "rounds": number,
      "startState": { "crisisSeverity": 0, "crisisState": "No Crisis", "edipLegitimacy": 0 },
      "injects": [string]
    }
  ],
  "teams": [
    {
      "id": string,
      "name": string,
      "description": string,
      "personas": [string, string],
      "uniqueAction": string,
      "pc": number,
      "po": number,
      "readiness": number,
      "stock": number,
      "crm": number,
      "ic": number
    }
  ],
  "nationalActions": [
    { "id": string, "name": string, "summary": string, "cost": string }
  ],
  "cards": [
    { "id": string, "name": string, "cat": string, "timing": string, "req": string, "effect": string }
  ]
}

NUMERIC RANGES (hard clamps):
- pc: 0-6
- po: -2 to 2
- readiness: 0-5
- stock, crm, ic: 0-9 (plausible starting values)

STRUCTURAL EXEMPLAR (follow this shape exactly -- invent domain-appropriate content):
{
  "name": "EDIP Security of Supply Wargame",
  "domain": "European Defence Technological and Industrial Base",
  "description": "A 4-round tabletop exercise exploring coordinated response to a critical raw materials supply crisis.",
  "objective": "Teams balance national interest with EDIP cohesion under supply pressure.",
  "redLines": "No military escalation. No unilateral export bans without EDIP coordination.",
  "pcThresholds": "PC 1 = STRAINED warning; PC 0 = CRISIS -- team loses one unique action.",
  "votingRule": "Simple majority of teams present; ties resolved by the Chair team.",
  "eoMechanic": "Executive Orders require PC >= 2 and trigger a Chen integrity check.",
  "resourceLogic": "PC regenerates +1 per round up to cap 6; STK depletes when production falters.",
  "facilitation": "Facilitator inputs round injects and Crisis State transitions.",
  "scenarios": [
    {
      "id": "S1",
      "name": "CRM Supply Crisis",
      "description": "A sudden 40% drop in critical raw materials triggers cascading industrial stress.",
      "rounds": 4,
      "startState": { "crisisSeverity": 0, "crisisState": "No Crisis", "edipLegitimacy": 0 },
      "injects": [
        "Round 1: market intelligence signals the CRM shortfall.",
        "Round 2: allied industries begin production slowdowns.",
        "Round 3: strategic stocks approach national minimums.",
        "Round 4: emergency coordination window closes."
      ]
    }
  ],
  "teams": [
    {
      "id": "A",
      "name": "Team A: Frontline Member State",
      "description": "Industrially exposed, politically pragmatic.",
      "personas": ["Industry minister focused on production continuity", "Foreign policy advisor balancing alliance signals"],
      "uniqueAction": "INDUSTRIAL_SURGE (once per round): accelerate one production chain. Cost: PC -1.",
      "pc": 3, "po": 0, "readiness": 3, "stock": 2, "crm": 2, "ic": 2
    }
  ],
  "nationalActions": [
    { "id": "NA-01", "name": "Emergency Procurement", "summary": "Secure short-term supply via bilateral deal.", "cost": "PC -1, IC -1" }
  ],
  "cards": [
    { "id": "C-01", "name": "Strategic Reserve Release", "cat": "Crisis State", "timing": "This Round", "req": "CrisisSeverity >= 2", "effect": "All teams +1 STK." }
  ]
}

MINIMUM OUTPUT: 2 scenarios, 4 teams (IDs A/B/C/D), 4 national actions, 6 cards. Infer plausible details from the brief to make the exercise playable."""


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
        # json_object mode: upstream guarantees syntactically-valid JSON (no prose, no
        # markdown fences). Schema adherence is separately enforced by the frontend
        # validateGameConfig. If the deployed LLM endpoint is NOT OpenAI-compatible
        # and rejects this field with 400, remove this line -- the rest of the pipeline
        # still works without it (the system prompt already forbids prose output).
        "response_format": {"type": "json_object"},
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
