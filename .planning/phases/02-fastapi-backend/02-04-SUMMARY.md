---
phase: 02-fastapi-backend
plan: "04"
subsystem: api
tags: [fastapi, starlette, spa, static-files, react, vite, typescript]

# Dependency graph
requires:
  - phase: 02-fastapi-backend/02-02
    provides: POST /api/llm router with LLM proxy and error handling
  - phase: 02-fastapi-backend/02-03
    provides: POST /api/generate-config router with same error pattern
  - phase: 01-foundation/01-01
    provides: Vite + React frontend with pnpm build producing dist/
provides:
  - SPAStaticFiles class in main.py — fall-back to index.html for unknown paths
  - Conditional dist/ mount as catch-all after API routes (single-process deployment)
  - Updated .env.example with LLM_ENDPOINT_URL, LLM_TIMEOUT_SECONDS, corrected defaults
  - Confirmed all 5 Phase 2 success criteria pass via curl integration test
affects:
  - 03-game-state-api (API layer complete; backend now a single deployable unit)
  - 06-llm-wiring (deployment pattern established: uvicorn serves both API and SPA)
  - all-phases (vite.config.ts now uses vitest/config defineConfig — test infra fixed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SPAStaticFiles: StaticFiles subclass catches 404s and returns index.html for SPA routing
    - Conditional mount: os.path.isdir guard skips static mount when dist/ absent (dev mode safe)
    - Mount order: SPA catch-all registered LAST — API routers always take priority

key-files:
  created:
    - src/vite-env.d.ts
  modified:
    - backend/app/main.py
    - .env.example
    - tsconfig.app.json
    - vite.config.ts

key-decisions:
  - "SPAStaticFiles subclasses StaticFiles, catches StarletteHTTPException 404 and serves index.html — no third-party dependency"
  - "SPA mount uses os.path.isdir guard so dev mode (no dist/) never crashes the server"
  - "app.mount('/') is the final line in main.py — enforced by comment and module structure"
  - "vite.config.ts must import defineConfig from vitest/config (not vite) for vitest 4.x test option"
  - "noUncheckedSideEffectImports set to false in tsconfig.app.json — CSS side-effect imports are valid"

patterns-established:
  - "API-first mount ordering: include_router() calls precede app.mount() — catch-all SPA always last"
  - "SPAStaticFiles pattern: minimal StaticFiles subclass with 404 fallback, no external deps"

# Metrics
duration: 3min
completed: 2026-04-13
---

# Phase 2 Plan 04: SPA Static Serving and Integration Test Summary

**SPAStaticFiles catch-all mounted after API routes in FastAPI, enabling single-process deployment of React SPA + LLM proxy — all 5 Phase 2 success criteria verified via curl**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-13T20:15:52Z
- **Completed:** 2026-04-13T20:19:05Z
- **Tasks:** 2 (Task 1: impl + fixes; Task 2: verification-only, no commit)
- **Files modified:** 5

## Accomplishments

- FastAPI serves React dist/ build via SPAStaticFiles — GET / returns index.html, /game and /config return 200 (not 404)
- API routes /api/llm and /api/generate-config unaffected — correct mount order prevents SPA swallowing API paths
- .env.example corrected: LLM_ENDPOINT renamed to LLM_ENDPOINT_URL, LLM_TIMEOUT_SECONDS added, LLM_MAX_TOKENS default corrected to 2048
- All 5 Phase 2 success criteria pass: shape validation (SC1/SC2), key not in body (SC3), 400 on malformed (SC4), static serving (SC5)
- Startup validation confirmed: missing env vars prevent server from starting

## Task Commits

1. **Task 1: SPAStaticFiles + .env.example update** - `167568d` (feat)
2. **Task 2: Integration test** - no commit (verification only)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `backend/app/main.py` — Added SPAStaticFiles class and conditional `app.mount("/", ...)` as final statement
- `.env.example` — Renamed LLM_ENDPOINT -> LLM_ENDPOINT_URL, added LLM_TIMEOUT_SECONDS=60, corrected LLM_MAX_TOKENS=2048
- `src/vite-env.d.ts` — Created with `/// <reference types="vite/client" />` (fixes import.meta.env TS error)
- `tsconfig.app.json` — Set noUncheckedSideEffectImports: false (CSS imports are valid side effects)
- `vite.config.ts` — Changed defineConfig import from `vite` to `vitest/config` (vitest 4.x requirement)

## Decisions Made

- SPAStaticFiles subclasses Starlette's StaticFiles directly — no extra dependencies, minimal surface area
- `os.path.isdir` guard means `pnpm build` is the only prerequisite for static serving; dev mode with `pnpm dev` is unaffected
- `app.mount("/", ...)` is enforced as the last statement in main.py — comment in module docstring reinforces this constraint for future editors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing src/vite-env.d.ts causing TS2339 on import.meta.env**
- **Found during:** Task 1 (build verification — `pnpm build` step)
- **Issue:** TypeScript error `Property 'env' does not exist on type 'ImportMeta'` — `vite-env.d.ts` was absent from src/, so `import.meta.env.DEV` in gameStore.ts had no type
- **Fix:** Created `src/vite-env.d.ts` with `/// <reference types="vite/client" />`
- **Files modified:** `src/vite-env.d.ts` (created)
- **Verification:** `pnpm build` passes with no TS errors
- **Committed in:** `167568d` (Task 1 commit)

**2. [Rule 1 - Bug] noUncheckedSideEffectImports blocking CSS import in main.tsx**
- **Found during:** Task 1 (build verification)
- **Issue:** `tsconfig.app.json` had `noUncheckedSideEffectImports: true`, causing TS2882 on `import './styles/index.css'` — TypeScript treated the CSS side-effect import as suspicious
- **Fix:** Set `noUncheckedSideEffectImports: false` in tsconfig.app.json — CSS side-effect imports are the standard pattern for Vite projects
- **Files modified:** `tsconfig.app.json`
- **Verification:** Build succeeds; CSS import error gone
- **Committed in:** `167568d` (Task 1 commit)

**3. [Rule 1 - Bug] vite.config.ts defineConfig from wrong package (vitest 4.x breakage)**
- **Found during:** Task 1 (build verification)
- **Issue:** TS2769 — `test` property not recognized in `UserConfigExport` because `defineConfig` was imported from `vite` instead of `vitest/config`; vitest 4.x removed the type augmentation approach and requires its own `defineConfig`
- **Fix:** Changed `import { defineConfig } from 'vite'` to `import { defineConfig } from 'vitest/config'`; removed the now-unnecessary `/// <reference types="vitest" />` pragma
- **Files modified:** `vite.config.ts`
- **Verification:** `tsc -b` passes; build succeeds
- **Committed in:** `167568d` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug)
**Impact on plan:** All three bugs were pre-existing in the frontend from Phase 1; they surfaced here because this was the first `pnpm build` run. No scope creep — fixes are necessary for correctness and CI viability.

## Issues Encountered

- Port 8000 was occupied by a leftover uvicorn process from a prior session — used port 8001 for integration tests and killed the orphaned process
- `taskkill /PID` fails in Git Bash (path mangling issue) — used `python -c "subprocess.run(['taskkill',...])"` as workaround

## Next Phase Readiness

- Backend is complete: single `uvicorn backend.app.main:app` serves both the React SPA and the LLM proxy API
- Phase 3 can add game-state API endpoints to the same app — routers simply get `include_router()`'d before the SPA mount
- Frontend build is confirmed working with corrected tsconfig/vite config — Phase 3 UI work starts clean
- No blockers for Phase 3

---
*Phase: 02-fastapi-backend*
*Completed: 2026-04-13*
