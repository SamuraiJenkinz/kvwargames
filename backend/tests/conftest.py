"""
Shared test fixtures for backend tests.

Key fixtures:
  - env_base: sets the three required LLM_* env vars so Settings can instantiate.
  - reset_settings_cache: clears the lru_cache on get_settings between tests so
    env-var changes actually take effect (tests that set env vars with
    monkeypatch must re-read settings).

The http_client lifespan is deliberately NOT invoked in these tests.  Each
test that exercises the /api/llm route is expected to install its own
httpx.AsyncClient(transport=httpx.MockTransport(...)) onto app.state via
the helpers in test_llm_auth_header.py.
"""

import pytest

from app.config import get_settings


@pytest.fixture
def env_base(monkeypatch):
    """Minimum viable env for Settings() to validate."""
    monkeypatch.setenv("LLM_API_KEY", "test-key-abc123")
    monkeypatch.setenv("LLM_ENDPOINT_URL", "https://upstream.example.com/v1/chat/completions")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    # Ensure previous tests' values don't leak through pydantic-settings
    monkeypatch.delenv("LLM_AUTH_HEADER_NAME", raising=False)
    monkeypatch.delenv("LLM_AUTH_VALUE_PREFIX", raising=False)
    monkeypatch.delenv("LLM_EXTRA_HEADERS", raising=False)


@pytest.fixture(autouse=True)
def reset_settings_cache():
    """Clear the lru_cache'd Settings before and after every test."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def env_tts_fake(monkeypatch):
    """Set TTS_PROVIDER=fake with zero delay — for debrief podcast endpoint tests.

    Must be combined with env_base so LLM_* required vars are present.
    """
    monkeypatch.setenv("TTS_PROVIDER", "fake")
    monkeypatch.setenv("FAKE_TTS_DELAY_SECONDS", "0.0")
