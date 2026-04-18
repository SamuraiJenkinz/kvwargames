---
phase: 13-firewall-spike-mockable-backend-foundation
verified: 2026-04-17T00:00:00Z
approved: 2026-04-18T00:00:00Z
status: passed
score: 4/4 must-haves cleared (MH-1 via user-approved evidence-form swap 2026-04-18; MH-2, MH-3 auto-verified; MH-4 scoped out to Phase 14)
human_verification:
  - test: Review PODDEP-01 evidence-form swap
    why_human: ROADMAP.md SC-1 requires >60s MP3 payload committed to evidence folder. Binary does not exist. Documentation is honest about this. Project-owner risk decision.
    resolution: Approved by user 2026-04-18. Operational precedent (separate production app on MC211APT2AS5AHG calling api.elevenlabs.io daily) + Invoke-WebRequest /v1/voices HTTP 200 preflight accepted as SC-1 closure. Formal TTS-streaming-payload proof deferred to Phase 16 first live Tier-B replay.
---

# Phase 13: Firewall Spike and Mockable Backend Foundation -- Verification Report

**Phase Goal:** The backend can produce a stitched three-voice MP3 from a debrief-shaped input entirely against a fake provider -- and the corporate firewall is empirically proven to allow the real providers long-running TLS payload before any production code targets it.

**Verified:** 2026-04-17 (automated) · **Approved:** 2026-04-18 (user)
**Status:** passed
**Re-verification:** No -- initial verification
---

## Scope note on Must-Have 4 (podcast endpoint)

The ROADMAP.md SC-4 references POST /api/debrief/podcast returning a valid MP3 response. The three PLAN.md files confirm Phase 13 does NOT build this endpoint -- that is Phase 14 work (plan 14-01 per 13-02-SUMMARY.md). Phase 13 deliverables are: (1) firewall evidence, (2) TTSProvider ABC plus FakeTTSProvider plus ElevenLabsTTSProvider plus fixtures, (3) text preprocessor plus golden-file tests. SC-4 is aspirational stage-setting in the roadmap. Not assessed as a gap.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| MH-1 | Firewall evidence: >60s MP3 payload from api.elevenlabs.io committed from inside corporate network | ? HUMAN NEEDED | Evidence form swapped. Binary MP3 was NOT committed. Deviation documented in 13-01-FIREWALL-SPIKE.md line 22 (probe_executed: false) and line 82. Human must confirm acceptance. |
| MH-2 | TTS_PROVIDER=fake causes zero network traffic -- verified by httpx spy | VERIFIED | test_fake_provider_makes_zero_network_calls passes: patches httpx._client.HTTPTransport.handle_request to raise on any call, calls synthesise() across all code paths. 93/93 tests pass. |
| MH-3 | Preprocessor golden-file: all required acronyms plus number rules plus markdown stripping verified | VERIFIED | 12-entry golden corpus at backend/tests/fixtures/preprocessor_golden.json. All EDIP, PC, PO, CRM, IC, LEFS, SIEP, SoS verified. 52-test parametrized suite all passing. |
| MH-4 | End-to-end MP3 from /api/debrief/podcast | SCOPED OUT | Phase 13 does not build the podcast endpoint. Phase 14 work. Not a gap. |

**Score:** 3 of 4 truths verified (MH-4 scoped out; MH-1 needs human confirmation)

---
## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| backend/app/services/tts/base.py | TTSProvider ABC with synthesise(text, voice_id) -> bytes | VERIFIED | 30 lines; @abstractmethod synthesise at line 23; sync not async (SDK sync-first per docstring line 12) |
| backend/app/services/tts/errors.py | 8-code TTSErrorCode taxonomy | VERIFIED | Lines 10-19: Literal with all 8 codes: timeout, auth_error, not_found, rate_limited, upstream_error, network_error, tls_error, invalid_response |
| backend/app/services/tts/fake_provider.py | Returns bytes, zero network | VERIFIED | 63 lines; no httpx/requests import; reads from Path fixtures; confirmed by httpx spy test |
| backend/app/services/tts/elevenlabs_provider.py | Concrete ElevenLabs implementation | VERIFIED | 108 lines; full 8-code error taxonomy; exception handler ordering load-bearing (TimeoutException before RequestError, ConnectError before RequestError) |
| backend/app/services/tts/fixtures/fake_kent.mp3 | Valid MP3 >=70KB | VERIFIED | 80,666 bytes; header=fffb90c4 (MPEG sync 0xFF 0xFB) |
| backend/app/services/tts/fixtures/fake_finch.mp3 | Valid MP3 >=70KB | VERIFIED | 80,666 bytes; header=fffb90c4 |
| backend/app/services/tts/fixtures/fake_chen.mp3 | Valid MP3 >=70KB | VERIFIED | 80,666 bytes; header=fffb90c4 |
| backend/app/services/text_preprocessor.py | Exports preprocess(text: str) -> str | VERIFIED | 129 lines; preprocess() at line 120; pipeline markdown_strip then acronym_expand then number_normalize; 14 acronyms in dict lines 34-49 |
| backend/tests/fixtures/preprocessor_golden.json | >=10 entries covering all required acronyms | VERIFIED | 12 entries; EDIP/EDIPs/PC/PCs/PO/POs/CRM/IC/ICs/LEFS/SIEP/SoS/EU/NATO all present; years/ordinals/percentages/plain integers exercised; markdown stripping via 3+ distinct marker classes |
| backend/tests/test_preprocessor.py | Parametrized golden-file plus per-rule tests | VERIFIED | 52 tests; golden parametrize at lines 28-44; pipeline order regression at lines 52-77; TestAcronyms/TestNumbers/TestMarkdown classes |
| backend/tests/test_fake_provider.py | httpx spy zero-network test | VERIFIED | 6 tests; test_fake_provider_makes_zero_network_calls at line 86 covers all synthesise branches under mock.patch |
| backend/.env.example | Documents TTS_PROVIDER=fake as dev default | VERIFIED | Lines 59-64: comment explains fake=no network dev default; line 64: # TTS_PROVIDER=fake |
| backend/requirements.txt | Pins elevenlabs SDK and num2words | VERIFIED | elevenlabs==2.43.0 (line 5) and num2words==0.5.14 (line 4) |
| .planning/PROJECT.md Key Decisions | PODDEP-01 row with 2026-04-17 date | VERIFIED | Line 138: full row present, marked Good, date 2026-04-17, link to 13-01-FIREWALL-SPIKE.md |
| 13-01-SUMMARY.md Deviations section | Prominent section describing what was not done literally | VERIFIED | Lines 91-127: titled Deviations from Plan -- Evidence Form Swap -- User-Authorized Deviation; lists which three must_haves were NOT delivered in literal form |
| 13-01-FIREWALL-SPIKE.md | Honestly reflects probe_executed: false | VERIFIED | Line 22: probe_executed: false -- superseded by operational precedent; line 82: binary was NOT committed; Section 6 documents residual risk |

---
## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| config.py Settings | tts/__init__.py factory | tts_provider Literal default fake at config.py line 70 | WIRED | get_tts_provider(settings) reads settings.tts_provider; model_validator at line 92 fails startup if elevenlabs mode lacks required vars |
| FakeTTSProvider | fixtures | Path(__file__).parent / fixtures at fake_provider.py line 19 | WIRED | KENT/FINCH/CHEN_BYTES loaded at module import time |
| ElevenLabsTTSProvider | error taxonomy | TTSProviderError(code=...) in synthesise() | WIRED | All 8 codes in except-chain lines 85-107; ordering load-bearing per docstring |
| test_fake_provider.py | FakeTTSProvider | get_tts_provider(settings) factory | WIRED | Factory path exercised; zero-network spy covers all synthesise branches |
| test_preprocessor.py | golden corpus | json.loads preprocessor_golden.json at lines 21-25 | WIRED | Parametrize IDs auto-generated; mismatch prints both strings per lines 38-44 |

---

## Anti-Patterns Found

None. No TODO/FIXME/placeholder patterns in TTS service files or preprocessor. No empty returns or stub handlers.

---

## Test Run Evidence

Full suite on HEAD: **93 passed in 3.71s** (Python 3.13.3, pytest 9.0.2, Windows)

- tests/test_preprocessor.py -- 52 tests, all passed (12 golden-file + pipeline order regression + per-rule units)
- tests/test_fake_provider.py -- 6 tests, all passed (including zero-network httpx spy)
- tests/test_elevenlabs_provider.py -- 11 tests, all passed (httpx MockTransport)
- tests/test_tts_config.py -- 7 tests, all passed
- tests/test_error_injection.py -- 3 tests, all passed
- remaining tests -- 14 tests, all passed

---
## Human Verification Required

### 1. PODDEP-01 Evidence-Form Swap Acceptance

**Test:** Review .planning/phases/13-firewall-spike-mockable-backend-foundation/13-01-FIREWALL-SPIKE.md Sections 3, 4, and 6; and 13-01-SUMMARY.md lines 91-127.

**Expected:** Confirm that the following substitution is accepted as closing SC-1:
- Primary evidence: a separate production application on MC211APT2AS5AHG already calls api.elevenlabs.io in production daily, proving the firewall permits sustained TLS traffic including long streaming payloads from the exact deployment host
- Supporting evidence: Invoke-WebRequest https://api.elevenlabs.io/v1/voices returned HTTP 200 with ~95 KB body on 2026-04-17 from that host
- Deferred: formal POST /v1/text-to-speech streaming-payload verification (>60s MP3 binary committed to evidence folder) moved to Phase 16 first live Tier-B replay

**Why human:** The ROADMAP.md SC-1 literal text requires a >60-second MP3 payload intact with raw command output committed to the phase evidence folder. That binary does not exist and was not run. 13-01-FIREWALL-SPIKE.md line 22 states probe_executed: false and line 82 states the MP3 was not committed. Whether the operational precedent substitution is sufficient to unblock Phase 14 onward is a project-owner risk decision.

**Specific question:** Is the operational precedent (existing production app on MC211APT2AS5AHG calling api.elevenlabs.io daily) plus the HTTP 200 Invoke-WebRequest preflight on 2026-04-17 acceptable as SC-1 closure, with formal TTS-endpoint streaming-payload evidence committed in Phase 16?

---

## Assessment of Deviation Honesty

The PODDEP-01 evidence-form swap is documented accurately and completely. Verified against five checkpoints:

1. FIREWALL-SPIKE.md line 22: states probe_executed: false -- superseded by operational precedent -- no misrepresentation
2. FIREWALL-SPIKE.md line 82: states the 13-firewall-spike-payload.mp3 binary was NOT committed -- no misrepresentation
3. SUMMARY.md lines 94-99: lists the three specific literal must_haves that were NOT delivered -- honest enumeration
4. SUMMARY.md line 127: Total deviations: 1 -- evidence form swap (user-authorized, 2026-04-17) -- correctly bounded
5. PROJECT.md line 138: Key Decision row accurately describes the substitution without claiming the probe was run

The documentation does not misrepresent what was done. The deviation is defensible on its merits: operational precedent from the same host is a stronger ongoing signal than a one-shot probe. The open question is whether it satisfies the project owner risk bar for SC-1 closure.

---

_Verified: 2026-04-17_
_Verifier: Claude (gsd-verifier)_