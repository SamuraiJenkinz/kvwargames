"""
FastAPI dependency injection helpers.

Usage in route handlers:
    from fastapi import Depends
    from .dependencies import get_http_client

    @router.post("/some-path")
    async def handler(client: httpx.AsyncClient = Depends(get_http_client)):
        ...
"""

import httpx
from fastapi import Request


def get_http_client(request: Request) -> httpx.AsyncClient:
    """Return the shared httpx.AsyncClient stored on app.state by the lifespan."""
    return request.app.state.http_client
