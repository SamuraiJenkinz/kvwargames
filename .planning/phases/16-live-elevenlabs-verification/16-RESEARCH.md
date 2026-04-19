# Phase 16: Live ElevenLabs Verification + Milestone Audit — Research

**Researched:** 2026-04-19
**Domain:** ElevenLabs live TTS replay, evidence documentation, milestone audit
**Confidence:** HIGH (all findings sourced from codebase + committed planning docs)

---

## 1. Summary

Phase 16 is a verification-plus-audit phase. No new product functionality. Two outputs:
(1) a Tier-B live TTS replay that produces a committed MP3 evidence bundle, and
(2) a v1.2 milestone audit that follows the v1.1 precedent exactly.

The standard replay approach is a direct `POST /api/debrief/podcast` call against the
live backend with `TTS_PROVIDER=elevenlabs` + real key + real voice IDs, capturing the
SSE stream, then pulling the audio token via `GET /api/debrief/podcast/audio`. There is
no existing script or pytest integration for this flow — Phase 16 must author one (modeled
on `run_firewall_spike.py`'s approach of env-var auth + stdout capture + binary write).

**Critical code gap:** `ActionToolbar.tsx` line 63–68 hardcodes sentinel voice IDs
(`__fake_kent__` etc.) with the comment "real voice IDs arrive in Phase 16 via settings."
Phase 16 must implement the mechanism to supply real voice IDs to the frontend POST body —
this is the only code-change work in the phase. Without it, the browser path would POST
sentinel IDs to the ElevenLabs provider, which would 404. The replay script bypasses the
frontend entirely and can POST real voice IDs directly; the browser-path fix is needed for
the human listen-through via the UI.

The Scenario-2 fixture can be derived directly from the committed Phase 08 live-run export
(`08-02-DEBRIEF-export.md`, lines 118–122); no fresh game is required.

---

## 2. v1.1 Precedent — LIVE-VERIFICATION Structure

**File:** `.planning/phases/12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md`

### Section map

| # | Section title | Purpose |
|---|--------------|---------|
| (no frontmatter) | — | None; document opens with prose intro paragraph |
| 1 | Replay metadata | Date, git SHA, endpoint, test-suite state at time of run |
| 2 | Replay payload | §2a pre-state (gameState values); §2b inject text verbatim; notes on source |
| 3 | System prompt in use | Proof of which code version ran; verifiable test commands |
| 4 | Raw LLM response | Full JSON response verbatim in a code fence (`json`) |
| 5 | Verdict | PASS/FAIL; exact match criteria with checkmarks |
| 6 | Cross-references | File links + section anchors to prior evidence and milestone audit |

### Adaptation notes for Phase 16

| v1.1 section | v1.2 equivalent |
|---|---|
| §1 Replay metadata | Same shape. Replace "LLM endpoint" → "ElevenLabs endpoint (`api.elevenlabs.io`), `xi-api-key` header (redacted)"; add "Voice IDs used (not the literal IDs — captured as `ELEVENLABS_VOICE_{KENT,FINCH,CHEN}` from env)" |
| §2 Replay payload | §2a → three locked persona texts from `fixtures/scenario2-debrief.json` verbatim; §2b → preprocessor-expanded output per persona; §2c → request body per persona (with `xi-api-key: ***REDACTED***`) |
| §3 System prompt in use | Replace with: per-segment response evidence (HTTP status, `Content-Type: audio/mpeg`, `Content-Length`, latency, first 32 bytes hex of MP3 as frame-header proof); stitched MP3 SHA-256 |
| §4 Raw LLM response | Not a JSON response. §4 becomes: "Raw response evidence per persona segment" (HTTP meta only; the binary is committed at `evidence/debrief-scenario2-live.mp3`) |
| §5 Verdict | Expands to: SC1 verdict (VLC end-to-end) + SC2 acronym deviation table (8 rows) + SC3 completeness checklist |
| §6 Cross-references | Add: Phase 15 graceful-degradation evidence (`15-VERIFICATION.md`), `v1.1-MILESTONE-AUDIT.md` (audit shape template), Phase 13 firewall spike evidence |

### Formatting conventions to preserve

- Section numbering: Arabic numerals (1, 2, 3…), no letters.
- Metadata tables: two-column `| Field | Value |` with `|---|---|`.
- Code fences: `json` for JSON, `bash` for commands, bare fences for raw text captures.
- Cross-reference format: `[anchor-text](../relative-path/file.md:line_number)` using path-relative links.
- No YAML frontmatter in this document (v1.1 has none; 16 should match).

---

## 3. v1.1 Precedent — MILESTONE-AUDIT Structure

**File:** `.planning/milestones/v1.1-MILESTONE-AUDIT.md`

### YAML frontmatter fields

```yaml
milestone: v1.1                      # → v1.2
audited: 2026-04-15T20:15:00Z        # → ISO-8601 timestamp when audit ran
status: tech_debt                    # shipped | tech_debt | blocked
scores:
  requirements: 18/18                # → 21/21
  phases: 4/4                        # → 4/4 (phases 13–16)
  integration: 4/4                   # → keep same shape
  flows: 3/3                         # → keep same shape (count may differ)
gaps:
  requirements: []                   # list of gap strings, empty if clean
  integration: []
  flows: []
tech_debt:
  - phase: roadmap-doc-drift         # example entry from v1.1
    severity: low
    items:
      - "text of the debt item"
```

`status: tech_debt` is explicitly an acceptable ship state (v1.1 precedent; it shipped with one low-severity doc-drift item). `status: blocked` is not acceptable.

### Body section structure

| Section | Template vs. v1.2-specific |
|---|---|
| Milestone Goal Achievement | Template. Write the v1.2 milestone goal + "Verdict: ACHIEVED" if all SCs pass. |
| Requirements Coverage (N/N SATISFIED) | v1.2-specific. 21 rows, same `| ID | Description | Phase | Status |` table. Evidence column points to `16-LIVE-VERIFICATION.md` for the live-validation claim. |
| Phase Verification Summary | v1.2-specific. 4 rows: Phases 13, 14, 15, 16 with must-have counts and tech-debt notes. |
| Cross-Phase Integration | v1.2-specific. 4 integration checkpoints, cited from VERIFICATION.md files. Equivalent to v1.1's "Phase 9→10", "10→Launch gate" etc. |
| E2E Flows | v1.2-specific. At minimum: (A) fake-provider dev/CI path (TTS_PROVIDER=fake → MP3 from fixtures), (B) live-provider path (TTS_PROVIDER=elevenlabs → real MP3, VLC verified), (C) graceful-degradation path (bad key → error banner + markdown download). |
| Tech Debt Register | Template + v1.2 items. WMP duration quirk (if present with real ElevenLabs output) goes here as Low. Any Tier B voice deviations not deferred also go here. |
| Anti-Patterns Scan | Template. Report result of TODO/FIXME/stub/placeholder grep across phases 13–16 load-bearing code. |
| Test Suite Evidence | v1.2-specific. Backend: 139 pytest (Phase 15 exit state). Frontend: 625 vitest (Phase 15 exit state). Phase 16 adds no new tests. |
| Human Verification Evidence | v1.2-specific. Phase 14: VLC playback of fake MP3 (already documented). Phase 15: garbage-key run screenshots. Phase 16: VLC listen-through of live MP3. |
| Recommendation | Template. Mirrors v1.1's one-paragraph verdict. |

### Evidence-citation conventions

- Per-phase VERIFICATION.md cited as a path link: `[13-VERIFICATION.md](../phases/13-firewall-spike-mockable-backend-foundation/13-VERIFICATION.md)`.
- No SHA references in v1.1 audit (audit cites file paths, not commits). Match this.
- The live-verification evidence is cited as: "Tier-B evidence: `16-LIVE-VERIFICATION.md`; MP3 committed at `evidence/debrief-scenario2-live.mp3`."
- REQUIREMENTS.md is cited as a single link; no row-by-row links.

### How `tech_debt` status was justified in v1.1

v1.1 had one low-severity item: `ROADMAP.md:198` said Phase 11 was "0/1 Not started" but the phase was complete. No functional impact. Audit shipped with `status: tech_debt` and a one-line fix recommendation. v1.2 should follow the same pattern: if the WMP duration quirk appears with real ElevenLabs output or the ROADMAP has similar doc-drift, record it as Low severity and ship.

---

## 4. Code Path for the Live Call

### TTS provider selection

`backend/app/config.py` lines 70–107:
- `Settings.tts_provider: Literal["fake", "elevenlabs"] = "fake"` (line 70)
- `model_validator` at line 90–107: when `tts_provider == "elevenlabs"`, startup fails unless `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_KENT`, `ELEVENLABS_VOICE_FINCH`, `ELEVENLABS_VOICE_CHEN` are all non-empty.

`backend/app/services/tts/__init__.py` lines 16–48:
- `get_tts_provider(settings)` reads `settings.tts_provider`. If `"elevenlabs"`, constructs `ElevenLabsTTSProvider(api_key=..., model_id=..., output_format=...)`. No voice IDs at construction — voice IDs are per-call, not per-provider.

`backend/app/routers/debrief.py` lines 54–86:
- `POST /api/debrief/podcast` reads `settings = get_settings()`, calls `get_tts_provider(settings)`, passes provider to `generate_podcast_sse()`.

### Per-segment generation

`backend/app/services/audio_generator.py` lines 184–199:
- Iterates `PERSONA_ORDER = ("kent", "finch", "chen")`.
- For each persona: calls `preprocess(texts[persona])`, then `provider.synthesise(processed, voices[persona])`.
- `voices[persona]` comes from the POST body `body["voices"]["kent"|"finch"|"chen"]`.

`backend/app/services/tts/elevenlabs_provider.py` lines 61–84:
- `synthesise(text, voice_id)` calls `self._client.text_to_speech.convert(voice_id=voice_id, text=text, model_id=..., output_format=..., request_options=RequestOptions(timeout_in_seconds=120, max_retries=0))`.
- Returns `b"".join(audio_iter)`.
- Auth: ElevenLabs SDK reads `api_key` from constructor arg (line 55); SDK sets `xi-api-key` header internally.

### MP3 stitching and offsets

`backend/app/services/audio_generator.py` lines 38–63:
- `stitch(kent, finch, chen)` = `kent + SILENCE_BYTES + finch + SILENCE_BYTES + chen`. No pydub/ffmpeg.
- `SILENCE_BYTES`: 11,702-byte 700ms pad at `backend/app/services/tts/fixtures/silence_700ms.mp3`.
- `compute_offsets(kent, finch, chen)` returns `[0.0, finch_start_s, chen_start_s]` using `bytes_to_seconds(n) = (n * 8) / 128000` (CBR formula for `mp3_44100_128`).

### Token delivery

`audio_generator.py` lines 201–214: after stitch, stores in `PodcastCache`, puts in `TokenStore` (60s TTL), emits SSE `done` event with `{token, offsets, word_count}`.

`debrief.py` lines 89–103: `GET /api/debrief/podcast/audio?token=<hex>` pops from `TokenStore`, returns `Response(content=audio_bytes, media_type="audio/mpeg")`.

### Critical voice-ID gap (frontend)

`src/components/game/FacilitatorInput/ActionToolbar.tsx` lines 63–68:
```ts
// Fake-mode sentinels — real voice IDs arrive in Phase 16 via settings
const voices = {
  kent: '__fake_kent__',
  finch: '__fake_finch__',
  chen: '__fake_chen__',
}
```
These sentinel strings will not resolve to valid ElevenLabs voice IDs when `TTS_PROVIDER=elevenlabs`. The provider will POST with `voice_id="__fake_kent__"` and receive HTTP 404 from ElevenLabs. **Phase 16 must implement the mechanism by which the frontend obtains real voice IDs.** The simplest approach (consistent with "Zero browser-side credentials" + backend-only config) is a new lightweight `GET /api/config/tts-voices` endpoint that returns `{kent, finch, chen}` voice IDs from `settings.elevenlabs_voice_*` when `TTS_PROVIDER=elevenlabs`, or the sentinel strings when fake. This is the only new code in Phase 16.

Line 212 in the same file also has a hardcoded sentinel in the RegenerateConfirmDialog test path — same fix applies.

---

## 5. Preprocessor + Golden Corpus

### Dict file

`backend/app/services/text_preprocessor.py` lines 34–49. Current `ACRONYMS` dict (14 entries):

| Key | Expansion | Note |
|---|---|---|
| `EDIPs` | `E D I Ps` | Plural first (longest-match guard) |
| `EDIP` | `E D I P` | |
| `PCs` | `P Cs` | |
| `PC` | `P C` | |
| `POs` | `P Os` | |
| `PO` | `P O` | |
| `CRM` | `C R M` | |
| `ICs` | `I Cs` | |
| `IC` | `I C` | |
| `LEFS` | `L E F S` | |
| `SIEP` | `S I E P` | |
| `SoS` | `S O S` | Letter-by-letter (military convention) |
| `EU` | `E U` | |
| `NATO` | `Nato` | Phonetic word; Title-case hints TTS |

All 8 CONTEXT.md target acronyms (`EDIP`, `PC`, `PO`, `CRM`, `IC`, `LEFS`, `SIEP`, `SoS`) are in the dict. No missing entries anticipated from the golden corpus; misses would be new terms in the Scenario-2 debrief text that were not in Phase 13 test inputs.

### Golden corpus file

`backend/tests/fixtures/preprocessor_golden.json` — 12 entries (JSON array of `{input, expected, comment}`). All 8 target acronyms covered across the 12 entries.

### Tier-A fix procedure

When a listen-through surfaces a dict miss:

1. **Add dict entry** to `ACRONYMS` in `text_preprocessor.py`. Observe insertion-order rule: longer form (plural) before shorter (singular) if adding a new plural.
2. **Add golden-file case** to `backend/tests/fixtures/preprocessor_golden.json`. Append a new JSON object `{input, expected, comment}` at the end of the array. `comment` should reference the source (e.g., "Observed during Phase 16 live listen-through — [term] mispronounced as [heard]").
3. **Run verification:** `cd backend && pytest tests/test_preprocessor.py -v`. All 52+ tests (including the new parametrized golden case) must pass.
4. **Re-run affected segment only** — not the full three-persona generation. POST to `POST /api/debrief/podcast` with `force_fresh: true` and only the affected persona's text needs to change. Alternatively, use the replay script with the corrected preprocessed text for that persona. Append corrected segment evidence to the deviation table.

---

## 6. Scenario-2 Fixture

### Verdict: EXISTING ARTIFACT AVAILABLE — no fresh game required.

**Source:** `.planning/phases/08-qa-credential-audit/08-02-DEBRIEF-export.md` lines 116–122.

This is the committed Markdown export from the Phase 08 v1.0 live run (Scenario 2: Eastern Flank — Hybrid to Hot War, 5 rounds, session end `2026-04-15T01:24:56.435Z`).

The `## Debrief` section contains all three persona messages:

```
Kent (—): As we conclude the game, it's crucial to reflect on the effectiveness of
EDIP tools in managing supply crises and maintaining legitimacy. Understanding which
tools balance resilience and political acceptability will inform future strategic frameworks.

Finch (—): Throughout the simulation, the adaptability of our responses to high-intensity
conflict and shifting crisis states provided insights into potential real-world applications.
The implications of mandatory measures on EDIP legitimacy require careful consideration
going forward.

Chen (—): Evaluating operational readiness and the flow of resources offers a pragmatic
view of the challenges encountered. Balancing immediate demands with sustainable practices
will be key to refining future EDIP mechanisms.
```

**Word count check:** Kent ~25 words, Finch ~30 words, Chen ~25 words. Total ~80 words. Well under the 2000-word soft ceiling (PODGEN-06). Standard generation path runs; no word-count confirmation dialog.

**Shape the fixture must take** (per CONTEXT.md decisions + `extractPersonaTexts` function contract):

```json
{
  "kent": "As we conclude the game, it's crucial to reflect on the effectiveness of EDIP tools in managing supply crises and maintaining legitimacy. Understanding which tools balance resilience and political acceptability will inform future strategic frameworks.",
  "finch": "Throughout the simulation, the adaptability of our responses to high-intensity conflict and shifting crisis states provided insights into potential real-world applications. The implications of mandatory measures on EDIP legitimacy require careful consideration going forward.",
  "chen": "Evaluating operational readiness and the flow of resources offers a pragmatic view of the challenges encountered. Balancing immediate demands with sustainable practices will be key to refining future EDIP mechanisms."
}
```

**Lock path:** `.planning/phases/16-live-elevenlabs-verification/fixtures/scenario2-debrief.json`

**Note on `extractPersonaTexts` contract:** The function (`src/lib/wordCountEstimate.ts:28`) anchors on the LAST `debrief_divider` in the message log, then collects persona messages after it. The fixture captures the same text those messages would contain. The fixture is consumed directly by the replay script (bypassing the browser), so the anchoring logic does not apply to the fixture itself — the fixture IS the extracted text.

---

## 7. Voice IDs and .env

### Where configured

`backend/app/config.py` lines 28–33 (env var names):
- `ELEVENLABS_VOICE_KENT` → `settings.elevenlabs_voice_kent`
- `ELEVENLABS_VOICE_FINCH` → `settings.elevenlabs_voice_finch`
- `ELEVENLABS_VOICE_CHEN` → `settings.elevenlabs_voice_chen`

`backend/.env.example` lines 71–73: placeholders only (`<voice_id for Kent Valentina>` etc.). **No actual voice IDs are committed anywhere in the codebase.**

`backend/.env11lab` (gitignored, local): has `dummy-kent`, `dummy-finch`, `dummy-chen` (used in Phase 15 garbage-key run). Not the real v0.10 voice IDs.

### "v0.10 configured voice IDs" meaning

The ROADMAP (line 85) and CONTEXT.md (line 94) refer to voice IDs as "v0.10 locked" and "already configured." This means the operator has the real IDs stored in the deployment `.env` (gitignored). They are NOT in source control. Phase 16's plan must instruct the operator to confirm the three `ELEVENLABS_VOICE_*` env vars are set in the deployment `.env` before running the replay. The plan should NOT attempt to discover or print the actual IDs — only confirm their presence (non-empty check).

### Deployment expectation

The deployment host `.env` (on `MC211APT2AS5AHG`) is expected to supply all four ElevenLabs vars. The config model-validator enforces this at startup (fails fast if any is missing when `TTS_PROVIDER=elevenlabs`). The plan should specify: "Start the backend with `TTS_PROVIDER=elevenlabs`; if it fails to start, missing env vars are the cause."

---

## 8. VLC Listen-Through Procedure

There is no existing script or command for VLC playback. This is an entirely manual step. The plan should specify the following sequence:

1. Retrieve the committed MP3 from `evidence/debrief-scenario2-live.mp3`.
2. Open VLC: `File → Open File → [path to MP3]`.
3. Let it play from start without skipping.
4. During Kent's segment: listen for `EDIP`, `PC`, `PO`.
5. During Finch's segment: listen for `EDIP`, `CRM`, `IC`, `LEFS`, `SIEP`.
6. During Chen's segment: listen for `EDIP`, `PO`, `SoS`.
7. Note VLC-reported total duration. Expected: Kent-duration + 0.7s + Finch-duration + 0.7s + Chen-duration. For ~80 words total at ElevenLabs default rate (~3 words/sec), expect roughly 25–40 seconds total. VLC will show the correct duration; WMP will show a shorter value (first-frame only — known accepted cosmetic quirk from 14-03).
8. For each of the 8 acronyms, record in the deviation table: `term | expected pronunciation | heard | tier | disposition`.
9. Verify three distinct voices in Kent → Finch → Chen order (cadence and timbre should differ; this is a Tier B observation if they sound similar).
10. Take one screenshot in VLC's loaded-paused state (before pressing Play, or pause immediately) showing the playback controls and duration. Save as `evidence/player-screenshot.png`.

**Note:** The CONTEXT.md specifies VLC as canonical (not WMP). WMP's duration quirk (reports first-segment duration only due to Xing/VBRI header) is a known cosmetic issue documented in 14-03, not a blocker.

---

## 9. Tier-B Replay Mechanics

### v1.1 replay shape

Phase 12's Tier-B replay was a **manual execution by the human operator** — not a script or pytest. The operator ran the game UI, observed the LLM response in the browser, and captured the JSON response verbatim. The `12-LIVE-VERIFICATION.md` evidence record was then authored manually.

### Phase 16 replay shape

The TTS replay is different: it involves:
1. HTTP POST to `POST /api/debrief/podcast` (SSE stream — complex to capture manually in a browser).
2. Pulling binary audio from `GET /api/debrief/podcast/audio?token=<token>`.
3. Writing the binary to `evidence/debrief-scenario2-live.mp3`.

The plan should author a **standalone Python replay script** modeled on `run_firewall_spike.py`:
- Reads `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_KENT`, `ELEVENLABS_VOICE_FINCH`, `ELEVENLABS_VOICE_CHEN` from env (never hardcoded).
- Reads persona texts from `fixtures/scenario2-debrief.json`.
- POSTs to `http://localhost:8000/api/debrief/podcast` with `TTS_PROVIDER=elevenlabs` backend running locally.
- Parses SSE stream to capture per-persona `persona_done` events + final `done` event (token + offsets).
- GETs `http://localhost:8000/api/debrief/podcast/audio?token=<token>`.
- Writes binary to `evidence/debrief-scenario2-live.mp3`.
- Writes offsets to `evidence/segment-offsets.json`.
- Prints: HTTP status per segment, `Content-Type`, `Content-Length`, latency, first 32 bytes hex.
- **Never prints or commits** `ELEVENLABS_API_KEY` or voice ID values.

Alternatively, the operator can use the browser UI if the frontend voice-ID wiring fix is applied first (see Section 4 — the `ActionToolbar.tsx` sentinel fix). Both paths work; the script is safer for evidence capture.

### Auth-hygiene convention (from v1.1 / run_firewall_spike.py)

`run_firewall_spike.py` lines 62–68 define `_SENSITIVE_HEADER_FRAGMENTS` that strip `authorization`, `api-key`, `x-api-key`, `xi-api-key`, `set-cookie`, `cookie` from any captured response headers.

The `12-LIVE-VERIFICATION.md` evidence record captures the LLM endpoint as "`LLM_BASE_URL` (captured in Task 2 without leaking auth)" and does not show the actual URL. For Phase 16, the evidence convention is:
- Request headers: show `xi-api-key: ***REDACTED***`, `Content-Type: application/json`.
- Response headers: strip auth-adjacent fields, show `Content-Type`, `Content-Length`, `x-request-id` (if present), `server`.
- Never print `ELEVENLABS_API_KEY` value or the actual voice ID strings in any committed file.
- The `.env` file used stays gitignored and is never committed.

---

## 10. Milestone Audit Mechanics

### Target file

`.planning/milestones/v1.2-MILESTONE-AUDIT.md` — directory already exists (confirmed: contains v1.0 and v1.1 audit files).

### Cross-reference targets (per-phase VERIFICATION.md paths)

All four phases have committed VERIFICATION.md files:

| Phase | VERIFICATION.md path | Status |
|---|---|---|
| 13 | `.planning/phases/13-firewall-spike-mockable-backend-foundation/13-VERIFICATION.md` | passed (4/4 with human approval) |
| 14 | `.planning/phases/14-podcast-endpoint-player/14-VERIFICATION.md` | passed (6/6) |
| 15 | `.planning/phases/15-tts-health-graceful-degradation/15-VERIFICATION-AUDIT.md` | passed (4/4) |
| 16 | `.planning/phases/16-live-elevenlabs-verification/16-LIVE-VERIFICATION.md` | to be created in 16-01 |

Phase 15 has two VERIFICATION files: `15-VERIFICATION.md` (empirical evidence) and `15-VERIFICATION-AUDIT.md` (automated audit). The audit should cite `15-VERIFICATION-AUDIT.md` for the per-phase summary row and reference `15-VERIFICATION.md` for the human-verification evidence row.

### Ordering (single pass vs. iterative)

v1.1 audit was produced in a single pass after all evidence was in. Phase 16 should follow the same pattern: 16-01 produces all evidence, 16-02 writes the audit from the committed evidence in one pass. No iterative draft-review cycle needed — the audit format is fully template-driven.

### REQUIREMENTS.md footer update

After Phase 16 ships, add a footer note to `REQUIREMENTS.md` after the existing trailing line:

```
*Requirements defined: 2026-04-17*
```

Append:

```
*Last updated: YYYY-MM-DD — v1.2 milestone audited shipped; all 21 requirements empirically validated against real ElevenLabs endpoint (evidence: .planning/phases/16-live-elevenlabs-verification/16-LIVE-VERIFICATION.md)*
```

No new column. No status change (all rows already show `Complete`). This is a footer-only edit.

---

## 11. Recommended 16-01 / 16-02 Plan Split

### 16-01: Live Tier-B Replay + Evidence Bundle

**What it does:**
1. Implement `GET /api/config/tts-voices` backend endpoint (returns voice IDs from `settings.elevenlabs_voice_*`).
2. Update `ActionToolbar.tsx` lines 63–68 to fetch voice IDs from the new endpoint before posting (replaces sentinel strings).
3. Lock the Scenario-2 debrief fixture at `fixtures/scenario2-debrief.json` (derived from `08-02-DEBRIEF-export.md` lines 118–122).
4. Author the replay script (or use browser UI if code fix is in place).
5. Run backend with `TTS_PROVIDER=elevenlabs` + real key + real voice IDs.
6. Execute Tier-B replay → capture SSE events → pull audio token → write `evidence/debrief-scenario2-live.mp3` + `evidence/segment-offsets.json`.
7. Human listen-through via VLC → complete 8-acronym deviation table → apply Tier-A fixes if needed (re-run affected segments).
8. Capture `evidence/player-screenshot.png`.
9. Author `16-LIVE-VERIFICATION.md`.
10. Run test suite to confirm no regressions.

**Autonomous:** NO. Requires human for: VLC listen-through, screenshot capture, deviation table completion, and any Tier-A fix judgment calls. The code and script work is autonomous; the listen-through is not.

**Outputs:** `fixtures/scenario2-debrief.json`, `evidence/debrief-scenario2-live.mp3`, `evidence/segment-offsets.json`, `evidence/player-screenshot.png`, `16-LIVE-VERIFICATION.md`, the `/api/config/tts-voices` endpoint + frontend fix.

### 16-02: v1.2 Milestone Audit

**What it does:**
1. Read all four VERIFICATION.md files (13, 14, 15, 16).
2. Check test suite state (backend 139 pytest, frontend 625 vitest — confirm still pass).
3. Write `v1.2-MILESTONE-AUDIT.md` in the milestones directory.
4. Update `REQUIREMENTS.md` footer with the `*Last updated:...*` note.

**Depends on:** 16-01 complete and `16-LIVE-VERIFICATION.md` committed with no `[TBD]` placeholders.

**Autonomous:** YES — desk research + document authoring only.

**Outputs:** `.planning/milestones/v1.2-MILESTONE-AUDIT.md`, `REQUIREMENTS.md` footer update.

---

## 12. Pitfalls

### P1 — Sentinel voice IDs reaching ElevenLabs

If the frontend fix (`ActionToolbar.tsx` sentinel → real voice IDs) is not in place before the browser-path live test, the backend will call `elevenlabs.text_to_speech.convert(voice_id="__fake_kent__", ...)`. ElevenLabs returns 404 for unknown voice IDs, which maps to `TTSProviderError(code="not_found")`. This surfaces as an error banner in the UI and does not produce a MP3. **The replay script bypasses this by posting real voice IDs directly, but the human listen-through via UI requires the fix.**

### P2 — Fake MP3 CBR vs. real ElevenLabs MP3 frame format

The stitcher (`audio_generator.py:44`) does raw-bytes concat and assumes all segments share `mp3_44100_128` CBR. `FakeTTSProvider` returns pre-recorded fixtures that have the `fffb90c4` frame header (verified in 13-VERIFICATION.md line 50). Real ElevenLabs segments in `mp3_44100_128` should also be CBR, but the first-frame Xing/VBRI header inserted by the fake fixture may not match real ElevenLabs output exactly. **If real segments have a different VBRI/Xing header, the WMP cosmetic quirk may appear or disappear, and VLC/Chrome duration calculation may differ slightly from fake.** This is expected cosmetic variation, not a stitching defect. The 32-byte hex dump in the evidence record documents the actual frame header received.

### P3 — Token TTL during listen-through

The `TokenStore` has a 60-second TTL (`TOKEN_TTL_S = 60.0`, `audio_generator.py:31`). The token is emitted with the SSE `done` event; the client must call `GET /api/debrief/podcast/audio?token=<token>` within 60 seconds. In the browser path, this happens automatically. In the replay script, the script should pull the audio token immediately after receiving the `done` event, before any listen-through. Write the MP3 to disk first, then do the listen-through from the file.

### P4 — Authorization leakage in committed evidence

v1.1 precedent is clean — `12-LIVE-VERIFICATION.md` shows no auth headers. The replay script in Phase 13 (`run_firewall_spike.py`) has a runtime assertion (lines 200–205) that verifies the API key never appears in stdout. Phase 16 evidence must apply the same discipline. Key risk: if the SSE stream or ElevenLabs error response body ever echoes back the API key (unlikely but possible in malformed error responses), the evidence file could contain it. The script should scrub all output lines before writing to evidence files.

### P5 — Quota exhaustion mid-replay

Three ~80-word segments ≈ 240 characters total. At ElevenLabs free tier (10,000 chars/month) this is trivial. At paid tier, negligible. However, the retry policy (CONTEXT.md) says quota exhaustion (HTTP 429) triggers an immediate stop — no retry. If the account is near quota, the replay fails partway through. The plan should include a pre-flight quota check (e.g., `GET /api/health/tts` to confirm `ok: true`) before the full replay run.

### P6 — Voice ID missing from .env at replay time

`Settings` model-validator (`config.py:90–107`) fails startup if any `ELEVENLABS_VOICE_*` var is missing when `TTS_PROVIDER=elevenlabs`. The backend will refuse to start with a clear error naming the missing var. This is a pre-flight gate. Plan should specify: restart backend with `TTS_PROVIDER=elevenlabs`; if it fails, fix env before proceeding.

### P7 — v1.1 audit tech-debt item not closed

v1.1-MILESTONE-AUDIT.md noted `ROADMAP.md:198` Phase 11 doc-drift as `TD-v1.1-01`. The audit recommended closing it during `/gsd:complete-milestone` or next ROADMAP touch. The planner should check whether this was closed before authoring the v1.2 audit — if it persists, it should be noted as inherited tech debt or confirmed closed.

### P8 — Plan autonomy flag for 16-01

The evidence-capture tasks (replay script execution, binary commit) are autonomous; the VLC listen-through and screenshot are human-only. The plan must clearly mark which tasks require human action to avoid the verifier flagging the plan as incorrectly claiming full autonomy.

---

## Sources

### PRIMARY (HIGH confidence — all directly read from codebase)

- `backend/app/services/tts/elevenlabs_provider.py` — provider synthesise implementation
- `backend/app/services/audio_generator.py` — stitch, offsets, SSE orchestration
- `backend/app/services/text_preprocessor.py` — ACRONYMS dict, pipeline
- `backend/app/config.py` — Settings model, env var names, model-validator
- `backend/app/services/tts/__init__.py` — provider factory dispatch
- `backend/app/routers/debrief.py` — endpoint dispatch
- `backend/tests/fixtures/preprocessor_golden.json` — 12-entry golden corpus
- `backend/tests/test_preprocessor.py` — test structure and count
- `src/components/game/FacilitatorInput/ActionToolbar.tsx` — sentinel voice ID gap
- `.planning/phases/12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md` — section template
- `.planning/milestones/v1.1-MILESTONE-AUDIT.md` — audit template
- `.planning/phases/08-qa-credential-audit/08-02-DEBRIEF-export.md` lines 116–122 — Scenario-2 fixture source
- `.planning/phases/13-*/13-VERIFICATION.md` — Phase 13 verification evidence
- `.planning/phases/14-*/14-VERIFICATION.md` — Phase 14 verification evidence
- `.planning/phases/15-*/15-VERIFICATION-AUDIT.md` — Phase 15 verification evidence
- `.planning/phases/16-live-elevenlabs-verification/16-CONTEXT.md` — locked decisions
- `.planning/phases/13-*/scripts/run_firewall_spike.py` — auth-hygiene reference implementation
- `backend/.env.example` — env var names; no actual voice IDs
- `backend/.env11lab` — confirms dummy voice IDs only (Phase 15 garbage-key run)

### Metadata

**Research date:** 2026-04-19
**Valid until:** Stable (no external dependencies; all sourced from committed codebase)
**Backend test count at Phase 15 exit:** 139 pytest
**Frontend test count at Phase 15 exit:** 625 vitest
