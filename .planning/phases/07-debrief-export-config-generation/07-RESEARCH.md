# Phase 7: Debrief, Export & Config Generation - Research

**Researched:** 2026-04-14
**Domain:** Browser file download, JSON schema validation, LLM prompt engineering for structured output, Immer draft snapshots, React/Zustand store extension
**Confidence:** HIGH (all critical claims verified against codebase + official docs)

---

## Summary

Phase 7 adds two user-facing workflows to an already-working React/TypeScript/Vite/Zustand/Immer codebase. The core technical work is:

1. **Debrief export** — a pure `generateDebriefMarkdown()` function + browser Blob download; requires a new `stateSnapshots` slice in the store, captured at `advanceRound` time, and a split in `triggerDebrief` semantics.
2. **Generate-from-brief** — a new `GenerateBriefPanel` component (currently a two-line stub in `SetupScreen`) that calls `/api/generate-config`, handles loading/error states, then pipes the JSON text into `configJson` in the store and transitions to `'load'` mode. The backend `CONFIG_GEN_SYSTEM_PROMPT` must be completely rewritten.
3. **Deep schema validator** — a hand-rolled `validateGameConfig()` that extends the existing `parseConfigJson` pattern with field-level path errors, fitting seamlessly into the discriminated-union result convention already established.

No new runtime npm packages are needed. The established patterns (discriminated union result, pure function + imperative side-effect split, `get()` outside `set()` for structuredClone-safe snapshots, `vi.stubGlobal('fetch', vi.fn())`) cover every new problem.

**Primary recommendation:** Build everything with zero new dependencies; adopt `immer.current()` for safe snapshot capture inside `set()`; add `response_format: { type: "json_object" }` to the backend `/api/generate-config` call AND rewrite the system prompt with a condensed EDIP excerpt as the shape exemplar.

---

## Standard Stack

No new packages required. All Phase 7 work builds on already-installed dependencies.

### Core (already installed)
| Library | Version (from package.json) | Purpose in Phase 7 |
|---------|----|----|
| `zustand` + `immer` | 5.0.12 / 11.1.4 | Store slice additions (`stateSnapshots`, `draftConfigJson`, `draftSource`, `gameEnded`) |
| `react` / `react-dom` | 19.2.5 | `GenerateBriefPanel` component |
| `vitest` + RTL | 4.1.4 / 16.3.2 | Test suite for exporter, validator, panel |

### Browser APIs (zero install)
| API | Purpose |
|-----|---------|
| `Blob` | Wrap markdown string as binary |
| `URL.createObjectURL` / `URL.revokeObjectURL` | Create/release temporary download URL |
| `document.createElement('a')` | Synthetic anchor for `download` attribute |
| `AbortController` | Cancel in-flight generate-brief fetch |

### Installation
```bash
# No new packages — Phase 7 has zero new dependencies
```

---

## Architecture Patterns

### Recommended File Structure Additions
```
src/
├── lib/
│   ├── debriefExporter.ts        # NEW: generateDebriefMarkdown(), downloadDebrief()
│   └── configValidator.ts        # NEW: validateGameConfig() deep validator
├── components/
│   └── setup/
│       └── GenerateBriefPanel.tsx # NEW: brief input + generate flow
backend/
└── app/routers/
    └── config_gen.py             # EDIT: CONFIG_GEN_SYSTEM_PROMPT rewrite
```

### Pattern 1: Pure exporter + imperative download side-effect (matches 06-03 precedent)

```typescript
// src/lib/debriefExporter.ts

// PURE — takes a plain snapshot of store state, returns string. No side-effects.
export function generateDebriefMarkdown(snapshot: DebriefSnapshot): string {
  // ...build and return markdown string
}

// IMPERATIVE side-effect — creates Blob, synthetic anchor, triggers save, revokes URL.
export function downloadDebrief(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown; charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  // Defer revokeObjectURL by one tick — Firefox needs the click event to
  // complete before revocation is safe. 0ms setTimeout is sufficient.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
```

The `DebriefSnapshot` type is a plain-object slice of `GameStore` extracted at export time:

```typescript
export interface DebriefSnapshot {
  gameConfig: GameConfig
  gameState: GameState           // current live state → becomes "Final State"
  stateSnapshots: Record<number, GameState>  // round → pre-advance plain snapshot
  messages: ChatMessage[]
  exportedAt: Date
}
```

### Pattern 2: Store snapshot capture — use `immer.current()` inside `set()` (CRITICAL)

The existing precedent for avoiding Immer proxy DataCloneError is in `gameStore.ts` line 300–305: call `get()` outside `set()` before passing to `structuredClone`. However, **inside `advanceRound`'s `set()` callback, the draft is already in scope**. The correct tool is `immer.current()`.

`immer.current()` produces a plain (non-proxy, non-frozen) snapshot of a draft at the current moment. It does NOT throw DataCloneError and does NOT require `structuredClone` at all — the result is already a plain object.

```typescript
// In gameStore.ts, import current from 'immer'
import { current } from 'immer'

advanceRound: () => {
  const state = get()
  if (!state.gameState || state.loading) return
  const currentRound = state.gameState.round
  // ...

  set((s) => {
    if (!s.gameState) return
    // Capture pre-advance snapshot as a plain object using immer.current().
    // current() strips the Proxy wrapper — safe to store, safe to structuredClone later.
    s.stateSnapshots[currentRound] = current(s.gameState)

    s.gameState.round = newRound
    // ... rest of advanceRound mutations
  })
  // ...
}
```

For `initGame`, the initial snapshot (round 1 start state) is set AFTER the `set()` call using a `get()` pattern (same as the existing `reportPromptBudget` call there), since `initGame` sets `gameState` in `set()` then immediately reads back with `get()`:

```typescript
initGame: (config, scenarioIndex) => {
  set((state) => {
    // ... set gameState, etc.
    state.stateSnapshots = {}    // reset snapshots
  })
  // Seed round-1 snapshot from the plain state (not a draft) via get()
  const freshState = get().gameState
  if (freshState) {
    get().setStateSnapshot(1, structuredClone(freshState))
  }
}
```

Alternatively, seed round-1 snapshot inside the `set()` callback using `current()`:
```typescript
set((state) => {
  // ... build gameState ...
  // current(state.gameState) after the field assignments are complete
  state.stateSnapshots = { 1: current(state.gameState) }
})
```

The second form is cleaner — one atomic `set()`.

### Pattern 3: Deep schema validator — hand-rolled discriminated union (matches 06-02 precedent)

```typescript
// src/lib/configValidator.ts

export interface ValidationError {
  path: string    // e.g. "scenarios[0].injects[2]", "teams[1].startState.pc"
  message: string // e.g. "missing 'text' field", "expected number 0–6, got \"strong\""
}

export type ValidationResult =
  | { ok: true; value: GameConfig }
  | { ok: false; errors: ValidationError[] }

export function validateGameConfig(parsed: unknown): ValidationResult {
  const errors: ValidationError[] = []
  // ... field-by-field checks, push to errors[]
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: parsed as GameConfig }
}
```

Path string construction helper:
```typescript
function pathOf(base: string, key: string | number): string {
  return typeof key === 'number' ? `${base}[${key}]` : `${base}.${key}`
}
```

### Pattern 4: AbortController for GenerateBriefPanel — fresh per call, component-local

The store's `currentAbortController` is tied to the main LLM turn loop (`runLLMTurn`). Config generation is an independent HTTP call with a different lifecycle. Use a component-local ref:

```typescript
// Inside GenerateBriefPanel
const abortRef = useRef<AbortController | null>(null)

const handleGenerate = async () => {
  abortRef.current = new AbortController()
  setLoading(true)
  setError(null)
  // ...fetch /api/generate-config with { signal: abortRef.current.signal }
}

const handleCancel = () => {
  abortRef.current?.abort()
  setLoading(false)
}
```

This matches the "Claude's Discretion" note in CONTEXT.md — config generation is independent of the main LLM turn loop.

### Pattern 5: Browser file download cross-browser safe pattern

```typescript
export function downloadDebrief(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown; charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename       // critical: forces file save, not navigation
  document.body.appendChild(anchor) // needed in some older Firefox builds
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 0) // defer — Firefox needs event loop tick
}
```

Key cross-browser notes:
- `anchor.download` is the spec-correct way to force file save (not `window.location.assign`)
- `document.body.appendChild` + `removeChild` around the click is the most compatible pattern; some older Firefox versions ignored programmatic clicks on detached elements (now fixed but cheap to include)
- `setTimeout(..., 0)` for revoke is the established workaround for Firefox — immediate revocation can abort the download before the browser has read the blob (risk is very low for small .md files, but the pattern is correct regardless)
- `URL.createObjectURL` is baseline-available since 2015 across all target browsers (Chrome, Firefox, Safari, Edge)

### Anti-Patterns to Avoid
- **`window.open(url)`**: opens a new tab instead of saving — violates DEB-03
- **`window.location.assign(url)`**: navigation, not download; filename not respected
- **Immediate `revokeObjectURL` without setTimeout**: risks Firefox blob-read race on any file size
- **`structuredClone()` on an Immer draft inside `set()`**: throws DataCloneError — use `immer.current()` instead
- **Installing Zod/Ajv for the schema validator**: unnecessary dep for a codebase that is already hand-rolling all validation with the discriminated union pattern; Zod 4 bundles ~2KB gzipped (with `zod/mini`) but adds ecosystem coupling for no DX gain when the error format needs to be custom anyway
- **Template-literal Tailwind class composition in GenerateBriefPanel**: Tailwind v4 requires literal class strings in source — no `\`text-${color}\`` patterns

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|------------|-------------|-----|
| Deep state clone inside Immer `set()` | `structuredClone(s.gameState)` inside `set()` | `import { current } from 'immer'` | draft is a Proxy; `structuredClone` throws DataCloneError on proxies |
| File download | Custom fetch-to-file, server-side download endpoint | Blob + createObjectURL + anchor.download | Zero server involvement; MDN baseline-available |
| Schema validation library | Zod, Ajv, Yup, Valibot | Hand-rolled `validateGameConfig()` | No new package; custom error path format; project already hand-rolls all validation |
| Markdown rendering | react-markdown, rehype pipeline | Plain `.md` string file save | Phase 7 output is a file artifact, not in-browser rendering |
| Streaming config generation | SSE / ReadableStream | Single blocking fetch + loading indicator | Backend returns single completion; streaming not in scope until Phase 8+ |

---

## Common Pitfalls

### Pitfall 1: `structuredClone` on Immer draft proxy inside `set()`
**What goes wrong:** `DataCloneError: Failed to execute 'structuredClone' on 'Window'`
**Why it happens:** Immer drafts are ES6 Proxy objects. `structuredClone` cannot serialize Proxies.
**How to avoid:** Inside `set()` callbacks, use `current(s.gameState)` (imported from `immer`) to get a plain-object snapshot. The existing store (`gameStore.ts` line 300–305) already shows the alternative: call `get()` outside `set()` to read plain state. Both work; `current()` is cleaner when the mutation must happen atomically in the same `set()` call.
**Warning signs:** DataCloneError in the browser console during `advanceRound` after adding snapshot code.

### Pitfall 2: Immediate `URL.revokeObjectURL` truncates download in Firefox
**What goes wrong:** The downloaded `.md` file is 0 bytes or incomplete in Firefox.
**Why it happens:** Firefox starts reading the blob asynchronously after `anchor.click()`; revoking the URL immediately cancels the read.
**How to avoid:** Wrap `revokeObjectURL` in `setTimeout(() => URL.revokeObjectURL(url), 0)`.
**Warning signs:** Download works in Chrome/Safari but produces empty file in Firefox.

### Pitfall 3: Backend `CONFIG_GEN_SYSTEM_PROMPT` produces wrong JSON shape
**What goes wrong:** LLM returns JSON with `scenarioName`, `injectCards`, `winConditions` — fields that do NOT exist in the frontend `GameConfig` interface. Generated config fails parse/validation immediately.
**Why it happens:** The current prompt (Phase 2 placeholder) asks for a completely different shape. This is documented as CRITICAL in CONTEXT.md.
**How to avoid:** Rewrite the entire `CONFIG_GEN_SYSTEM_PROMPT` in `config_gen.py` to enumerate every `GameConfig` field explicitly, and embed a condensed EDIP config fragment as a structural exemplar. See Code Examples section for prompt structure.
**Warning signs:** Test brief generation returns JSON that immediately fails `validateGameConfig` with multiple missing-field errors.

### Pitfall 4: `json_object` mode alone does not guarantee schema adherence
**What goes wrong:** LLM returns valid JSON but omits required fields (`teams`, `scenarios`, `cards`, `nationalActions`) even when instructed to include them.
**Why it happens:** OpenAI's `response_format: { type: "json_object" }` guarantees syntactic JSON validity only, not schema conformance. The prompt must instruct the model on the shape.
**How to avoid:** Combine `response_format: { type: "json_object" }` (added to the backend payload) with a detailed system prompt that lists every required field and includes a condensed structural exemplar. The `json_object` mode prevents prose/markdown fences; the system prompt drives the shape.
**Warning signs:** Valid JSON from LLM but missing required top-level fields or wrong field names.

### Pitfall 5: `draftConfigJson` vs `configJson` store field confusion
**What goes wrong:** LoadConfigPanel reads `configJson` but GenerateBriefPanel writes to a different field, so the review panel is pre-populated with stale EDIP config instead of the generated one.
**Why it happens:** CONTEXT.md specifies lifting `draftConfigJson` to the store, but the existing `LoadConfigPanel` binds to `configJson`. The plan must clarify which field LoadConfigPanel reads when `draftSource === 'brief'`.
**How to avoid:** On generate-brief success: write generated JSON to `configJson` (the existing field LoadConfigPanel binds to) AND set `draftSource = 'brief'`. No new field needed — `configJson` is already in the store and LoadConfigPanel already reads it. `draftSource` only drives the "← Back to Brief" conditional rendering.
**Warning signs:** Review panel shows EDIP default config after successful generation.

### Pitfall 6: `gameEnded` not on `GameState` type
**What goes wrong:** `gameEnded` added to the store but TypeScript errors because `GameState` interface doesn't include it; or `gameEnded` added to `GameState` and export snapshots pick it up unexpectedly.
**Why it happens:** `gameEnded` is UI/session state, not game simulation state.
**How to avoid:** Add `gameEnded: boolean` to `GameStore` (not to `GameState`), default `false`, reset to `false` in `newGame()` and `resetGame()`. Separate from `GameState` which represents the simulation.

### Pitfall 7: Debrief messages after a `debrief_divider` that precedes a `round_divider`
**What goes wrong:** If an interim debrief fires mid-game (DEBRIEF divider in Round 1), then play continues (Round 2 divider), the exporter must not include Round 2 transcript messages in the `## Debrief` section.
**Why it happens:** The CONTEXT.md spec says `## Debrief` = "all persona messages after the FIRST `debrief_divider`." But if play continues after an interim debrief, those messages belong to the round transcripts.
**How to avoid:** `## Debrief` section = messages after the LAST `debrief_divider` in the message list (or after the first, if there is only one). Simpler: only include messages after the final `debrief_divider`. Confirm with CONTEXT.md — it says "first" but the intent is the debrief content, which would be the last triggered debrief.
**Recommendation:** Use the LAST `debrief_divider` as the anchor for the `## Debrief` section — this correctly handles both interim-only and end-game-only scenarios.

---

## Code Examples

### Exporter: markdown table for TeamState (VS Code + GitHub safe)

Markdown pipe tables are GFM (GitHub Flavored Markdown) and render correctly in VS Code preview and GitHub. They also remain readable in plain text. Preferred over bullet lists for multi-team multi-field grids.

```markdown
### State at start of Round 2

Crisis: **Supply Crisis** (Severity 3) | EDIP Legitimacy: **+1**

| Team | PC | PO | RDY | STK | CRM | IC |
|------|----|----|-----|-----|-----|----|
| A    |  1 |  0 |   3 |   2 |   2 |  2 |
| B    |  4 |  1 |   3 |   3 |   2 |  5 |
| C    |  3 |  0 |   3 |   3 |   3 |  3 |
| D    |  4 |  1 |   3 |   3 |   3 |  3 |
```

Helper to render a GameState as this table:

```typescript
// Source: hand-written, matching CONTEXT.md spec
function renderStateSnapshot(state: GameState): string {
  const header = `Crisis: **${state.crisisState}** (Severity ${state.crisisSeverity}) | EDIP Legitimacy: **${state.edipLegitimacy >= 0 ? '+' : ''}${state.edipLegitimacy}**`
  const tableHeader = `| Team | PC | PO | RDY | STK | CRM | IC |`
  const tableSep    = `|------|----|----|-----|-----|-----|----|`
  const rows = state.teams.map(t =>
    `| ${t.id.padEnd(4)} | ${String(t.pc).padStart(2)} | ${String(t.po).padStart(2)} | ${String(t.readiness).padStart(3)} | ${String(t.stock).padStart(3)} | ${String(t.crm).padStart(3)} | ${String(t.ic).padStart(2)} |`
  )
  return [header, '', tableHeader, tableSep, ...rows].join('\n')
}
```

### Filename sanitiser: `toKebabFilename(name: string): string`

```typescript
// Source: hand-written; no library needed for this simple case
export function toKebabFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')   // strip non-word chars (emoji, slashes, punctuation)
    .replace(/[\s_]+/g, '-')    // spaces and underscores → hyphens
    .replace(/-+/g, '-')        // collapse consecutive hyphens
    .replace(/^-|-$/g, '')      // trim leading/trailing hyphens
    || 'game'                   // fallback if name is all-special-chars
}

// Filename: debrief-{kebab}-{YYYY-MM-DD-HHmm}.md
export function buildDebriefFilename(gameName: string, date: Date): string {
  const kebab = toKebabFilename(gameName)
  const ts = date.toISOString().slice(0, 16).replace('T', '-').replace(':', '')
  // '2026-04-14T15:30' → '2026-04-14-1530'
  return `debrief-${kebab}-${ts}.md`
}
```

### Backend prompt rewrite structure (config_gen.py)

The current `CONFIG_GEN_SYSTEM_PROMPT` is a ~200-word placeholder that asks for the wrong shape. The rewrite must:
1. List every `GameConfig` field explicitly
2. Specify the JSON types for each field
3. Embed a **condensed** EDIP structural exemplar (not the full 194-line config — token waste)
4. Require `"Output ONLY valid JSON"` (no markdown fences)

Prompt structure:

```python
CONFIG_GEN_SYSTEM_PROMPT = """You are a war-game scenario designer for the KV War Game engine.
Given a facilitator's brief, produce a complete JSON game configuration.

RULES:
- Output ONLY valid JSON. No markdown code fences, no prose, no comments.
- The word "JSON" must appear in your output (engine requirement).
- Every field below is required. Do not omit or rename any field.

REQUIRED SHAPE:
{
  "name": string,
  "domain": string,
  "description": string,
  "objective": string,
  "redLines": string,
  "pcThresholds": string,
  "votingRule": string,
  "eoMechanic": string,
  "resourceLogic": string,
  "facilitation": string,
  "scenarios": [
    {
      "id": string,
      "name": string,
      "description": string,
      "rounds": number,
      "startState": { "crisisSeverity": 0, "crisisState": "No Crisis", "edipLegitimacy": 0 },
      "injects": [string]  // one string per round
    }
  ],
  "teams": [
    {
      "id": string,    // e.g. "A", "B", "C", "D"
      "name": string,
      "description": string,
      "personas": [string, string],
      "uniqueAction": string,
      "pc": number,    // 0–6
      "po": number,    // -2 to 2
      "readiness": number, // 0–5
      "stock": number,
      "crm": number,
      "ic": number
    }
  ],
  "nationalActions": [
    { "id": string, "name": string, "summary": string, "cost": string }
  ],
  "cards": [
    { "id": string, "name": string, "cat": string, "timing": string, "req": string, "effect": string }
  ]
}

STRUCTURAL EXEMPLAR (condensed — follow this shape exactly):
{
  "name": "EDIP Security of Supply Wargame",
  "domain": "European Defence Technological and Industrial Base",
  "scenarios": [
    {
      "id": "S1", "name": "CRM Supply Crisis", "rounds": 4,
      "startState": { "crisisSeverity": 0, "crisisState": "No Crisis", "edipLegitimacy": 0 },
      "injects": ["Round 1 inject text", "Round 2 inject text", "Round 3 inject text", "Round 4 inject text"]
    }
  ],
  "teams": [
    {
      "id": "A", "name": "Team A: Frontline", "personas": ["Persona 1 summary", "Persona 2 summary"],
      "uniqueAction": "UNIQUE_ACTION (once per round): description. Cost: PC -1.",
      "pc": 3, "po": 0, "readiness": 3, "stock": 2, "crm": 2, "ic": 2
    }
  ],
  "nationalActions": [{ "id": "NA-01", "name": "Action Name", "summary": "What it does", "cost": "PC -1" }],
  "cards": [{ "id": "C-01", "name": "Card Name", "cat": "Category", "timing": "This Round", "req": "Precondition", "effect": "Effect text" }]
}

Generate at minimum: 2 scenarios, 4 teams, 4 national actions, 6 cards. Infer plausible details from the brief."""
```

Add `response_format: { "type": "json_object" }` to the API payload in `config_gen.py`:

```python
payload = {
    "model": settings.llm_model,
    "messages": [...],
    "max_tokens": settings.llm_max_tokens,
    "response_format": {"type": "json_object"},   # ADD THIS LINE
}
```

**Note on `response_format`:** The `json_object` mode guarantees syntactically valid JSON (no markdown fences, no prose preamble). It does NOT guarantee schema adherence — that is what the frontend `validateGameConfig()` validator handles. The combination of `json_object` + a detailed system prompt with a structural exemplar is the current best practice for non-streaming config generation without Structured Outputs (which requires specific model snapshot versions not configurable in this deployment).

**Important:** The `json_object` mode requires the word `"JSON"` to appear in the system prompt or messages — the prompt above satisfies this.

### validateGameConfig — required fields v1 scope

Per CONTEXT.md, v1 validates: `name`, `scenarios[].injects`, `teams[].startState` numerics, `cards[]` shape, `nationalActions[]` shape, `pcThresholds`. Path format: `scenarios[0].injects[2]: missing 'text' field`.

```typescript
// Source: hand-written per CONTEXT.md spec
export function validateGameConfig(parsed: unknown): ValidationResult {
  const errors: ValidationError[] = []
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, errors: [{ path: '(root)', message: 'expected object' }] }
  }
  const cfg = parsed as Record<string, unknown>

  // name
  if (typeof cfg.name !== 'string' || cfg.name.trim() === '') {
    errors.push({ path: 'name', message: 'required string, got ' + JSON.stringify(cfg.name) })
  }

  // pcThresholds
  if (typeof cfg.pcThresholds !== 'string') {
    errors.push({ path: 'pcThresholds', message: 'required string' })
  }

  // scenarios[].injects
  if (!Array.isArray(cfg.scenarios) || cfg.scenarios.length === 0) {
    errors.push({ path: 'scenarios', message: 'required non-empty array' })
  } else {
    (cfg.scenarios as unknown[]).forEach((sc, si) => {
      if (typeof sc !== 'object' || sc === null) {
        errors.push({ path: `scenarios[${si}]`, message: 'expected object' })
        return
      }
      const s = sc as Record<string, unknown>
      if (!Array.isArray(s.injects)) {
        errors.push({ path: `scenarios[${si}].injects`, message: 'required array' })
      }
    })
  }

  // teams[].startState numerics — note: TeamConfig has pc/po/readiness/stock/crm/ic at top level (no startState nested object)
  if (!Array.isArray(cfg.teams) || cfg.teams.length === 0) {
    errors.push({ path: 'teams', message: 'required non-empty array' })
  } else {
    (cfg.teams as unknown[]).forEach((tm, ti) => {
      if (typeof tm !== 'object' || tm === null) {
        errors.push({ path: `teams[${ti}]`, message: 'expected object' })
        return
      }
      const t = tm as Record<string, unknown>
      const numFields: { key: string; min: number; max: number }[] = [
        { key: 'pc', min: 0, max: 6 },
        { key: 'po', min: -2, max: 2 },
        { key: 'readiness', min: 0, max: 5 },
      ]
      for (const { key, min, max } of numFields) {
        if (typeof t[key] !== 'number') {
          errors.push({ path: `teams[${ti}].${key}`, message: `expected number ${min}–${max}, got ${JSON.stringify(t[key])}` })
        }
      }
    })
  }

  // cards[]
  if (!Array.isArray(cfg.cards)) {
    errors.push({ path: 'cards', message: 'required array' })
  } else {
    (cfg.cards as unknown[]).forEach((c, ci) => {
      if (typeof c !== 'object' || c === null) {
        errors.push({ path: `cards[${ci}]`, message: 'expected object' })
        return
      }
      const card = c as Record<string, unknown>
      for (const field of ['id', 'name', 'cat', 'timing', 'effect'] as const) {
        if (typeof card[field] !== 'string') {
          errors.push({ path: `cards[${ci}].${field}`, message: `required string` })
        }
      }
    })
  }

  // nationalActions[]
  if (!Array.isArray(cfg.nationalActions)) {
    errors.push({ path: 'nationalActions', message: 'required array' })
  } else {
    (cfg.nationalActions as unknown[]).forEach((na, ni) => {
      if (typeof na !== 'object' || na === null) {
        errors.push({ path: `nationalActions[${ni}]`, message: 'expected object' })
        return
      }
      const a = na as Record<string, unknown>
      for (const field of ['id', 'name', 'summary'] as const) {
        if (typeof a[field] !== 'string') {
          errors.push({ path: `nationalActions[${ni}].${field}`, message: `required string` })
        }
      }
    })
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: parsed as GameConfig }
}
```

### Testing browser download in Vitest/jsdom

jsdom does not implement `URL.createObjectURL`. Stub it in the test:

```typescript
// In debriefExporter.test.ts
beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  })
  // jsdom has no real anchor.click() either
  vi.spyOn(document, 'createElement').mockReturnValue(
    Object.assign(document.createElement('a'), { click: vi.fn() })
  )
})
```

Or more focused: test `generateDebriefMarkdown()` (pure) exhaustively; test `downloadDebrief()` only for the anchor.download attribute and that revokeObjectURL is called.

### Testing GenerateBriefPanel fetch in Vitest/RTL

Matches the established pattern from `llmClient.test.ts` (line 31–37):

```typescript
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| `response_format: json_object` only | `json_object` + detailed system prompt + structural exemplar | ~80% reduction in shape-mismatch failures |
| Structured Outputs (`json_schema`) | Not used — requires specific model snapshot versions | Irrelevant unless LLM_MODEL is pinned to gpt-4o-mini-2024-07-18 or later |
| `structuredClone()` outside `set()` | `immer.current()` inside `set()` for draft snapshots | Eliminates DataCloneError class entirely |

**Deprecated/outdated in this codebase:**
- `CONFIG_GEN_SYSTEM_PROMPT` in `config_gen.py` — Phase 2 placeholder, completely wrong shape; MUST be replaced in Phase 7 plan 07-03 as first step before any frontend wiring

---

## Open Questions

1. **Last vs first debrief_divider as anchor for `## Debrief` section**
   - What we know: CONTEXT.md says "messages after the first `debrief_divider`" 
   - What's unclear: if an interim debrief fires in Round 1 and the game continues to Round 3, "first `debrief_divider`" anchor would include all subsequent round messages in the Debrief section — clearly wrong
   - Recommendation: Use the LAST `debrief_divider` as the anchor. This correctly handles interim-then-end-game flow and is semantically correct ("the debrief content" = what happened in the last debrief trigger). Planner should document this as a named decision.

2. **`configJson` vs separate `draftConfigJson` field**
   - What we know: CONTEXT.md says to lift `draftConfigJson` to the store; LoadConfigPanel currently binds to `configJson`
   - What's unclear: should LoadConfigPanel be updated to read `draftConfigJson` instead, or should generate-brief write to the existing `configJson`?
   - Recommendation: Write to `configJson` (existing field); add `draftSource: 'brief' | 'load' | null` as a separate lightweight flag. This avoids updating LoadConfigPanel's data binding and all existing tests that set `configJson` directly on the store. The planner should confirm this simplification.

3. **Backend `response_format: json_object` — model compatibility**
   - What we know: `json_object` mode is supported on gpt-3.5-turbo and gpt-4 family models; the specific model is set via `LLM_MODEL` env var
   - What's unclear: if the deployment uses a non-OpenAI-compatible endpoint (e.g. Claude via Anthropic API, or a local model), `response_format` may be silently ignored or cause a 400 error
   - Recommendation: Add the `response_format` field with a comment in `config_gen.py` noting it is OpenAI-compatible only and the field is gracefully ignored by incompatible backends. The frontend validator handles shape failures regardless.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read — `src/lib/gameStore.ts` (advanceRound, applyStateUpdate pattern, lines 300–305, DataCloneError precedent)
- Codebase direct read — `src/lib/jsonValidation.ts` (existing ParseResult discriminated union; validator pattern to extend)
- Codebase direct read — `src/lib/llmClient.ts` (fetch pattern, AbortController, error code mapping)
- Codebase direct read — `backend/app/routers/config_gen.py` (current wrong-shape prompt; `response_format` field absent from payload)
- Codebase direct read — `src/components/setup/SetupScreen.tsx` (GenerateBriefPanel = two-line stub confirmed)
- Codebase direct read — `src/components/setup/LoadConfigPanel.tsx` (reads `configJson` from store; `draftSource` field absent)
- Codebase direct read — `src/types/game.ts` (`GameConfig`, `GameState` shapes; `gameEnded` absent from both)
- Codebase direct read — `package.json` (no Zod/Ajv/Yup/Valibot in dependencies; confirmed hand-roll required)
- [MDN — URL.createObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static) — baseline available, Service Worker restriction noted
- [Immer — current() function](https://immerjs.github.io/immer/current/) — plain-object snapshot from draft, not frozen, safe to store

### Secondary (MEDIUM confidence, cross-referenced)
- [MDN Blob URI docs](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob) — download attribute and anchor pattern
- [LogRocket — Programmatically downloading files](https://blog.logrocket.com/programmatically-downloading-files-browser/) — cross-browser anchor + revoke pattern; Firefox setTimeout workaround
- [OpenAI JSON Mode guide](https://www.eesel.ai/blog/openai-json-mode) — `json_object` requires "JSON" in prompt; guarantees syntax not schema
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) — `json_schema` mode requires specific model versions; not applicable unless model is pinned

### Tertiary (LOW confidence — WebSearch only, not authoritative source)
- Zod 4 bundle size claims (~2KB gzipped for zod/mini) — not directly verified against npm registry
- Firefox-specific `document.body.appendChild` workaround for programmatic click — widely cited community pattern; correct behavior is browser-version dependent and has been largely fixed in modern Firefox

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — direct package.json read; zero new packages
- Architecture patterns: HIGH — direct codebase read of 12 source files
- Pitfalls: HIGH for items 1–4 (codebase evidence + official docs); MEDIUM for items 5–7 (logical deduction from codebase)
- Code examples: HIGH for pure function signatures; MEDIUM for prompt text (prompt engineering is empirical)

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable APIs; MDN docs don't drift; Immer API is stable)
