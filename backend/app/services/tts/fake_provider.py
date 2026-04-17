"""FakeTTSProvider — deterministic MP3 bytes from pre-recorded fixtures, zero network.

Used as the dev default (TTS_PROVIDER=fake). Returns the same bytes for any
given voice_id regardless of text content. Simulates render latency via
time.sleep(delay_seconds) so Phase 14 progress-UI can be tested locally.

Phase 13 Success Criterion #2: this provider makes ZERO outbound HTTP calls —
proved by the httpx-spy test in test_fake_provider.py.
"""

import logging
import time
from pathlib import Path

from .base import TTSProvider

logger = logging.getLogger(__name__)

_FIXTURES = Path(__file__).parent / "fixtures"

# Load fixture bytes once at module import time — they are small (~80 KB each)
# and shared across all provider instances and all synthesise() calls.
KENT_BYTES = (_FIXTURES / "fake_kent.mp3").read_bytes()
FINCH_BYTES = (_FIXTURES / "fake_finch.mp3").read_bytes()
CHEN_BYTES = (_FIXTURES / "fake_chen.mp3").read_bytes()


class FakeTTSProvider(TTSProvider):
    """Returns deterministic pre-recorded MP3 bytes; no network I/O whatsoever.

    Args:
        voice_map: Mapping of voice_id string → fixture bytes. Built by
                   get_tts_provider() using settings.elevenlabs_voice_* values
                   (or sentinel strings "__fake_kent__" etc. when those are None).
        delay_seconds: Time to sleep before returning bytes, simulating render
                       latency. Set to 0.0 in tests.
    """

    def __init__(self, voice_map: dict[str, bytes], delay_seconds: float = 2.0) -> None:
        self._voice_map = voice_map
        self._delay_seconds = delay_seconds

    def synthesise(self, text: str, voice_id: str) -> bytes:
        """Return fixture MP3 bytes for voice_id.

        The text argument is intentionally ignored — fake output is independent
        of content (same bytes every time for a given voice_id).

        Falls back to the Kent fixture (first in voice_map / KENT_BYTES) if
        voice_id is not in voice_map.
        """
        if self._delay_seconds > 0:
            time.sleep(self._delay_seconds)

        if voice_id in self._voice_map:
            return self._voice_map[voice_id]

        logger.warning(
            "FakeTTSProvider: unknown voice_id %r — falling back to fake_kent.mp3",
            voice_id,
        )
        return KENT_BYTES
