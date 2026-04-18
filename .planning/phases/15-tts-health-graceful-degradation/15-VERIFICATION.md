# Phase 15 — Graceful Degradation Verification

**Date:** {fill in at checkpoint}
**Requirement:** PODRES-01 (structural + empirical)
**Success Criterion:** SC3 (garbage-key run) + SC4 (mid-gen failure — engineering-layer proof in 15-02)
**Precedent:** `.planning/phases/12-crisis-state-prompt-engineering/12-LIVE-VERIFICATION.md`

## Setup

- Backend: commit `{fill in — git rev-parse HEAD at time of run}`
- Frontend build: `pnpm dev` running on http://127.0.0.1:5173 (or configured port)
- Backend server: `uvicorn app.main:app --reload` running on http://127.0.0.1:8000
- `.env` configuration at time of run:
  ```
  TTS_PROVIDER=elevenlabs
  ELEVENLABS_API_KEY=badkey123
  ELEVENLABS_VOICE_KENT={fill in}
  ELEVENLABS_VOICE_FINCH={fill in}
  ELEVENLABS_VOICE_CHEN={fill in}
  ```
- Scenario config: {fill in — which config was loaded, e.g. Scenario-2 from v1.0 fixture}

## Reproduction Steps

1. Back up your current `.env`: `cp .env .env.bak`
2. Edit `.env` as above (garbage `ELEVENLABS_API_KEY=badkey123`; voice IDs can be dummy strings since no TTS call will succeed)
3. Restart the backend server (uvicorn should auto-reload on `.env` change, but do a manual restart if in doubt: Ctrl+C then re-run `uvicorn app.main:app --reload`)
4. Refresh the browser setup screen
5. **Observation A — Setup-screen badge:** Confirm the TtsHealthBadge shows amber dot + text `[auth_error] Podcast generation unavailable — markdown debrief will still work.`. Confirm Launch button remains enabled.
   - Evidence: `evidence/setup-badge-amber.png`
6. Load a scenario configuration and click Launch
7. Play through a full game to end-of-debrief (fastest path: send a handful of messages per round, click **Advance to Round N** until the final round, then **End Game + Debrief**)
8. Wait for the debrief_divider message to render
9. Click **Generate Podcast**
10. **Observation B — Podcast error banner:** The GenerationPanel error banner renders `[auth_error] {backend-provided message}`.
    - Evidence: `evidence/podcast-error-banner.png`
11. **Observation C — Browser console:** Open DevTools → Console. Type: `usePodcastStore.getState().error` and press Enter. Copy the printed object.
    - Evidence: Pasted console excerpt below.
12. **Observation D — Markdown download:** With the error banner still on screen, click **Download Debrief (.md)**. A `.md` file downloads.
13. Move the downloaded file to `.planning/phases/15-tts-health-graceful-degradation/evidence/debrief.md` (overwrite if exists)
14. Compute SHA-256: `sha256sum evidence/debrief.md` (Windows PowerShell: `Get-FileHash -Algorithm SHA256 ...`). Paste output below.
15. Confirm the first 20 lines of the downloaded file are well-formed markdown (headings, persona dividers, no error dialog HTML)
16. Restore `.env`: `cp .env.bak .env && rm .env.bak`. Restart backend to confirm normal `TTS_PROVIDER=fake` state is back.

## Evidence

### Observation A — Setup-screen TtsHealthBadge (amber)

![Setup badge amber](evidence/setup-badge-amber.png)

### Observation B — Podcast error banner in GenerationPanel

![Podcast error banner](evidence/podcast-error-banner.png)

### Observation C — Console log of podcastStore error state

```
> usePodcastStore.getState().error
{code: "auth_error", message: "{fill in}"}
```

### Observation D — Downloaded debrief markdown

- File: `evidence/debrief.md`
- SHA-256: `{fill in}`
- First 20 lines:
  ```markdown
  {fill in — paste first 20 lines}
  ```

## Result

- {fill in ✅ or ❌} SC3: Garbage-key run produces clear `[auth_error]` banner AND markdown download remains functional
- {fill in ✅ or ❌} PODRES-01: Podcast and markdown failure boundaries are confirmed independent — empirical proof
- {fill in ✅ or ❌} PODRES-02: Setup-screen TtsHealthBadge shows amber (not red) and Launch button is not disabled

## Notes / Deviations

{fill in — any observed deviations from the expected behavior, e.g. unexpected console errors, UI layout quirks, retry prompts}

## Mid-Generation Failure (SC4) — Engineering-Layer Proof

The mid-generation failure injection (SC4) is covered by the vitest safety net in plan 15-02 (`src/lib/podcastClient.test.ts`). See `15-02-SUMMARY.md` for test output. Empirical mid-gen screenshot is OPTIONAL for this evidence bundle since the engineering test provides sufficient coverage; if the user wants a visible screenshot, document it in `## Notes / Deviations` above.
