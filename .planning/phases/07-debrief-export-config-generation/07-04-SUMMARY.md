---
phase: 07-debrief-export-config-generation
plan: 04
subsystem: config-validation
tags: [typescript, zustand, react, rtl, vitest, tailwind, discriminated-union, schema-validation]

# Dependency graph
requires:
  - phase: 07-03
    provides: draftSource store field, LoadConfigPanel with Back-to-Brief, GenerateBriefPanel
  - phase: 04
    provides: LoadConfigPanel base (parseConfigJson, debounce, Launch buttons), JsonEditor
  - phase: 01
    provides: GameConfig TypeScript interface, EDIP_CONFIG
provides:
  - validateGameConfig(parsed: unknown): ValidationResult — hand-rolled deep schema validator
  - ValidationError { path: string; message: string } interface
  - ValidationResult discriminated union { ok: true; value: GameConfig } | { ok: false; errors: ValidationError[] }
  - LoadConfigPanel field-error banner for draftSource === 'brief' configs
  - Launch button gate on validation errors (SETUP-05 satisfied)
affects:
  - 08-phase-8-ops (range validation deferred — po/pc/readiness type-only in v1)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-rolled discriminated-union validator matching parseConfigJson pattern (zero new deps)"
    - "validateGameConfig chained inside existing 300ms debounce — no second timer created"
    - "Banner scoped to draftSource === 'brief' — regular load path unaffected"
    - "launchDisabled = !parseResult.ok || validationErrors.length > 0 — two-layer gate"
    - "Short-circuit per-item cascade on non-object array entries (prevents noise)"

key-files:
  created:
    - src/lib/configValidator.ts
    - src/lib/configValidator.test.ts
  modified:
    - src/components/setup/LoadConfigPanel.tsx
    - src/components/setup/LoadConfigPanel.test.tsx

key-decisions:
  - "Hand-rolled validator, zero new deps — matches parseConfigJson discriminated-union pattern in jsonValidation.ts"
  - "v1 scope: type-only check for teams numeric fields; range validation (po -2..2, pc 0–6, readiness 0–5) deferred to Phase 8"
  - "crisisState enum NOT validated — LLM briefs emit non-canonical strings ('Heightened Alert' etc.) that render as fallback badges without crash"
  - "cat on GameCard NOT validated against allowlist — free-form string per spec"
  - "cards[] empty array accepted (no min-count requirement in v1 scope)"
  - "Banner shown ONLY when draftSource === 'brief' — user-pasted configs keep existing parse-error-only behaviour"
  - "isValid variable removed — launchDisabled replaces both !isValid and schema-failure gate"
  - "validateGameConfig chained inside existing 300ms debounce — no second setTimeout created"
  - "amber-500/10, amber-400, amber-500/30 Tailwind classes used (consistent with ActionToolbar warning style)"

# Metrics
duration: ~14min
completed: 2026-04-14
---

# Phase 7 Plan 04: Config Validator Summary

**Hand-rolled `validateGameConfig` discriminated-union validator with 27 exhaustive tests + LoadConfigPanel field-error banner gated on `draftSource === 'brief'`, satisfying SETUP-05 end-to-end**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-04-14
- **Completed:** 2026-04-14
- **Tasks:** 2
- **Files modified:** 4 (2 new, 2 modified)

## Accomplishments

### Task 1: configValidator.ts + 27 tests (commit `6448f5a`)

Built `src/lib/configValidator.ts` — pure hand-rolled validator with zero new dependencies. Exports:

```ts
export interface ValidationError { path: string; message: string }
export type ValidationResult =
  | { ok: true; value: GameConfig }
  | { ok: false; errors: ValidationError[] }
export function validateGameConfig(parsed: unknown): ValidationResult
```

**Validated fields (v1 scope per CONTEXT.md):**

| Field | Rule |
|-------|------|
| `name` | required non-empty string |
| `pcThresholds` | required non-empty string |
| `scenarios` | required non-empty array; each item must have `injects[]` array |
| `teams` | required non-empty array; each item's `pc`/`po`/`readiness` must be `number` (type-only, no range check) |
| `cards` | required array (may be empty); each item must have `id`/`name`/`cat`/`timing`/`effect` strings |
| `nationalActions` | required array; each item must have `id`/`name`/`summary` strings |

**Error path format:** `scenarios[0].injects`, `teams[1].pc`, `cards[2].name`, `(root)` for top-level type errors.

**27 test groups (all passing):**

| Group | Tests | Coverage |
|-------|-------|----------|
| 1 — Happy path | 1 | EDIP_CONFIG → ok:true with correct shape |
| 2 — Top-level type failures | 4 | null, string, array, number all → (root) expected object |
| 3 — Missing required top-level fields | 7 | delete each of: name, name='', pcThresholds, scenarios, teams, cards, nationalActions |
| 4 — Empty arrays | 3 | scenarios:[]=error, teams:[]=error, cards:[]=NO error (v1 allows empty) |
| 5 — Scenario field errors | 4 | missing injects, injects not array, string scenario item (no cascade), second scenario fails only |
| 6 — Team field errors | 4 | pc='strong' message, po:3 no range error, all three missing, string team (no cascade) |
| 7 — Cards/nationalActions shape | 3 | card missing 4 fields, card with all 5 fields passes, nationalAction missing 2 fields |
| 8 — Multi-error accumulation | 1 | delete name+pcThresholds+scenarios → errors.length ≥ 3 |

### Task 2: LoadConfigPanel integration (commit `aca31bb`)

**State additions:**

```ts
const [validationErrors, setValidationErrors] = useState<ValidationError[]>(() => {
  const initial = parseConfigJson(configJson)
  if (!initial.ok) return []
  const v = validateGameConfig(initial.value as unknown)
  return v.ok ? [] : v.errors
})
```

**Debounce wiring** — `validateGameConfig` runs inside the existing 300ms `setTimeout`, chained after `parseConfigJson`. On parse failure, `validationErrors` is cleared (parse-level error takes precedence; no double-banner). Zero additional timers created.

**Banner placement** — appears in the left editor column, below the existing JSON parse error alert:

```tsx
{draftSource === 'brief' && parseResult.ok && validationErrors.length > 0 && (
  <div role="alert" className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
    <p className="text-sm font-medium text-amber-400 mb-2">
      Structure OK but {validationErrors.length} {…} attention
    </p>
    <ul className="text-xs font-mono space-y-1">
      {validationErrors.map((err, i) => (
        <li key={i}>
          <span className="text-amber-300">{err.path}</span>
          <span className="text-amber-400/70">: {err.message}</span>
        </li>
      ))}
    </ul>
  </div>
)}
```

**Launch button gate:**

```ts
const launchDisabled = !parseResult.ok || validationErrors.length > 0
// buttons: disabled={launchDisabled} aria-disabled={launchDisabled}
```

**5 new LoadConfigPanel tests (A–E):**

| Test | What it verifies |
|------|-----------------|
| A | draftSource !== 'brief' — banner NOT shown even on schema failure |
| B | draftSource === 'brief' AND schema fail — banner shown with error list (≥2 error paths) |
| C | Launch buttons disabled when schema validation fails (parse passes) |
| D | Fixing config clears banner and re-enables Launch buttons |
| E | Banner lists error path strings (name, pcThresholds, nationalActions, cards) |

## Decisions Made

**07-04: v1 type-only check for team numeric fields — ranges deferred**

`validateGameConfig` checks `typeof t[key] !== 'number'` for `pc`, `po`, `readiness`. It does NOT validate ranges (`po` within -2..2, `pc` within 0–6, `readiness` within 0–5). A team with `po: 3` (out of spec range) passes the v1 validator. This is intentional: smoke-test observations confirmed LLM-generated briefs produce in-range values; range enforcement is Phase 8 QA boundary-value suite.

**07-04: crisisState enum not validated**

Non-canonical crisisState values ("Heightened Alert", "Alert", "Strain", "Crisis Emergent") from real LLM briefs render without UI crash as fallback badges. Enum validation would block valid generated configs from reaching the Load panel. Deferred to Phase 8 if facilitator UX suffers.

**07-04: cat free-form, not validated**

GameCard.cat is free-form string per spec. LLM invents per-brief categories. No allowlist check added.

**07-04: banner scoped to draftSource === 'brief'**

For user-pasted configs, the JSON parse error (existing behaviour) is the primary signal. Field-level errors are most valuable in the brief-source context where the LLM may emit structurally plausible but spec-incomplete JSON. Regular Load flow is unchanged.

**07-04: isValid removed, replaced by launchDisabled**

The original `isValid = parseResult.ok` variable became a dead-code TS6133 error once `launchDisabled` subsumed its role. Removed cleanly.

**07-04: amber Tailwind classes (not custom @theme token)**

ActionToolbar already uses `bg-amber-500/10 text-amber-400 border border-amber-500/30` for its Download Debrief button. The validation banner uses the same literal class set for visual consistency. No new @theme token added for this single-consumer styling.

## Ranges vs Types — Phase 8 Clarification

The following fields will need range validation in Phase 8 to fully satisfy boundary-value QA:

| Field | Spec range | v1 validator | Phase 8 |
|-------|-----------|--------------|---------|
| `teams[].po` | -2 to +2 | type only | range check |
| `teams[].pc` | 0 to 6 | type only | range check |
| `teams[].readiness` | 0 to 5 | type only | range check |
| `crisisState` | enum | not checked | allowlist |
| `startState.crisisSeverity` | 0–5 | not checked | range check |

Smoke-test confirmed LLM briefs stay within spec ranges; non-zero `crisisSeverity` (1 or 2 in Briefs 1/2) is brief-faithful and must not be rejected.

## Phase 7 Requirements Evidence

| Requirement | Evidence |
|-------------|---------|
| DEB-01: Download Debrief button appears once debrief_divider exists | ActionToolbar.tsx — conditional render; 07-02 |
| DEB-02: Downloaded .md contains all required sections | debriefExporter.ts generateDebriefMarkdown; 07-01 |
| DEB-03: File save (not new tab) | downloadDebrief() Blob + anchor.download; 07-01 |
| SETUP-04: Generate from Brief flow end-to-end | GenerateBriefPanel.tsx + backend config_gen.py; 07-03 |
| SETUP-05: Generated config schema errors show field-level detail | validateGameConfig + LoadConfigPanel banner; **this plan (07-04)** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `isValid` variable became dead code (TS6133) after Launch gate refactored**

- **Found during:** Task 2 (`pnpm build` step)
- **Issue:** The original `const isValid = parseResult.ok` variable was referenced in the button's `disabled` prop and className. After replacing both with `launchDisabled`, `isValid` became unused — TypeScript TS6133 error blocked production build.
- **Fix:** Removed `isValid` variable; kept `launchDisabled` as the single gate.
- **Files modified:** `src/components/setup/LoadConfigPanel.tsx`
- **Committed in:** `aca31bb`

**2. [Rule 1 - Bug] Pre-existing LoadConfigPanel test seeded minimal JSON that failed new schema validator**

- **Found during:** Task 2 (`pnpm test -- LoadConfigPanel` after writing new tests)
- **Issue:** The original "disables Launch buttons when JSON is invalid" test seeded `configJson` with JSON containing only `scenarios` + `teams` (the minimal structure `parseConfigJson` accepts), missing `name`, `pcThresholds`, `nationalActions`, `cards`. With `validateGameConfig` now chained, this partial config was rejected by the new schema validator immediately on mount — making buttons disabled at render, which broke the test's initial assertion that buttons are initially enabled.
- **Fix:** Replaced the seed JSON with `EDIP_JSON` (full EDIP_CONFIG serialized) which passes both `parseConfigJson` AND `validateGameConfig`. The test flow (corrupt → debounce → assert disabled) remains semantically identical.
- **Files modified:** `src/components/setup/LoadConfigPanel.test.tsx`
- **Committed in:** `aca31bb`

**3. [Rule 1 - Style] Two separate `import` lines from configValidator → combined to one**

- **Found during:** Task 2 verify (`grep -c "import.*configValidator" == 1` assertion)
- **Issue:** `import { validateGameConfig }` and `import type { ValidationError }` were on separate lines, giving count 2 vs the plan's expected 1.
- **Fix:** Combined to `import { validateGameConfig, type ValidationError } from '@/lib/configValidator'`.
- **Files modified:** `src/components/setup/LoadConfigPanel.tsx`
- **Committed in:** `aca31bb`

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs + 1 Rule 1 style)
**Impact on plan:** All fixes necessary for correctness and verify compliance. No scope creep.

## Test Coverage

**configValidator.test.ts:** 27 new tests (Groups 1–8)
**LoadConfigPanel.test.tsx:** 5 new tests (A–E) + 1 existing test fixed

**Total new tests: 32**
**Full suite: 507/507 passing (up from 475 baseline)**

## Next Phase Readiness

- Phase 8 QA boundary-value suite: range validation for po/pc/readiness + crisisState enum check + crisisSeverity 0–5 range
- Phase 8 ops: confirm corporate LLM endpoint context window — HISTORY_WINDOW_N may need raising if >8k tokens available
- Phase 8 DEV-mode GuardedGameScreen follow-up: distinguish initial load from intentional new-game reset

---
*Phase: 07-debrief-export-config-generation*
*Completed: 2026-04-14*
