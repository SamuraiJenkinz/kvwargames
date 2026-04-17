"""ElevenLabsTTSProvider — real TTS via the `elevenlabs` SDK.

Built and unit-tested (with httpx.MockTransport) in Phase 13-02.
NOT exercised against live ElevenLabs until Phase 16's Tier-B replay.

Error mapping (all 8 codes from TTSProviderError taxonomy):
  httpx.TimeoutException        → timeout
  ApiError 401/403              → auth_error
  ApiError 404                  → not_found
  ApiError 429                  → rate_limited
  ApiError 5xx                  → upstream_error
  httpx.ConnectError (SSLError) → tls_error
  httpx.ConnectError (other)    → network_error
  httpx.RequestError (other)    → network_error
  empty bytes from 200          → invalid_response

Exception-handler ordering is load-bearing: httpx.TimeoutException MUST precede
httpx.RequestError (subclass). httpx.ConnectError MUST precede httpx.RequestError
(also subclass). Matches health.py handler order exactly.
"""

import ssl
from typing import Optional

import httpx

from .base import TTSProvider
from .errors import TTSProviderError


class ElevenLabsTTSProvider(TTSProvider):
    """Calls the ElevenLabs TTS API via the official `elevenlabs` SDK.

    Args:
        api_key: ElevenLabs API key (ELEVENLABS_API_KEY).
        model_id: Model identifier, e.g. "eleven_multilingual_v2".
        output_format: CBR format, e.g. "mp3_44100_128".
        timeout_seconds: Request timeout passed to the SDK client.
        httpx_client: Optional pre-built httpx.Client for test injection.
                      In production this is None (SDK builds its own client).
    """

    def __init__(
        self,
        api_key: str,
        model_id: str,
        output_format: str,
        timeout_seconds: int = 120,
        httpx_client: Optional[httpx.Client] = None,
    ) -> None:
        from elevenlabs.client import ElevenLabs

        self.model_id = model_id
        self.output_format = output_format
        self._client = ElevenLabs(
            api_key=api_key,
            httpx_client=httpx_client,  # None in prod; MockTransport-wrapped Client in tests
            timeout=timeout_seconds,
        )

    def synthesise(self, text: str, voice_id: str) -> bytes:
        """Call ElevenLabs TTS and return raw MP3 bytes.

        Raises:
            TTSProviderError: with one of the 8 error codes on any failure.
        """
        from elevenlabs.core import ApiError
        from elevenlabs.core.request_options import RequestOptions

        try:
            audio_iter = self._client.text_to_speech.convert(
                voice_id=voice_id,
                text=text,
                model_id=self.model_id,
                output_format=self.output_format,
                request_options=RequestOptions(timeout_in_seconds=120, max_retries=0),
            )
            data = b"".join(audio_iter)
            if not data:
                raise TTSProviderError(
                    code="invalid_response",
                    message="empty bytes from ElevenLabs",
                )
            return data
        except httpx.TimeoutException as exc:
            raise TTSProviderError(code="timeout", message=str(exc), status=None) from exc
        except ApiError as exc:
            status = exc.status_code
            if status in (401, 403):
                code = "auth_error"
            elif status == 404:
                code = "not_found"
            elif status == 429:
                code = "rate_limited"
            else:
                code = "upstream_error"
            raise TTSProviderError(code=code, message=str(exc), status=status) from exc
        except httpx.ConnectError as exc:
            if isinstance(exc.__cause__, ssl.SSLError):
                raise TTSProviderError(code="tls_error", message=str(exc)) from exc
            raise TTSProviderError(code="network_error", message=str(exc)) from exc
        except httpx.RequestError as exc:
            raise TTSProviderError(code="network_error", message=str(exc)) from exc
        except TTSProviderError:
            raise  # our own invalid_response — don't wrap again
        except Exception as exc:
            raise TTSProviderError(code="invalid_response", message=str(exc)) from exc
