"""
Config generation router.

Endpoints added in Plan 02-03:
  POST /api/config/generate — generates scenario config from a facilitator brief
"""

from fastapi import APIRouter

router = APIRouter()
