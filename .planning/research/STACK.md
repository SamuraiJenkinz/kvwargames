# Technology Stack: KV War Game Engine

**Project:** KV War Game Engine — AI-powered wargame facilitation tool
**Researched:** 2026-04-13
**Architecture:** Python/FastAPI backend + React/Vite frontend (monorepo)

---

## Recommended Stack

### Backend: Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Python | 3.11+ | Runtime | 3.11 gives meaningful perf gains over 3.10; 3.12 is stable but some corporate IT images lag behind. 3.11 is the safe minimum for 2025 deployments. |
| FastAPI | 0.135.x | API server + LLM proxy | Current stable (0.135.3 as of 2026-04-01). Built-in async, automatic OpenAPI docs, Pydantic-native. Starlette-based so it can serve the React build as static files. The LLM proxy route is the single most important architectural decision — FastAPI makes this trivial with a single async endpoint. |
| Uvicorn | 0.x (latest) | ASGI server | Bundled with `fastapi[standard]`. Standard ASGI server for FastAPI. Use `uvicorn[standard]` for production (includes `uvloop` and `httptools` for speed). |
| Pydantic v2 | 2.9+ | Request/response models, settings | Required by FastAPI 0.135.2+. v2 uses Rust-based core — meaningfully faster than v1 for JSON serialization. The LLM structured-response parsing (persona responses + state deltas) benefits from Pydantic model validation. |
| pydantic-settings | 2.x | Environment variable management | Official companion to Pydantic v2 for typed, validated env var loading. Reads `.env` files and environment variables. The correct way to load `LLM_API_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_EXTRA_HEADERS` into typed Python classes. |
| httpx | 0.27+ | Async HTTP client for LLM proxy | FastAPI's TestClient is built on httpx. For the LLM proxy route (`POST /api/llm`), use `httpx.AsyncClient` to forward requests to the corporate OpenAI-compatible endpoint. Non-blocking, supports streaming, has the exact same API shape as the OpenAI SDK's underlying transport. |

**Why not `requests` library?** Blocking sync I/O in an async FastAPI handler kills the server's concurrency. `httpx` is the async-native replacement and is already a FastAPI transitive dependency.

**Why not `openai` Python SDK?** The OpenAI SDK adds version-pinned opinions about auth headers and endpoint shape. For a corporate endpoint proxy where you must pass custom headers (`LLM_EXTRA_HEADERS`), raw `httpx` against the OpenAI-compatible chat completions format gives cleaner control. If the corporate endpoint is Azure OpenAI, there is also an `openai` SDK with Azure support — but raw httpx is simpler and has zero extra dependencies for this single-endpoint use case.

---

### Backend: Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-dotenv | 1.0+ | `.env` file loading in dev | Used by pydantic-settings automatically when `env_file=".env"` is set. Install explicitly so dev tooling can find it. |
| python-multipart | 0.0.9+ | Form data parsing | Required by FastAPI for file upload endpoints (config JSON file upload). Install with `fastapi[standard]` but pin explicitly. |
| anyio | 4.x | Async compatibility layer | FastAPI/Starlette dependency. Needed explicitly for async test setup (`pytest.mark.anyio`). |

---

### Frontend: Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 20 LTS | Runtime | 20 LTS is the stable corporate standard. Vite 6 requires Node 18+; 20 LTS gives two more years of security updates. |
| React | 19.x | UI library | Current stable as of December 2024. React 19 removes `forwardRef` complexity (direct `ref` prop), which matters for the animated components (TrackBar, LoadingDots). Security patches are in 19.2.1+. Do NOT use React 18 — the ecosystem has moved. |
| TypeScript | 5.x | Type safety | 5.x is the current stable. Use strict mode. The spec's data models (`GameState`, `PersonaResponse`, `TeamState`) are complex enough that loose TypeScript will cause bugs during LLM response parsing. |
| Vite | 6.x | Build tool + dev server | Current stable. `@tailwindcss/vite` plugin integrates directly — no PostCSS config needed. Fast HMR during development. For the corporate deployment pattern (FastAPI serves the `dist/` build), `vite build` outputs a clean SPA bundle. |

---

### Frontend: State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 5.x | Client state (game state, chat, LLM history) | Zustand 5 is current. No boilerplate, no providers, no Context wrapping. The spec's `GameStore` — game config, team states, chat messages, LLM conversation history, round/crisis tracking — maps directly to a flat Zustand store. Session-only requirement means no persistence middleware needed. Simpler than Redux or Jotai for this use case. |

**Zustand 4 vs 5:** Zustand 5 dropped the default export in favor of named exports (`import { create } from 'zustand'`). Be aware of this if copying old examples. Use v5 — it's stable and all new docs target it.

---

### Frontend: Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first styling | Current stable (4.2). Critical change from v3: **no `tailwind.config.js`**. CSS-first configuration using `@theme {}` in your main CSS file. For the dark UI with custom design tokens (Syne, DM Sans, IBM Plex Mono, custom color palette), define all tokens in `@theme {}`. The Vite plugin (`@tailwindcss/vite`) is the correct integration — not PostCSS. |
| @tailwindcss/vite | 4.x | Tailwind Vite plugin | First-party plugin, faster than PostCSS path. Add to `vite.config.ts` plugins array. |

**Tailwind v3 vs v4:** v4 is a breaking change. `tailwind.config.js` does not exist. If you find tutorials using `theme.extend` in a JS config file, those are v3 patterns. Use `@theme {}` in CSS instead.

---

### Frontend: Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React | 0.4x+ | Icons | Lightweight, tree-shakeable. Used for UI affordances (send button, export, status indicators). Already specified in the original spec. |
| clsx | 2.x | Conditional class names | Utility for combining Tailwind classes conditionally (e.g., persona-specific bubble colors, crisis state badges). Simpler than `classnames` package. |
| tailwind-merge | 2.x | Merge conflicting Tailwind classes | Prevents duplicate class conflicts when composing components with dynamic classes. Use alongside `clsx` via a `cn()` utility. |

**Google Fonts:** Load Syne, DM Sans, IBM Plex Mono via `@import` in the main CSS file or via `<link>` in `index.html`. Do NOT use a Google Fonts npm package — direct CSS import is faster and has no JavaScript overhead.

---

### Development Tooling

#### Backend

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| pytest | 8.x | Test runner | Current stable. Standard Python testing. |
| pytest-anyio | 0.x (latest) | Async test support | Required for testing async FastAPI routes (the LLM proxy route is async). Use `@pytest.mark.anyio` on async test functions with `AsyncClient`. |
| ruff | 0.4+ | Linter + formatter | Replaces flake8, isort, and black in a single tool. Extremely fast. FastAPI itself uses ruff. Configure via `pyproject.toml`. |
| mypy | 1.x | Static type checking | Verify the Pydantic models and LLM response parsers are type-safe. Run in CI. |

#### Frontend

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Vitest | 2.x | Unit/integration testing | Vite-native test runner. Same config as Vite, no webpack overhead. Use for Zustand store tests and utility function tests. |
| @testing-library/react | 16.x | Component testing | Current stable for React 19. Works with Vitest. |
| ESLint | 9.x | Linting | v9 uses flat config (`eslint.config.js`). Use with `typescript-eslint` and `eslint-plugin-react-hooks`. |
| prettier | 3.x | Formatting | Consistent code style. |

---

## Project Structure (Recommended)

```
kvwargame/
├── backend/                    # Python/FastAPI
│   ├── app/
│   │   ├── main.py             # FastAPI app + static file mount
│   │   ├── config.py           # pydantic-settings Settings class
│   │   ├── routers/
│   │   │   ├── llm.py          # POST /api/llm  (LLM proxy)
│   │   │   └── config_gen.py   # POST /api/generate-config
│   │   └── models/
│   │       ├── llm.py          # LLM request/response Pydantic models
│   │       └── game.py         # Game state Pydantic models
│   ├── tests/
│   ├── pyproject.toml          # deps + ruff + mypy config
│   └── .env.example
│
├── frontend/                   # React/Vite/TypeScript
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── store/
│   │   │   └── gameStore.ts    # Zustand store
│   │   ├── components/
│   │   ├── lib/
│   │   │   ├── llmClient.ts    # fetch() wrapper to /api/llm
│   │   │   ├── promptBuilder.ts
│   │   │   └── stateUpdater.ts
│   │   ├── types/
│   │   │   ├── game.ts
│   │   │   └── llm.ts
│   │   └── styles/
│   │       └── main.css        # @import "tailwindcss"; @theme {...}
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
└── config.json                 # EDIP game configuration (already exists)
```

**Deployment note:** `vite build` outputs to `frontend/dist/`. FastAPI's `StaticFiles(directory="frontend/dist", html=True)` mounts this at root. A single `uvicorn app.main:app` serves everything. No reverse proxy required for corporate internal deployment.

---

## Installation

### Backend

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install "fastapi[standard]" pydantic-settings httpx python-dotenv
pip install pytest pytest-anyio ruff mypy

# pyproject.toml (key entries)
# [project]
# requires-python = ">=3.11"
# dependencies = [
#   "fastapi[standard]>=0.135.0",
#   "pydantic>=2.9.0",
#   "pydantic-settings>=2.0.0",
#   "httpx>=0.27.0",
#   "python-dotenv>=1.0.0",
#   "python-multipart>=0.0.9",
# ]
```

### Frontend

```bash
# Scaffold Vite + React + TypeScript
npm create vite@latest frontend -- --template react-ts
cd frontend

# Install dependencies
npm install zustand lucide-react clsx tailwind-merge
npm install -D tailwindcss @tailwindcss/vite

# Dev dependencies
npm install -D vitest @testing-library/react @testing-library/user-event
npm install -D eslint typescript-eslint eslint-plugin-react-hooks prettier
```

### vite.config.ts (critical — Tailwind v4 integration)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8000'  // Forward to FastAPI in dev
    }
  }
})
```

### main.css (Tailwind v4 CSS-first config)

```css
@import "tailwindcss";

@theme {
  --font-sans: 'DM Sans', sans-serif;
  --font-display: 'Syne', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
  /* Add custom color tokens here */
}
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend framework | FastAPI | Django REST Framework | DRF is heavyweight for a single-facilitator tool with 2 API routes. No ORM needed (no persistence). FastAPI's async is better for LLM streaming. |
| Backend framework | FastAPI | Flask | Flask lacks native async. Async Flask (via quart) is less mature. FastAPI's Pydantic integration is critical for LLM response parsing. |
| LLM HTTP client | httpx | openai Python SDK | OpenAI SDK adds opinion about auth patterns that conflict with custom corporate headers. Raw httpx against the OpenAI-compatible format is more controllable. |
| LLM HTTP client | httpx | aiohttp | httpx has nicer API, is a transitive FastAPI dep already, and has TestClient compatibility. |
| Frontend bundler | Vite | Next.js | Original spec used Next.js for its API route / SSR LLM proxy. Adapting to Python backend means that reason is gone. Vite is lighter and faster for a pure SPA. |
| Frontend bundler | Vite | Create React App | CRA is officially deprecated. Not a valid choice. |
| State management | Zustand | Redux Toolkit | Redux is over-engineered for single-session, single-user state with no time travel debugging needed. |
| State management | Zustand | Jotai | Jotai is atomic and works well, but Zustand's flat store pattern maps better to the spec's `GameStore` shape which has interconnected state slices. |
| Styling | Tailwind CSS v4 | CSS Modules | Tailwind is already specified. CSS Modules would require abandoning the utility-first approach and writing more CSS. |
| Styling | Tailwind CSS v4 | styled-components | Runtime CSS-in-JS adds overhead. Tailwind v4's zero-runtime approach is better for a tool that may run on lower-spec facilitator laptops. |
| Python version | 3.11+ | 3.12 | 3.12 is stable but adds minimal benefit here; 3.11 has wider corporate image availability. |
| Python version | 3.11+ | 3.10 | Missing `match` statement improvements and performance gains. 3.11 is the current LTS sweet spot. |

---

## What NOT to Use

| Technology | Reason to Avoid |
|------------|----------------|
| Next.js | Original spec used Next.js for server-side LLM proxy. Python/FastAPI makes Next.js redundant and adds Node.js server complexity alongside the Python server. |
| SQLAlchemy / any ORM | No persistence. Session-only state means no database. Adding ORM infrastructure creates complexity with zero benefit. |
| Redis / Celery | No background job queues needed. LLM calls are inline request-response. FastAPI's async handles the latency without queue infrastructure. |
| WebSockets | LLM responses for this tool are short (2-4 sentences per persona). Server-Sent Events (SSE, now supported natively in FastAPI 0.135.0) would be the right choice IF streaming is added later — but standard fetch/JSON responses are sufficient for the initial build. |
| React Query / TanStack Query | Useful for cache-aware server state. This app has no server state to cache — all state lives in Zustand, all LLM calls are one-shot mutations. Adds unnecessary complexity. |
| Tailwind v3 | Do not downgrade. v4 is the current stable. v3 patterns (JS config file, `theme.extend`, `content` array) are outdated and the ecosystem is moving on. |
| `class-variance-authority` (CVA) | Useful for complex design systems. For this app's scope, `clsx` + `tailwind-merge` is sufficient without the abstraction overhead. |
| Docker (for development) | Adds complexity for what is a simple single-facilitator corporate deployment. Provide a `pyproject.toml` + `package.json` and a startup script. Containerization is an option for ops teams but not a development requirement. |
| `python-jose` / JWT | No authentication layer. Corporate SSO is external to this app. Adding JWT infrastructure inside the app creates a false security boundary. |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| FastAPI version (0.135.x) | HIGH | Verified via official release notes (fastapi.tiangolo.com/release-notes, 2026-04-01) |
| Pydantic v2 minimum (2.9+) | HIGH | Verified via FastAPI 0.135.2 release notes explicitly requiring `pydantic >=2.9.0` |
| pydantic-settings pattern | HIGH | Verified via official FastAPI advanced settings docs |
| CORS middleware pattern | HIGH | Verified via official FastAPI CORS docs |
| Static files serving pattern | HIGH | Verified via official FastAPI static files docs |
| React 19.x current stable | HIGH | Verified via React blog (released December 2024, 19.2.1 latest security patch) |
| Tailwind CSS v4 + Vite plugin | HIGH | Verified via tailwindcss.com/blog/tailwindcss-v4 and install docs |
| Tailwind v4 CSS-first config | HIGH | Verified — `tailwind.config.js` replaced by `@theme {}` in CSS |
| Zustand 5.x | MEDIUM | Known from training data; named export change from v4 verified in docs. Version number not confirmed via live source due to fetch restrictions. |
| Vite 6.x | MEDIUM | Known from training data that Vite 6 exists and requires Node 18+. Version confirmed by Tailwind docs referencing Vite 6 examples. |
| httpx for LLM proxy | HIGH | Confirmed as FastAPI's underlying HTTP client and recommended for async proxy patterns |
| pytest-anyio for async tests | HIGH | Verified via official FastAPI async tests docs |
| TypeScript 5.x | MEDIUM | Known from training data; widely adopted as current stable |
| Python 3.11 minimum | MEDIUM | Training data + FastAPI docs use 3.10+ syntax; 3.11 recommendation based on training + corporate deployment patterns |

---

## Sources

- FastAPI release notes (verified 2026-04-01): https://fastapi.tiangolo.com/release-notes/
- FastAPI CORS docs: https://fastapi.tiangolo.com/tutorial/cors/
- FastAPI settings docs: https://fastapi.tiangolo.com/advanced/settings/
- FastAPI static files docs: https://fastapi.tiangolo.com/tutorial/static-files/
- FastAPI testing docs: https://fastapi.tiangolo.com/tutorial/testing/
- FastAPI async tests docs: https://fastapi.tiangolo.com/advanced/async-tests/
- Tailwind CSS v4 blog post: https://tailwindcss.com/blog/tailwindcss-v4
- Tailwind CSS v4 install docs: https://tailwindcss.com/docs/installation (current version: v4.2)
- React 19 release blog: https://react.dev/blog/2024/12/05/react-19
- Pydantic-settings pattern: https://docs.pydantic.dev/latest/concepts/pydantic_settings/ (via FastAPI docs)
