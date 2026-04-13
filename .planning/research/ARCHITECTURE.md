# Architecture Patterns

**Domain:** AI-powered wargame facilitation engine (FastAPI + React/Vite)
**Researched:** 2026-04-13
**Sources:** WARGAME_ENGINE_DEV_SPEC.md (authoritative), FastAPI official docs (HIGH confidence), Pydantic v2 docs (HIGH confidence)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (React/Vite)                         │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Zustand Store (in-memory)                  │   │
│  │  phase | setupMode | gameConfig | gameState | messages        │   │
│  │  llmHistory | loading | activeTab                             │   │
│  └─────────────────────────┬────────────────────────────────────┘   │
│                            │ reads / writes                          │
│  ┌──────────┐  ┌──────────┐│ ┌────────────┐  ┌──────────────────┐  │
│  │  Setup   │  │  Game    ││ │ lib/prompt │  │ lib/stateUpdater │  │
│  │  Screen  │  │  Screen  ││ │ Builder.ts │  │     .ts          │  │
│  └────┬─────┘  └────┬─────┘│ └────────────┘  └──────────────────┘  │
│       │             │      │                                         │
│       └──────┬──────┘      │                                         │
│              │ fetch POST  │                                         │
│              ▼             │                                         │
│        llmClient.ts ───────┘                                         │
│              │                                                       │
└──────────────┼───────────────────────────────────────────────────────┘
               │ HTTP POST /api/llm  or  /api/generate-config
               │ (JSON: systemPrompt + messages + maxTokens)
               │ CORS enforced — no credentials in request
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       FastAPI BACKEND (Python)                      │
│                                                                     │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐   │
│  │   POST /api/llm      │    │  POST /api/generate-config       │   │
│  │   (llm_router.py)    │    │  (config_router.py)              │   │
│  │                      │    │                                  │   │
│  │  reads env vars:     │    │  reads env vars:                 │   │
│  │  LLM_API_BASE_URL    │    │  same + CONFIG_GEN_MAX_TOKENS    │   │
│  │  LLM_API_KEY         │    │                                  │   │
│  │  LLM_MODEL           │    │  system prompt: JSON schema      │   │
│  │  LLM_EXTRA_HEADERS   │    │  instruction for GameConfig      │   │
│  └──────────┬───────────┘    └────────────────┬─────────────────┘   │
│             │                                 │                      │
│             └─────────────┬───────────────────┘                      │
│                           │ httpx async POST                         │
│                           │ Authorization: Bearer {LLM_API_KEY}      │
│                           │ + any LLM_EXTRA_HEADERS                  │
│                           ▼                                          │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │   Corporate LLM Endpoint      │
            │   (OpenAI-compatible API)     │
            │   GPT-4o / GPT-5              │
            │   POST /v1/chat/completions   │
            └───────────────────────────────┘
```

**Security boundary:** The FastAPI backend is the only component that ever holds or sends `LLM_API_KEY`. The browser never sees it. The client POSTs `{systemPrompt, messages, maxTokens}` — a credential-free payload.

---

## Component Responsibilities

### Backend Components

| Component | File | Responsibility | Communicates With |
|-----------|------|----------------|-------------------|
| LLM Proxy Route | `backend/routers/llm.py` | Validates request, reads env credentials, forwards to corporate LLM in OpenAI format, returns `{text}` or `{error}` | Frontend via HTTP, Corporate LLM via httpx |
| Config Generation Route | `backend/routers/config_gen.py` | Same proxy pattern; uses config-gen system prompt and higher max_tokens | Frontend via HTTP, Corporate LLM via httpx |
| Pydantic Models | `backend/models/llm.py`, `backend/models/game.py` | Request/response validation; Python equivalents of TypeScript interfaces | All routes (FastAPI auto-validates) |
| App Entry | `backend/main.py` | FastAPI app init, CORS middleware, router registration | All routes |
| Config / Settings | `backend/config.py` | `pydantic-settings` BaseSettings reads env vars; single source of truth | All routes |

### Frontend Components

| Component | File | Responsibility | Communicates With |
|-----------|------|----------------|-------------------|
| Zustand Store | `src/lib/gameStore.ts` | All session state: phase, gameConfig, gameState, messages, llmHistory, UI state | Every component (read), llmClient (write) |
| LLM Client | `src/lib/llmClient.ts` | `callLLM()` and `generateConfig()` — fetch wrappers to FastAPI endpoints, JSON parse, markdown fence strip | FastAPI backend, gameStore (caller applies result) |
| Prompt Builder | `src/lib/promptBuilder.ts` | Constructs the full system prompt string from `GameConfig` + live `GameState` | Called by game interaction handlers before every LLM call |
| State Updater | `src/lib/stateUpdater.ts` | Applies `StateUpdate` delta to `GameState` with clamping rules | Called after LLM response parsed; writes to gameStore |
| Debrief Exporter | `src/lib/debriefExporter.ts` | Collects `isDebrief: true` messages, formats markdown, triggers browser download | gameStore (read messages), browser download API |
| EDIP Config Data | `src/data/edipConfig.ts` | Static `GameConfig` constant — the canonical first game | SetupScreen (pre-loads into textarea) |
| SetupScreen | `src/components/setup/` | Home / Load / Brief / Review flow; calls `initGame()` to transition to game phase | gameStore, llmClient (for config gen) |
| GameScreen | `src/components/game/GameScreen.tsx` | Three-column layout shell, composes all game-phase components | All game subcomponents |
| GameHeader | `src/components/game/GameHeader.tsx` | Round counter, crisis badge, New Game button | gameStore (round, crisisState) |
| StatePanel | `src/components/game/StatePanel.tsx` | Track bars (severity/legitimacy), team resource grids, persona legend | gameStore (gameState) |
| ChatFeed | `src/components/game/ChatFeed.tsx` | Scrollable message list; all message types; auto-scroll; loading dots | gameStore (messages, loading) |
| PersonaMessage | `src/components/game/PersonaMessage.tsx` | Single message bubble with avatar, persona colour, flag banner | Rendered by ChatFeed |
| FacilitatorInput | `src/components/game/FacilitatorInput.tsx` | Text input + Send; Advance Round / End Game + Debrief / Request Debrief buttons | gameStore (loading), triggers LLM flow |
| ReferencePanel | `src/components/game/ReferencePanel.tsx` | Three-tab reference (CARDS / ACTIONS / GUIDE) with card detail drill-down | gameStore (gameConfig, activeTab) |
| Shared | `src/components/shared/` | TrackBar, StatusBadge, LoadingDots — reusable primitives | GameHeader, StatePanel, ChatFeed |
| Types | `src/types/game.ts`, `src/types/llm.ts` | TypeScript interfaces — single source of truth for data shapes | All components and lib files |

---

## Project Structure

```
KVWarGame/
├── .env                           # Never committed — LLM credentials
├── .env.example                   # Committed template
│
├── backend/                       # FastAPI (Python)
│   ├── main.py                    # App init, CORS, router registration
│   ├── config.py                  # pydantic-settings BaseSettings (env vars)
│   ├── models/
│   │   ├── llm.py                 # LLMRequest, LLMResponse, PersonaResponse, LLMStructuredResponse
│   │   └── game.py                # GameConfig, GameState, TeamState, StateUpdate, etc.
│   └── routers/
│       ├── llm.py                 # POST /api/llm
│       └── config_gen.py          # POST /api/generate-config
│
├── frontend/                      # React/Vite (TypeScript)
│   ├── vite.config.ts             # Dev proxy: /api → http://localhost:8000
│   ├── index.html
│   └── src/
│       ├── main.tsx               # React entry
│       ├── App.tsx                # Router: / → setup, /game → game
│       ├── types/
│       │   ├── game.ts            # GameConfig, GameState, ChatMessage, etc.
│       │   └── llm.ts             # LLMRequest, LLMResponse, PersonaResponse
│       ├── data/
│       │   └── edipConfig.ts      # EDIP_CONFIG constant (GameConfig)
│       ├── lib/
│       │   ├── gameStore.ts       # Zustand store
│       │   ├── llmClient.ts       # callLLM(), generateConfig()
│       │   ├── promptBuilder.ts   # buildSystemPrompt(config, state)
│       │   ├── stateUpdater.ts    # applyStateUpdate(state, delta)
│       │   └── debriefExporter.ts # exportDebrief(messages)
│       └── components/
│           ├── setup/
│           │   ├── SetupScreen.tsx
│           │   ├── LoadConfigPanel.tsx
│           │   └── GenerateBriefPanel.tsx
│           ├── game/
│           │   ├── GameScreen.tsx
│           │   ├── GameHeader.tsx
│           │   ├── StatePanel.tsx
│           │   ├── ChatFeed.tsx
│           │   ├── PersonaMessage.tsx
│           │   ├── RoundDivider.tsx
│           │   ├── FacilitatorInput.tsx
│           │   └── ReferencePanel.tsx
│           └── shared/
│               ├── TrackBar.tsx
│               ├── StatusBadge.tsx
│               └── LoadingDots.tsx
```

---

## FastAPI to React Integration Pattern

### Development: Vite Proxy

During development, Vite's `server.proxy` configuration forwards `/api/*` requests from the React dev server (port 5173) to FastAPI (port 8000). This means the frontend code uses relative paths (`/api/llm`) everywhere — no URL changes between dev and production.

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
```

### Production: Static Files or Reverse Proxy

Two viable options:

**Option A — FastAPI serves built React (simplest for corporate deployment):**
FastAPI mounts the Vite build output as a `StaticFiles` directory and catches all non-API routes with a single-page app fallback. One process, one port.

**Option B — Separate servers with NGINX/proxy:**
React build served by NGINX or CDN; FastAPI behind `/api/` prefix. Requires CORS configuration.

For this project (single corporate deployment, single facilitator), Option A is recommended. Simpler ops, no CORS complexity in production.

### CORS Configuration (FastAPI)

Required only if React and FastAPI run on different origins (Option B, or during development without Vite proxy).

```python
# backend/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=False,                  # No cookies needed
    allow_methods=["POST"],                   # Only POST used
    allow_headers=["Content-Type"],
)
```

Note: `allow_credentials=False` is appropriate here — auth is handled at the corporate SSO layer, not at this app boundary.

### API Contract

The two API endpoints are the entire FastAPI surface:

| Endpoint | Method | Request Body | Response Body |
|----------|--------|--------------|---------------|
| `/api/llm` | POST | `{systemPrompt: str, messages: [{role, content}], maxTokens?: int}` | `{text: str}` or `{error: str}` |
| `/api/generate-config` | POST | `{brief: str}` | `{text: str}` or `{error: str}` |

Both endpoints return `{text: str}` — raw LLM output. JSON parsing happens client-side in `llmClient.ts`. This keeps the backend thin and format-agnostic.

---

## TypeScript Interfaces to Python Pydantic Models

The spec's `src/types/game.ts` interfaces map directly to Pydantic v2 models in `backend/models/`.

| TypeScript (frontend) | Python Pydantic (backend) | Notes |
|----------------------|--------------------------|-------|
| `interface LLMRequest` | `class LLMRequest(BaseModel)` | Request body for `/api/llm` |
| `interface LLMResponse` | `class LLMResponse(BaseModel)` | Response from `/api/llm` |
| `type PersonaId = "kent" \| "finch" \| "chen"` | `PersonaId = Literal["kent", "finch", "chen"]` | Use `typing.Literal` |
| `type CrisisState = "No Crisis" \| ...` | `CrisisState = Literal["No Crisis", ...]` | Same |
| `interface PersonaResponse` | `class PersonaResponse(BaseModel)` | Nested in LLMStructuredResponse |
| `interface LLMStructuredResponse` | `class LLMStructuredResponse(BaseModel)` | Parsed client-side; backend doesn't need this |
| `interface StateUpdate` | Not needed in backend | State management is client-only |
| `interface GameConfig` | Not needed in backend | Config lives in browser/frontend |

The backend models are intentionally minimal — only the LLM proxy request/response shapes. Game state (`GameConfig`, `GameState`, `TeamState`, etc.) lives entirely in the React frontend's Zustand store. The backend has no game logic.

Example mapping:

```python
# backend/models/llm.py
from pydantic import BaseModel
from typing import Literal, Optional

class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class LLMRequest(BaseModel):
    systemPrompt: str
    messages: list[Message]
    maxTokens: Optional[int] = None

class LLMResponse(BaseModel):
    text: Optional[str] = None
    error: Optional[str] = None
```

---

## Data Flow

### Primary Flow: Facilitator Input → LLM → UI Update

```
1. Facilitator types text in FacilitatorInput and presses Enter

2. FacilitatorInput handler:
   a. Adds facilitator message to store (messages[])
   b. Sets loading = true
   c. Calls buildSystemPrompt(gameConfig, gameState) → systemPrompt string
   d. Constructs LLMRequest: { systemPrompt, messages: llmHistory + new user message, maxTokens }

3. llmClient.callLLM(request):
   a. POST /api/llm with {systemPrompt, messages, maxTokens}
   b. Awaits response

4. FastAPI /api/llm handler:
   a. Reads LLM_API_KEY, LLM_API_BASE_URL, LLM_MODEL from env
   b. Constructs OpenAI-compatible payload
   c. httpx.AsyncClient POST to corporate LLM endpoint
   d. Returns {text: raw_llm_content}

5. llmClient receives {text}:
   a. Strips markdown fences if present
   b. JSON.parse → LLMStructuredResponse { responses: PersonaResponse[] }

6. Handler applies result:
   a. Appends user message + assistant JSON string to llmHistory
   b. For each PersonaResponse:
      - Creates ChatMessage (type: "persona") and adds to messages[]
      - If stateUpdate !== null: calls stateUpdater.applyStateUpdate(gameState, delta)
        → clamps all values → writes updated GameState to store
   c. Sets loading = false

7. React re-renders:
   - ChatFeed renders new persona messages
   - StatePanel reflects updated track values and team resources
```

### Secondary Flow: Setup → Config Load → Game Launch

```
Option A (Load Config):
  User pastes/edits JSON → parse validates → setGameConfig(parsed)
  → "Launch Scenario N" → initGame(config, scenarioIndex) → phase = "game"
  → Navigate to /game → GameScreen mounts → auto-triggers Round 1 LLM call

Option B (Generate from Brief):
  User types brief → "Generate" button
  → llmClient.generateConfig(brief) → POST /api/generate-config
  → FastAPI proxies to LLM with JSON schema system prompt
  → Returns {text: json_string} → parse → setConfigJson(json_string)
  → setupMode = "review" → user reviews/edits JSON → same as Option A
```

### Debrief Flow

```
"End Game + Debrief" or "Request Debrief Now" button:
→ Adds debrief_divider message to store
→ Calls LLM with special debrief instruction in user message
→ LLM returns three persona debrief responses with isDebrief: true flag
→ Messages added to store; stateUpdates applied if any
→ "Export Debrief" button (in header or debrief divider):
   → debriefExporter.exportDebrief(messages) filters isDebrief messages
   → Formats as markdown → browser download as wargame-debrief-{date}.md
```

---

## Architectural Patterns to Follow

### Pattern 1: Thin Backend, Fat Client

**What:** The FastAPI backend is a pure credential-protecting proxy. It has no game logic, no state, no persona logic, no prompt engineering. All of that lives in the React frontend.

**Why:** The spec made this split intentional. The game engine (prompt construction, state management, persona routing) is complex domain logic best developed and tested in TypeScript close to the UI. The backend's one job is credential security.

**Implementation:**
- Backend validates request shape (Pydantic) and forwards to LLM
- Backend never parses LLM output — returns raw `text` string
- No game state on the server; every request is stateless
- If game logic needs to change, only frontend changes

### Pattern 2: Prompt-as-Configuration

**What:** The system prompt encodes the entire game engine — personas, routing rules, game state, card mechanics, voting rules — as structured text. The LLM is the rules interpreter.

**Why:** Makes the engine reusable for any game config without code changes. Loading a different `GameConfig` JSON changes what the LLM knows without any code deployment.

**Implementation:**
- `promptBuilder.ts` rebuilds the full system prompt on every LLM call
- System prompt includes serialized live `GameState` so LLM always has current context
- Prompt includes explicit JSON output schema instruction (prevents free-text responses)
- Routing rules are encoded in the prompt, not in code conditionals

### Pattern 3: Optimistic Message Append

**What:** The facilitator's own message is added to the chat feed immediately (before LLM responds), with loading dots shown for the pending AI response. LLM messages appear when the response arrives.

**Why:** Prevents the UI freezing on LLM latency. Corporate LLM calls may take 2-5 seconds.

**Implementation:**
- `addMessage({type: "facilitator", ...})` fires synchronously on send
- `setLoading(true)` fires synchronously
- `addMessages(personaResponses)` fires after LLM resolves
- All buttons disabled during `loading === true`

### Pattern 4: Single LLM History Thread

**What:** `llmHistory` in the Zustand store is a flat array of `{role, content}` pairs accumulating the entire session conversation. Every LLM call sends the full history.

**Why:** Maintains LLM context across rounds — it can reference earlier decisions, track narrative continuity, and produce coherent persona voices.

**Caution:** History grows unbounded. For long games (5+ rounds, high facilitator activity), history may approach token limits. The spec does not address truncation — this is a known gap to address in implementation (see PITFALLS.md).

### Pattern 5: Clamped State Application

**What:** `stateUpdater.applyStateUpdate()` enforces hard bounds on all numeric values before writing to the store.

**Why:** LLM output is probabilistic. Without clamping, a state update could produce `pc: -3` or `crisisSeverity: 8`.

**Clamp bounds (from spec):**
- `crisisSeverity`: [0, 5]
- `edipLegitimacy`: [-2, 2]
- `pc`: [0, 6]
- `po`: [-2, 2]
- `readiness`: [0, 5]
- `stock`, `crm`, `ic`: [0, 99]

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Credentials in Frontend

**What:** Passing `LLM_API_KEY` to the React app via `VITE_` environment variables or hardcoding it.

**Why bad:** `VITE_` variables are bundled into the JavaScript — visible in browser DevTools network tab and JS source. Corporate audit failure.

**Instead:** API key lives only in backend `.env`. Frontend calls `/api/llm` with no auth header. FastAPI adds the key server-side.

### Anti-Pattern 2: Game State on the Server

**What:** Storing `GameState`, `messages`, or `llmHistory` in a server-side database or in-memory cache.

**Why bad:** The spec explicitly requires session-only, ephemeral state. Adds persistence complexity, session management, and multi-user isolation concerns — all explicitly out of scope.

**Instead:** Zustand store in the browser. Refresh = reset. This is intentional.

### Anti-Pattern 3: Per-Round System Prompt Changes via Config

**What:** Storing persona definitions or routing rules outside `promptBuilder.ts` in a separately editable file or database, distinct from the TypeScript code.

**Why bad:** The prompt is code. Persona voice, routing rules, and JSON schema instructions all interact. Separating them into a config file creates invisible coupling and makes testing harder.

**Instead:** Prompt is assembled in `promptBuilder.ts` from structured `GameConfig` data. The prompt template (personas, routing, format instructions) is code; only game-specific content (teams, cards, scenarios) comes from `GameConfig` data.

### Anti-Pattern 4: Parsing LLM JSON in the Backend

**What:** Having the FastAPI route parse `LLMStructuredResponse` and return structured Python objects instead of raw text.

**Why bad:** Adds backend complexity without benefit. JSON parsing errors (malformed LLM output) are easier to handle in the frontend where the error can be shown gracefully in the chat feed. Backend parsing would require additional error serialisation.

**Instead:** Backend returns `{text: str}`. `llmClient.ts` parses and handles malformed JSON with a try/catch that produces an `error` message type in the chat feed.

### Anti-Pattern 5: Multiple LLM History Arrays

**What:** Maintaining separate conversation histories for each persona or for setup vs game flows.

**Why bad:** The three personas share one conversation — they refer to each other's responses and accumulate shared context. Splitting history breaks persona continuity.

**Instead:** Single `llmHistory[]` array for the game session. Setup config generation uses a separate stateless call (no history needed — it's a one-shot JSON generation).

---

## Suggested Build Order (Phase Dependencies)

The dependencies below inform how phases should be sequenced:

```
Phase 1: Types + Data + Store (no UI, no backend)
│  Establishes the data contract everything else depends on
│  ├── src/types/game.ts + src/types/llm.ts  ← unblocks all other frontend work
│  ├── src/data/edipConfig.ts               ← unblocks Setup screen testing
│  └── src/lib/gameStore.ts                 ← unblocks all UI components
│
Phase 2: Setup Screen (needs Store, Types, Data)
│  Can be built and tested entirely without backend
│  ├── SetupScreen + LoadConfigPanel        ← needs EDIP_CONFIG + store
│  └── GenerateBriefPanel (stub API call)   ← real call added in Phase 4
│
Phase 3: Game Screen Layout (needs Store, Types)
│  Can be built entirely with mock data injected via store
│  ├── GameScreen shell + three-column layout
│  ├── GameHeader, StatePanel, ChatFeed, ReferencePanel
│  └── FacilitatorInput (buttons wired to store, no LLM yet)
│
Phase 4: Backend + LLM Integration (needs Types, then wires to Phase 2/3)
│  Backend can be built and tested independently with curl/httpie
│  ├── backend/main.py + config.py + models/
│  ├── routers/llm.py  ← test with curl before connecting frontend
│  ├── routers/config_gen.py
│  ├── src/lib/promptBuilder.ts  ← needs GameConfig + GameState types
│  ├── src/lib/stateUpdater.ts   ← needs GameState + StateUpdate types
│  ├── src/lib/llmClient.ts      ← needs backend running
│  └── Wire FacilitatorInput → llmClient → store update
│
Phase 5: Polish + Export (needs Phase 4 complete)
│  ├── src/lib/debriefExporter.ts
│  ├── PC warning badges
│  ├── Error states in ChatFeed
│  └── GenerateBriefPanel wired to real /api/generate-config
│
Phase 6: QA (needs Phase 5 complete + real LLM credentials)
    Full scenario runs, clamping verification, credential audit
```

**Key dependency:** `src/types/game.ts` must be finalized before anything else. It is the contract between all layers. Changes to types after Phase 1 cause cascading rework.

---

## Scalability Considerations

This is a single-facilitator, session-ephemeral tool. Scalability is not a primary concern. However:

| Concern | At 1 user (current target) | At ~20 concurrent users | Notes |
|---------|--------------------------|------------------------|-------|
| LLM latency | FastAPI async handles fine | Still fine (LLM is the bottleneck) | httpx async is correct choice |
| Token limits | ~4K-8K per call early game; grows with history | Same per user | History truncation needed for long games |
| Memory | Zero server-side state | Zero server-side state | No sessions to manage |
| Deployment | Single process, `uvicorn main:app` | Multiple uvicorn workers or gunicorn | Stateless backend scales trivially |

---

## Sources

- `WARGAME_ENGINE_DEV_SPEC.md` — project root, authoritative (HIGH confidence)
- FastAPI official docs: CORS — https://fastapi.tiangolo.com/tutorial/cors/ (HIGH confidence)
- FastAPI official docs: Request Body — https://fastapi.tiangolo.com/tutorial/body/ (HIGH confidence)
- FastAPI official docs: Async response — https://fastapi.tiangolo.com/advanced/response-directly/ (HIGH confidence)
- Vite server proxy — official docs (MEDIUM confidence — WebFetch blocked, but pattern is standard and stable)
- Pydantic v2 model definition — https://docs.pydantic.dev/latest/concepts/models/ (MEDIUM confidence — WebFetch blocked, pattern confirmed via FastAPI docs which use Pydantic v2)
