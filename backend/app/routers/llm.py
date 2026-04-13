"""
LLM proxy router.

Endpoints added in Plan 02-02:
  POST /api/llm/chat — proxies a completion request to the corporate LLM endpoint
"""

from fastapi import APIRouter

router = APIRouter()
