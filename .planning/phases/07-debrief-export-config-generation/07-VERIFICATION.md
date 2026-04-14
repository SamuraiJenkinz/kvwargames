---
phase: 07-debrief-export-config-generation
verified: 2026-04-14T15:45:00Z
status: passed
score: 4/4 must-haves verified
approved_by: user
approved_at: 2026-04-14
human_verification_results:
  - test: "Cross-browser file save of Download Debrief"
    result: "passed — user ran a live game through End Game + Debrief → LLM responded → Download Debrief button appeared → .md file saved to downloads (not a new tab). Filename format confirmed (`debrief-{kebab-name}-{ISO-slice}.md`)."
  - test: "Downloaded markdown structure inspection"
    result: "passed — user pasted back the full .md content. All six structural sections present (H1, metadata, per-round section with GFM table + persona attribution `**Kent (—):**`, ## Debrief, ## Final State, ## Appendix). Noted polish opportunity (not a gap): messages after last debrief_divider appear in BOTH the round transcript AND the Debrief section because round-bucketing only splits on round_divider, not debrief_divider. Logged for Phase 8."
  - test: "Validator banner gate on corrupted generated config"
    result: "skipped by user approval. Code inspection + 32 unit tests in 07-04 (27 configValidator + 5 LoadConfigPanel RTL tests) cover this path. `launchDisabled = !parseResult.ok || validationErrors.length > 0` at LoadConfigPanel.tsx:96."
  - test: "ALERT badge rendering from non-canonical crisisState value"
    result: "passed (bonus finding) — user launched a generated-brief scenario with `crisisState: \"Alert\"` (non-canonical); badge rendered cleanly as green ALERT without UI crash. Confirms graceful enum fallback."
---

# Phase 7: Debrief, Export and Config Generation -- Verification Report

**Phase Goal:** The session ends with a downloadable debrief artifact, and a facilitator can generate a game config from a plain-text brief -- completing the two remaining user-facing workflows.
**Verified:** 2026-04-14T15:45:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking End Game + Debrief produces Download Debrief (.md) button; clicking saves .md file not new tab | VERIFIED | ActionToolbar.tsx:84 -- hasDebrief conditional render; debriefExporter.ts:288-300 -- Blob + anchor.download=filename + anchor.click() + deferred URL.revokeObjectURL |
| 2 | Downloaded markdown includes game metadata, persona messages with attribution, state snapshots at round boundaries, debrief section | VERIFIED | debriefExporter.ts:190,193,220,264,268,272 -- H1 title renderMetadata() renderRound() with stateSnapshots[n] sections Debrief Final-State Appendix; renderMessage lines 108-129 uses PERSONA_META[speaker].displayName |
| 3 | Generate from Brief accepts free text calls /api/generate-config returns JSON to review panel facilitator can launch | VERIFIED | GenerateBriefPanel.tsx:76-109 -- POST /api/generate-config on 200: setConfigJson->setDraftSource(brief)->setSetupMode(load); SetupScreen.tsx:16-18; HomeScreen.tsx:43; smoke test 3/3 passed |
| 4 | Generated config that fails schema validation shows field-level errors not generic invalid JSON | VERIFIED | configValidator.ts:97-99 -- path teams[N].pc message expected number 0-6 got ...; LoadConfigPanel.tsx:163-181 -- amber banner gated on draftSource===brief AND parseResult.ok AND validationErrors.length>0; launchDisabled line 96 |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| src/lib/debriefExporter.ts | Markdown formatter + downloadDebrief | VERIFIED WIRED | 301 lines; exports generateDebriefMarkdown, downloadDebrief, buildDebriefFilename, toKebabFilename; imported in ActionToolbar.tsx |
| src/lib/debriefExporter.test.ts | 29+ unit tests | VERIFIED | 29 tests across 4 groups; all pass in 507/507 suite |
| src/lib/gameStore.ts stateSnapshots+gameEnded+endGame | Store state and actions for debrief flow | VERIFIED | stateSnapshots Record<number GameState>, gameEnded boolean, setGameEnded, endGame(), setStateSnapshot; endGame sets gameEnded=true + pushes debrief_divider + fires runLLMTurn |
| src/components/game/FacilitatorInput/ActionToolbar.tsx | Download button + gameEnded gates | VERIFIED | Conditionally renders Download Debrief (.md) when hasDebrief; handleDownload calls generateDebriefMarkdown then downloadDebrief; Advance/RequestDebrief/EndGame gate on gameEnded |
| src/components/setup/GenerateBriefPanel.tsx | Full generate-from-brief UI | VERIFIED | 221 lines; textarea bound to briefText; POST /api/generate-config with AbortController; 7-variant ErrorKind union; triple store write on success |
| src/components/setup/SetupScreen.tsx | Routes brief mode to GenerateBriefPanel | VERIFIED | Lines 16-18: case brief returns GenerateBriefPanel |
| src/components/setup/HomeScreen.tsx | Generate from Brief card enabled | VERIFIED | Line 43: onClick setSetupMode(brief) -- no aria-disabled stub |
| src/components/setup/LoadConfigPanel.tsx | Field-error banner + launch gate | VERIFIED | validateGameConfig chained in 300ms debounce lines 65-70; amber banner at lines 163-181 gated on draftSource===brief; launchDisabled at line 96 |
| src/lib/configValidator.ts | Hand-rolled discriminated-union validator | VERIFIED | 143 lines; exports ValidationError ValidationResult validateGameConfig; path format teams[N].pc scenarios[N].injects (root); zero new deps |
| src/lib/configValidator.test.ts | 27 exhaustive tests | VERIFIED | Groups 1-8 all pass in 507/507 suite |
| backend/app/routers/config_gen.py | Rewritten CONFIG_GEN_SYSTEM_PROMPT + json_object mode | VERIFIED | Contains pcThresholds nationalActions redLines; response_format type json_object at line 188; POST /api/generate-config |
| backend/tests/test_config_gen.py | 6 backend tests (A-F) | VERIFIED | Tests A-F pass in 8/8 backend suite |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ActionToolbar.tsx | debriefExporter.ts | generateDebriefMarkdown + downloadDebrief import | WIRED | Lines 3-7 import; handleDownload() lines 30-43 |
| ActionToolbar.tsx:endGame() | gameStore.ts:endGame | useGameStore selector | WIRED | Line 17: const endGame = useGameStore(s => s.endGame) |
| ActionToolbar.tsx:hasDebrief | messages[] | s.messages.some(m=>m.type===debrief_divider) | WIRED | Lines 22-24; Download button conditionally renders on this |
| GenerateBriefPanel.tsx | /api/generate-config | fetch POST with body {brief} | WIRED | Lines 76-81 |
| GenerateBriefPanel.tsx success | LoadConfigPanel via store | setConfigJson->setDraftSource(brief)->setSetupMode(load) | WIRED | Lines 107-109 |
| LoadConfigPanel.tsx | validateGameConfig | chained inside 300ms debounce after parseConfigJson | WIRED | Lines 65-70 |
| LoadConfigPanel.tsx | validation error banner | draftSource===brief AND parseResult.ok AND validationErrors.length>0 | WIRED | Lines 163-181 |
| LoadConfigPanel.tsx | launch gate | launchDisabled = !parseResult.ok OR validationErrors.length>0 | WIRED | Lines 96, 208-209 |
| gameStore.ts:advanceRound | stateSnapshots[newRound] | current(s.gameState) inside set() | WIRED | Confirmed by 07-01 SUMMARY and gameStore tests |
| debriefExporter.ts:renderMessage | PERSONA_META | PERSONA_META[speaker].displayName lookup | WIRED | Lines 114-116 |

---

### Requirements Coverage

| Requirement | Status | Where Satisfied |
|-------------|--------|-----------------|
| DEB-01: Download Debrief button appears once debrief_divider exists | SATISFIED | ActionToolbar.tsx:22-24,84 -- hasDebrief selector + conditional render |
| DEB-02: Downloaded .md contains game metadata, persona messages with attribution, state snapshots, debrief section | SATISFIED | debriefExporter.ts:186-278 -- generateDebriefMarkdown emits all 6 sections; renderMessage uses PERSONA_META.displayName; renderRound uses stateSnapshots[n] |
| DEB-03: File save not new tab | SATISFIED | debriefExporter.ts:288-300 -- anchor.download=filename + anchor.click() (no window.open); deferred URL.revokeObjectURL for Firefox safety |
| SETUP-04: Generate from Brief end-to-end flow | SATISFIED | HomeScreen.tsx:43 -> SetupScreen.tsx:16-18 -> GenerateBriefPanel.tsx:76-109 -> /api/generate-config -> triple store write -> LoadConfigPanel |
| SETUP-05: Generated config schema errors show field-level detail | SATISFIED | configValidator.ts:97-99 -- path teams[N].pc, message expected number 0-6 got ...; LoadConfigPanel.tsx:163-181 -- amber banner listing err.path:err.message per field |

---

### Anti-Patterns Found

None found. Spot-check of all new source files:

- debriefExporter.ts -- no TODO/FIXME; return null in renderMessage line 129 is intentional (filters divider messages from transcript)
- GenerateBriefPanel.tsx -- no TODO/FIXME, no placeholder content, fully wired
- configValidator.ts -- no TODO/FIXME, all required fields validated
- LoadConfigPanel.tsx -- no TODO/FIXME, banner and launch gate both wired

---

### Test / Typecheck / Build Results

| Check | Command | Result |
|-------|---------|--------|
| Frontend tests | pnpm exec vitest run | 507/507 passed (22 test files) |
| Backend tests | cd backend and python -m pytest -q | 8/8 passed |
| TypeScript | pnpm typecheck | Zero errors (clean exit) |
| Production build | pnpm build | Clean -- 1780 modules, 328 KB JS (gzip 105 KB) |

---

### Human Verification Required

#### 1. Cross-browser Download Debrief file save

**Test:** In Chrome and Firefox, run a game through to debrief (click End Game + Debrief, wait for LLM response), then click Download Debrief (.md).
**Expected:** A .md file named debrief-{kebab-game-name}-{YYYY-MM-DD-HHmm}.md appears in the downloads folder. No new browser tab opens.
**Why human:** anchor.download + anchor.click() is verified structurally (debriefExporter.ts line 293) and mocked in RTL tests, but actual file-save behaviour across browser vendors can only be confirmed by a human.

#### 2. Debrief markdown content inspection

**Test:** Open the downloaded .md file in any text editor or Markdown viewer after a multi-round game with at least one persona message.
**Expected:** File contains: # {game name} -- Debrief Report heading; metadata block (Game, Domain, Scenario, dates, rounds played); ## Round N sections each with ### State at start of Round N GFM table and ### Transcript with persona attribution like **Kent (--):**; ## Debrief section with only post-last-divider persona content; ## Final State team table; ## Appendix: Raw Config one-liner.
**Why human:** The markdown structure is fully tested in 29 unit tests, but visual inspection of real LLM output in a running game confirms the formatting renders correctly end-to-end.

#### 3. Field-level validation banner in UI

**Test:** Generate a config from the Cyber incident response chip, navigate to the Load panel, then manually remove the name field from the JSON editor. Wait 300ms for the debounce.
**Expected:** An amber banner appears below the editor with text like 1 field needs attention and a list item reading name: required non-empty string, got undefined. Launch Scenario buttons are greyed out.
**Why human:** RTL tests A-E in LoadConfigPanel.test.tsx cover this path, but a facilitator-path walkthrough confirms the amber banner colour, typography, and disabled button state look correct in the actual UI.

---

### Gaps Summary

No gaps found. All four must-haves have concrete code evidence at all three verification levels (exists, substantive, wired). Status is human_needed -- not gaps_found -- because the three human verification items above are optional confidence-boosting checks, not evidence of missing implementation.

---

_Verified: 2026-04-14T15:45:00Z_
_Verifier: Claude (gsd-verifier)_
