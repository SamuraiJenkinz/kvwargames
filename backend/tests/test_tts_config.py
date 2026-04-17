"""
Tests for TTS provider configuration in Settings (Phase 13, plan 13-02).

Validates:
  - TTS_PROVIDER=fake is the default; Settings instantiates with only LLM_* vars.
  - TTS_PROVIDER=elevenlabs fails startup when ELEVENLABS_* vars are missing.
  - All four ELEVENLABS_* vars present: Settings instantiates cleanly.
  - Invalid TTS_PROVIDER literal raises ValidationError.
  - FAKE_TTS_DELAY_SECONDS default (2.0) and override both work.

Pattern mirrors test_missing_env_var.py:
  - monkeypatch.setitem(Settings.model_config, "env_file", None) prevents
    pydantic-settings from reading backend/.env and leaking real values into tests.
  - env_base fixture (from conftest) sets the three required LLM_* vars.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config import Settings, get_settings


def test_tts_provider_default_is_fake_with_only_llm_vars_set(env_base, monkeypatch):
    """With only the three LLM vars set and no TTS_PROVIDER, default must be 'fake'."""
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    # Ensure no TTS vars leak from environment
    monkeypatch.delenv("TTS_PROVIDER", raising=False)
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    monkeypatch.delenv("ELEVENLABS_VOICE_KENT", raising=False)
    monkeypatch.delenv("ELEVENLABS_VOICE_FINCH", raising=False)
    monkeypatch.delenv("ELEVENLABS_VOICE_CHEN", raising=False)
    get_settings.cache_clear()

    settings = Settings(_env_file=None)
    assert settings.tts_provider == "fake"


def test_tts_provider_elevenlabs_without_key_raises(env_base, monkeypatch):
    """TTS_PROVIDER=elevenlabs with no ELEVENLABS_API_KEY must raise ValidationError
    mentioning ELEVENLABS_API_KEY."""
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.setenv("TTS_PROVIDER", "elevenlabs")
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    monkeypatch.delenv("ELEVENLABS_VOICE_KENT", raising=False)
    monkeypatch.delenv("ELEVENLABS_VOICE_FINCH", raising=False)
    monkeypatch.delenv("ELEVENLABS_VOICE_CHEN", raising=False)
    get_settings.cache_clear()

    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)
    assert "ELEVENLABS_API_KEY" in str(exc_info.value)


def test_tts_provider_elevenlabs_missing_one_voice_raises(env_base, monkeypatch):
    """TTS_PROVIDER=elevenlabs with all vars except ELEVENLABS_VOICE_CHEN must raise
    ValidationError mentioning ELEVENLABS_VOICE_CHEN."""
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.setenv("TTS_PROVIDER", "elevenlabs")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test-api-key")
    monkeypatch.setenv("ELEVENLABS_VOICE_KENT", "voice-kent-id")
    monkeypatch.setenv("ELEVENLABS_VOICE_FINCH", "voice-finch-id")
    monkeypatch.delenv("ELEVENLABS_VOICE_CHEN", raising=False)
    get_settings.cache_clear()

    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)
    assert "ELEVENLABS_VOICE_CHEN" in str(exc_info.value)


def test_tts_provider_elevenlabs_all_vars_present_ok(env_base, monkeypatch):
    """TTS_PROVIDER=elevenlabs with all four ELEVENLABS_* vars set must instantiate
    cleanly with tts_provider == 'elevenlabs'."""
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.setenv("TTS_PROVIDER", "elevenlabs")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test-api-key")
    monkeypatch.setenv("ELEVENLABS_VOICE_KENT", "voice-kent-id")
    monkeypatch.setenv("ELEVENLABS_VOICE_FINCH", "voice-finch-id")
    monkeypatch.setenv("ELEVENLABS_VOICE_CHEN", "voice-chen-id")
    get_settings.cache_clear()

    settings = Settings(_env_file=None)
    assert settings.tts_provider == "elevenlabs"
    assert settings.elevenlabs_api_key == "test-api-key"


def test_tts_provider_invalid_literal_raises(env_base, monkeypatch):
    """TTS_PROVIDER=bogus must raise ValidationError (Literal validation, not
    the 'Required when TTS_PROVIDER=elevenlabs' message)."""
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.setenv("TTS_PROVIDER", "bogus")
    get_settings.cache_clear()

    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)
    # Should be a literal_error, not the elevenlabs-specific message
    error_str = str(exc_info.value)
    assert "Required when TTS_PROVIDER=elevenlabs" not in error_str
    # It should mention the literal constraint or 'bogus'
    assert "literal" in error_str.lower() or "bogus" in error_str.lower() or "tts_provider" in error_str.lower()


def test_fake_tts_delay_seconds_default(env_base, monkeypatch):
    """FAKE_TTS_DELAY_SECONDS defaults to 2.0 when unset."""
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.delenv("FAKE_TTS_DELAY_SECONDS", raising=False)
    monkeypatch.delenv("TTS_PROVIDER", raising=False)
    get_settings.cache_clear()

    settings = Settings(_env_file=None)
    assert settings.fake_tts_delay_seconds == 2.0


def test_fake_tts_delay_seconds_override(env_base, monkeypatch):
    """FAKE_TTS_DELAY_SECONDS=0.1 must be parsed as 0.1 by Settings."""
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.setenv("FAKE_TTS_DELAY_SECONDS", "0.1")
    monkeypatch.delenv("TTS_PROVIDER", raising=False)
    get_settings.cache_clear()

    settings = Settings(_env_file=None)
    assert abs(settings.fake_tts_delay_seconds - 0.1) < 1e-9
