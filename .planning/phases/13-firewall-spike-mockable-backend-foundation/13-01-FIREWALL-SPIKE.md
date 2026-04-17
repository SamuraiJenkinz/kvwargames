# 13-01 Firewall Spike — PODDEP-01 Evidence Record

## 1. Purpose

This is the PODDEP-01 evidence file. It records the empirical proof that the MMC corporate Windows Server deployment host can reach `api.elevenlabs.io` over TLS and receive a >60-second MP3 payload intact, before any production code targets the live ElevenLabs API key. This closes Phase 13 ROADMAP success criterion SC-1: "A `requests.post(...)` run from inside the corporate network against `api.elevenlabs.io` returns a >60-second MP3 payload intact, and the raw command output is committed to the phase's evidence folder and noted in PROJECT.md Key Decisions with date."

Structural precedent: v1.1 Tier-B template at [12-LIVE-VERIFICATION.md](../12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md) — same metadata → command → result → cross-reference shape used here for network-posture spikes.

---

## 2. Replay metadata

| Field | Value |
|---|---|
| Replay date | TODO (Task 2 operator): YYYY-MM-DD |
| Machine identifier (sanitized) | TODO (Task 2 operator): e.g., `target-deploy-host` (hostname sanitized per corporate policy) |
| Corporate-network indicator | TODO (Task 2 operator): e.g., "executed on target Windows Server behind MMC corporate proxy; HTTPS_PROXY env var: [present/absent]" |
| Python version | TODO (Task 2 operator): `python -c "import sys; print(sys.version)"` |
| `requests` version | TODO (Task 2 operator): `python -c "import requests; print(requests.__version__)"` |
| Git SHA at time of spike | TODO (Task 2 operator): `git rev-parse --short HEAD` |

---

## 3. Spike configuration

| Parameter | Value |
|---|---|
| Voice ID | `ELEVENLABS_VOICE_KENT` (configured in spike operator's env — not recorded here) |
| Output format | `mp3_44100_128` |
| Model ID | `eleven_multilingual_v2` |
| Text payload length | ≈ 500 characters |
| Minimum acceptable response | ≥ 900,000 bytes (≥ 60 s at 128 kbps CBR) |

**Verbatim text payload** (deterministic — same text is hardcoded in `scripts/run_firewall_spike.py`):

```
This is a representative EDIP debrief segment for the v1.2 podcast firewall-reachability spike.
Over the past three rounds the participants navigated escalating pressure on the eastern flank:
Russia mobilised additional battalions, NATO and the EU coordinated responses, and defence stocks
in frontline states began to deplete rapidly. The crisis severity reached level four. Kent Valentina
advocated accepting broader EDIP powers. Doctor Alistair Finch flagged the transition to a security
related supply crisis. Doctor Michael Chen catalogued the industrial and legal tradeoffs.
```

---

## 4. Exact command run

```
# On the target Windows Server, in a shell with the corporate proxy configured:
set ELEVENLABS_API_KEY=<API_KEY_REDACTED>
set ELEVENLABS_VOICE_KENT=<voice_id>
python .planning/phases/13-firewall-spike-mockable-backend-foundation/scripts/run_firewall_spike.py
```

> **Note:** The literal token `<API_KEY_REDACTED>` above MUST be preserved — do not substitute a real key. The script never echoes the API key to stdout; this redaction is intentional and permanent in this evidence file.

---

## 5. Result

TODO (Task 2 operator): paste the stdout from the `run_firewall_spike.py` invocation here, verbatim, inside a fenced code block. Confirm HTTP status is 200, Bytes received ≥ 900000, elapsed seconds are reasonable (expected 30–180 s for a 60 s render).

```
<paste stdout here>
```

---

## 6. VLC verification

TODO (Task 2 operator): one sentence confirming the committed `13-firewall-spike-payload.mp3` file opens in VLC (or equivalent media player), plays end-to-end at ≥ 60 seconds duration, and contains audible spoken-English voice content matching the input text.

---

## 7. Outcome & cross-references

**PODDEP-01 status:** `<PASS|FAIL — to be filled in Task 2>`

| Reference | Path |
|---|---|
| Evidence binary | [./13-firewall-spike-payload.mp3](./13-firewall-spike-payload.mp3) |
| Structural precedent | [../12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md](../12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md) |
| Requirement | [../../REQUIREMENTS.md](../../REQUIREMENTS.md) — PODDEP-01 row |
| Roadmap success criterion | [../../ROADMAP.md](../../ROADMAP.md) — Phase 13 SC-1 |
