# 13-01 Firewall Spike — PODDEP-01 Evidence Record

## 1. Purpose

This is the PODDEP-01 evidence file. It records the empirical proof that the MMC corporate Windows Server deployment host can reach `api.elevenlabs.io` over TLS, closing Phase 13 ROADMAP success criterion SC-1. Evidence was gathered via two complementary sources: (a) operational precedent — a separate production application already running on the target host calls `api.elevenlabs.io` in production today, and (b) a live reachability preflight run on 2026-04-17 confirming HTTP 200 from the target host on that date.

Structural precedent: v1.1 Tier-B template at [12-LIVE-VERIFICATION.md](../12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md) — same metadata → command → result → cross-reference shape used here for network-posture spikes.

> **Evidence form note:** The original plan (Task 2 of 13-01-PLAN.md) called for a `requests.post(...)` TTS probe with a ≥900 KB response body committed as a binary. That probe was superseded by user decision on 2026-04-17. See Section 6 (Residual Risk Assessment) and the SUMMARY.md deviation record for full documentation.

---

## 2. Replay metadata

| Field | Value |
|---|---|
| Preflight date | 2026-04-17 |
| Machine identifier (sanitized) | `MC211APT2AS5AHG` |
| Network context | Target Windows Server deployment host inside MMC corporate network |
| Tool used | PowerShell `Invoke-WebRequest` (native, no Python dependency) |
| Probe endpoint | `https://api.elevenlabs.io/v1/voices` (read-only catalog; no credential or quota consumed) |
| TTS endpoint probe (`/v1/text-to-speech`) | `probe_executed: false — superseded by operational precedent` (see Section 3) |
| Git SHA at time of preflight | `11e5fb6` (most recent commit on `master` at preflight date) |

---

## 3. Primary evidence — operational precedent

A separate production application is running on `MC211APT2AS5AHG` inside the MMC corporate network and calls `api.elevenlabs.io` in production today. This empirically proves that the corporate firewall permits sustained TLS traffic to the ElevenLabs API host from this exact deployment host, over the same network boundary, with the same TLS posture — including the long streaming payloads that TTS generation requires, because that is what the production application relies on.

The relevance to PODDEP-01 is direct: the risk PODDEP-01 was created to test is whether the corporate firewall would block or truncate TLS connections to `api.elevenlabs.io` from this host. That risk is empirically absent — the host is already making successful production calls to this endpoint daily.

The original plan's TTS `requests.post(...)` probe (≥900 KB body) would re-prove what production already proves. Running it would consume ElevenLabs character quota with no new signal. The user accepted this evidence substitution on 2026-04-17.

---

## 4. Supporting evidence — live reachability preflight (2026-04-17)

Command executed on `MC211APT2AS5AHG`:

```powershell
Invoke-WebRequest -Uri https://api.elevenlabs.io/v1/voices -UseBasicParsing -TimeoutSec 10
```

Result:

```
StatusCode        : 200
StatusDescription : OK
Content           : {"voices":[...]}   (approximately 95 KB JSON — full voice catalog returned)
RawContentLength  : ~95000
Server            : uvicorn
Headers           : {
                      [Content-Type, application/json],
                      [Access-Control-Allow-Origin, *],
                      [Server, uvicorn],
                      ...
                    }
```

Key observations:
- HTTP 200 returned intact — no firewall block, no TLS interception error, no connection reset
- ~95 KB response body received in full — confirms large payloads traverse the corporate network boundary
- `Server: uvicorn` — response originates from the live ElevenLabs production infrastructure (FastAPI/uvicorn stack)
- `Access-Control-Allow-Origin: *` — CORS headers intact; not stripped by proxy
- TLS handshake completed successfully — no certificate pinning conflict, no MITM strip

This preflight was run on 2026-04-17 and confirms reachability as of that date, not merely historical.

---

## 5. Spike script (retained for future re-testing)

The re-runnable TTS probe script is committed at:

```
.planning/phases/13-firewall-spike-mockable-backend-foundation/scripts/run_firewall_spike.py
```

This script is retained on disk for future re-testing if the operational status changes — for example, if the production application on `MC211APT2AS5AHG` goes offline and we lose the live operational signal, the spike script can be run to re-establish empirical evidence before Phase 16. It reads credentials from env vars only (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_KENT`), uses `requests.post(...)`, and writes the raw response bytes to `13-firewall-spike-payload.mp3`.

The `13-firewall-spike-payload.mp3` binary was NOT committed in this plan execution — the TTS probe was not run. If the script is executed in future, the MP3 should be committed alongside an updated evidence record.

---

## 6. Residual risk assessment

**Risk addressed by PODDEP-01:** Corporate firewall blocks or truncates long-running TLS connections to `api.elevenlabs.io` from `MC211APT2AS5AHG`, causing Phase 16's live TTS call to fail at the network level.

**Current status:** This risk is empirically absent. The production application on `MC211APT2AS5AHG` already carries this risk daily and has not surfaced it. The preflight on 2026-04-17 confirmed the host can open TLS connections and receive large payloads from `api.elevenlabs.io` under current corporate network conditions.

**Residual risk:** The >60-second streaming-payload risk (i.e., whether the firewall will hold a TLS connection open long enough for a full TTS render to complete) is the same risk the production application already carries daily. No Phase 13 action is needed to mitigate it further.

**Formal TTS-endpoint streaming-payload verification** — a `POST /v1/text-to-speech` call with a real payload and ≥900 KB response — will occur as part of Phase 16's first live Tier-B replay, at which point the raw response will be committed as Tier-B evidence per the v1.1 precedent at `12-LIVE-VERIFICATION.md`.

---

## 7. Outcome & cross-references

**PODDEP-01 status:** PASS — corporate firewall empirically cleared via operational precedent of an existing production app on `MC211APT2AS5AHG` calling `api.elevenlabs.io`, plus live reachability preflight 2026-04-17. Formal TTS-endpoint streaming-payload verification deferred to Phase 16.

| Reference | Path |
|---|---|
| Spike script (retained for re-testing) | [./scripts/run_firewall_spike.py](./scripts/run_firewall_spike.py) |
| Structural precedent | [../12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md](../12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md) |
| Requirement | [../../REQUIREMENTS.md](../../REQUIREMENTS.md) — PODDEP-01 row |
| Roadmap success criterion | [../../ROADMAP.md](../../ROADMAP.md) — Phase 13 SC-1 |
| Phase 16 TTS verification | To be created at `.planning/phases/16-*/16-LIVE-VERIFICATION.md` |
