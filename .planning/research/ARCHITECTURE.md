# Architecture Research — v1.2 Debrief Podcast

**Domain:** Feature integration into shipped FastAPI + React/Vite + Zustand app
**Milestone:** v1.2 Debrief Podcast (additive capability; does NOT rewrite existing surfaces)
**Researched:** 2026-04-17
**Confidence:** HIGH (existing architecture empirically verified by reading every referenced file; ElevenLabs shapes lifted from the known-good MDInsights reference; the only MEDIUM-confidence call is the health-check option choice, which is a genuine design decision rather than a discovery question)

> This document supersedes the earlier v1.0 architecture research (2026-04-13) for the purpose of the v1.2 milestone. The v1.0 architecture is now shipped and is consumed here as "existing shape." For v1.0 context see `.planning/MILESTONES.md` and PROJECT.md Key Decisions.

---

## 1. Existing Architecture Map (what we integrate INTO)

This is the shape as it exists post-v1.1 on 2026-04-17. Every new v1.2 file below must land as a sibling to one of these existing files — do not invent a new folder structure.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  BROWSER — React 19 + Vite + Zustand (session-only, in-memory)                │
│                                                                               │
│  ┌─────────────────────────┐   ┌──────────────────────────────────────────┐   │
│  │ src/components/setup/   │   │ src/components/game/                      │   │
│  │   HomeScreen            │   │   GameScreen ─► GameHeader               │   │
│  │   LoadConfigPanel       │   │               ─► StatePanel / ChatFeed / │   │
│  │   GenerateBriefPanel    │   │                  ReferencePanel          │   │
│  │   HealthBadge (v1.1) ───┼──►│               ─► FacilitatorInput        │   │
│  │   JsonEditor / Summary  │   │                   ├─ ActionToolbar ◄──── │   │
│  │                         │   │                   │   (Download Debrief  │   │
│  │   Launch gate on        │   │                   │    md button lives   │   │
│  │   healthStatus==='ok'   │   │                   │    here)             │   │
│  └─────────────────────────┘   │                   └─ MessageInput        │   │
│                                └──────────────────────────────────────────┘   │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ src/lib/   (all session-only, no persistence)                            │  │
│  │   gameStore.ts ◄── Zustand + immer + devtools; owns phase, gameConfig,   │  │
│  │   │                gameState, messages[], llmHistory[], UI state,        │  │
│  │   │                stateSnapshots, gameEnded, pendingControlBanner       │  │
│  │   ├─ llmClient.ts       fetch('/api/llm'); zero-throw discriminated      │  │
│  │   │                     union LLMCallResult                              │  │
│  │   ├─ responseParser.ts  4-layer defensive parser → ParseResult           │  │
│  │   ├─ promptBuilder.ts   rebuilds full system prompt each turn            │  │
│  │   ├─ stateUpdater.ts    applyStateUpdatePure + hard clamp                │  │
│  │   ├─ contextWindow.ts   HISTORY_WINDOW_N=2 rolling window                │  │
│  │   └─ debriefExporter.ts DebriefSnapshot → markdown → Blob download       │  │
│  │                          halts bucketing at lastDebriefIdx (08-05)       │  │
│  │ src/types/   game.ts · llm.ts · health.ts   (LOCKED contracts)           │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────┬──────────────────────────────────────────┘
                                     │  fetch /api/*
                                     ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  BACKEND — FastAPI (Python) · uvicorn · httpx.AsyncClient (shared, lifespan)  │
│                                                                               │
│   backend/app/main.py                                                         │
│     ├─ lifespan: validates Settings, builds shared AsyncClient                │
│     ├─ RequestValidationError → 400 (unified {error:{code,message}})          │
│     ├─ include_router(llm), include_router(health), include_router(config_gen)│
│     └─ SPAStaticFiles mount (MUST be last)                                    │
│                                                                               │
│   backend/app/config.py     pydantic-settings; get_settings() lru_cached      │
│     └─ env-only: LLM_API_KEY, LLM_ENDPOINT_URL, LLM_MODEL,                    │
│        LLM_AUTH_HEADER_NAME, LLM_AUTH_VALUE_PREFIX, LLM_EXTRA_HEADERS, …      │
│                                                                               │
│   backend/app/routers/                                                        │
│     ├─ llm.py          POST /api/llm           → proxies to corp endpoint     │
│     ├─ config_gen.py   POST /api/generate-config                              │
│     └─ health.py       GET  /api/health/llm    always-200; body.ok carries   │
│                                                  signal; 8-code taxonomy     │
│                                                  (timeout|auth_error|not_    │
│                                                  found|rate_limited|upstream_│
│                                                  error|network_error|tls_    │
│                                                  error|invalid_response)     │
│   backend/app/services/   (does NOT yet exist — created in v1.2)              │
│   backend/tests/          pytest + respx mocks (no live calls in CI)          │
└────────────────────────────────────┬──────────────────────────────────────────┘
                                     │  httpx
                                     ▼
                    Corporate OpenAI-compatible LLM endpoint
                      (Azure OpenAI or OpenAI-style; env-configured)
```

### Component Responsibilities (existing — DO NOT MODIFY the contract)

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `main.py` | App bootstrap, lifespan, SPA mount | FastAPI + async context manager; shared `httpx.AsyncClient` on `app.state.http_client` |
| `config.py` | Env loading, settings singleton | `pydantic-settings` with `@lru_cache`; Azure vs OpenAI via `llm_auth_header_name` / `llm_auth_value_prefix` |
| `routers/llm.py` | Credential proxy for chat completions | `POST /api/llm` {systemPrompt, messages, maxTokens} -> {text} or {error:{code,message}} |
| `routers/health.py` | Upstream reachability probe | `GET /api/health/llm` always-200; 15s SLA; 8-code taxonomy; reuses LLM env config verbatim |
| `routers/config_gen.py` | One-shot config-from-brief LLM call | Stateless; mirrors llm.py error shape |
| `gameStore.ts` | Single source of client truth | Zustand + immer + devtools; session-only; no persistence |
| `debriefExporter.ts` | Build markdown from `messages[]` | Pure function; halts bucketing at `lastDebriefIdx`; Blob + anchor download |
| `ActionToolbar.tsx` | End-of-session controls | Hosts "Download Debrief (.md)" button that renders only when `hasDebrief===true` |

---

## 2. v1.2 Additions — what's NEW (every path given; no ambiguity)

### 2.1 Backend — new service layer

Create a new folder **`backend/app/services/`** (it does not exist today — see §1 tree). Mirror the MDInsights layout, drop the provider-fallback layer (single provider = ElevenLabs-only per milestone scope). The services folder is the first new sibling to `routers/`.

| New file | Role | Neighbour to read for shape |
|----------|------|-----------------------------|
| `backend/app/services/__init__.py` | Empty package marker | `backend/app/routers/__init__.py` |
| `backend/app/services/tts/__init__.py` | Empty package marker | — |
| `backend/app/services/tts/base.py` | `TTSProvider` ABC + `TTSError` exception | MDInsights `app/services/tts/base.py` (transplants verbatim) |
| `backend/app/services/tts/elevenlabs_provider.py` | Concrete impl — `synthesize(text, output_path) -> dict`; atomic temp-file + rename; catches any exception -> `TTSError` | MDInsights `app/services/tts/elevenlabs_provider.py` (drop primary/fallback orchestration; this IS the primary) |
| `backend/app/services/text_preprocessor.py` | Normalises numbers and EDIP acronyms (EDIP, PC, PO, CRM, IC, LEFS, SIEP -> phonetic expansion or spoken form); pure function, no I/O | Mirror existing `src/lib/promptBuilder.ts` philosophy (deterministic transform, fully unit-testable) |
| `backend/app/services/audio_generator.py` | Orchestrator: takes 3 persona segments + 3 voice IDs -> calls provider 3x -> stitches with brief silence pads -> returns MP3 bytes | MDInsights `app/services/audio_generator.py` minus the fallback branch |

**Rationale for the services/ folder boundary:** `routers/` must stay thin — it does HTTP framing and error-code translation. Audio generation is domain logic (orchestration, text preprocessing, file I/O, stitching) and belongs behind a service seam so the router is trivially testable with a mocked `AudioGenerator`. This is the SOLID rationale the project has already been following (frontend owns JSON validation; backend owns only the parts that can't happen client-side).

### 2.2 Backend — new router

| New file | Role |
|----------|------|
| `backend/app/routers/debrief.py` | `POST /api/debrief/podcast` — takes three debrief texts + three voice IDs -> calls `AudioGenerator` -> streams MP3 response |

**Why a new router, not an extension of `routers/llm.py`?** Separation of concerns (SRP). `routers/llm.py` is a chat-completions proxy — request shape `{systemPrompt, messages, maxTokens}`, response shape `{text}`. Podcast generation has a different request shape, different response type (audio/mpeg bytes, not JSON), different upstream provider, different error codes, and a different credential (`ELEVENLABS_API_KEY`). Stuffing it into `llm.py` violates the existing clean module boundary. Register in `main.py` alongside the others:

```python
# backend/app/main.py  (MODIFY this existing file — add one import and one include_router)
from .routers import config_gen, debrief, health, llm
...
app.include_router(llm.router)
app.include_router(health.router)
app.include_router(config_gen.router)
app.include_router(debrief.router)      # <- NEW
# SPA mount stays LAST
```

### 2.3 Backend — new settings

**MODIFY** `backend/app/config.py` to add ElevenLabs env vars. Follow the same pattern as the existing LLM block — required fields have no default (fail-fast at startup), optional ones have defaults.

New `Settings` fields:

| Field | Required | Default | Purpose |
|-------|----------|---------|---------|
| `elevenlabs_api_key` | yes | — | Upstream auth |
| `elevenlabs_base_url` | no | `https://api.elevenlabs.io` | Allows corporate proxy override |
| `elevenlabs_model_id` | no | `eleven_multilingual_v2` | Stays tunable in .env |
| `elevenlabs_voice_kent` | yes | — | ElevenLabs voice ID for Kent |
| `elevenlabs_voice_finch` | yes | — | ElevenLabs voice ID for Finch |
| `elevenlabs_voice_chen` | yes | — | ElevenLabs voice ID for Chen |
| `elevenlabs_timeout_seconds` | no | `120` | Per-call timeout (TTS is slower than chat) |
| `tts_segment_silence_ms` | no | `750` | Inter-persona silence pad |

Add a helper `is_tts_configured() -> bool` for the health router to use (parity with the existing `is_*_configured()` pattern referenced in the research brief).

**Credential rule (unchanged project invariant):** `ELEVENLABS_API_KEY` is env-only. It is never sent from the browser, never logged, never echoed in responses. The frontend POSTs three plain text strings; the backend attaches the key from Settings before calling ElevenLabs. Same model as `/api/llm` — matches PROJECT.md Key Decision "LLM auth header configurable via env (06-01)".

### 2.4 Frontend — new files

| New file | Role | Neighbour to read for shape |
|----------|------|-----------------------------|
| `src/types/podcast.ts` | Types for `PodcastGenerationRequest`, `PodcastGenerationResult`, `PodcastStatus`, `PodcastErrorCode` | `src/types/health.ts` (same size + structure — 8-code taxonomy) and `src/types/llm.ts` (discriminated unions) |
| `src/lib/podcastClient.ts` | `generatePodcast(req, opts) -> Promise<PodcastGenerationResult>`; fetch wrapper; zero-throw; returns blob on success | `src/lib/llmClient.ts` (copy its abort / network / HTTP-error / unknown-code branches, swap JSON->blob) |
| `src/components/game/PodcastPlayer/PodcastPlayer.tsx` | Renders Generate button -> spinner -> `<audio>` + Download — in a new subfolder because it will grow (status variants, error state, retry affordance) | `src/components/game/ChatFeed/ChatFeed.tsx` (directory-as-component-family convention already in use) |
| `src/components/game/PodcastPlayer/PodcastPlayer.test.tsx` | RTL test parity with existing component tests | `src/components/game/ChatFeed/ChatFeed.tsx` siblings |

### 2.5 Frontend — files to MODIFY (list is explicit so the roadmapper can map REQ->phase cleanly)

| File | Change |
|------|--------|
| `src/lib/gameStore.ts` | Add podcast state slice (§3) + actions `generatePodcast()`, `abortPodcastGeneration()`, `clearPodcast()`. Wire cleanup into the existing `resetGame()` and `newGame()` bodies (revoke blob URL before clearing the slice — see §7). |
| `src/components/game/FacilitatorInput/ActionToolbar.tsx` | Render `<PodcastPlayer />` adjacent to the existing `Download Debrief (.md)` button, gated on the same `hasDebrief` predicate. This is the ONE existing UI file that needs an edit for wire-up. |
| `src/types/health.ts` | IF we go with health Option A (see §4) — extend the response type with an optional `tts` sub-object. IF Option B (prescribed), leave this file untouched and add `src/types/ttsHealth.ts`. |
| `src/components/setup/HealthBadge.tsx` | IF Option A — handle the extended response (treat `tts` failure as a non-blocking warning, since markdown debrief still works without TTS). IF Option B (prescribed) — add a sibling `TtsHealthBadge.tsx` component in the same folder; this file stays untouched. |
| `src/components/setup/LoadConfigPanel.tsx` | IF Option B — render the new `<TtsHealthBadge>` immediately under the existing `<HealthBadge>`. No change to Launch-gate logic (TTS is non-gating). |
| `backend/app/main.py` | Add `debrief` to the router imports + `include_router` call (see §2.2). |
| `backend/app/config.py` | Add ElevenLabs settings (see §2.3). |

**No other existing files are touched.** `debriefExporter.ts`, `llmClient.ts`, `gameStore.ts`'s existing LLM logic, `promptBuilder.ts`, and every component outside `ActionToolbar.tsx` stay bit-identical. This is explicitly a bolt-on.

---

## 3. Zustand State Slice — prescribed shape

Add a single slice to `gameStore.ts`. All fields live on the existing store (no separate store) because the podcast lifecycle is coupled to `messages` and `gameEnded` — two stores would duplicate the subscription graph.

```typescript
// Additions to GameStore interface in src/lib/gameStore.ts

export type PodcastStatus = 'idle' | 'generating' | 'ready' | 'failed'

export type PodcastErrorCode =
  | 'TTS_TIMEOUT'
  | 'TTS_AUTH_ERROR'
  | 'TTS_UPSTREAM_ERROR'
  | 'TTS_UNREACHABLE'
  | 'TTS_RATE_LIMITED'
  | 'TTS_INVALID_INPUT'      // backend rejected the request body
  | 'NETWORK_ERROR'          // fetch itself failed
  | 'INTERNAL_ERROR'         // unknown / fallback
  | 'ABORTED'                // newGame / unmount cancelled

export interface PodcastSlice {
  podcastStatus: PodcastStatus
  /** Object URL from URL.createObjectURL(blob). MUST be revoked before overwrite. */
  podcastBlobUrl: string | null
  /** ISO timestamp of successful generation — drives filename + player label. */
  podcastGeneratedAt: string | null
  /** Populated only when podcastStatus === 'failed'. */
  podcastError: { code: PodcastErrorCode; message: string } | null
  /** Abort handle for the in-flight POST /api/debrief/podcast call. */
  podcastAbortController: AbortController | null

  // Actions
  generatePodcast: () => void            // kicks off the fetch; idempotent if already generating
  abortPodcastGeneration: () => void     // manual cancel
  clearPodcast: () => void               // revoke blob URL + reset status to 'idle'
}
```

**State-transition diagram (enforced by the actions above):**

```
 idle ──generatePodcast()──► generating ──┬── success ──► ready ──┐
                                          │                        │
                                          └── failure ──► failed   │
                                                                   │
 (any state) ──newGame()/clearPodcast()──► revoke blob URL ─► idle◄┘

 generating ──abort/unmount──► (transient ABORTED) ──► idle
```

**Why four status values, not three?** `idle` and `ready` are genuinely distinct: idle = never generated OR explicitly cleared; ready = blob in memory waiting to be played/downloaded. The player-visibility predicate is `status === 'ready'`; the generate-button-visibility predicate is `status === 'idle' || status === 'failed'`. Collapsing them forces a boolean-pair workaround. `ABORTED` is a transient outcome code from `podcastClient` (mirroring `llmClient`) that the store absorbs by flipping back to `idle` — it is not a persisted status.

**Why is this on the main `gameStore`, not a separate store?** Because `newGame()` and `resetGame()` already own the "cancel everything and zero the store" responsibility. A sibling store would require two cancellation paths and two cleanup sites — exactly the kind of duplication Decision 06-05 ("four-layer defensive parser with zero `throw`") was designed to avoid.

---

## 4. Health-Check Integration — prescribed Option B

### The three options on the table

| Option | Shape | Pros | Cons |
|--------|-------|------|------|
| **A. Extend `/api/health/llm`** | Single endpoint returns `{ok, latencyMs, tts: {ok, code, hint, latencyMs}}` | One fewer round-trip on setup screen; one fewer exception-handler block to write | Contract break: every existing monitoring consumer of `/api/health/llm` gets a new shape. The name lies — it's no longer LLM-specific. v1.1 decision "health endpoint always returns HTTP 200, body.ok carries signal" now has to answer "ok == LLM? or ok == LLM && TTS?" |
| **B. Parallel `/api/health/tts`** | New endpoint, same 8-code taxonomy, same always-200 contract | Orthogonal; existing `/api/health/llm` consumers untouched; matches the v1.1 rationale that each upstream gets its own probe; mirror-test patterns transplant line-for-line from `test_health_llm.py` | Two fetches on setup mount (cheap — both are < 2s) |
| **C. Aggregated `/api/health`** | Returns `{services: {llm: {...}, tts: {...}}, ok: <aggregate>}` | Most RESTful | Breaks the existing URL; requires frontend to re-plumb `HealthBadge`; over-engineered for two services; the "ok aggregate" answer is actually domain-specific (LLM down = hard fail; TTS down = warning only — see graceful degradation §11) |

### Prescription: Option B — `GET /api/health/tts`

**Reasoning:** The v1.1 decisions record "Health endpoint reuses LLM env config" and "HTTP 200 always; body.ok carries signal" — both are about contract stability. Option A breaks contract stability by mutating the response body of a shipped endpoint. Option B preserves the shipped contract *by construction* (zero edits to `health.py` or `src/types/health.ts`) and extends it laterally.

More importantly, the domain semantics differ:

- LLM down -> **hard fail** (Launch button is disabled; the game can't run)
- TTS down -> **soft warning** (the markdown debrief still works; podcast generation is a nice-to-have)

Aggregating the two behind one `ok` boolean would force a lossy collapse. Two endpoints with independent `ok` flags preserve the distinction for the frontend to act on.

### Prescribed `/api/health/tts` response shape

Identical taxonomy to `/api/health/llm` — this is intentional; the frontend has already learned the shape and error-handling paths transplant.

```jsonc
// Success (HTTP 200)
{ "ok": true, "latencyMs": 812 }

// Failure (HTTP 200 — body carries signal)
{
  "ok": false,
  "code": "auth_error",          // same enum as llm: timeout | auth_error |
                                 // not_found | rate_limited | upstream_error |
                                 // network_error | tls_error | invalid_response
  "status": 401,                 // null for timeout/network/tls
  "hint": "ElevenLabs rejected the API key — check ELEVENLABS_API_KEY in .env",
  "latencyMs": 412
}
```

**Probe strategy:** call ElevenLabs `GET /v1/voices` (cheap, auth-validating, no generation quota cost). If that endpoint proves expensive, fall back to `GET /v1/user` — both are documented lightweight auth-check endpoints. Timeout SLA: 15s, same as the LLM probe.

**Handler ordering note (load-bearing, copy verbatim from `routers/health.py` lines 125-131):** `TimeoutException` before `RequestError` (subclass). `ConnectError` before `RequestError` (subclass). The comment explaining this is a shipped invariant — preserve it.

**Frontend wiring:**

- New sibling component `src/components/setup/TtsHealthBadge.tsx` — structurally identical to `HealthBadge.tsx`, fetches `/api/health/tts` instead.
- Renders in `LoadConfigPanel.tsx` under the existing `HealthBadge`.
- **Does NOT gate the Launch button.** TTS being down must not block the facilitator from starting a game (graceful degradation rule — §11).
- Label when failed: "Podcast generation unavailable — markdown debrief will still work."

---

## 5. `/api/debrief/podcast` — prescribed contract

### Request shape

The backend is stateless. The frontend has the full debrief content in `messages[]` already (via `debriefExporter.ts`'s existing `lastDebriefIdx` slice). Therefore the request is option (a) from the brief — **full text payload, one entry per persona**. Option (b) is rejected because there's no server-side session. Option (c) (full messages array) is rejected because it includes chat-UI metadata (`id`, `timestamp`, `revealDelay`) that the podcast doesn't need — shipping less is better.

```jsonc
// POST /api/debrief/podcast
// Content-Type: application/json
{
  "segments": [
    { "persona": "kent",  "text": "Kent's full debrief message, concatenated if the persona spoke multiple times in the debrief window." },
    { "persona": "finch", "text": "Finch's full debrief message." },
    { "persona": "chen",  "text": "Chen's full debrief message." }
  ],
  "gameName": "EDIP Security of Supply Wargame"   // used only for MP3 metadata / Content-Disposition filename
}
```

**Segment ordering in the request is authoritative** — the backend stitches in the order received. Canonical order produced by the frontend: Kent -> Finch -> Chen (matches persona-routing convention).

**Validation (frontend, mirroring decision 02-03 "frontend owns JSON validation"):**

- All three personas present exactly once
- Each `text` non-empty after `trim()`
- Total payload size < 50 KB (sanity cap; three debrief messages are typically ~2-5 KB combined)

**Validation (backend, defence-in-depth):**

- Pydantic model rejects malformed body -> existing 400 handler in `main.py` returns `{error:{code:VALIDATION_ERROR, message:"Malformed request body"}}` — reuses shipped contract

### Response shape

**Success: streaming `audio/mpeg` response (blocking HTTP).**

```
HTTP/1.1 200 OK
Content-Type: audio/mpeg
Content-Disposition: attachment; filename="podcast-edip-security-of-supply-2026-04-17-1432.mp3"
Content-Length: <bytes>
X-Podcast-Duration-Ms: <int>     // optional metadata for player label

<MP3 bytes>
```

**Why blocking HTTP and not 202+poll?** Three reasons:

1. **Facilitator UX fits blocking.** Generation takes 60-180s for three ~30s segments (ElevenLabs stock throughput). The facilitator explicitly clicks "Generate podcast" and waits next to the debrief download — they're not context-switching. A blocking response with a visible spinner is simpler than a polling state machine.
2. **The existing `/api/llm` tolerates 45s LLM calls on a single request.** Infrastructure (corporate reverse proxy, uvicorn, httpx) already permits multi-minute requests; no new tuning needed.
3. **202+poll adds server-side state** (a job store) to an otherwise stateless backend. PROJECT.md deferred multi-tenancy for a reason — don't introduce session state here.

**Timeout budget:** set the backend `elevenlabs_timeout_seconds` to 120 *per segment*. Total request ceiling = 3 × 120s + stitching overhead ≈ 400s. Frontend `podcastClient.ts` sets its own safety AbortController at 420s (mirrors `LLM_FRONTEND_TIMEOUT_MS = 45000` pattern but scaled for TTS).

**Failure: JSON `{error:{code, message}}`** with HTTP status matching the shipped `/api/llm` convention.

| HTTP | code | Cause |
|------|------|-------|
| 504 | `TTS_TIMEOUT` | One or more ElevenLabs calls exceeded timeout |
| 401 | `TTS_AUTH_ERROR` | ElevenLabs rejected the API key |
| 429 | `TTS_RATE_LIMITED` | ElevenLabs rate limit hit |
| 502 | `TTS_UPSTREAM_ERROR` | Non-2xx non-401 from ElevenLabs, OR stitching failed |
| 502 | `TTS_UNREACHABLE` | Network error reaching ElevenLabs |
| 400 | `VALIDATION_ERROR` | Request body malformed (handled by shared `main.py` handler) |
| 500 | `INTERNAL_ERROR` | Anything else |

**Why mirror the `/api/llm` codes exactly?** Because `podcastClient.ts` will mirror `llmClient.ts`, which means the error-mapping branches read identically. Consistency is a feature here — a facilitator who has seen one error taxonomy should not have to learn a second one.

---

## 6. Data Flow — end-of-game to podcast bytes

```
(existing, unchanged)
  End-of-game ─► gameStore.endGame() ─► runLLMTurn(END_GAME_DEBRIEF)
             ─► 3 persona responses with isDebrief:true land in messages[]
             ─► ActionToolbar renders "Download Debrief (.md)"

(NEW in v1.2)
  Facilitator clicks "Generate Podcast" (ONE explicit click, never auto)
             │
             ▼
  gameStore.generatePodcast()
    ├─ read messages[], slice messages[lastDebriefIdx+1:], group by persona
    ├─ build PodcastGenerationRequest { segments: [kent, finch, chen], gameName }
    ├─ set podcastStatus = 'generating', podcastAbortController = new AbortController()
    │
    ▼
  podcastClient.generatePodcast(req, {signal})
    └─ fetch('/api/debrief/podcast', POST, JSON body, abort signal)
             │
             │  HTTP network
             ▼
  routers/debrief.py: validate body ─► call audio_generator.py
                                        │
                                        ▼
    audio_generator.py:
      for each segment:
        text_preprocessor.normalise(segment.text)   # EDIP/PC/PO expansion
        elevenlabs_provider.synthesize(normalised, tmpfile)
      stitch([tmpfile_kent, silence, tmpfile_finch, silence, tmpfile_chen])
      return MP3 bytes + duration_ms
             │
             ▼
  routers/debrief.py: StreamingResponse(audio_bytes, media_type='audio/mpeg', headers=...)
             │
             │  HTTP response body
             ▼
  podcastClient reads response.blob() ─► returns { ok:true, blob, durationMs }
             │
             ▼
  gameStore.setPodcastResult(URL.createObjectURL(blob))
    ├─ podcastStatus = 'ready'
    ├─ podcastBlobUrl = <blob:...>
    └─ podcastGeneratedAt = ISO now
             │
             ▼
  PodcastPlayer re-renders:
    ├─ <audio controls src={podcastBlobUrl} />
    └─ <a href={podcastBlobUrl} download={...}>Download MP3</a>
```

**Failure branch is symmetric:** any error at any step -> `podcastClient` returns `{ok:false, errorCode, message}` -> `gameStore.setPodcastError(...)` -> `podcastStatus = 'failed'` -> `PodcastPlayer` renders the hint + a "Try again" button that calls `generatePodcast()` again. No mutation to `messages[]`, `gameState`, or any other slice — perfect atomicity mirrors `runLLMTurn`'s failure branch in `gameStore.ts` lines 205-238.

**Frontend segment-grouping (the "slice and group" step in generatePodcast):**

```typescript
// Inside gameStore.ts generatePodcast action, BEFORE the fetch:
const { messages, gameConfig } = get()

// Find lastDebriefIdx using the SAME rule debriefExporter.ts uses
// (decision 08-05 — halt at last debrief_divider). Re-exported as a pure
// helper so both call sites agree on the contract.
const lastDebriefIdx = messages.reduce<number>(
  (acc, m, i) => (m.type === 'debrief_divider' ? i : acc),
  -1,
)
if (lastDebriefIdx === -1) return   // no debrief -> nothing to podcast

const debriefMessages = messages
  .slice(lastDebriefIdx + 1)
  .filter(m => m.type === 'persona' && m.speaker && ['kent','finch','chen'].includes(m.speaker))

// Group by speaker, concatenate any repeats with a newline
const byPersona: Record<'kent'|'finch'|'chen', string[]> = { kent: [], finch: [], chen: [] }
for (const m of debriefMessages) byPersona[m.speaker as 'kent'|'finch'|'chen'].push(m.text ?? '')

const segments = (['kent','finch','chen'] as const).map(p => ({
  persona: p,
  text: byPersona[p].join('\n\n').trim(),
}))
```

Note: this grouping logic is a candidate for extraction into `debriefExporter.ts` as a new pure helper `collectDebriefSegments(messages)` so both the markdown exporter (future: could cite segments) and the podcast generator share one canonical "what is in the debrief" definition.

---

## 7. Blob URL Lifecycle — prescribed handling

Object URLs are a browser-lifetime resource. Leaking them is the classic frontend TTS bug.

**Four rules, enforced by `gameStore` (not by the component):**

1. **Create:** `URL.createObjectURL(blob)` happens inside the success branch of `generatePodcast`, the ONLY place that ever assigns `podcastBlobUrl`.
2. **Revoke-before-overwrite:** before assigning a new URL, read the current `podcastBlobUrl` and call `URL.revokeObjectURL()` on it if non-null. Prevents the "regenerate twice" leak.
3. **Revoke-on-clear:** `clearPodcast()` revokes first, then zeroes the slice.
4. **Revoke-on-session-end:** `newGame()` and `resetGame()` call `clearPodcast()` *before* the existing zero-everything `set(...)` block. This is added as a one-line `get().clearPodcast()` at the top of each action.

**Do NOT revoke inside `PodcastPlayer`'s unmount effect.** The blob must survive re-mounts of the player (e.g. the ActionToolbar re-renders). The store owns the lifecycle, not the component — mirrors the v1.1 rationale that transient setup-screen state belongs in the component while session-scoped state belongs in the store.

**Download anchor:** use the same pattern already shipped in `debriefExporter.ts::downloadDebrief` — synthetic `<a>`, `anchor.click()`, `document.body.removeChild`. For the markdown case the pattern also schedules `setTimeout(() => URL.revokeObjectURL, 0)` because that URL has no other consumer. For the podcast case, the blob URL is ALSO bound to `<audio src>`, so the anchor MUST NOT revoke. Two options:

- **Option A:** clone a fresh object URL for the download anchor (`const dlUrl = URL.createObjectURL(blob)`) and let the markdown-style deferred revoke handle it. Requires storing the blob itself, not just the URL.
- **Option B (prescribed):** reuse the single store-owned URL for both `<audio src>` and the download anchor; skip anchor-side revoke. Store revokes on `clearPodcast`.

**Option B is simpler, has one owner, and matches the store-owned-lifecycle rule above.** The only cost is that the URL lives until `clearPodcast()` / `newGame()` — which is exactly the intended lifetime.

---

## 8. Build-Order Dependency Chain — prescribed sequencing

This is not phase-numbering (that's the roadmapper's job). It IS the dependency-ordered sequence. Each slice is independently testable; each merges cleanly before the next starts.

```
Slice 1 — Backend settings + TTS health skeleton (MOCKABLE)
  ├─ MODIFY backend/app/config.py: add ElevenLabs + voice settings
  ├─ NEW    backend/app/routers/debrief.py: SKELETON only (returns 501)
  ├─ NEW    backend/app/routers/health.py additions OR new endpoint — Option B:
  │          add a new function in health.py (same router) that handles
  │          GET /api/health/tts. (Same file keeps both probes together; the
  │          existing /api/health/llm is untouched.)
  └─ Tests: pytest with respx mocks (mirror tests/test_health_llm.py)
     Unblocks: frontend can begin Slice 5/6/7 against a stub

Slice 2 — TTS provider + preprocessor (MOCKABLE — respx)
  ├─ NEW backend/app/services/tts/base.py
  ├─ NEW backend/app/services/tts/elevenlabs_provider.py
  ├─ NEW backend/app/services/text_preprocessor.py
  └─ Tests: unit tests with respx for ElevenLabs responses; pure-function tests
     for preprocessor (EDIP -> "ee-dip", CRM -> "see-are-em", numbers -> words).
     No live credentials needed. This is where most of the test surface lives.

Slice 3 — Audio generator + stitching (MOCKABLE — fake provider)
  ├─ NEW backend/app/services/audio_generator.py
  └─ Tests: unit test with an in-memory fake TTSProvider returning tiny MP3
     stub bytes; assert stitched output has 3 segments + expected silence pads.

Slice 4 — /api/debrief/podcast endpoint wired to the generator (MOCKABLE)
  ├─ Replace Slice 1's 501 skeleton with the full impl
  └─ Integration test: httpx TestClient + respx for ElevenLabs; assert
     response is audio/mpeg bytes + correct Content-Disposition.

Slice 5 — Frontend podcast client + types (MOCKABLE — fetch-mock)
  ├─ NEW src/types/podcast.ts
  ├─ NEW src/lib/podcastClient.ts
  └─ Tests: vitest with fetch mock; assert all discriminated-union branches
     (ok, ABORTED, NETWORK_ERROR, TTS_TIMEOUT, TTS_AUTH_ERROR, invalid-body).

Slice 6 — Zustand slice + actions (MOCKABLE — store-only tests)
  ├─ MODIFY src/lib/gameStore.ts: add slice (§3) + actions + wire cleanup
  │   into newGame() / resetGame()
  └─ Tests: mirror gameStore.test.ts patterns — assert revoke-before-overwrite,
     assert newGame revokes blob URL, assert failed->ready transition.

Slice 7 — PodcastPlayer component + ActionToolbar wire-up (MOCKABLE — RTL)
  ├─ NEW    src/components/game/PodcastPlayer/PodcastPlayer.tsx
  ├─ MODIFY src/components/game/FacilitatorInput/ActionToolbar.tsx
  └─ Tests: RTL — generating state shows spinner, ready state shows <audio>,
     failed state shows hint + retry button, generate click calls action.

Slice 8 — TTS health-badge integration (MOCKABLE)
  ├─ NEW    src/types/ttsHealth.ts (or reuse LLMHealth types — trivial rename)
  ├─ NEW    src/components/setup/TtsHealthBadge.tsx (Option B)
  ├─ MODIFY src/components/setup/LoadConfigPanel.tsx: render under HealthBadge
  └─ Tests: mirror HealthBadge.test.tsx — ok / failed / checking states,
     failed state does NOT gate Launch.

────── mock boundary ──────

Slice 9 — LIVE end-to-end against real ElevenLabs (NEEDS REAL CREDS)
  ├─ Same pattern as v1.1 Tier B live-LLM replay (PROJECT.md decision "Tier B
  │   replay path full R1→R2→R3, not localStorage seed")
  ├─ Run a mini end-of-game flow against real ElevenLabs with stock voice IDs
  ├─ Verify: MP3 plays, duration reasonable, filename correct, audio audible
  │   for each persona, stitching silence pads land cleanly
  └─ Pass artifact: a real MP3 committed under .planning/evidence/ (or
     fingerprint-only if file-size policy prohibits binary in repo)

Slice 10 — Graceful-degradation verification (NEEDS REAL-ISH SETUP)
  ├─ Temporarily set ELEVENLABS_API_KEY to a garbage value
  ├─ Verify: /api/health/tts shows auth_error; TtsHealthBadge shows hint;
  │   Launch button still enabled; end-of-game flow still produces the
  │   markdown debrief; Generate Podcast click surfaces the hint without
  │   blocking any other UI
  └─ This IS the v1.2 audit-equivalent of the v1.1 Tier B replay.

Slice 11 — Milestone audit
  ├─ Same pattern as v1.1-MILESTONE-AUDIT.md
  └─ Checks: requirements coverage, test coverage deltas, no shipped-contract
     regressions on /api/llm or /api/health/llm, markdown debrief path
     unchanged.
```

**Mock-vs-live boundary:** slices 1-8 are all mockable. Slice 9 is the first that requires a real ElevenLabs key. This matches exactly the v1.1 Tier B pattern and is the reason the project can keep `pytest` and `vitest` green in CI without shipping live credentials.

**Parallelism opportunity:** slices 5-6 and slice 8 have no dependency on backend slices 2-4 once slice 1's skeleton is in. A two-person team could parallelise frontend from backend after slice 1 merges.

---

## 9. Architectural Patterns (v1.2 applies these — all pre-existing in this repo)

### Pattern A — Credential-proxy in a thin router; domain logic in a service

**What:** Router handles HTTP framing (request parsing, error-code translation, response shape); service owns upstream calls, preprocessing, stitching.
**When:** Any time a browser-to-corp-upstream proxy is added.
**Trade-off:** One extra indirection level; pays off at the first unit test.

```python
# routers/debrief.py (sketch)
@router.post("/api/debrief/podcast")
async def debrief_podcast(body: PodcastRequest, request: Request) -> Response:
    settings = get_settings()
    client: httpx.AsyncClient = request.app.state.http_client
    generator = AudioGenerator(
        provider=ElevenLabsTTSProvider(client, settings),
        preprocessor=preprocess_text,
        silence_ms=settings.tts_segment_silence_ms,
    )
    try:
        mp3_bytes, duration_ms = await generator.generate(body.segments)
    except TTSError as err:
        return map_tts_error_to_json(err)   # same 8-code shape
    filename = build_podcast_filename(body.gameName)
    return StreamingResponse(
        iter([mp3_bytes]),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Podcast-Duration-Ms": str(duration_ms),
        },
    )
```

### Pattern B — Zero-throw client with discriminated union

**What:** Client never `throws`; returns `{ok:true,...} | {ok:false, errorCode, ...}`.
**When:** All fetch wrappers in this project (established by decision 06-05).
**Trade-off:** Slightly more boilerplate than throwing; callers never need `try/catch`.

```typescript
// src/lib/podcastClient.ts — mirror llmClient.ts line-for-line, swap JSON -> blob
export type PodcastResult =
  | { ok: true; blob: Blob; durationMs: number | null }
  | { ok: false; errorCode: PodcastErrorCode; message: string }
```

### Pattern C — Store-owned lifecycle for session-scoped resources

**What:** Objects whose lifetime is "a game session" (the blob URL, the AbortController, the pendingControlBanner) live on `gameStore` and are cleaned up by `newGame()` / `resetGame()` — never by component unmount effects.
**When:** Anything that must survive a component re-render but die on session end.
**Trade-off:** Store becomes authoritative for cleanup; components become free of cleanup responsibility.

---

## 10. Anti-Patterns (explicitly to be avoided in v1.2)

### Anti-Pattern 1 — Auto-generating the podcast on end-of-game

**What people do:** Fire the TTS call the instant the final debrief messages land.
**Why it's wrong:** 60-180s network request the facilitator didn't ask for; burns ElevenLabs quota on sessions where no one wanted audio; no UX affordance to cancel.
**Do this instead:** Explicit click on "Generate Podcast" — facilitator opts in.

### Anti-Pattern 2 — Storing ElevenLabs key in the browser

**What people do:** Expose `VITE_ELEVENLABS_API_KEY` and call ElevenLabs directly from `podcastClient.ts`.
**Why it's wrong:** Contradicts the shipped credential model (PROJECT.md v1.0 audit "zero browser-side Authorization / Bearer / api-key headers"); key leaks to every browser dev tools panel.
**Do this instead:** Server-side proxy only. Same model as `/api/llm`.

### Anti-Pattern 3 — Making the markdown debrief depend on TTS

**What people do:** Move the markdown generation server-side too, or require the podcast to succeed before showing the markdown download.
**Why it's wrong:** Breaks the graceful-degradation rule. A facilitator with no ElevenLabs access must still be able to finish a game and download the debrief.
**Do this instead:** Markdown debrief stays 100% client-side in `debriefExporter.ts` (no change). Podcast is an orthogonal add-on.

### Anti-Pattern 4 — Revoking the blob URL in PodcastPlayer's unmount effect

**What people do:** `useEffect(() => () => URL.revokeObjectURL(blobUrl), [blobUrl])`.
**Why it's wrong:** A re-mount of ActionToolbar (which happens on any sibling state change) unmounts PodcastPlayer and revokes a live URL; the next render shows a dead `<audio>`.
**Do this instead:** Store-owned lifecycle (§7). Only `newGame()` / `resetGame()` / `clearPodcast()` revoke.

### Anti-Pattern 5 — Polling a job queue

**What people do:** `/api/debrief/podcast` returns 202 with a job ID; frontend polls `/api/debrief/podcast/:id`.
**Why it's wrong:** Introduces server-side state to a currently stateless backend — directly conflicts with the multi-tenancy deferral in PROJECT.md.
**Do this instead:** Blocking response with a visible spinner. §5 has the reasoning.

### Anti-Pattern 6 — Rebuilding the "what is the debrief" selector from scratch

**What people do:** Re-derive `lastDebriefIdx` inside `podcastClient.ts` or `PodcastPlayer.tsx` with subtly different rules from `debriefExporter.ts`.
**Why it's wrong:** Two sources of truth on "what belongs to the debrief" — one could include interim-debrief messages, the other could not.
**Do this instead:** Extract the grouping into a shared helper in `debriefExporter.ts` (or a new `src/lib/debriefSelector.ts`) and call it from both consumers.

---

## 11. Graceful-Degradation Contract (explicit)

The markdown debrief path **must keep working** in all of these failure modes:

| Failure | Markdown debrief | Podcast generation |
|---------|------------------|--------------------|
| `ELEVENLABS_API_KEY` missing / wrong | works | 401 -> hint shown |
| ElevenLabs endpoint unreachable | works | 502 -> hint shown |
| ElevenLabs rate-limited | works | 429 -> "try again later" hint |
| ElevenLabs returns malformed MP3 | works | 502 upstream_error -> hint |
| TTS health check failing at setup | works; Launch button still enabled | warning badge shown |
| Browser blocks `URL.createObjectURL` | works | INTERNAL_ERROR -> hint |
| User clicks Generate, then `newGame()` | works | aborted cleanly, no stranded state |

**Single invariant:** the Download Debrief (.md) button at the existing location (`ActionToolbar.tsx`) stays functional regardless of TTS state. This is enforced by construction: `debriefExporter.ts` and its call site have **zero** new imports from any TTS module. The ONLY change to `ActionToolbar.tsx` is the addition of a sibling `<PodcastPlayer />` component — the existing download button's code path is untouched.

---

## 12. Integration Points Summary

### External services

| Service | Integration pattern | Notes |
|---------|---------------------|-------|
| ElevenLabs `/v1/text-to-speech/{voice_id}` | Server-side POST via `httpx.AsyncClient` reusing `app.state.http_client`; API key from `Settings.elevenlabs_api_key`; 120s per-call timeout | Stock voice IDs in `.env`; voice audition explicitly out of v1.2 scope |
| ElevenLabs `/v1/voices` (or `/v1/user`) | Health probe from `/api/health/tts`; 15s SLA; cheap auth check | Matches `/api/health/llm` probe philosophy |
| Corporate OpenAI-compatible LLM | (UNCHANGED) | No v1.2 impact |

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `routers/debrief.py` <-> `services/audio_generator.py` | direct Python call; generator takes an injected `TTSProvider` | Enables in-memory fake in tests |
| `services/audio_generator.py` <-> `services/tts/elevenlabs_provider.py` | ABC (`TTSProvider`) boundary | Single provider in v1.2; extensibility preserved for v2+ |
| `src/lib/podcastClient.ts` <-> `/api/debrief/podcast` | fetch; POST JSON -> blob response | Zero-throw; mirrors `llmClient.ts` |
| `src/lib/gameStore.ts` <-> `src/lib/podcastClient.ts` | direct import; action calls client | Mirrors existing `runLLMTurn -> callLLMProxy` pattern |
| `PodcastPlayer` <-> `gameStore` | Zustand selector subscriptions; never holds local blob state | Ownership rule §7 |
| `ActionToolbar` <-> `PodcastPlayer` | Conditional render on `hasDebrief` (existing predicate — no new store selector needed) | One-line addition |

---

## 13. Quality-Gate Self-Check

| Gate | Status | Where covered |
|------|--------|---------------|
| Every new file has an exact path matching existing layout | yes | §2.1, §2.2, §2.4 — every path is `backend/app/...` or `src/...` |
| `/api/debrief/podcast` request/response JSON shape specified | yes | §5 |
| Health-check integration choice prescribed with reasoning | yes | §4 — Option B chosen |
| Zustand state slice shape prescribed | yes | §3 |
| Blob URL lifecycle handling prescribed | yes | §7 (four rules) |
| Dependency-ordered build sequence prescribed | yes | §8 (11 slices) |
| Mockable vs live-test phases distinguished | yes | §8 (explicit mock-boundary line after slice 8) |
| Existing files that need MODIFICATION listed | yes | §2.5 (seven files) |
| Graceful-degradation behaviour specified | yes | §11 (full matrix) |

---

## Sources

- `C:\KVWarGame\backend\app\main.py` — lifespan + router registration order (load-bearing SPA-mount-last rule)
- `C:\KVWarGame\backend\app\config.py` — pydantic-settings pattern to mirror for ElevenLabs settings
- `C:\KVWarGame\backend\app\routers\llm.py` — error-shape contract and auth-header construction (lines 79-84) to mirror in the debrief router
- `C:\KVWarGame\backend\app\routers\health.py` — 8-code taxonomy, always-200 invariant, handler-ordering comment, 15s SLA per-request override
- `C:\KVWarGame\src\lib\gameStore.ts` — Zustand + immer store pattern; `runLLMTurn` atomic-failure branch (lines 205-238) to mirror for podcast
- `C:\KVWarGame\src\lib\llmClient.ts` — zero-throw discriminated-union client to mirror in `podcastClient.ts`
- `C:\KVWarGame\src\lib\debriefExporter.ts` — Blob + synthetic-anchor download pattern; `lastDebriefIdx` halting rule
- `C:\KVWarGame\src\types\health.ts` — Health response types (template for `ttsHealth.ts` if Option B)
- `C:\KVWarGame\src\types\llm.ts` — Discriminated-union conventions for `PodcastGenerationResult`
- `C:\KVWarGame\src\components\setup\HealthBadge.tsx` — template for `TtsHealthBadge.tsx`
- `C:\KVWarGame\src\components\game\FacilitatorInput\ActionToolbar.tsx` — the single UI file that needs an edit
- `C:\KVWarGame\.planning\PROJECT.md` — Key Decisions 06-01 / 06-03 / 06-05 / 08-05 / v1.1 health decisions that constrain this milestone
- MDInsights reference (`SamuraiJenkinz/daily-intelligence-brief`): `app/services/tts/base.py`, `app/services/tts/elevenlabs_provider.py`, `app/services/audio_generator.py` — cited in milestone_context as already-reviewed reference implementation; transplanting shapes with the primary/fallback layer dropped per milestone scope

---
*Architecture research for: v1.2 Debrief Podcast integration*
*Researched: 2026-04-17*
