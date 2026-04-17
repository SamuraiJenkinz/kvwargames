# Phase 13: Firewall Spike + Mockable Backend Foundation — Research

**Researched:** 2026-04-17
**Domain:** ElevenLabs SDK import surface, pydantic-settings Literal+model_validator, num2words API, ffmpeg fixture generation, codebase collision check
**Confidence:** HIGH

## Summary

The CONTEXT.md for Phase 13 is unusually rich — every architectural decision, interface shape, module layout, and plan boundary is already locked. This document does NOT re-derive those decisions. It answers the narrow question: "what does the planner need to know that isn't already in CONTEXT.md?"

The four targeted findings are: (1) exact file paths in the live codebase that Phase 13 touches or creates, (2) the exact `elevenlabs==2.43.0` import surface and exception taxonomy the `ElevenLabsTTSProvider` must handle, (3) the exact `num2words` call signatures for every normalization rule in the preprocessor, and (4) the concrete `ffmpeg` one-liners to generate the three CBR MP3 fixture files.

One non-obvious finding: the `elevenlabs` SDK does NOT wrap `httpx` exceptions. `httpx.TimeoutException`, `httpx.ConnectError`, and `httpx.RequestError` propagate raw from `client.text_to_speech.convert(...)`. The `ElevenLabsTTSProvider` catch-block must handle these directly alongside the SDK's own `elevenlabs.core.ApiError`.

**Primary recommendation:** Planner can work from CONTEXT.md for all design decisions. Use this document only for the concrete code-level details below.

---

## Codebase File Map

### Files that exist today (read before touching)

All paths relative to repo root `C:\KVWarGame`.

| Path | Phase 13 action | Notes |
|------|----------------|-------|
| `backend/requirements.txt` | Append 2 lines | Currently has 3 deps: fastapi[standard], httpx, pydantic-settings |
| `backend/app/config.py` | Add TTS fields + model_validator | Lines 31–55 are the exact transplant target. `Settings` class only, no other file changes. |
| `backend/app/main.py` | No change in Phase 13 | Router registration for the new debrief router is Phase 14. |
| `backend/app/routers/health.py` | No change in Phase 13 | `/api/health/tts` is Phase 15. Read for error taxonomy only. |
| `backend/tests/conftest.py` | Add TTS env fixture | `env_base` fixture must expose `TTS_PROVIDER=fake` as baseline. Since `tts_provider` defaults to `"fake"`, the minimal change is: ensure `TTS_PROVIDER` is explicitly NOT set (so the default applies) — the current `env_base` doesn't set it, which is already correct. No change needed to conftest unless tests need to exercise `elevenlabs` mode. |

### Files and directories that do NOT yet exist (create in Phase 13)

| Path | Plan | Notes |
|------|------|-------|
| `backend/app/services/` | 13-02 | New package; needs `__init__.py` |
| `backend/app/services/tts/` | 13-02 | New package |
| `backend/app/services/tts/__init__.py` | 13-02 | `get_tts_provider()` factory |
| `backend/app/services/tts/base.py` | 13-02 | `TTSProvider` ABC |
| `backend/app/services/tts/errors.py` | 13-02 | `TTSProviderError` |
| `backend/app/services/tts/fake_provider.py` | 13-02 | `FakeTTSProvider` |
| `backend/app/services/tts/elevenlabs_provider.py` | 13-02 | `ElevenLabsTTSProvider` |
| `backend/app/services/tts/fixtures/fake_kent.mp3` | 13-02 | Binary, generated offline |
| `backend/app/services/tts/fixtures/fake_finch.mp3` | 13-02 | Binary, generated offline |
| `backend/app/services/tts/fixtures/fake_chen.mp3` | 13-02 | Binary, generated offline |
| `backend/app/services/text_preprocessor.py` | 13-03 | Standalone module, NOT a package |
| `backend/tests/fixtures/preprocessor_golden.json` | 13-03 | Golden-file corpus |
| `backend/tests/test_fake_provider.py` | 13-02 | Or merged into one file — planner decides |
| `backend/tests/test_elevenlabs_provider.py` | 13-02 | |
| `backend/tests/test_preprocessor.py` | 13-03 | |
| `.planning/phases/13-firewall-spike-mockable-backend-foundation/13-01-FIREWALL-SPIKE.md` | 13-01 | Evidence file |
| `.planning/phases/13-firewall-spike-mockable-backend-foundation/13-firewall-spike-payload.mp3` | 13-01 | Committed binary |

### Collision check: no `backend/app/services/` exists

Confirmed by Glob — the `services/` directory does not exist. No collision risk. The new package tree is additive only.

No existing file imports from `backend/app/services/`. Main.py imports only `config_gen`, `health`, `llm` routers. No existing test references `services`.

---

## ElevenLabs SDK: Import Surface for `ElevenLabsTTSProvider`

**Installed locally:** `elevenlabs==2.36.1` (project pins `2.43.0` — add to requirements.txt; signature is stable across minor versions in 2.x series, verified by inspecting local install).

### Client construction

```python
from elevenlabs.client import ElevenLabs

client = ElevenLabs(
    api_key=settings.elevenlabs_api_key,
    timeout=settings.elevenlabs_timeout_seconds,  # defaults to 240 in SDK; use 120
)
```

Constructor signature (verified): `__init__(self, *, base_url=None, environment=..., api_key=None, timeout=240, httpx_client=None)`. The `timeout` arg controls the underlying httpx client's default.

### `convert()` call

```python
audio_iter = client.text_to_speech.convert(
    voice_id=voice_id,             # positional-first: str
    text=text,                     # keyword: str
    model_id=settings.elevenlabs_model_id,    # keyword: Optional[str]
    output_format=settings.elevenlabs_output_format,  # keyword: Literal['mp3_44100_128', ...]
    request_options=RequestOptions(timeout_in_seconds=120, max_retries=0),
)
segment_bytes: bytes = b"".join(audio_iter)
```

`convert()` returns `Iterator[bytes]` — byte chunks streamed from the HTTP response. `b"".join(audio_iter)` collects them into a single `bytes` object. This is the **only correct collection pattern** — do not call `list()` or iterate manually.

`RequestOptions` import:
```python
from elevenlabs.core import RequestOptions
```

`RequestOptions` is a `TypedDict`-like with keys: `timeout_in_seconds: NotRequired[int]`, `max_retries: NotRequired[int]`, `additional_headers: NotRequired[Dict]`, `additional_query_parameters: NotRequired[Dict]`, `additional_body_parameters: NotRequired[Dict]`, `chunk_size: NotRequired[int]`.

Set `max_retries=0` — the SDK has built-in retry logic for 429/5xx; we want `TTSProviderError` to surface immediately to the caller rather than blocking silently.

### Exception taxonomy (CRITICAL — not in CONTEXT.md)

The SDK does NOT catch `httpx` exceptions. They propagate raw. The `ElevenLabsTTSProvider.synthesise()` must catch:

| Exception | Import | Maps to `TTSProviderError.code` | `.status` |
|-----------|--------|--------------------------------|-----------|
| `httpx.TimeoutException` | `import httpx` (already in requirements.txt) | `"timeout"` | `None` |
| `elevenlabs.core.ApiError` where `.status_code in (401, 403)` | `from elevenlabs.core import ApiError` | `"auth_error"` | `401` or `403` |
| `elevenlabs.core.ApiError` where `.status_code == 404` | same | `"not_found"` | `404` |
| `elevenlabs.core.ApiError` where `.status_code == 429` | same | `"rate_limited"` | `429` |
| `elevenlabs.core.ApiError` where `.status_code >= 500` | same | `"upstream_error"` | e.g. `503` |
| `elevenlabs.core.ApiError` (any other status) | same | `"upstream_error"` | actual status |
| `httpx.ConnectError` where `isinstance(exc.__cause__, ssl.SSLError)` | `import ssl` | `"tls_error"` | `None` |
| `httpx.ConnectError` (non-TLS) | `import httpx` | `"network_error"` | `None` |
| `httpx.RequestError` (catch-all transport) | `import httpx` | `"network_error"` | `None` |
| `Exception` (empty bytes, iterator exhausted without data, etc.) | — | `"invalid_response"` | `None` |

`ApiError` has `.status_code: Optional[int]` attribute (verified). Handler order matters: `httpx.TimeoutException` must precede `httpx.RequestError` (it is a subclass). `httpx.ConnectError` must precede `httpx.RequestError` (also a subclass). This mirrors the pattern in `backend/app/routers/health.py:132–182` exactly.

`ApiError` does NOT have named subclasses for 401/403/429 — it is a single class; discriminate on `.status_code`. The named subclasses (`UnauthorizedError`, `ForbiddenError`, etc.) exist but their status codes are not set as class attributes; they are raised from `UnprocessableEntityError` (422) only. For all other non-2xx codes the SDK raises `ApiError` directly with `status_code=_response.status_code`.

### SDK version delta (2.36.1 → 2.43.0)

The locally installed `2.36.1` has the same `convert()` signature as `2.43.0` as of research date. The Fern-generated SDK uses weekly auto-generated releases; pinning exactly to `2.43.0` in `requirements.txt` is non-negotiable (from CONTEXT.md). The `apply_text_normalization` parameter is present in both versions.

---

## num2words: Exact Call Signatures

**Installed locally:** `num2words==0.5.14`. All calls verified by REPL execution.

```python
from num2words import num2words
```

| Normalization rule | Regex trigger | Call | Output example |
|--------------------|---------------|------|----------------|
| Year | `\b(19\|20)\d{2}\b` | `num2words(year_int, to='year')` | `num2words(2026, to='year')` → `"twenty twenty-six"` |
| Ordinal | `\b\d+(st\|nd\|rd\|th)\b` | `num2words(n_int, to='ordinal')` | `num2words(22, to='ordinal')` → `"twenty-second"` |
| Plain integer | `\b\d+\b` (after year/ordinal consumed) | `num2words(n_int)` | `num2words(123)` → `"one hundred and twenty-three"` |
| Decimal | `\b\d+\.\d+\b` | `num2words(float_val)` | `num2words(3.5)` → `"three point five"` |
| Percentage | `\b(\d+(?:\.\d+)?)\%` | regex pre-sub: `f"{num2words(n)} percent"` | `"50%"` → `"fifty percent"` |

Percentage handling: num2words has no native `to='percent'` — apply a regex substitution before num2words, or capture the number, call `num2words(n)`, append `" percent"`. The CONTEXT.md prescribes regex pre-substitution.

The `lang` parameter defaults to `'en'` — no need to pass it explicitly.

`num2words(2000)` → `"two thousand"` (plain int, not a year — only match as year if `\b(19|20)\d{2}\b` pattern applies).

`num2words(1, to='ordinal')` → `"first"`. `num2words(3, to='ordinal')` → `"third"`. Ordinal stripping: extract the numeric prefix from `"22nd"` → `22`, pass to `num2words(22, to='ordinal')`.

---

## pydantic-settings: `Literal` + `model_validator` Pattern

Verified by REPL. The existing `backend/app/config.py` pattern transplants cleanly with these additions:

### New fields to add to `Settings`

```python
from typing import Literal, Optional
from pydantic import model_validator

# In Settings class body, after existing fields:

# TTS provider selection
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

@model_validator(mode="after")
def validate_elevenlabs_config(self) -> "Settings":
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
```

### Verification results

- `tts_provider="fake"` with no ElevenLabs vars → instantiates cleanly. (Verified.)
- `tts_provider="elevenlabs"` with missing key → raises `pydantic.ValidationError` with the `ValueError` message. (Verified.)
- `tts_provider="bad_value"` → raises `pydantic.ValidationError` with `type=literal_error` — model_validator does NOT run (Literal validation fails first). (Verified.)
- `tts_provider` default = `"fake"` even when `env_file=None` (no `.env` present). (Verified — safe for CI.)

### Test-isolation concern

The existing `test_missing_env_var.py` patches `Settings.model_config['env_file'] = None` to prevent `.env` file reads. This pattern still works with new fields because `tts_provider` has a default of `"fake"`. Existing tests that only set `LLM_*` vars remain valid — they do not need `TTS_PROVIDER` in the environment.

The `conftest.py` `env_base` fixture does not currently set `TTS_PROVIDER`. Since the default is `"fake"`, this is already correct for Phase 13 tests. No conftest change needed.

---

## ffmpeg Commands: Generating the Three Fixture MP3s

These are run **once, offline, on a developer machine with ffmpeg installed** (ffmpeg is not in PATH on the target Windows Server — confirmed). The generated `.mp3` files are committed as binary. Do NOT run these at test time or app startup.

```bash
# fake_kent.mp3 — 220 Hz sine tone, 5 seconds, 44.1 kHz, mono, 128 kbps CBR
ffmpeg -f lavfi -i "sine=frequency=220:duration=5" -ac 1 -ar 44100 -b:a 128k -f mp3 \
  backend/app/services/tts/fixtures/fake_kent.mp3

# fake_finch.mp3 — 440 Hz (concert A), 5 seconds
ffmpeg -f lavfi -i "sine=frequency=440:duration=5" -ac 1 -ar 44100 -b:a 128k -f mp3 \
  backend/app/services/tts/fixtures/fake_finch.mp3

# fake_chen.mp3 — 660 Hz, 5 seconds
ffmpeg -f lavfi -i "sine=frequency=660:duration=5" -ac 1 -ar 44100 -b:a 128k -f mp3 \
  backend/app/services/tts/fixtures/fake_chen.mp3
```

Flags explained:
- `-f lavfi` — use the virtual device/filter input (lavfi = libavfilter input)
- `-i "sine=frequency=N:duration=5"` — generate a sine wave at N Hz for 5 seconds
- `-ac 1` — mono (matches ElevenLabs `mp3_44100_128` output)
- `-ar 44100` — 44.1 kHz sample rate
- `-b:a 128k` — 128 kbps audio bitrate (CBR)
- `-f mp3` — force MP3 container format

Expected output per file: ~80 KB (5s × 128 kbps / 8 bytes/bit = 80,000 bytes). Audible and distinguishable: 220 Hz is a low drone, 440 Hz is concert A, 660 Hz is noticeably higher. All three will be clearly different when played back.

If ffmpeg is not available, equivalent alternatives: `sox` (`sox -n -r 44100 -c 1 fake_kent.mp3 synth 5 sine 220 rate 44100`), or Python `pydub` on a dev machine (not the target server).

---

## `FakeTTSProvider` Implementation Notes

### Reading fixtures

```python
from pathlib import Path

_FIXTURES_DIR = Path(__file__).parent / "fixtures"

_VOICE_FIXTURE_MAP: dict[str, Path] = {
    # Keyed by the voice_id strings configured in .env (ELEVENLABS_VOICE_KENT etc.)
    # BUT: FakeTTSProvider ignores voice_id and routes by positional persona order.
    # The factory passes the fixture path based on the calling context, not voice_id.
}

# Simpler: map by fixture name directly; factory provides the right path
KENT_FIXTURE = (_FIXTURES_DIR / "fake_kent.mp3").read_bytes()
FINCH_FIXTURE = (_FIXTURES_DIR / "fake_finch.mp3").read_bytes()
CHEN_FIXTURE  = (_FIXTURES_DIR / "fake_chen.mp3").read_bytes()
```

Per CONTEXT.md, `FakeTTSProvider` accepts any `voice_id` string and routes to a fixture by a **stable mapping** (Kent voice → `fake_kent.mp3`). The mapping lives in the provider, not in env. The practical approach: map by the `voice_id` value that `get_tts_provider()` knows corresponds to Kent/Finch/Chen via `settings.elevenlabs_voice_kent` etc. — or simpler, map by persona name (have the factory wire the fixture at construction time).

### `FAKE_TTS_DELAY_SECONDS` placement

The env var `FAKE_TTS_DELAY_SECONDS` (default `2.0`, range `0.0–60.0`) belongs in `Settings` as `fake_tts_delay_seconds: float = 2.0`. Tests set this to `0.0` via monkeypatch to avoid 2-second delays per call. In pytest, either:
- Pass `0.0` explicitly in provider construction
- Or use `monkeypatch.setenv("FAKE_TTS_DELAY_SECONDS", "0")`

The `synthesise()` method is synchronous (per CONTEXT.md: `sync, not async`). The delay is implemented as `import time; time.sleep(self.delay_seconds)`. The `asyncio.sleep` note in CONTEXT.md refers to Phase 14's `run_in_threadpool` wrapping — within the sync provider, `time.sleep` is correct.

---

## Test Pattern for `ElevenLabsTTSProvider`

The provider must be tested with an `httpx.MockTransport` passed via the SDK's `httpx_client` constructor argument:

```python
import httpx
from elevenlabs.client import ElevenLabs

def _make_mock_elevenlabs(handler) -> ElevenLabs:
    mock_httpx = httpx.Client(transport=httpx.MockTransport(handler))
    return ElevenLabs(api_key="test-key", httpx_client=mock_httpx)
```

This is the correct injection point — verified by `ElevenLabs.__init__` signature: `httpx_client: Optional[httpx.Client] = None`. The sync `httpx.Client` (not `AsyncClient`) is the right type since the SDK uses sync transport.

For testing `TTSProviderError` mapping, raise `httpx.TimeoutException` (or `ApiError` with appropriate `status_code`) from the mock handler.

---

## Evidence File Template Reference

The `13-01-FIREWALL-SPIKE.md` template mirrors `.planning/phases/12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md`. Confirmed structure from that file:

1. Replay metadata table (date, machine identifier, network indicator, tool versions)
2. Exact command run (with API key replaced by `<API_KEY_REDACTED>`)
3. Result (HTTP status, response headers sanitized, `len(response.content)` bytes, wall-clock seconds)
4. Committed binary reference (`13-firewall-spike-payload.mp3`)
5. VLC verification note

The planner should include this structure in the 13-01 plan's "actions" section as the expected output shape.

---

## Open Questions

None that block planning. Two informational notes:

1. **`elevenlabs==2.43.0` not installed in dev environment.** The local machine has `2.36.1`. The plan should include a step to run `pip install -r requirements.txt` after adding the new deps. The `convert()` signature is stable across this version range — no code changes expected.

2. **`MAX_CONCURRENT_TTS` field.** CONTEXT.md references it as a Phase 14 concern (the audio generator orchestrator owns concurrency). Do NOT add `MAX_CONCURRENT_TTS` to `Settings` in Phase 13 — the planner confirmed this is Phase 14's deferred item.

---

## Sources

### Primary (HIGH confidence)

- Live codebase read: `backend/app/config.py`, `backend/app/main.py`, `backend/app/routers/health.py`, `backend/tests/conftest.py`, `backend/tests/test_missing_env_var.py`, `backend/requirements.txt` — all read directly
- REPL verification: `elevenlabs==2.36.1` installed, all import paths and signatures confirmed by execution
- REPL verification: `num2words==0.5.14` installed, all conversion cases executed
- REPL verification: `pydantic-settings` Literal + model_validator pattern executed against 3 test cases
- `.planning/phases/13-firewall-spike-mockable-backend-foundation/13-CONTEXT.md` — read in full
- `.planning/research/SUMMARY.md`, `.planning/research/STACK.md` — read in full

### Secondary (MEDIUM confidence)

- `.planning/phases/12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md` — evidence file template structure confirmed
- ElevenLabs SDK `raw_client.py` and `http_client.py` source — exception propagation behavior confirmed by reading source directly

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Codebase file map | HIGH | Glob + Read confirmed every path |
| ElevenLabs import surface | HIGH | REPL-verified on installed SDK; `convert()` sig stable across 2.x minor versions |
| Exception taxonomy | HIGH | Source code of `raw_client.py` and `http_client.py` read directly |
| num2words call signatures | HIGH | REPL-verified on installed 0.5.14 |
| pydantic-settings pattern | HIGH | REPL-verified against 3 test cases |
| ffmpeg commands | HIGH | Standard ffmpeg lavfi syntax; `-ac 1 -ar 44100 -b:a 128k` flags are stable |

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable libraries; elevenlabs SDK moves fast but we're pinned to 2.43.0)
