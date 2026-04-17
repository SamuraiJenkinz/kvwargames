# Phase 13: Firewall Spike + Mockable Backend Foundation - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend infrastructure that lets `POST /api/debrief/podcast` produce a stitched three-voice MP3 entirely against a fake provider — and empirical proof that the corporate firewall will let `api.elevenlabs.io` through before any production code targets it. Three deliverables:

1. **PODDEP-01 firewall spike** — bare-metal `requests.post(...)` from the target Windows Server, evidence committed, PROJECT.md Key Decision entry recorded.
2. **TTSProvider abstraction** — ABC + `FakeTTSProvider` (dev default) + `ElevenLabsTTSProvider` (built, not exercised live in this phase) + `TTS_PROVIDER` env switch.
3. **Text preprocessor** — markdown stripping + acronym pronunciation dict + `num2words` integration + golden-file test corpus from v1.0 Scenario-2 debriefs.

OUT of scope: the `/api/debrief/podcast` router itself (Phase 14), the `/api/health/tts` endpoint (Phase 15), any live ElevenLabs call (Phase 16), and any frontend code (Phase 14).

</domain>

<decisions>
## Implementation Decisions

### FakeTTSProvider output shape

- **Pre-recorded MP3 fixtures, not generated tones, not silent bytes.** Three small `mp3_44100_128` CBR fixtures committed at `backend/app/services/tts/fixtures/fake_{kent,finch,chen}.mp3`, ~5 seconds each (~80 KB per file).
- **Per-persona pitch differentiation is mandatory.** Fixtures must be audibly distinguishable from each other (e.g., 220 Hz / 440 Hz / 660 Hz sine tones, or three distinct short spoken-word clips). Reason: every Phase-14 UX surface — skip-to-persona, "now playing" label, segment-boundary animation — needs to be debugged against the fake before any live call. Indistinguishable fixtures defeat that purpose.
- **Generated offline once, committed binary.** Use `ffmpeg -f lavfi -i "sine=frequency=N:duration=5" -b:a 128k -ar 44100 fake_X.mp3` (or any equivalent generator) on a developer machine, commit the result. Do NOT generate at runtime — the whole point is zero ffmpeg dependency at runtime per the locked raw-bytes-concat decision.
- **Format must match real provider exactly:** `mp3_44100_128` CBR, 44.1 kHz, mono. Mismatch breaks the raw-bytes stitching invariant.
- **Simulated render delay via env var** — `FAKE_TTS_DELAY_SECONDS` (default `2.0`, range `0.0–60.0`). Implemented as `await asyncio.sleep(...)` in the provider before returning bytes. Lets the Phase-14 progress UI be debugged at realistic timings without a real call. Set to `0.0` in pytest.
- **Deterministic:** same `(text, voice_id)` → same bytes. No randomness, no timestamp injection. Hash-based cache in Phase 14 depends on this.
- **Voice ID handling:** `FakeTTSProvider` accepts any voice_id string and routes to a fixture by a stable mapping (Kent voice → `fake_kent.mp3`, etc.). The mapping lives in the provider, not in env — env voice IDs are ignored by the fake.

### Firewall spike scope & evidence (PODDEP-01)

- **Run from the target Windows Server**, NOT from a developer laptop. The corporate firewall behavior is what we're proving; running from elsewhere proves nothing. This is the same network-posture rule the v1.1 Tier-B verification used.
- **Tool: Python `requests.post(...)`** — matches the production stack's TLS posture (httpx and requests share urllib3-adjacent TLS behavior; both honor corporate proxy env vars). `curl` would also work but Python is preferred for parity.
- **Payload:** ~500 characters of representative text (one paragraph of EDIP debrief prose), targeting one of the env-configured ElevenLabs voice IDs (any of Kent/Finch/Chen). Output format pinned to `mp3_44100_128`. Expected response: a >60-second MP3.
- **Evidence committed to** `.planning/phases/13-firewall-spike-mockable-backend-foundation/13-01-FIREWALL-SPIKE.md` with this shape (mirrors `12-LIVE-VERIFICATION.md` pattern):
  1. **Replay metadata** — date, machine identifier (sanitized of employee/asset tags), corporate-network indicator (e.g., "behind MMC corporate proxy"), Python and `requests` versions.
  2. **Exact command run** — full Python invocation with API key replaced by `***` (use `<API_KEY_REDACTED>` literal token).
  3. **Result** — HTTP status code, response headers (sanitized — no auth echoed back), `len(response.content)` in bytes, elapsed wall-clock seconds.
  4. **Committed binary** — the actual MP3 written to `13-firewall-spike-payload.mp3` alongside the markdown. ~960 KB for a 60-second `mp3_44100_128` payload — acceptable to commit.
  5. **VLC verification note** — one sentence confirming the file opens and plays end-to-end at expected duration with audible voice content.
- **PROJECT.md Key Decisions table** gets a new dated entry recording the spike outcome (success: "PODDEP-01 cleared YYYY-MM-DD — corporate firewall passes >60s ElevenLabs TLS payload intact"). Reference to the evidence file. Marked `Good`.
- **Failure handling:** if the spike fails, Phase 13 BLOCKS. Do NOT silently fall back to non-streaming, do NOT vendor a proxy, do NOT switch network. Escalate to network team with the captured evidence; the milestone reschedules. Plans 13-02 and 13-03 must NOT start until 13-01 succeeds. (STATE.md already encodes this as the highest-risk item in v1.2.)
- **Re-run cadence:** spike is one-shot for v1.2. If Phase 16 (the first live phase) fails with a network symptom that contradicts the spike result, re-run is triggered — but that's a Phase-16 concern, not Phase 13.

### Preprocessor acronym + number rules

- **Pipeline order is fixed:** `markdown_strip → acronym_expand → number_normalize`. Reason: stripping markdown first prevents `**EDIP**` becoming `**E D I P**`; acronym expansion before number normalization prevents `PC 2024` (which becomes `P C 2024`) from later confusing year-vs-plain-number detection.
- **Acronym strategy: explicit dict only, no heuristic fallback.**
  - Word-boundary match: `\bEDIP\b` not bare `EDIP`. Avoids corrupting any word containing those letters.
  - Case-sensitive match (acronyms appear in canonical uppercase in the prompt and `edipConfig.ts`).
  - Pluralized forms entered as explicit dict entries (`EDIPs` → "E D I Ps", `PCs` → "P Cs", `ICs` → "I Cs"). No runtime suffix logic.
  - Unknown acronyms pass through unchanged. The golden-file corpus is the safety net; new acronyms surface during Phase-16 listen-through and get added in a follow-up.
  - Required entries (drawn from v1.0 EDIP corpus + research SUMMARY.md): `EDIP`, `EDIPs`, `PC`, `PCs`, `PO`, `POs`, `CRM`, `IC`, `ICs`, `LEFS`, `SIEP`, `SoS`, `EU`, `NATO` (→ "Nato", not letter-spelled — research line 75). Exact list finalized by the planner from the v1.0 Scenario-2 message corpus.
- **Number normalization rules** (using `num2words>=0.5.13,<0.6`):
  - **Years** matched by `\b(19|20)\d{2}\b` → `num2words(year, to='year')` → "twenty twenty-six"
  - **Ordinals** matched by `\b\d+(st|nd|rd|th)\b` → `num2words(n, to='ordinal')` → "first", "second"
  - **Plain integers** → `num2words(n)` → "one hundred twenty-three"
  - **Decimals** → `num2words` default handling
  - **Percentages** (`50%`) → expand as "fifty percent" (regex pre-substitution before num2words)
  - **Currency, dates beyond years, scientific notation** — out of scope for v1.2; pass through unchanged.
- **Markdown stripping rules:**
  - Bold/italic markers (`**`, `*`, `_`) — strip the characters, keep the enclosed text. Single-pass character removal handles nested cases (`**_text_**` → `text`).
  - Line-start headers (`#`, `##`, `###` ...) — strip the marker + trailing space, keep the heading text.
  - Line-start bullets (`- `, `* `, `1. `, `2. `, ...) — strip the marker, keep the item text.
  - Backticks — strip the characters.
  - HTML tags (`<br>`, `<em>`, etc.) — strip via `re.sub(r'<[^>]+>', '', ...)`.
  - **Preserve sentence terminators** `.`, `!`, `?` — TTS pacing depends on them.
  - Implementation choice between `markdown-it-py` + plain-text renderer vs. a regex battery is Claude's discretion at planning time; both approaches must produce identical output on the golden-file corpus.
- **Golden-file test corpus:**
  - **Source:** real v1.0 Scenario-2 `isDebrief: true` messages, captured from the v1.0/v1.1 live-run transcripts (Phase 7, Phase 8 live-run files). Planner extracts ≥10 representative samples covering each persona and each round.
  - **Format:** committed as `backend/tests/fixtures/preprocessor_golden.json` — list of `{input: str, expected: str, comment: str}` entries.
  - **Test shape:** parametrized pytest that runs `preprocess(input) == expected` for every entry. Mismatch fails the suite with a diff showing both strings.
  - **Coverage requirement:** every acronym in the dict must appear in ≥1 corpus entry; every number-normalization rule (year, ordinal, plain, percent) must appear in ≥1 entry; markdown stripping must be exercised by ≥3 entries containing different markers.

### TTS_PROVIDER switch + error semantics

- **Default value: `fake`** — committed in `.env.example`, repeated in `config.py` field default. No environment-detection magic (no "default to elevenlabs in prod"). Explicit and predictable.
- **Validation timing: pydantic-settings startup validation**, mirroring the existing `LLM_API_KEY` required-no-default pattern in `backend/app/config.py:35-37`.
  - `TTS_PROVIDER` field type: `Literal["fake", "elevenlabs"]`. Invalid values → app fails to start with `ValidationError: Invalid TTS_PROVIDER 'foo' (allowed: fake, elevenlabs)`.
  - When `TTS_PROVIDER == "elevenlabs"`, a model_validator enforces that `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_KENT`, `ELEVENLABS_VOICE_FINCH`, `ELEVENLABS_VOICE_CHEN` are all present and non-empty. Missing → app fails to start with a clear error naming the missing var.
  - When `TTS_PROVIDER == "fake"`, ElevenLabs vars are optional (CI / dev machines never need them).
- **Defaults for ElevenLabs config** (all optional with safe defaults per research SUMMARY.md):
  - `ELEVENLABS_MODEL_ID` default `eleven_multilingual_v2`
  - `ELEVENLABS_OUTPUT_FORMAT` default `mp3_44100_128`
  - `MAX_CONCURRENT_TTS` default `1` (serial; bump to 2 only when on Creator tier)
- **Fail-loud philosophy:** no silent fallback from `elevenlabs` to `fake` on any error condition (missing key, invalid value, etc.). The whole point of an explicit env var is that the operator knows which provider is in play; silent fallback would mask production misconfiguration that PODDEP-01's evidence is specifically there to prevent.
- **Phase 13 scope guardrail:** `ElevenLabsTTSProvider` is built and unit-tested with an `httpx` mock-transport (no live network). It is NOT exercised against the real ElevenLabs API in this phase. Phase 16 is the first phase that calls the real key. This means Phase 13's pytest run can complete with `ELEVENLABS_API_KEY` unset (because `TTS_PROVIDER=fake` is the dev default).

### TTSProvider ABC interface (locked for downstream phases)

- **Method:** `synthesise(text: str, voice_id: str) -> bytes` — sync, not async. Returns raw MP3 bytes in `mp3_44100_128` CBR.
- **Why sync:** ElevenLabs SDK 2.43.0's `AsyncElevenLabs` has open issue #243 (TypeError); SDK is sync-first. Phase-14 orchestrator wraps each call in `starlette.concurrency.run_in_threadpool`. Provider-layer stays simple.
- **Errors:** raise a `TTSProviderError(code: str, message: str, status: int | None)` exception class defined in `backend/app/services/tts/errors.py`. Code values map directly to the 8-code taxonomy (`timeout`, `auth_error`, `not_found`, `rate_limited`, `upstream_error`, `network_error`, `tls_error`, `invalid_response`) for Phase-15 health-endpoint reuse.
- **Provider construction:** factory function `get_tts_provider(settings) -> TTSProvider` selects implementation based on `settings.tts_provider`. Lives in `backend/app/services/tts/__init__.py`. Wired into FastAPI dependency injection in Phase 14.
- **Module layout (locked):**
  ```
  backend/app/services/tts/
    __init__.py          # get_tts_provider() factory
    base.py              # TTSProvider ABC
    errors.py            # TTSProviderError
    fake_provider.py     # FakeTTSProvider
    elevenlabs_provider.py  # ElevenLabsTTSProvider
    fixtures/
      fake_kent.mp3
      fake_finch.mp3
      fake_chen.mp3
  ```

### Plan ordering (locked)

- **Plan 13-01 (firewall spike) is BLOCKING.** Plans 13-02 and 13-03 must not start until 13-01's evidence is committed and PROJECT.md updated.
- **Plans 13-02 (TTSProvider) and 13-03 (preprocessor) are independent** of each other once 13-01 clears. The planner may sequence them serially or — if the executor supports parallel work — in parallel.

### Claude's Discretion

- Exact fixture frequencies (220/440/660 Hz vs. spoken word vs. another differentiation scheme — must be audibly distinguishable, format-compliant, and committed binary).
- Exact text content used for the firewall-spike payload (must be ~500 chars of EDIP-domain prose, voice-IDs configured, output format pinned).
- Choice of markdown-strip implementation: `markdown-it-py` plain-text render vs. regex battery. Both must produce identical output on the golden-file corpus.
- Exact filename for the committed firewall-spike binary (default: `13-firewall-spike-payload.mp3`).
- Exact pytest fixture format (JSON vs. YAML — JSON recommended, matches v1.0 conventions).
- Whether `TTSProviderError` lives in `tts/errors.py` or `tts/base.py` (recommend separate file).
- Test layout: one big `test_tts_provider.py` vs. `test_fake_provider.py` + `test_elevenlabs_provider.py` + `test_preprocessor.py`.

</decisions>

<specifics>
## Specific Ideas

- **The v1.1 Tier-B `12-LIVE-VERIFICATION.md` is the structural template** for `13-01-FIREWALL-SPIKE.md`. Same metadata table → command/payload section → result section → cross-references section shape. Keep evidence files visually consistent across milestones.
- **Pipeline order `markdown_strip → acronym_expand → number_normalize`** is load-bearing — re-ordering breaks at least two test cases (`**EDIP**` in markdown, `PC 2024` for year detection after acronym substitution).
- **Fake provider must format-match real provider exactly** (`mp3_44100_128` CBR, 44.1 kHz, mono). The Phase-14 raw-bytes stitcher will silently produce broken MP3 if a fake fixture has different sample rate or bitrate. This is the same invariant locked at the milestone level.
- **The 8-code error taxonomy from `backend/app/routers/health.py:30`** (`timeout | auth_error | not_found | rate_limited | upstream_error | network_error | tls_error | invalid_response`) is the same shape `TTSProviderError.code` must use. Phase 15 reuses it verbatim for `/api/health/tts`.
- **Existing `pydantic_settings` pattern** in `backend/app/config.py:31-55` is the line-for-line transplant target — required-no-default fields trigger startup `ValidationError`; optional fields have inline defaults; helper methods on the `Settings` class for derived values. Don't invent a new config style.
- **Per-persona fixture pitch separation** lets the Phase-14 facilitator-walkthrough actually validate "skip to Finch jumped to the right offset" by ear, without needing a live ElevenLabs call. This is why pre-recorded fixtures beat silent bytes.

</specifics>

<deferred>
## Deferred Ideas

- **`MAX_CHARS_PER_SEGMENT` per-request hard cap and `MAX_CHARS_PER_SESSION` session cap** — research recommends 800/6000 as defaults. Lives in Phase 14 (the endpoint that enforces them), not Phase 13.
- **`tts.characters_sent` structured logging** — research's quota-protection recommendation. Belongs in `audio_generator.py` orchestrator (Phase 14), not the provider layer.
- **Bounded-concurrent synthesis via `asyncio.Semaphore(MAX_CONCURRENT_TTS)`** — research recommends serial (`MAX_CONCURRENT_TTS=1`) by default. Concurrency switch lives in Phase 14 orchestrator.
- **`is_disconnected()` checkpoints** — Phase 14 orchestrator concern (the endpoint owns request lifecycle).
- **30-second in-memory cache on health probes** — Phase 15 (`/api/health/tts` endpoint).
- **ElevenLabs voice-library current state research** — research SUMMARY.md flags this for the live-verification phase. Phase 16 concern, not Phase 13.
- **SSML / pronunciation-dictionary feature on ElevenLabs side** — research notes this as a fallback if the regex acronym approach proves insufficient. Not needed unless Phase-16 listen-through reveals problems.
- **Per-persona MP3 download (DF-6)** — research explicitly defers to v1.3+; structural backend change.
- **Voice audition UI / voice casting** — research deferred per user scope.
- **Wind-down / reverse acronym pronunciations** — none currently identified; if a future scenario needs context-dependent pronunciation (e.g., `PC` → "Personal Computer" vs. "Political Council"), that's a separate design conversation.

</deferred>

---

*Phase: 13-firewall-spike-mockable-backend-foundation*
*Context gathered: 2026-04-17*
