"""
Backend startup-failure test for Phase 08-04.

When LLM_API_KEY is not set, get_settings() must raise pydantic ValidationError
at startup (NOT a runtime 500). Per 08-RESEARCH Pitfall 3, this is asserted at
the settings layer directly — we do NOT enter the FastAPI test-client context,
because the lifespan calls get_settings() and would crash before the test body
runs, surfacing a confusing setup error rather than the expected exception.

Note on the dev `.env` file:
  backend/app/config.py declares `SettingsConfigDict(env_file=".env", ...)`,
  so pydantic-settings will transparently read `backend/.env` when the test
  runs from backend/. Since the developer's .env legitimately carries
  LLM_API_KEY, deleting the env var via monkeypatch alone is not enough —
  pydantic re-fills from the file. The test therefore also patches the model
  config's `env_file` to None before calling get_settings(), simulating the
  prod condition where no .env file exists and required env vars are missing.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config import Settings, get_settings


def test_missing_llm_api_key_raises_validation_error(monkeypatch):
    """With LLM_API_KEY unset AND no .env file fallback, get_settings() must
    raise pydantic.ValidationError because `llm_api_key: str` has no default
    in backend/app/config.py."""
    # conftest's autouse reset_settings_cache fixture already clears the
    # lru_cache before this test runs. Explicitly delete LLM_API_KEY so this
    # test works whether or not the dev shell has it set (other required env
    # vars being present is fine — the missing LLM_API_KEY alone triggers
    # ValidationError, which is exactly what we're asserting).
    monkeypatch.delenv("LLM_API_KEY", raising=False)

    # Prevent pydantic-settings from reading backend/.env as a fallback.
    # Production deployments have no .env file; this simulates that condition.
    # model_config is a dict-like ConfigDict on the Settings class; patch the
    # env_file key to None so pydantic-settings skips file loading entirely.
    monkeypatch.setitem(Settings.model_config, "env_file", None)

    # Defensive: also clear the lru_cache locally in case fixture ordering
    # differs from current conftest (autouse runs per-test, but belt-and-
    # braces keeps the test robust if someone edits the fixture later).
    get_settings.cache_clear()

    with pytest.raises(ValidationError):
        get_settings()
