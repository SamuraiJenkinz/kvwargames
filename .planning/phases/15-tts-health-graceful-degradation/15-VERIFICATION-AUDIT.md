---
phase: 15-tts-health-graceful-degradation
verified: 2026-04-18T08:17:00Z
status: passed
score: 4/4 must-haves verified
gaps: []
---

# Phase 15 Verification Audit: TTS Health and Graceful Degradation

**Phase Goal:** The facilitator sees TTS connectivity status on the setup screen before launching — informational only, never gating Launch — and if ElevenLabs is unreachable or broken mid-session, the markdown debrief path continues to work unchanged.

**Verified:** 2026-04-18
**Status:** PASSED
**Re-verification:** No — initial audit

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | GET /api/health/tts always returns HTTP 200; body.ok true with latencyMs when reachable; body.ok false with structured 8-code reason when not; 15-second SLA | VERIFIED | health_tts.py L254: JSONResponse(status_code=200) on every path; all 8 codes mapped; httpx.Timeout(15.0) in _make_http_client(); 14/14 pytest pass |
| SC2 | Setup screen shows TtsHealthBadge adjacent to HealthBadge; Launch button remains enabled when TTS is red; failed copy contains exact phrase | VERIFIED | TtsHealthBadge mounted in LoadConfigPanel.tsx line 212; onStatusChange is no-op lambda (PODRES-02); launchDisabled references only healthStatus (LLM), not TTS; exact copy at line 70 confirmed |
| SC3 | Garbage-key run produces clear error code in podcast area; Download Debrief (.md) still downloads complete session markdown | VERIFIED | 15-VERIFICATION.md: amber badge png + upstream_error banner png + debrief.md 7466 bytes SHA-256 b00eda86...; zero placeholder strings; all 3 checkmarks confirmed |
| SC4 | Mid-generation network interruption surfaces structured error; markdown download unaffected | VERIFIED | podcastMidGenFailure.test.ts 3 tests all pass; full suite 625/625 passing |

**Score: 4/4 truths verified**

---

## Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| backend/app/routers/health_tts.py | SC1 TTS health endpoint | VERIFIED | 255 lines; all 8 error codes; HTTP 200 invariant; 15s timeout; fake short-circuit; 30s cache + force bypass |
| backend/app/main.py | Router registration | VERIFIED | Line 118: app.include_router(health_tts.router); imported line 36 |
| backend/tests/test_health_tts.py | SC1 automated coverage | VERIFIED | 14 tests, 14 passed (live run 4.44s) |
| src/components/setup/TtsHealthBadge.tsx | SC2 badge component | VERIFIED | 143 lines; auto-check on mount; Re-check fetches force=true; amber dot bg-[var(--color-crisis-supply)]; exact locked copy |
| src/components/setup/LoadConfigPanel.tsx | SC2 badge placement + Launch gate | VERIFIED | TtsHealthBadge mounted line 212; launchDisabled line 106 has zero TTS reference |
| .planning/.../15-VERIFICATION.md | SC3 empirical evidence bundle | VERIFIED | No placeholders; all 3 checkmarks confirmed; upstream_error deviation documented and valid |
| evidence/setup-badge-amber.png | SC3 visual proof A | VERIFIED | 639002 bytes (non-empty PNG) |
| evidence/podcast-error-banner.png | SC3 visual proof B | VERIFIED | 603846 bytes (non-empty PNG) |
| evidence/debrief.md | SC3 markdown download proof | VERIFIED | 7466 bytes; well-formed markdown confirmed |
| src/lib/podcastMidGenFailure.test.ts | SC4 engineering-layer proof | VERIFIED | 3 tests: network_error, auth_error mid-gen, structural decoupling; all pass |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| health_tts.py | HTTP 200 always | JSONResponse(status_code=200) on every return path | WIRED | Fake L127, cache hit L144, success L170, 5 exception handlers, shared return L254. No non-200 path. |
| main.py | health_tts.router | app.include_router(health_tts.router) line 118 | WIRED | Router imported from .routers line 36 |
| LoadConfigPanel.tsx | TtsHealthBadge | Import line 10, mount line 212 | WIRED | onStatusChange is a deliberate no-op; PODRES-02 invariant documented in comment |
| TtsHealthBadge.tsx | /api/health/tts?force=true | runCheck(true) on Re-check click | WIRED | Line 46: url determined by force boolean |
| launchDisabled | LLM status only | healthStatus !== ok | WIRED | TtsHealthBadge receives no-op; TTS cannot influence Launch gate |
| podcastMidGenFailure.test.ts | podcastStore error path | mockRejectedValueOnce then startGeneration catch | WIRED | Tests 1+2 confirm state.error.code; Test 3 confirms generateDebriefMarkdown reads zero podcastStore state |

---

## Anti-Patterns Found

None. Checked all relevant files for TODO/FIXME/placeholder/stub returns. All 5 exception handlers in health_tts.py populate a full body dict before reaching JSONResponse. TtsHealthBadge failed-state renders real copy. launchDisabled has no TTS state leak.

---

## SC1 Detailed Verification

**HTTP 200 invariant:** Every code path in health_tts.py exits via JSONResponse(status_code=200, content=body). Fake short-circuit (line 127), cache hits (line 144), success (line 170), and all 5 exception handlers each reach a body dict before the shared return at line 254. No non-200 path exists.

**8-code taxonomy coverage:**

| Code | Handler | Trigger |
|------|---------|---------|
| timeout | httpx.TimeoutException line 179 | No response in 15s |
| auth_error | httpx.HTTPStatusError 401 or 403 line 189 | Bad API key |
| not_found | httpx.HTTPStatusError 404 line 193 | Probe URL changed |
| rate_limited | httpx.HTTPStatusError 429 line 196 | Quota exceeded |
| upstream_error | httpx.HTTPStatusError 5xx line 199 | ElevenLabs server error |
| network_error | httpx.ConnectError non-TLS line 215 + httpx.RequestError line 221 | Connectivity failure |
| tls_error | httpx.ConnectError with ssl.SSLError cause line 211 | TLS handshake failure |
| invalid_response | Exception catch-all line 228 | Valid HTTP but missing subscription key |

**Handler order correctness:** TimeoutException (line 179) precedes RequestError (line 220); ConnectError (line 206) precedes RequestError (line 220). Both are subclasses of RequestError; ordering is load-bearing and correct per the module docstring.

**15-second timeout:** _HEALTH_TIMEOUT_SECONDS = 15.0 (line 69); applied as httpx.Timeout(15.0) in _make_http_client() (line 94). test_tts_health_15s_sla_per_request_override covers this.

**TTS_PROVIDER=fake short-circuit:** Lines 119-129 return ok=True before any cache or network logic. test_tts_health_fake_provider_short_circuit covers this.

**Cache and force bypass:** Cache read gated on if not force (line 134); cache always written back (lines 251-252). test_tts_health_cache_hit_avoids_second_probe and test_tts_health_force_true_bypasses_cache cover both paths.

---

## SC2 Detailed Verification

**Badge placement:** TtsHealthBadge imported (line 10) and rendered at line 212, immediately after HealthBadge (line 208).

**Launch gate unchanged (LoadConfigPanel.tsx lines 106-107):**

    const launchDisabled = !parseResult.ok || validationErrors.length > 0 || healthStatus !== "ok"

healthStatus is set only by HealthBadge. TtsHealthBadge receives an explicit no-op with comment: TTS status is informational only, does NOT gate Launch per PODRES-02. TTS status cannot propagate to launchDisabled.

**Exact failed-state copy (TtsHealthBadge.tsx line 70):**

    text includes: [code] Podcast generation unavailable — markdown debrief will still work.

Required phrase is a literal substring of the locked copy template.

**Amber dot (line 118):** bg-[var(--color-crisis-supply)] matches spec.

**Re-check button fetches force=true:** Line 133 onClick calls runCheck(true); line 46 url = force ? /api/health/tts?force=true : /api/health/tts.

---

## SC3 Detailed Verification

15-VERIFICATION.md reviewed in full:

- Zero placeholder or fill-in strings found (grep confirms)
- All three result checkmarks confirmed (lines 115-117)
- upstream_error deviation from predicted auth_error: documented at Notes/Deviations item 1; acceptable because upstream_error is a valid 8-code taxonomy member; the SC requires a reason code, not specifically auth_error; two-endpoint divergence (setup probe hits /v1/user; TTS generation hits /v1/text-to-speech) is expected behaviour and strengthens verification
- Evidence files confirmed non-empty: setup-badge-amber.png (639002 bytes); podcast-error-banner.png (603846 bytes); debrief.md (7466 bytes)
- Debrief markdown is well-formed with heading, metadata block, round structure, state tables (15-VERIFICATION.md lines 88-110)

---

## SC4 Detailed Verification

src/lib/podcastMidGenFailure.test.ts contains 3 tests in describe block: mid-gen failure safety net (SC4, Phase 15-02)

1. mid-gen TypeError (network failure) surfaces as network_error: confirms state.error.code equals network_error
2. mid-gen PodcastGenerationError auth_error surfaces in podcastStore.error.code: confirms code, message, and persona fields
3. generateDebriefMarkdown succeeds when podcastStore is in error state: structurally proves markdown exporter reads zero state from podcastStore

All 3 passed on live run. Full suite: 625/625 passing.

The empirical observation in 15-VERIFICATION.md also constitutes a real-world SC4 event: Kent was rendering when the upstream_error fired mid-stream, proving mid-gen failure surfaces cleanly rather than silently swallowing.

---

## Summary

Phase 15 goal is fully achieved. All four success criteria pass both structural verification and automated test verification (14 pytest + 3 vitest mid-gen + 625-test full suite). The empirical evidence bundle in 15-VERIFICATION.md is complete with no placeholders, three non-empty evidence files, and all result checkmarks confirmed.

The one documented deviation (upstream_error observed instead of predicted auth_error) does not represent a gap. It is correctly handled in the evidence document, is a valid taxonomy member, and strengthens verification by demonstrating multi-code dispatch across two different ElevenLabs endpoints.

---

_Verified: 2026-04-18_
_Verifier: Claude (gsd-verifier)_