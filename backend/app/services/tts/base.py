"""Abstract base class for TTS providers.

Implementations:
  - FakeTTSProvider (fake_provider.py) — dev default, returns pre-recorded MP3 bytes, no network
  - ElevenLabsTTSProvider (elevenlabs_provider.py) — real ElevenLabs API via the `elevenlabs` SDK

Selection is driven by Settings.tts_provider (Literal["fake", "elevenlabs"]) via
get_tts_provider() in __init__.py.

Interface note: synthesise() is SYNCHRONOUS (not async). The underlying
ElevenLabs SDK is sync-first; its AsyncElevenLabs has open issue #243 (TypeError)
as of 2.43.0. The Phase-14 audio_generator orchestrator will wrap provider calls
in starlette.concurrency.run_in_threadpool to keep the endpoint async-clean.
"""

from abc import ABC, abstractmethod


class TTSProvider(ABC):
    """Abstract base class for text-to-speech providers."""

    @abstractmethod
    def synthesise(self, text: str, voice_id: str) -> bytes:
        """Convert text + voice selection to raw MP3 bytes (mp3_44100_128 CBR).

        Raises:
            TTSProviderError: on any failure, with a code from the 8-code taxonomy.
        """
        ...
