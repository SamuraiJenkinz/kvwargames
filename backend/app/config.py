"""
Application configuration using pydantic-settings.

Required env vars (startup fails if missing):
  LLM_API_KEY         - API key for LLM endpoint
  LLM_ENDPOINT_URL    - Full URL of LLM completion endpoint
  LLM_MODEL           - Model identifier string

Optional env vars (have defaults):
  LLM_TIMEOUT_SECONDS   - HTTP timeout in seconds (default: 60)
  LLM_MAX_TOKENS        - Max tokens per completion (default: 2048)
  LLM_EXTRA_HEADERS     - JSON object string for extra HTTP headers (default: '{}')
  LLM_AUTH_HEADER_NAME  - HTTP header name used to carry the API key
                          (default: 'Authorization' for OpenAI-compatible endpoints;
                          set to 'api-key' for Azure OpenAI).
  LLM_AUTH_VALUE_PREFIX - String prefixed to the API key in the auth header
                          (default: 'Bearer ' — trailing space intentional so that
                          f"{prefix}{key}".strip() yields "Bearer <key>". Set to ''
                          for Azure OpenAI, which expects the raw key with no prefix).
  APP_HOST              - Host interface uvicorn binds to (default: '127.0.0.1' for dev).
                          Set to '0.0.0.0' for LAN-accessible deployment.
  APP_PORT              - TCP port uvicorn binds to (default: 8000).

TTS provider (v1.2 Phase 13):
  TTS_PROVIDER            - Which TTS backend to use: 'fake' (default) or 'elevenlabs'.
                            'fake' uses pre-recorded fixtures with no network calls.
  ELEVENLABS_API_KEY      - Required when TTS_PROVIDER=elevenlabs.
  ELEVENLABS_VOICE_KENT   - ElevenLabs voice ID for Kent Valentina.
                            Required when TTS_PROVIDER=elevenlabs.
  ELEVENLABS_VOICE_FINCH  - ElevenLabs voice ID for Dr. Alistair Finch.
                            Required when TTS_PROVIDER=elevenlabs.
  ELEVENLABS_VOICE_CHEN   - ElevenLabs voice ID for Dr. Michael Chen.
                            Required when TTS_PROVIDER=elevenlabs.
  ELEVENLABS_MODEL_ID     - ElevenLabs model identifier (default: 'eleven_multilingual_v2').
  ELEVENLABS_OUTPUT_FORMAT - ElevenLabs output format (default: 'mp3_44100_128').
  FAKE_TTS_DELAY_SECONDS  - Simulated render delay for FakeTTSProvider, in seconds
                            (default: 2.0). Tests set to 0.0.
"""

import json
from functools import lru_cache
from typing import Literal, Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Required — no default means ValidationError on missing
    llm_api_key: str
    llm_endpoint_url: str
    llm_model: str

    # Optional with defaults
    llm_timeout_seconds: int = 60
    llm_max_tokens: int = 2048
    llm_extra_headers: str = "{}"
    llm_auth_header_name: str = "Authorization"
    llm_auth_value_prefix: str = "Bearer "

    # Server bind — defaults preserve dev behavior (localhost only)
    app_host: str = "127.0.0.1"
    app_port: int = 8000

    # -----------------------------------------------------------------------
    # TTS provider selection (v1.2 Phase 13)
    # -----------------------------------------------------------------------
    tts_provider: Literal["fake", "elevenlabs"] = "fake"

    # ElevenLabs config — optional unless tts_provider == "elevenlabs"
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_voice_kent: Optional[str] = None
    elevenlabs_voice_finch: Optional[str] = None
    elevenlabs_voice_chen: Optional[str] = None
    elevenlabs_model_id: str = "eleven_multilingual_v2"
    elevenlabs_output_format: str = "mp3_44100_128"

    # FakeTTSProvider config
    fake_tts_delay_seconds: float = 2.0

    def get_extra_headers(self) -> dict:
        """Parse llm_extra_headers JSON string safely. Returns {} on parse error."""
        try:
            return json.loads(self.llm_extra_headers)
        except json.JSONDecodeError:
            return {}

    @model_validator(mode="after")
    def validate_elevenlabs_config(self) -> "Settings":
        """When tts_provider=elevenlabs, require the four ELEVENLABS_* env vars."""
        if self.tts_provider == "elevenlabs":
            missing = [
                name for name, val in [
                    ("ELEVENLABS_API_KEY", self.elevenlabs_api_key),
                    ("ELEVENLABS_VOICE_KENT", self.elevenlabs_voice_kent),
                    ("ELEVENLABS_VOICE_FINCH", self.elevenlabs_voice_finch),
                    ("ELEVENLABS_VOICE_CHEN", self.elevenlabs_voice_chen),
                ]
                if not val
            ]
            if missing:
                raise ValueError(
                    f"Required when TTS_PROVIDER=elevenlabs: {', '.join(missing)}"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance. Raises ValidationError if required env vars are missing."""
    return Settings()
