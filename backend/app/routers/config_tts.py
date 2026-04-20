"""
GET /api/config/tts-voices — returns per-persona voice ID map.

Behaviour:
  - TTS_PROVIDER=elevenlabs  → returns the three ELEVENLABS_VOICE_* values from settings.
  - TTS_PROVIDER=fake        → returns the sentinel strings used by FakeTTSProvider so the
                               frontend can construct podcast requests without needing to know
                               which provider is active.

This endpoint replaces the hardcoded sentinel voice IDs that ActionToolbar.tsx previously
embedded directly in the handleGenerate function (Phase 16 fix — see 16-RESEARCH.md §4).
Moving the dispatch server-side means the browser always posts the correct IDs regardless
of which TTS backend is configured.

Security note: voice ID values are NOT logged here.  Real ElevenLabs voice IDs are
considered semi-sensitive (they are scoped to the account), so they must not appear in
server stdout/logs that could be captured in CI.
"""

from fastapi import APIRouter, Response

from ..config import get_settings

router = APIRouter()


# Cache-Control: no-store keeps browsers from serving a stale voice map after a
# .env-driven ELEVENLABS_VOICE_* change. Without this, a page loaded under old
# voice IDs would keep posting them to /api/debrief/podcast across restarts.
_NO_STORE_HEADERS = {"Cache-Control": "no-store"}


@router.get("/api/config/tts-voices")
async def get_tts_voices(response: Response) -> dict[str, str]:
    """Return the {kent, finch, chen} voice ID map for the active TTS provider.

    Returns:
        200 JSON: {"kent": str, "finch": str, "chen": str}
        Header:  Cache-Control: no-store (so browsers re-fetch after env changes)

    When TTS_PROVIDER=elevenlabs, values are the ElevenLabs voice IDs from
    settings.elevenlabs_voice_*.  When TTS_PROVIDER=fake, values are the
    __fake_*__ sentinels consumed by FakeTTSProvider.
    """
    response.headers["Cache-Control"] = "no-store"
    settings = get_settings()

    if settings.tts_provider == "elevenlabs":
        # validate_elevenlabs_config ensures these are non-None when provider=elevenlabs.
        # No defensive None-check needed — backend would not have started with missing values.
        return {
            "kent": settings.elevenlabs_voice_kent,   # type: ignore[return-value]
            "finch": settings.elevenlabs_voice_finch, # type: ignore[return-value]
            "chen": settings.elevenlabs_voice_chen,   # type: ignore[return-value]
        }

    # TTS_PROVIDER=fake — return sentinels verbatim so existing fake-mode tests pass unchanged.
    return {
        "kent": "__fake_kent__",
        "finch": "__fake_finch__",
        "chen": "__fake_chen__",
    }
