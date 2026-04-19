# Phase 16: Live ElevenLabs Verification + Milestone Audit - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Empirically verify that the end-to-end podcast path (built against `FakeTTSProvider` in Phases 13–15) produces an audibly correct three-voice MP3 when pointed at a real ElevenLabs API key, then audit the v1.2 milestone against the v1.1 precedent. First phase that calls a real key; follows the v1.1 Tier-B pattern (`12-LIVE-VERIFICATION.md` → `v1.1-MILESTONE-AUDIT.md`).

No new functionality. No new requirement IDs (REQUIREMENTS.md:81 confirms Phase 16 is verification-only). This phase re-exercises PODGEN-01..08, PODPLAY-01..05, PODUX-01..03 against a real key and produces the evidence artifact the milestone audit cites.

</domain>

<decisions>
## Implementation Decisions

### Fixture selection

- **Source:** A captured Scenario-2 end-of-game debrief with three real `isDebrief: true` persona messages (Kent Valentina, Dr. Alistair Finch, Dr. Michael Chen). Deterministic input; the live run must be reproducible without introducing LLM variance.
- **Preferred fixture origin, in order:**
  1. An existing Scenario-2 debrief artifact from v1.0 Phase 8 live-run captures or v1.1 Tier-B work, if one exists with all three persona debrief messages intact.
  2. If (1) is absent or incomplete, run **one** fresh full Scenario-2 game against the real LLM endpoint to capture debrief messages, commit those three messages verbatim as `.planning/phases/16-live-elevenlabs-verification/fixtures/scenario2-debrief.json`, and use **that committed fixture** as the locked input for all subsequent Phase 16 runs. This mirrors the v1.1 pattern of locking the replay payload before the Tier-B run.
- **Fixture shape:** JSON with `kent`, `finch`, `chen` string fields; text matches exactly what `extractPersonaTexts` (the function locked in 14-03 that anchors on the last `debrief_divider`) would emit in-session — no manual editing, no truncation.
- **Word count:** Must be in the "normal" range (well under the ~2000-word soft ceiling from PODGEN-06) so the standard generation path runs, not the confirmation-dialog branch.

### Listen-through deviation policy

When a listen-through surfaces an audio issue, classify and route per this tiered policy:

- **Tier A — Fix preprocessor within Phase 16.** Applies to: dictionary misses where `text_preprocessor.py` can deterministically fix the pronunciation (e.g., `EDIP` comes out as "ee-dip" instead of `E-D-I-P`, or a number reads as digits instead of words). Fix is a `pronunciation_dict` entry + a new golden-file case in the Phase 13 preprocessor test corpus. Re-run only the affected persona segment(s) against the real key, append the fixed evidence to the bundle. Do NOT block the milestone for Tier A issues — they are in-phase corrections.
- **Tier B — Document and defer to v1.3 VOICE-01.** Applies to: voice quality / cadence / emotional tone / ambiguous pronunciation where the stock voice is the root cause and a custom voice is the fix. Record in the `16-LIVE-VERIFICATION.md` acronym deviation table with verdict `deferred-to-VOICE-01`. Add the observation to the v1.3 backlog as a VOICE-01 input note. Do NOT block the milestone.
- **Tier C — Block the milestone.** Applies to: wrong persona reads wrong text, segment ordering broken, corrupted audio, audio cuts short mid-word, or any structural defect in the stitched MP3. Trigger a Phase 17 insert (or expand Phase 16 scope if the fix is trivial); do not ship v1.2 until resolved.
- **Deviation table** in `16-LIVE-VERIFICATION.md` records every target acronym (`EDIP`, `PC`, `PO`, `CRM`, `IC`, `LEFS`, `SIEP`, `SoS`) with columns: `term` / `expected pronunciation` / `heard` / `tier` / `disposition`. All eight acronyms get a row even if they sound right (explicit PASS entries are evidence too).

### Evidence bundle scope

The bundle lives at `.planning/phases/16-live-elevenlabs-verification/` and contains:

- **`16-LIVE-VERIFICATION.md`** — the Tier-B evidence record, structured to mirror `12-LIVE-VERIFICATION.md`:
  1. Replay metadata (date, git SHA at replay time, voice IDs used, `TTS_PROVIDER=elevenlabs`, `ELEVENLABS_API_KEY` presence confirmed but **never the key itself**, test suite state)
  2. Replay payload (the three locked persona text fixtures verbatim, preprocessor-expanded output per persona, request bodies per persona — with `xi-api-key` and `Authorization` headers redacted)
  3. Raw response evidence per persona segment: HTTP status, `Content-Type`, `Content-Length`, latency, first 32 bytes of MP3 as hex (frame-header proof)
  4. Stitched MP3 artifact description + SHA-256 of the committed binary
  5. Acronym deviation table (all 8 acronyms)
  6. VLC listen-through verdict (PASS/FAIL against Roadmap SC1+SC2)
  7. Cross-references to `12-LIVE-VERIFICATION.md` (precedent), `v1.1-MILESTONE-AUDIT.md` (audit shape), Phase 15 graceful-degradation evidence
- **`fixtures/scenario2-debrief.json`** — locked input, committed text.
- **`evidence/debrief-scenario2-live.mp3`** — the full stitched MP3, committed as a binary blob. Expected size ~2–5 MB for ~3 minutes; well under any git-LFS threshold. One-time evidence commit, not a recurring build artifact.
- **`evidence/segment-offsets.json`** — per-segment offsets JSON the backend returned (Kent/Finch/Chen start times in seconds), used to verify PODPLAY-04 against a real MP3.
- **`evidence/player-screenshot.png`** — one screenshot of `PodcastPlayer` in the loaded-paused state showing the `<audio controls>` element, the three Skip buttons, the "Now playing" label, and the Download MP3 button. Visual proof that PODPLAY-01 holds against a real MP3.
- **Authorization hygiene:** every captured request/response has `xi-api-key`, `Authorization`, and any bearer tokens redacted before commit. `ELEVENLABS_API_KEY` never appears in any file in this directory. The `.env` used for the run stays gitignored.

### Milestone ship criteria

Ship gates for v1.2, evaluated in order:

1. **Roadmap SC1 (stitched MP3 plays end-to-end in VLC) — binary pass/fail.** No partial credit. If the MP3 doesn't play cleanly in VLC with three distinct voices in Kent → Finch → Chen order at expected duration, the milestone does not ship until fixed.
2. **Roadmap SC2 (acronym pronunciation) — tiered pass.** Tier A fixes applied in-phase are acceptable. Tier B deferrals documented are acceptable. Tier C defects block.
3. **Roadmap SC3 (evidence bundle) — completeness gate.** `16-LIVE-VERIFICATION.md` + fixture + MP3 + offsets JSON + screenshot + deviation table all present and committed. Missing any one of these blocks the audit.
4. **Roadmap SC4 (milestone audit) — structure match.** `v1.2-MILESTONE-AUDIT.md` follows `v1.1-MILESTONE-AUDIT.md` shape: YAML frontmatter with `milestone`, `audited`, `status` (`shipped` | `tech_debt` | `blocked`), `scores`, `gaps`, `tech_debt` lists; body sections for Milestone Goal Achievement, Requirements Coverage (21/21), Phase Verification Summary, Cross-Phase Integration, E2E Flows, Tech Debt Register, Anti-Patterns Scan, Test Suite Evidence, Human Verification Evidence, Recommendation. `tech_debt` status is an acceptable ship state (v1.1 precedent). `blocked` status is not.

**Retry / failure policy during the live run:**

- **Transient (rate-limit, HTTP 5xx, network reset):** retry up to 3 times per segment with exponential backoff (1s → 2s → 4s). Document retries inline in the evidence bundle. Transient failures that recover within the retry budget do NOT block.
- **Quota exhaustion / 401 / 403:** stop immediately. This is an environmental blocker (wrong key, expired key, insufficient quota), not a code defect. Resolve out-of-band, schedule the replay for a later date, do not paper over in evidence.
- **Preprocessor miss detected during listen-through:** capture the full MP3 first (do not waste the quota already spent), then apply the Tier A fix, then re-run **only the affected persona segment** and splice the corrected segment into the evidence bundle. The deviation table documents both the original miss and the correction.
- **Code defect detected (e.g., wrong segment ordering, stitching corruption that was not caught by FakeTTSProvider):** STOP. Do not paper over. Extend Phase 16 scope or trigger a Phase 17 insert, fix, re-run, replace evidence bundle. No partial-credit shipping on code defects.

**REQUIREMENTS.md status update rule:**

- No new status column or flag is introduced. Match v1.1 precedent exactly.
- After Phase 16 ships, the audit updates REQUIREMENTS.md's **footer traceability table** to show `Status: Complete` for all 21 requirements with a footer note: `*Last updated: YYYY-MM-DD — v1.2 milestone audited shipped; all 21 requirements empirically validated against real ElevenLabs endpoint (evidence: 16-LIVE-VERIFICATION.md)*`.
- The validation evidence is the **link from `v1.2-MILESTONE-AUDIT.md` to `16-LIVE-VERIFICATION.md`**, not a column on the requirements table.
- PODRES-01..03 are already empirically validated by `15-VERIFICATION.md` (Phase 15 garbage-key run); the audit cites that evidence rather than re-running.
- PODDEP-01..02 are already validated by Phase 13 firewall spike + FakeTTSProvider evidence; the audit cites those.

### Claude's Discretion

- Exact retry backoff constants (1s/2s/4s is the default; adjust only if ElevenLabs docs prescribe otherwise).
- Screenshot framing and resolution for `player-screenshot.png`.
- Whether to capture a second screenshot mid-playback (not required; loaded-paused is the canonical proof).
- Markdown table column ordering in the deviation table.
- Exact hex-dump width for the first-32-bytes frame-header evidence.
- Whether `16-LIVE-VERIFICATION.md` section numbers match `12-LIVE-VERIFICATION.md` section numbers exactly (semantic match is what matters, not numeric alignment).

</decisions>

<specifics>
## Specific Ideas

- **Strong v1.1 precedent carries forward verbatim in shape:** `12-LIVE-VERIFICATION.md` section ordering (metadata → payload → system-state proof → raw response → verdict → cross-references) is the template. Replace "LLM response" semantics with "TTS response + stitched MP3" semantics; the structural bones are identical.
- **`v1.1-MILESTONE-AUDIT.md` YAML frontmatter shape is the audit template.** `status: tech_debt` is an acceptable non-blocking ship state.
- **Voice IDs are already locked at v0.10** (per roadmap line 85). Phase 16 does not renegotiate voice selection — it uses the configured IDs as-is. Any "the voice doesn't match the persona" observation flows to VOICE-01 (Tier B).
- **Raw-bytes MP3 stitching is already proven** (no `pydub` / `ffmpeg`). The live run verifies that real ElevenLabs segments (not FakeTTSProvider segments) also share the `mp3_44100_128` CBR shape the stitcher assumes. If they don't, that's a Tier C blocker and Phase 14's stitching logic needs revisiting.
- **The MP3-duration WMP quirk documented in 14-03 decisions is cosmetic** — Chrome and VLC report correct duration, WMP reads first-frame header only. Listen-through uses VLC per the roadmap; WMP discrepancy is a known accepted outcome and gets a one-line note in the audit under Tech Debt Register if it appears with real ElevenLabs output too.
- **Graceful degradation remains proven** from Phase 15's empirical garbage-key run (STATE.md lines 14, 87–89). The audit cites `15-VERIFICATION.md` for PODRES-01..03; Phase 16 does not re-run the degradation test.
- **Firewall reachability is proven** from Phase 13's operational-precedent + HTTP 200 `/v1/voices` preflight (STATE.md line 101). Phase 16 does not re-run the firewall spike; the live TTS streaming response itself is the Phase 16-specific firewall-for-streaming-payload evidence that PODDEP-01 deferred.

</specifics>

<deferred>
## Deferred Ideas

- **Expose Zustand stores on `window.__STORES__` in dev mode** (STATE.md line 88) — surfaced during Phase 15 DevTools inspection; belongs in v1.3 polish, not Phase 16.
- **VOICE-01 (custom ElevenLabs voices per persona)** — any Tier B voice-quality observation from the Phase 16 listen-through is appended to the v1.3 VOICE-01 backlog as input evidence. Not a Phase 16 deliverable.
- **PLAYER-01/02/03 (per-persona MP3 download, Media Session API, custom speed selector)** — v1.3 scope per REQUIREMENTS.md:54–56.
- **WMP duration quirk documentation** — already captured as a 14-03 decision. If it persists with real ElevenLabs output, gets one line in the audit Tech Debt Register. No active remediation work.
- **A "Validated" column on REQUIREMENTS.md** — explicitly considered and rejected to preserve v1.1 precedent shape. The link from the audit to `16-LIVE-VERIFICATION.md` is the validation evidence; a column would be redundant ceremony.

</deferred>

---

*Phase: 16-live-elevenlabs-verification*
*Context gathered: 2026-04-19*
