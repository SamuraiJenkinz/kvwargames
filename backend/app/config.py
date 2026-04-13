"""
Application configuration using pydantic-settings.

Required env vars (startup fails if missing):
  LLM_API_KEY         - API key for LLM endpoint
  LLM_ENDPOINT_URL    - Full URL of LLM completion endpoint
  LLM_MODEL           - Model identifier string

Optional env vars (have defaults):
  LLM_TIMEOUT_SECONDS - HTTP timeout in seconds (default: 60)
  LLM_MAX_TOKENS      - Max tokens per completion (default: 2048)
  LLM_EXTRA_HEADERS   - JSON object string for extra HTTP headers (default: '{}')
"""

import json
from functools import lru_cache

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

    def get_extra_headers(self) -> dict:
        """Parse llm_extra_headers JSON string safely. Returns {} on parse error."""
        try:
            return json.loads(self.llm_extra_headers)
        except json.JSONDecodeError:
            return {}


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance. Raises ValidationError if required env vars are missing."""
    return Settings()
