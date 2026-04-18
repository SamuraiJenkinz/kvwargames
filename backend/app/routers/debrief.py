"""Debrief podcast router — Phase 14.

Endpoints:
  POST /api/debrief/podcast          -> text/event-stream (SSE sidecar)
  GET  /api/debrief/podcast/audio    -> audio/mpeg (token-authenticated pull)

Key invariants:
  - Cache lives on app.state.podcast_cache (created in lifespan).
  - Token store lives on app.state.podcast_tokens (created in lifespan).
  - TTS provider is resolved per-request via get_tts_provider(settings) — this
    returns a fresh instance but all FakeTTSProvider instances share the module-level
    fixture bytes, so instantiation is cheap.
  - The SSE endpoint is an async generator that yields ServerSentEvent objects;
    FastAPI's routing layer serializes them to the text/event-stream wire format.
"""

import logging
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from fastapi.sse import EventSourceResponse, ServerSentEvent
from pydantic import BaseModel, Field

from app.config import get_settings
from app.services.audio_generator import (
    generate_podcast_sse,
)
from app.services.tts import get_tts_provider

logger = logging.getLogger(__name__)
router = APIRouter()


class PersonaTexts(BaseModel):
    kent: str = Field(..., min_length=1)
    finch: str = Field(..., min_length=1)
    chen: str = Field(..., min_length=1)


class VoiceMap(BaseModel):
    kent: str = Field(..., min_length=1)
    finch: str = Field(..., min_length=1)
    chen: str = Field(..., min_length=1)


class PodcastRequest(BaseModel):
    game_name: str = Field(..., min_length=1)
    persona_texts: PersonaTexts
    voices: VoiceMap
    force_fresh: bool = False


@router.post("/api/debrief/podcast", response_class=EventSourceResponse)
async def generate_podcast(body: PodcastRequest, request: Request) -> AsyncIterator[ServerSentEvent]:
    """Serial Kent->Finch->Chen synthesis with per-persona SSE events.

    Yields ServerSentEvent objects; FastAPI serializes them to text/event-stream.
    The client consumes via fetch + ReadableStream (browser EventSource API
    does not support POST bodies).
    """
    settings = get_settings()
    provider = get_tts_provider(settings)
    cache = request.app.state.podcast_cache
    tokens = request.app.state.podcast_tokens

    body_dict = {
        "game_name": body.game_name,
        "persona_texts": {
            "kent": body.persona_texts.kent,
            "finch": body.persona_texts.finch,
            "chen": body.persona_texts.chen,
        },
        "voices": {
            "kent": body.voices.kent,
            "finch": body.voices.finch,
            "chen": body.voices.chen,
        },
        "force_fresh": body.force_fresh,
    }

    async for evt in generate_podcast_sse(request, body_dict, provider, cache, tokens):
        # Use raw_data (pre-serialized JSON string) so FastAPI doesn't re-encode it.
        # The data field would cause double-serialization (the JSON string gets
        # wrapped in another JSON string on the wire).
        yield ServerSentEvent(event=evt["event"], raw_data=evt["data"])


@router.get("/api/debrief/podcast/audio")
async def get_podcast_audio(token: str, request: Request) -> Response:
    """Pull the stitched MP3 by token. Single-use; 404 after first fetch or on unknown token."""
    tokens = request.app.state.podcast_tokens
    audio_bytes = tokens.pop(token)
    if audio_bytes is None:
        raise HTTPException(status_code=404, detail="Unknown or expired podcast audio token")
    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": 'inline; filename="podcast.mp3"',
            "Cache-Control": "no-store",
        },
    )
