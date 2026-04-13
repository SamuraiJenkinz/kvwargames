# Phase 1: Foundation - Research

**Researched:** 2026-04-13
**Domain:** TypeScript interfaces, Zustand state management, Vite/React/Tailwind v4 scaffolding
**Confidence:** HIGH (core stack verified via official docs and Context7-equivalent sources)

---

## Summary

Phase 1 establishes the complete data contract and state management foundation for the war game engine. The stack is Vite 6 + React + TypeScript with Zustand 5 for state, Tailwind v4 for styling, and Vitest for testing. The spec was written for Next.js but the project uses Vite/React — this requires systematic adaptation in three areas: (1) path aliases must be defined in both tsconfig.json AND vite.config.ts, (2) there are no server-side API routes — the Vite dev proxy handles CORS during development, and (3) environment variables use the `VITE_` prefix for any browser-accessible variables.

The critical decisions for this phase are already locked in CONTEXT.md: Zustand with devtools middleware (dev only) and immer for complex state updates, TypeScript strict mode throughout, and idempotent `initGame`/`resetGame` semantics. The EDIP data constant is transcribed verbatim from spec Section 7. The primary pitfall to avoid is the dual-configuration requirement for path aliases — omitting either the tsconfig or vite.config entry causes silent failures that only manifest at runtime or in tests.

**Primary recommendation:** Scaffold with `pnpm create vite` (react-ts template), immediately add Tailwind v4 via `@tailwindcss/vite` plugin, then implement types → data → store in that order. Each layer validates the previous.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite | ^6.x (latest v8.0.8) | Build tool + dev server | First-party React/TS support, proxy, HMR |
| @vitejs/plugin-react | ^4.x | React JSX transform | Official Vite React plugin |
| react | ^19.x | UI framework | Required by project |
| react-dom | ^19.x | DOM rendering | Required by project |
| typescript | ^5.x | Type system | Required by project |
| zustand | ^5.0.x (current: 5.0.12) | State management | Locked in spec — ephemeral session state |
| tailwindcss | ^4.x | CSS framework | Locked in spec — CSS-first v4 |
| @tailwindcss/vite | ^4.x | Tailwind Vite plugin | First-party, replaces PostCSS approach in v4 |
| lucide-react | latest | Icons | Locked in spec |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| immer | ^10.x | Immutable state helper | Required by zustand/middleware/immer |
| vitest | ^3.x | Test runner | Locked in decisions — native Vite integration |
| @vitest/ui | ^3.x | Test UI | Development convenience |
| @testing-library/react | ^16.x | Component testing | React hook/component tests |
| @testing-library/jest-dom | ^6.x | DOM matchers | Assert on DOM in tests |
| jsdom | ^26.x | Browser simulation | Vitest environment for DOM tests |
| @types/node | ^22.x | Node types | Required for path alias in vite.config.ts |
| eslint | ^9.x | Linting | Locked in decisions |
| @eslint/js | ^9.x | ESLint base rules | Standard ESLint flat config |
| typescript-eslint | ^8.x | TypeScript ESLint | Strict TypeScript linting |
| prettier | ^3.x | Code formatting | Locked in decisions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zustand immer | Manual spread operators | Spreads are fine for flat state; immer saves verbosity for nested team arrays |
| @tailwindcss/vite | PostCSS + tailwindcss | PostCSS works but the first-party Vite plugin is simpler and faster in v4 |
| vitest | jest | Vitest shares vite.config.ts (path aliases work automatically); Jest requires separate config |
| vite-tsconfig-paths plugin | Manual resolve.alias | Manual alias is more explicit and avoids extra dependency |

**Installation:**
```bash
# Scaffold
pnpm create vite war-game-engine --template react-ts
cd war-game-engine

# Core runtime
pnpm add zustand immer lucide-react

# Tailwind v4
pnpm add tailwindcss @tailwindcss/vite

# Dev/test
pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
pnpm add -D @types/node eslint @eslint/js typescript-eslint prettier
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── types/
│   ├── game.ts          # All game interfaces (GameConfig, GameState, TeamState, etc.)
│   └── llm.ts           # LLM request/response interfaces
├── data/
│   └── edipConfig.ts    # EDIP_CONFIG constant — sole source of game data
├── lib/
│   └── gameStore.ts     # Zustand store — all session state
├── components/
│   ├── setup/           # Empty dirs — Phase 4/5
│   ├── game/            # Empty dirs — Phase 4/5
│   └── shared/          # Empty dirs — Phase 4/5
├── styles/
│   └── index.css        # @import "tailwindcss" + @theme tokens + global styles
└── main.tsx             # Entry point
```

### Pattern 1: Path Aliases — Dual Configuration Required

**What:** `@/` path alias must be configured in BOTH tsconfig.json (for TypeScript) AND vite.config.ts (for bundling). They are independent systems.

**When to use:** Every import using `@/types/...`, `@/lib/...`, `@/data/...`

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**vite.config.ts:**
```typescript
// Source: https://vite.dev/config/
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

Note: `path.resolve` requires `@types/node` installed as dev dependency.

### Pattern 2: Zustand Store with Devtools + Immer

**What:** Single store file with all session state. Devtools wrapped around immer — devtools is the outer middleware, immer is inner.

**When to use:** All state reads/writes in the application

```typescript
// Source: https://github.com/pmndrs/zustand/discussions/2195
// Source: https://zustand.docs.pmnd.rs/reference/middlewares/devtools
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// TypeScript: double function call pattern — required for inference
const useGameStore = create<GameStore>()(
  devtools(
    immer((set, get) => ({
      // state and actions here
    })),
    {
      name: 'GameStore',
      enabled: import.meta.env.DEV,
    }
  )
)
```

The double function call `create<GameStore>()( ... )` is required — it's not a typo. TypeScript cannot infer the state type from a single call when middleware is involved.

### Pattern 3: Tailwind v4 CSS-First Configuration

**What:** No tailwind.config.ts needed. Design tokens live in the CSS file using `@theme`.

**When to use:** All custom design tokens — colors, fonts, spacing

```css
/* src/styles/index.css */
/* Source: https://tailwindcss.com/docs/theme */
@import "tailwindcss";

@theme {
  /* App background colors */
  --color-bg-base: #060810;
  --color-bg-panel: #07090E;
  --color-bg-surface: #0A0D14;
  --color-bg-elevated: #0D1017;

  /* Border colors */
  --color-border-subtle: #0F1520;
  --color-border-default: #141920;
  --color-border-muted: #1A2030;
  --color-border-dim: #1E2838;

  /* Text colors */
  --color-text-primary: #BCC8D8;
  --color-text-secondary: #6A7A90;
  --color-text-muted: #3A4A5A;

  /* Persona colors */
  --color-persona-kent: #5B9BD5;
  --color-persona-finch: #DFA02A;
  --color-persona-chen: #2BC48A;

  /* Resource colors */
  --color-resource-pc: #5B9BD5;
  --color-resource-po: #A29BFE;
  --color-resource-readiness: #2BC48A;
  --color-resource-stock: #74B9FF;
  --color-resource-crm: #FF7675;
  --color-resource-ic: #FDCB6E;

  /* Typography */
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
}
```

Usage in components: `bg-bg-base`, `text-text-primary`, `font-mono`, etc.

Note: The spec references `tailwind.config.ts` with a `colors:` object — this is the Next.js approach. For Vite + Tailwind v4, move all tokens into `@theme` in CSS. The spec's color values are authoritative; only the mechanism changes.

### Pattern 4: Vite Proxy for FastAPI

**What:** Vite dev server forwards `/api/*` to FastAPI on port 8000. No CORS headers needed in development.

```typescript
// In vite.config.ts server section
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      // Do NOT rewrite path — FastAPI backend expects /api prefix
    },
  },
},
```

FastAPI routes should be prefixed with `/api/` to match. In production, the web server (nginx, etc.) handles this routing instead.

### Pattern 5: TypeScript Interface Hierarchy

**What:** The spec defines interfaces in src/types/game.ts and src/types/llm.ts. Keep them exactly as specified — all subsequent phases import from here.

**Build order within this pattern:**
1. Primitive types and enums first (`CrisisState`, `PersonaId`, `AppPhase`, `SetupMode`, `MessageType`)
2. Config interfaces (`TeamConfig`, `Scenario`, `NationalAction`, `GameCard`, `GameConfig`)
3. State interfaces (`TeamState`, `GameState`, `StateUpdate`)
4. Message/chat interfaces (`ChatMessage`)
5. LLM interfaces (separate file: `LLMRequest`, `LLMResponse`, `PersonaResponse`, `LLMStructuredResponse`)

### Pattern 6: Zustand Store — initGame Implementation

**What:** `initGame` must build `GameState` from `GameConfig` + scenario index, wiping all previous state.

```typescript
// Source: spec Section 8 + CONTEXT.md decisions
initGame: (config: GameConfig, scenarioIndex: number) => set((state) => {
  const scenario = config.scenarios[scenarioIndex]
  state.gameConfig = config
  state.gameState = {
    round: 1,
    scenarioIndex,
    crisisSeverity: scenario.startState.crisisSeverity,
    crisisState: scenario.startState.crisisState,
    edipLegitimacy: scenario.startState.edipLegitimacy,
    teams: config.teams.map((t) => ({
      id: t.id,
      name: t.name,
      pc: t.pc,
      po: t.po,
      readiness: t.readiness,
      stock: t.stock,
      crm: t.crm,
      ic: t.ic,
    })),
    cardsThisRound: [],
  }
  state.phase = 'game'
  state.messages = []
  state.llmHistory = []
}),
```

### Pattern 7: applyStateUpdate — Safe Clamping with id-based Team Matching

```typescript
// Source: spec Section 8 + CONTEXT.md decisions
applyStateUpdate: (update: StateUpdate) => set((state) => {
  if (!state.gameState) return  // no-op if no active game

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v))

  if (update.crisisSeverity != null)
    state.gameState.crisisSeverity = clamp(update.crisisSeverity, 0, 5)
  if (update.crisisState != null)
    state.gameState.crisisState = update.crisisState
  if (update.edipLegitimacy != null)
    state.gameState.edipLegitimacy = clamp(update.edipLegitimacy, -2, 2)

  if (update.teamUpdates) {
    for (const teamUpdate of update.teamUpdates) {
      const team = state.gameState.teams.find((t) => t.id === teamUpdate.id)
      if (!team) continue  // silently drop unknown team IDs
      if (teamUpdate.pc != null) team.pc = clamp(teamUpdate.pc, 0, 6)
      if (teamUpdate.po != null) team.po = clamp(teamUpdate.po, -2, 2)
      if (teamUpdate.readiness != null) team.readiness = clamp(teamUpdate.readiness, 0, 5)
      if (teamUpdate.stock != null) team.stock = clamp(teamUpdate.stock, 0, 99)
      if (teamUpdate.crm != null) team.crm = clamp(teamUpdate.crm, 0, 99)
      if (teamUpdate.ic != null) team.ic = clamp(teamUpdate.ic, 0, 99)
    }
  }
}),
```

### Anti-Patterns to Avoid
- **Putting Tailwind tokens in tailwind.config.ts:** This is the v3 pattern. In v4, there is no JS config file — all tokens go in `@theme` in CSS.
- **Single function call with TypeScript + Zustand middleware:** `create<T>(...)` without the second `()` loses type inference when middleware is stacked.
- **Path alias in tsconfig only:** Vitest and the Vite bundler both need the alias in vite.config.ts — TypeScript's paths setting only helps the compiler/editor.
- **Rewriting /api path in proxy:** Keep the `/api` prefix — FastAPI backend will be built with `/api/` routes in Phase 2.
- **Array-index team updates:** Always match teams by `id` field, not position — LLM output order is not guaranteed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Immutable nested state updates | Manual spread operators for team arrays | `zustand/middleware/immer` | Team state has nested objects; spreads are error-prone and verbose |
| Store reset between Vitest tests | Custom store factory per test | Zustand `__mocks__/zustand.ts` with `afterEach` reset | Official pattern; avoids test pollution |
| Path alias resolution | Custom import resolver | tsconfig paths + vite resolve.alias together | Standard pattern; editor, bundler, and tests all need it |
| CSS variable color tokens | CSS custom properties managed manually | Tailwind v4 `@theme` | Automatically generates utility classes from tokens |
| Test environment setup | Custom DOM environment | jsdom via vitest `environment: 'jsdom'` | Standard for React component testing |

**Key insight:** The most hand-roll-tempting problem here is Zustand test isolation. It looks like you just need to reset some variables, but test order dependencies create subtle bugs. Use the official `__mocks__/zustand.ts` pattern.

---

## Common Pitfalls

### Pitfall 1: Missing Vite Path Alias (TypeScript Compiles, Runtime Fails)
**What goes wrong:** Code compiles with zero TypeScript errors because tsconfig.json is configured, but at runtime or in Vitest, `@/types/game` resolves to nothing — module not found error.
**Why it happens:** TypeScript's `paths` only instructs the compiler; Vite and Vitest use their own module resolution.
**How to avoid:** Always configure `resolve.alias` in vite.config.ts AND add `@types/node` to devDependencies (required for `path.resolve(__dirname, ...)`).
**Warning signs:** TS errors absent but test or dev server throws "Cannot find module '@/types/...'"

### Pitfall 2: Zustand Double-Call Syntax Omitted
**What goes wrong:** TypeScript infers `unknown` for state type, losing all type checking on store actions.
**Why it happens:** Zustand v5 requires `create<T>()( middleware(...) )` — the empty `()` after the type parameter is necessary for TypeScript's currying inference to work with middleware.
**How to avoid:** Always write `create<StoreType>()( devtools( immer(...) ) )`. Check that your IDE shows typed autocomplete on store actions.
**Warning signs:** `state` parameter typed as `any` or `unknown` inside set callbacks.

### Pitfall 3: Tailwind v4 Config in Wrong Location
**What goes wrong:** Custom color tokens don't generate utility classes — `bg-bg-base` is undefined.
**Why it happens:** Developer puts tokens in `tailwind.config.ts` (v3 pattern) or uses `@layer base` instead of `@theme`.
**How to avoid:** In v4 with `@tailwindcss/vite`, there is no JS config file. ALL design tokens go in the `@theme {}` block in your CSS file. The CSS file must include `@import "tailwindcss"` as the first line.
**Warning signs:** `tailwind.config.ts` exists with a `theme.extend.colors` block; tokens defined with `@layer` rather than `@theme`.

### Pitfall 4: Vite Proxy Path Rewrite Strips /api Prefix
**What goes wrong:** Requests reach FastAPI at the wrong path (`/llm` instead of `/api/llm`), causing 404s.
**Why it happens:** Developers copy examples that use `rewrite: (path) => path.replace(/^\/api/, '')` — this is for backends that don't have an `/api` prefix. This backend WILL have `/api` routes.
**How to avoid:** Do NOT include a `rewrite` function in the proxy config. Proxy straight-through: `{ '/api': { target: 'http://localhost:8000', changeOrigin: true } }`.
**Warning signs:** 404 errors from FastAPI when requests hit `/llm` (missing prefix).

### Pitfall 5: EDIP Config Data Entry Errors
**What goes wrong:** Tests fail because team starting values, card counts, or scenario data don't match the spec.
**Why it happens:** Manual transcription of a large data constant introduces typos. The spec says 11 cards, 4 teams, 2 scenarios, 4 national actions.
**How to avoid:** Write Vitest tests FIRST that assert counts (cards.length === 11, teams.length === 4, etc.) and spot-check key values (Team A pc === 3, Scenario S1 rounds === 4). Run tests during transcription, not after.
**Warning signs:** Tests assert counts that pass with partial data because the assertion itself has a typo.

### Pitfall 6: Zustand Store Not Reset Between Vitest Tests
**What goes wrong:** Tests pass individually but fail when run together — state from test A bleeds into test B.
**Why it happens:** Zustand stores are module-level singletons. Importing the store in multiple test files shares the same instance.
**How to avoid:** Create `__mocks__/zustand.ts` at the project root (not src/). The mock patches `create` to register a reset function, then `afterEach` calls all reset functions. See official Zustand testing guide.
**Warning signs:** Tests pass with `vitest run --testNamePattern="specific test"` but fail with `vitest run`.

### Pitfall 7: VITE_ Prefix Missing on Frontend Env Variables
**What goes wrong:** `import.meta.env.MY_VAR` is `undefined` in the browser even though `.env.example` documents it.
**Why it happens:** Vite only exposes env vars prefixed with `VITE_` to the browser bundle. Unprefixed vars are server-only.
**How to avoid:** Only LLM credentials (server-only) should be unprefixed. Any variable the React app needs must start with `VITE_`. Document this split clearly in `.env.example`.
**Warning signs:** Variable is defined in `.env.local` but `import.meta.env.VARNAME` logs undefined.

---

## Code Examples

### Complete vite.config.ts
```typescript
// Source: https://vite.dev/config/server-options.html + https://tailwindcss.com/docs/installation
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

Note: `test` block in vite.config.ts requires `/// <reference types="vitest" />` at the top, OR use a separate `vitest.config.ts`. Either approach works; colocation in vite.config.ts reduces configuration files.

### Vitest reference directive (if colocating)
```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
// ... rest of config
```

### Zustand Store — Full Structure
```typescript
// Source: spec Section 8 + https://github.com/pmndrs/zustand/discussions/2195
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { AppPhase, SetupMode, GameConfig, GameState, ChatMessage, StateUpdate } from '@/types/game'

interface GameStore {
  // ... (full interface from spec Section 8)
}

export const useGameStore = create<GameStore>()(
  devtools(
    immer((set, get) => ({
      // initial state
      phase: 'setup' as AppPhase,
      setupMode: 'home' as SetupMode,
      gameConfig: null,
      configJson: '',
      briefText: '',
      gameState: null,
      messages: [] as ChatMessage[],
      llmHistory: [],
      loading: false,
      activeTab: 'cards' as 'cards' | 'actions' | 'guide',
      // actions implemented inline
    })),
    { name: 'GameStore', enabled: import.meta.env.DEV }
  )
)
```

### Zustand Test Mock (official Vitest pattern)
```typescript
// __mocks__/zustand.ts  (at project root, NOT src/)
// Source: https://github.com/pmndrs/zustand/issues/242
import { act } from '@testing-library/react'
import { afterEach } from 'vitest'
import { create as actualCreate, createStore as actualCreateStore } from 'zustand'
import type { StateCreator } from 'zustand'

const storeResetFns = new Set<() => void>()

const create = (<T,>(stateCreator: StateCreator<T>) => {
  const store = actualCreate(stateCreator)
  const initialState = store.getState()
  storeResetFns.add(() => store.setState(initialState, true))
  return store
}) as typeof actualCreate

afterEach(() => {
  act(() => {
    storeResetFns.forEach((resetFn) => resetFn())
  })
})

export { create }
export default create
```

### .env.example (Vite + FastAPI split)
```bash
# ─── Frontend (Vite) — accessible via import.meta.env.VITE_* ─────────────────
# App display title
VITE_APP_TITLE=EDIP War Game Engine

# ─── Backend (FastAPI, server-only — NOT prefixed with VITE_) ────────────────
# These are used by the FastAPI proxy server, not the React frontend.
# The corporate LLM API base URL (OpenAI-compatible endpoint)
LLM_API_BASE_URL=https://your-corporate-llm.example.com/v1

# Your corporate API key or bearer token
LLM_API_KEY=your-api-key-here

# The model identifier
LLM_MODEL=gpt-4o

# Optional: additional headers (JSON string)
# Example: {"X-Corporate-Header":"value"}
LLM_EXTRA_HEADERS={}

# Max tokens for game persona responses
LLM_MAX_TOKENS=1000

# Max tokens for game config generation
LLM_CONFIG_GEN_MAX_TOKENS=2000

# FastAPI server port (default 8000)
FASTAPI_PORT=8000
```

### EDIP Config Validation Test Pattern
```typescript
// src/data/edipConfig.test.ts
import { describe, it, expect } from 'vitest'
import { EDIP_CONFIG } from './edipConfig'

describe('EDIP_CONFIG', () => {
  it('has 2 scenarios', () => {
    expect(EDIP_CONFIG.scenarios).toHaveLength(2)
  })
  it('has 4 teams', () => {
    expect(EDIP_CONFIG.teams).toHaveLength(4)
  })
  it('has 11 cards', () => {
    expect(EDIP_CONFIG.cards).toHaveLength(11)
  })
  it('has 4 national actions', () => {
    expect(EDIP_CONFIG.nationalActions).toHaveLength(4)
  })
  it('team A starts with pc=3, readiness=3', () => {
    const teamA = EDIP_CONFIG.teams.find((t) => t.id === 'A')
    expect(teamA?.pc).toBe(3)
    expect(teamA?.readiness).toBe(3)
  })
  it('scenario S1 has 4 rounds', () => {
    const s1 = EDIP_CONFIG.scenarios.find((s) => s.id === 'S1')
    expect(s1?.rounds).toBe(4)
  })
  it('scenario S2 has 5 rounds', () => {
    const s2 = EDIP_CONFIG.scenarios.find((s) => s.id === 'S2')
    expect(s2?.rounds).toBe(5)
  })
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.ts with theme.extend | @theme block in CSS file | Tailwind v4 (Jan 2025) | No JS config file needed — all tokens in CSS |
| @tailwind base/components/utilities directives | @import "tailwindcss" | Tailwind v4 (Jan 2025) | Single import replaces three directives |
| PostCSS for Tailwind | @tailwindcss/vite plugin | Tailwind v4 (Jan 2025) | First-party Vite plugin; 100x faster incremental builds |
| create<T>(middleware) | create<T>()(middleware) | Zustand v4+ | Double-call syntax required for TypeScript inference with middleware |
| Zustand v4 | Zustand v5 (5.0.12) | October 2024 | Cleaner API surface, React 18 concurrent mode optimized |
| Vite 5 | Vite 6 (8.0.x) | Late 2024 | Template is react-ts; same configuration approach |
| next/font | Google Fonts via @import or fontsource | This project (Vite) | No Next.js font optimization — use @fontsource/* packages or standard @import |

**Deprecated/outdated:**
- `next/font/google`: Spec uses this for Syne/DM Sans/IBM Plex Mono — inapplicable in Vite. Use `@fontsource/syne`, `@fontsource/dm-sans`, `@fontsource/ibm-plex-mono` packages instead, or load from Google Fonts CDN in index.html.
- `tailwind.config.ts` with `theme.colors`: v3 pattern. In v4, this file should not exist.
- `@tailwind base; @tailwind components; @tailwind utilities`: v3 directives. Replace with `@import "tailwindcss"`.

---

## Open Questions

1. **Google Fonts vs @fontsource packages**
   - What we know: Spec loads fonts via `next/font/google` (server-side optimization). In Vite this doesn't exist.
   - What's unclear: Whether to use `@fontsource/*` npm packages (zero external requests, tree-shakeable) or a standard Google Fonts CDN `<link>` in index.html.
   - Recommendation: Use `@fontsource/*` packages — keeps fonts offline-capable (important for corporate deployment), adds them to pnpm lockfile. Install: `pnpm add @fontsource/syne @fontsource/dm-sans @fontsource/ibm-plex-mono`. Import in index.css. LOW-MEDIUM confidence — verify this approach isn't overkill for Phase 1 scope.

2. **Vitest triple-slash reference vs separate vitest.config.ts**
   - What we know: Colocation in vite.config.ts requires `/// <reference types="vitest" />`. Separate vitest.config.ts avoids the directive.
   - What's unclear: Which is more common for this stack in 2025/2026.
   - Recommendation: Colocate in vite.config.ts with the triple-slash reference — fewer files, simpler setup. Either is correct.

3. **configJson initial value**
   - What we know: CONTEXT.md says `configJson` is pre-populated with the EDIP config JSON string on store creation (convenience for setup screen).
   - What's unclear: Whether to JSON.stringify at module level (computed once at import time) or inside the Zustand initializer.
   - Recommendation: `JSON.stringify(EDIP_CONFIG, null, 2)` at module level in gameStore.ts — assign the result as the initial value. This is a constant, not reactive.

---

## Sources

### Primary (HIGH confidence)
- https://tailwindcss.com/docs/installation — Vite installation steps verified
- https://tailwindcss.com/docs/theme — @theme directive and design token syntax verified
- https://vite.dev/config/server-options.html — Proxy configuration options verified
- https://vite.dev/guide/ — Vite 6 (v8.0.x) version confirmed, react-ts template confirmed
- https://zustand.docs.pmnd.rs/reference/middlewares/devtools — devtools API, @redux-devtools/extension requirement
- https://github.com/pmndrs/zustand/discussions/2195 — devtools + immer TypeScript composition pattern

### Secondary (MEDIUM confidence)
- https://github.com/pmndrs/zustand/issues/242 — Zustand reset between tests pattern (widely cited, multiple sources)
- Multiple sources confirming Zustand 5.0.12 as current version (npmjs.com, socket.dev)
- WebSearch results confirming @tailwindcss/vite as the first-party Vite plugin for v4

### Tertiary (LOW confidence)
- @fontsource recommendation for Google Fonts in Vite — based on common community practice, not verified against official docs
- `configJson` initialization strategy — architectural recommendation from spec reading

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via official docs and npm
- Architecture: HIGH — Vite proxy docs confirmed, Tailwind v4 @theme confirmed, Zustand patterns confirmed via GitHub discussions + official middleware docs
- Pitfalls: HIGH (items 1-6) / MEDIUM (item 7 on VITE_ prefix — standard Vite behavior but not explicitly re-verified)

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (Tailwind v4 and Zustand v5 are stable releases; Vite patch versions may change but API is stable)
