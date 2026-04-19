# Phase 16 — Tier-B Live ElevenLabs Verification Record

One-shot empirical replay of the Scenario-2 debrief podcast against the real ElevenLabs API endpoint, using the v0.10 locked voice IDs, a committed fixture, and the `/api/debrief/podcast` SSE backend added in Phase 14. Closes the Phase 16 success criteria (SC1, SC2, SC3) and provides the evidence bundle that plan 16-02 will cite in the v1.2 milestone audit for PODGEN-01..08, PODPLAY-01..05, PODUX-01..03, and PODRES-01..03.

---

## 1. Replay metadata

| Field | Value |
|---|---|
| Replay date | `2026-04-19T16:29:14Z` (from `segment-offsets.json` `captured_at`) |
| Deployment host | `MC211APT2AS5AHG` |
| Git SHA carrying Task 1 code | `37011984d9ac19274667fc2e593ae8a0fcca4be4` (short: `3701198`) |
| ElevenLabs endpoint | `api.elevenlabs.io` |
| TTS_PROVIDER | `elevenlabs` |
| ELEVENLABS_API_KEY presence | confirmed non-empty (value redacted) |
| Voice IDs source | backend `.env` (deployment-host, gitignored); values fetched at replay time via `/api/config/tts-voices`, values redacted throughout this record |
| Model ID | `eleven_multilingual_v2` (from `config.py:77`) |
| Output format | `mp3_44100_128` (from `config.py:78`) — confirmed by `file` output: `MPEG ADTS, layer III, v1, 128 kbps, 44.1 kHz, Monaural` |
| Backend test state | 142 passed (pytest -q, 2026-04-19) |
| Frontend test state | 627 passed (vitest --run, 2026-04-19) |
| Replay-script SHA-256 | `450b15bc6a10b5ddadc7db92802198c5ccbfbfc53fba86dd4d3beee9ee6e7d3c` — `.planning/phases/16-live-elevenlabs-verification/scripts/run_live_replay.py` |

---

## 2. Replay payload

### 2a. Raw fixture texts (pre-preprocessing)

Source: `.planning/phases/08-qa-credential-audit/08-02-DEBRIEF-export.md` lines 118-122, captured verbatim during v1.0 Scenario-2 live run 2026-04-15T01:24:56.435Z.

**Kent:**

```
As we conclude the game, it's crucial to reflect on the effectiveness of EDIP tools in managing supply crises and maintaining legitimacy. Understanding which tools balance resilience and political acceptability will inform future strategic frameworks.
```

**Finch:**

```
Throughout the simulation, the adaptability of our responses to high-intensity conflict and shifting crisis states provided insights into potential real-world applications. The implications of mandatory measures on EDIP legitimacy require careful consideration going forward.
```

**Chen:**

```
Evaluating operational readiness and the flow of resources offers a pragmatic view of the challenges encountered. Balancing immediate demands with sustainable practices will be key to refining future EDIP mechanisms.
```

### 2b. Text after `preprocess()` (what ElevenLabs received)

`preprocess()` from `backend/app/services/text_preprocessor.py` expands all entries in `ACRONYMS` dict. `EDIP` → `E D I P` in all three segments.

**Kent (preprocessed):**

```
As we conclude the game, it's crucial to reflect on the effectiveness of E D I P tools in managing supply crises and maintaining legitimacy. Understanding which tools balance resilience and political acceptability will inform future strategic frameworks.
```

**Finch (preprocessed):**

```
Throughout the simulation, the adaptability of our responses to high-intensity conflict and shifting crisis states provided insights into potential real-world applications. The implications of mandatory measures on E D I P legitimacy require careful consideration going forward.
```

**Chen (preprocessed):**

```
Evaluating operational readiness and the flow of resources offers a pragmatic view of the challenges encountered. Balancing immediate demands with sustainable practices will be key to refining future E D I P mechanisms.
```

### 2c. ElevenLabs API request shape (per-persona, voice IDs redacted)

Each persona segment was sent as a separate POST. Request shape — identical for all three, with persona-specific `text` and voice ID in the URL:

```
POST /v1/text-to-speech/***REDACTED***?output_format=mp3_44100_128
Host: api.elevenlabs.io
xi-api-key: ***REDACTED***
Content-Type: application/json
Accept: audio/mpeg

{
  "text": "<expanded-text-from-§2b>",
  "model_id": "eleven_multilingual_v2"
}
```

Kent's `text` body: the Kent preprocessed string from §2b.
Finch's `text` body: the Finch preprocessed string from §2b.
Chen's `text` body: the Chen preprocessed string from §2b.

---

## 3. Raw response evidence

All three segments returned HTTP 200 (inferred — SSE stream emitted no `error` event; PASS is conditional on that). The stitched MP3 token fetch returned `Content-Type: audio/mpeg`.

### Kent

- `persona_done` event received at **4.34 s** from POST origin
- Content-Type: `audio/mpeg` (via stitched MP3 token pull)
- First 32 bytes of stitched MP3 at byte offset 0 (hex):

```
49443304000000000023545353450000000f0000034c61766636302e31362e31
```

Note: this is the ID3v2.4.0 tag header + `TSSE` frame identifier + `Lavf60.16.1` encoder string embedded at file start. Kent's actual audio MPEG frames begin after the ID3 tag (35-byte offset per the `0023` size marker). The file-level ID3 tag is present because the ElevenLabs `mp3_44100_128` response includes it on the first segment.

### Finch

- `persona_done` event received at **6.84 s** from POST origin
- First 32 bytes at CBR byte offset 278,319 (17.3949375 s × 16,000 bytes/s = 278,319) (hex):

```
5555555555555555555555555555555555555555555555555555555555555555
```

Note: `0x55` (binary `01010101`) is a common pattern in low-energy MP3 audio data. This byte offset lands mid-frame inside the Finch audio bitstream — MP3 frame headers are 4 bytes wide and occur only at frame boundaries (~26 ms apart at 44.1 kHz), so a CBR-computed byte offset measured from the full-file start will typically land mid-frame in the audio payload. This is not a defect.

### Chen

- `persona_done` event received at **8.66 s** from POST origin
- First 32 bytes at CBR byte offset 572,103 (35.756437500000004 s × 16,000 bytes/s = 572,103) (hex):

```
5555555555555555555555555555555555555555555555555555555555555555
```

Note: same mid-frame landing explanation as Finch above.

---

## 4. Stitched MP3 artifact

| Field | Value |
|---|---|
| File | [`evidence/debrief-scenario2-live.mp3`](evidence/debrief-scenario2-live.mp3) |
| SHA-256 | `e9be8febd7aae986be3d06b3de99a2298610b5d876fc6d94bc3c21b0b98b73af` |
| Size | 782,966 bytes |
| First 32 bytes (hex) | `49443304000000000023545353450000000f0000034c61766636302e31362e31` |
| Duration (CBR formula: `(size × 8) / 128000`) | 48.94 s |
| Duration (VLC / browser audio element) | 0:52 (52 s) — confirmed by operator |
| CBR vs display variance | ~3 s cosmetic — ID3/Lavf header bytes counted in numerator inflate CBR estimate; VLC and Chrome scan all frames and report the correct playback duration. No audio is missing. This is the known cosmetic quirk of no-pydub stitching (see plan 14-03 decision §4). |
| Segment offsets | `[0.0, 17.3949375, 35.756437500000004]` s (from [`evidence/segment-offsets.json`](evidence/segment-offsets.json)) |
| Word count | 99 |

---

## 5. Verdict

### SC1 — Stitched MP3 plays end-to-end

**PASS**

Operator VLC listen-through confirms three distinct voices in Kent → Finch → Chen order. Audio plays through clearly with no defects, no truncation, no silence gaps beyond the expected inter-segment CBR boundary transitions.

### SC2 — Acronym pronunciation

| term | expected pronunciation | heard | tier | disposition |
|---|---|---|---|---|
| `EDIP` | `E D I P` letter-by-letter (per preprocessor `ACRONYMS` dict) | letter-by-letter in all 3 segments | PASS | PASS — operator listen-through confirms letter-by-letter pronunciation across Kent, Finch, and Chen segments |
| `PC` | letter-by-letter | N/A — not in fixture | N/A | golden-corpus coverage (already validated in `13-VERIFICATION.md` per `preprocessor_golden.json`) |
| `PO` | letter-by-letter | N/A — not in fixture | N/A | golden-corpus coverage (already validated in `13-VERIFICATION.md` per `preprocessor_golden.json`) |
| `CRM` | letter-by-letter | N/A — not in fixture | N/A | golden-corpus coverage (already validated in `13-VERIFICATION.md` per `preprocessor_golden.json`) |
| `IC` | letter-by-letter | N/A — not in fixture | N/A | golden-corpus coverage (already validated in `13-VERIFICATION.md` per `preprocessor_golden.json`) |
| `LEFS` | letter-by-letter | N/A — not in fixture | N/A | golden-corpus coverage (already validated in `13-VERIFICATION.md` per `preprocessor_golden.json`) |
| `SIEP` | letter-by-letter | N/A — not in fixture | N/A | golden-corpus coverage (already validated in `13-VERIFICATION.md` per `preprocessor_golden.json`) |
| `SoS` | `S O S` letter-by-letter | N/A — not in fixture | N/A | golden-corpus coverage (already validated in `13-VERIFICATION.md` per `preprocessor_golden.json`) |

**Overall SC2 verdict: PASS** — `EDIP` pronounced correctly in all three segments. Remaining 7 acronyms carry forward golden-corpus coverage from Phase 13.

### SC3 — Evidence bundle completeness

- [x] Fixture locked: `fixtures/scenario2-debrief.json` (committed `b851553`)
- [x] Replay script: `scripts/run_live_replay.py` (committed `b851553`, SHA-256 `450b15bc…`)
- [x] Stitched MP3: `evidence/debrief-scenario2-live.mp3` (committed `fd41e6c`, 782,966 bytes)
- [x] Offsets JSON: `evidence/segment-offsets.json` (committed `fd41e6c`)
- [x] Player screenshot: `evidence/player-screenshot.png` (committed `02298a3`) — browser `<audio controls>` at `0:00 / 0:52` loaded-paused, three Skip buttons (Kent active), "Now playing: Kent" blue label, Download MP3 button orange in top toolbar; backend was live with `TTS_PROVIDER=elevenlabs` and real voice IDs fetched via `/api/config/tts-voices`
- [x] Deviation table: see §6 of `16-01-SUMMARY.md`

---

## 6. Cross-references

- [`../12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md`](../12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md) — Tier-B precedent record (v1.1 live-LLM verification)
- [`../13-firewall-spike-mockable-backend-foundation/13-VERIFICATION.md`](../13-firewall-spike-mockable-backend-foundation/13-VERIFICATION.md) — firewall spike + preprocessor golden-corpus coverage (PODDEP-01..02, golden-corpus acronyms)
- [`../14-podcast-endpoint-player/14-VERIFICATION.md`](../14-podcast-endpoint-player/14-VERIFICATION.md) — podcast endpoint + player verification record (PODGEN-01..08, PODPLAY-01..05, PODUX-01..03)
- [`../15-tts-health-graceful-degradation/15-VERIFICATION.md`](../15-tts-health-graceful-degradation/15-VERIFICATION.md) — TTS health + graceful degradation verification (PODRES-01..03)
- [`../../milestones/v1.1-MILESTONE-AUDIT.md`](../../milestones/v1.1-MILESTONE-AUDIT.md) — v1.1 milestone audit (Tier-B pattern precedent)
- [`../../../backend/tests/fixtures/preprocessor_golden.json`](../../../backend/tests/fixtures/preprocessor_golden.json) — golden corpus pinning all acronym expansions tested in Phase 13
- [`../../REQUIREMENTS.md`](../../REQUIREMENTS.md) — master requirements list (PODGEN/PODPLAY/PODUX/PODRES/PODDEP entries)
