"""TTS provider factory — selects FakeTTSProvider or ElevenLabsTTSProvider based on Settings.tts_provider."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .base import TTSProvider
from .errors import TTSProviderError

if TYPE_CHECKING:
    from app.config import Settings

__all__ = ["TTSProvider", "TTSProviderError", "get_tts_provider"]


def get_tts_provider(settings: "Settings") -> TTSProvider:
    """Return the TTSProvider implementation chosen by settings.tts_provider.

    No silent fallback: invalid value would have failed pydantic-settings
    Literal validation at Settings instantiation time.
    """
    if settings.tts_provider == "fake":
        from .fake_provider import CHEN_BYTES, FINCH_BYTES, KENT_BYTES, FakeTTSProvider

        # Map the three configured voice_ids to their fixture bytes.
        # When ELEVENLABS_VOICE_* are None (fake mode, no ElevenLabs vars),
        # use three well-known sentinel strings so tests have stable keys.
        voice_map = {
            settings.elevenlabs_voice_kent or "__fake_kent__": KENT_BYTES,
            settings.elevenlabs_voice_finch or "__fake_finch__": FINCH_BYTES,
            settings.elevenlabs_voice_chen or "__fake_chen__": CHEN_BYTES,
        }
        return FakeTTSProvider(
            voice_map=voice_map,
            delay_seconds=settings.fake_tts_delay_seconds,
        )

    if settings.tts_provider == "elevenlabs":
        from .elevenlabs_provider import ElevenLabsTTSProvider

        return ElevenLabsTTSProvider(
            api_key=settings.elevenlabs_api_key,
            model_id=settings.elevenlabs_model_id,
            output_format=settings.elevenlabs_output_format,
        )

    # Unreachable due to Literal validation but explicit for type-checkers
    raise RuntimeError(f"Unknown TTS_PROVIDER: {settings.tts_provider!r}")
