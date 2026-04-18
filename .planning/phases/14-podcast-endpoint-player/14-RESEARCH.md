# Phase 14: Podcast Endpoint + Player — Research

**Researched:** 2026-04-18
**Domain:** FastAPI streaming/SSE, HTML5 audio, React audio player, in-memory caching, client-cancel, filename utils, word-count estimation, component decomposition, test strategy
**Confidence:** HIGH overall (verified against official FastAPI docs, MDN, and codebase inspection); LOW flags noted per section

---

## Summary

Phase 14 ships a complete podcast generation + playback surface using the TTS abstraction Phase 13 delivered. The eight research deliverables answer one central architectural question — how to surface per-persona progress (SC4) while the backend contract says "blocking streaming `audio/mpeg`" — and seven supporting questions about browser audio, caching, cancellation, filename utils, word-count math, component shape, and testability.

**The central reconciliation (deliverable 1):** The cleanest viable pattern for real per-persona completion events alongside a blocking audio/mpeg response is an **SSE sidecar endpoint**: `POST /api/debrief/podcast/stream` returns `text/event-stream` and yields one JSON event per persona as it completes, then a final `done` event whose data payload is `{"offsets": [...], "word_count": N}`. The client simultaneously fetches the audio blob via `GET /api/debrief/podcast/audio?token=<opaque>` once the `done` event fires. This is two requests, but the surface is clean, fetch-native (no WebSocket), and stateless (the audio is pulled by token from an in-memory short-lived slot). A simpler alternative — optimistic three-step client animation without any real event — is possible but violates SC4 literally. A multipart/mixed stream is the third option but is not reliably readable via the Fetch Streams API in Chrome without a specialized parser. The SSE sidecar is recommended.

**Browser audio (deliverable 2):** CBR MP3 from a Blob URL with `audio.currentTime = offsetSeconds` works reliably on Chrome/Edge (the only deployment targets) provided the audio is fully buffered before seeking. Blob URLs bypass the server-side HTTP 206 range-request problem entirely because the browser owns the full byte buffer. Precomputed segment start offsets in seconds work correctly with standard `<audio>` element seeking. The `timeupdate` event with a comparison against an offsets array is the boundary-detection mechanism. No gotchas specific to Chrome/Edge with CBR MP3 at 44.1 kHz / 128 kbps.

**Primary recommendation:** SSE sidecar endpoint for progress, Blob URL `<audio>` for playback, `lru_cache`-style in-process dict keyed by `sha256(game_name + text + voice_config)` for caching, `request.is_disconnected()` polling for server-side cancel, client-side JS for filename timestamping, `~150 wpm` spoken + `~delay_seconds per segment` fake render, and a three-component split: `PodcastSection` (orchestrator), `PodcastPlayer` (playback UI), `GenerationPanel` (progress UI).

---

## Standard Stack

### Core (no new dependencies required)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| FastAPI (native SSE) | >=0.135.0 | SSE sidecar endpoint via `EventSourceResponse` | Already installed (project uses `fastapi[standard]>=0.135.0`). SSE support added in 0.135.0. |
| `starlette.concurrency.run_in_threadpool` | (starlette bundled) | Wrap sync `TTSProvider.synthesise()` to keep endpoint async-clean | Already documented in `base.py` docstring as Phase 14's prescribed pattern |
| `hashlib.sha256` | stdlib | Cache key generation | No import needed beyond stdlib |
| `functools.lru_cache` or plain `dict` | stdlib | In-process MP3 cache | See caching section |
| `asyncio` | stdlib | Disconnect polling | Used in the SSE generator's disconnect check |
| React 19 + Zustand 5 | Already installed | Frontend state | All podcast state flows into the existing `useGameStore` or a co-located local hook |
| Tailwind CSS 4 + Lucide React | Already installed | UI styling and icons | ChevronDown for transcript toggle; no new icon lib needed |

### No New Python Dependencies

The Phase 14 backend requires zero new pip packages. `run_in_threadpool` is in Starlette (already installed). `hashlib` and `asyncio` are stdlib. `sse-starlette` (third-party) is NOT needed because FastAPI 0.135.0+ ships native `EventSourceResponse`.

### No New Frontend Dependencies

`react-markdown` is NOT installed and NOT needed. The requirement says "existing markdown rendering path." Phase 14's transcript panel must reuse whatever rendering `PersonaMessage` or the debrief exporter already uses (currently plain text in a `<div>`). There is no pre-existing React Markdown library in `package.json`. The transcript panel renders the raw markdown string into a `<pre>` or styled `<div>` — do NOT install `react-markdown` in Phase 14.

**Installation:** No new packages in Phase 14. Silence pad (700ms of CBR mp3_44100_128) is generated offline by ffmpeg and committed as `backend/app/services/tts/fixtures/silence_700ms.mp3`.

---

## Architecture Patterns

### Pattern 1: SSE Sidecar + Deferred Audio Fetch (RECOMMENDED for progress)

**What:** Two coordinated HTTP interactions. The client issues:

1. `POST /api/debrief/podcast` → `text/event-stream` — the SSE sidecar. The server runs the three-persona synthesis loop serially, yielding one SSE event per persona complete, then a final `done` event with offsets + an audio download token.
2. `GET /api/debrief/podcast/audio?token=<opaque>` → `audio/mpeg` — the audio pull. The server looks up the pre-generated bytes by token from an in-process short-lived dict, streams them, and removes the token.

The "token" is a short-lived UUID keyed to a dict entry on `app.state`. The audio bytes are generated during the SSE stream and held briefly. The client fires the GET immediately on receiving the `done` event.

**Why this pattern:**
- Fetch-native (EventSource API for SSE, plain fetch for audio). No WebSocket. Browser EventSource auto-reconnects on drop, which the client must suppress (reconnect not desired here — the server has finished by then).
- The SSE stream is how SC4's per-persona events are actually delivered. The REQUIREMENTS spec text for PODUX-01 says "driven client-side by optimistic state transitions, since the backend returns one blocking streamed MP3" — this was written when the solution was "blocking `audio/mpeg` only". The CONTEXT.md research note explicitly asks to reconcile SC4 with that decision. SSE sidecar is the reconciliation.
- Backend stays stateless: the audio token slot is ephemeral (TTL 60s, cleared on first GET).

**SSE event shape:**

```python
# FastAPI 0.135.0+ native SSE
from fastapi.sse import ServerSentEvent, EventSourceResponse

@router.post("/api/debrief/podcast", response_class=EventSourceResponse)
async def generate_podcast(body: PodcastRequest, request: Request):
    async def generator():
        # Kent
        kent_bytes = await run_in_threadpool(provider.synthesise, kent_text, kent_voice)
        yield ServerSentEvent(event="persona_done", data=json.dumps({"persona": "kent"}))
        # Finch ...
        # Chen ...
        # assemble stitched audio, store in app.state token slot
        token = str(uuid4())
        app.state.podcast_tokens[token] = stitched_bytes
        yield ServerSentEvent(event="done", data=json.dumps({
            "token": token,
            "offsets": [0.0, kent_duration_s + 0.7, kent_duration_s + 0.7 + finch_duration_s + 0.7],
            "word_count": total_words
        }))
    return EventSourceResponse(generator())
```

**Client-side (simplified):**

```typescript
// EventSource-style or fetch-ReadableStream
const es = new EventSource(/* or use fetch + TextDecoder stream */)
es.addEventListener('persona_done', e => updatePersonaStatus(JSON.parse(e.data).persona))
es.addEventListener('done', async e => {
  const { token, offsets, word_count } = JSON.parse(e.data)
  const audioRes = await fetch(`/api/debrief/podcast/audio?token=${token}`)
  const blob = await audioRes.blob()
  const blobUrl = URL.createObjectURL(blob)
  setAudioState({ blobUrl, offsets })
  es.close()
})
```

**Note:** Browser `EventSource` does not send a body (it is GET-only). For a POST-based SSE sidecar, the client must use `fetch()` + `ReadableStream` to consume the SSE stream. This is fetch-native and works in Chrome/Edge without libraries.

```typescript
const response = await fetch('/api/debrief/podcast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody),
  signal: abortController.signal,
})
const reader = response.body!.getReader()
const decoder = new TextDecoder()
// Parse SSE manually: split on \n\n, extract event:/data: lines
```

**Confidence:** MEDIUM — FastAPI 0.135.0 native SSE is verified by official docs. The POST-based fetch+stream parsing for SSE is a well-known pattern but requires a small manual parser (20 lines). No library needed.

---

### Pattern 2: Optimistic Client Animation (SIMPLER, but violates SC4 literally)

**What:** Backend returns a single blocking `application/octet-stream` or `audio/mpeg` response. Client plays a three-step animation (Kent → Finch → Chen) with fixed estimated durations. No real events.

**Why rejected:** CONTEXT.md and REQUIREMENTS PODUX-01 both say "per-persona status" driven by actual completion. The CONTEXT.md states "discrete progress bar driven by per-segment completion events." This option does not deliver real events and would fail the SC4 acceptance criterion.

---

### Pattern 3: Chunked Multipart/mixed Body (Rejected)

Streaming `multipart/mixed` (JSON-encoded progress parts followed by a binary audio part) is theoretically correct but the browser Fetch Streams API provides no built-in multipart parser. Reading raw ReadableStream chunks and splitting on boundary strings is fragile and has known chunking edge cases. Not recommended.

---

### Pattern 4: Audio Token Slot (app.state)

The in-process token dict lives on `app.state.podcast_tokens: dict[str, bytes]`. Entries are set during SSE synthesis, consumed (and deleted) on the `GET /audio` call, and swept by a TTL check (60 seconds). This keeps the pattern stateless enough for a single-process deployment (which this is — Windows Server, single uvicorn process per PROJECT.md context).

```python
# In lifespan:
app.state.podcast_tokens: dict[str, bytes] = {}
```

---

### Pattern 5: Blob URL Audio Loading (Frontend)

```typescript
// After receiving stitched bytes from GET /audio:
const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
const blobUrl = URL.createObjectURL(blob)
audioRef.current!.src = blobUrl
audioRef.current!.load()

// Cleanup on unmount or re-generate:
useEffect(() => {
  return () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl)
  }
}, [blobUrl])
```

Blob URLs bypass the HTTP 206 range-request requirement for seeking. The full audio buffer is owned by the browser once the blob is created. `audio.currentTime = offsetSeconds` works correctly for CBR MP3 (verified by MDN + Chrome bug reports — VBR is problematic, CBR is not).

**Confidence:** HIGH — MDN confirms, Chrome bug reports confirm CBR seeking works. The existing `downloadDebrief` function in `debriefExporter.ts` uses the identical `URL.createObjectURL + anchor + setTimeout revokeObjectURL` pattern; this is consistent with the codebase.

---

### Pattern 6: Segment-Boundary Detection via `timeupdate`

```typescript
const offsets = [0.0, 5.7, 12.3] // seconds; returned from backend

audioRef.current!.addEventListener('timeupdate', () => {
  const t = audioRef.current!.currentTime
  // Find which segment we're in
  let active = 0
  for (let i = offsets.length - 1; i >= 0; i--) {
    if (t >= offsets[i]) { active = i; break }
  }
  setActivePersona(active) // 0=Kent, 1=Finch, 2=Chen
})
```

`timeupdate` fires 4–66 times per second. At segment boundaries this is precise enough for the "Now playing" label update. No MediaSource extensions or chapter markers needed — those are for streaming, not pre-buffered blob audio.

**Confidence:** HIGH — standard HTML5 audio pattern, well-documented in MDN.

---

### Pattern 7: Backend Offset Calculation

Offsets in seconds are calculated from the stitched byte lengths using the CBR formula:

```python
CBR_BITRATE_KBPS = 128  # mp3_44100_128
SILENCE_DURATION_S = 0.7

def bytes_to_seconds(n_bytes: int) -> float:
    return (n_bytes * 8) / (CBR_BITRATE_KBPS * 1000)

kent_duration = bytes_to_seconds(len(kent_bytes))
finch_offset = kent_duration + SILENCE_DURATION_S
finch_duration = bytes_to_seconds(len(finch_bytes))
chen_offset = finch_offset + finch_duration + SILENCE_DURATION_S

offsets = [0.0, finch_offset, chen_offset]
```

CBR means the bitrate-to-time formula is exact. This is the only path that avoids parsing MP3 frames. It is reliable because all providers (fake and ElevenLabs) produce `mp3_44100_128` CBR. The formula becomes unreliable only with VBR, which is explicitly excluded by project decisions.

**Confidence:** HIGH — CBR math is deterministic. The fake fixtures (80,666 bytes each) calculate to `80666 * 8 / 128000 = 5.042s` each, which matches the 5-second ffmpeg target.

---

### Pattern 8: Silence Pad Asset

The 700ms silence pad is NOT shipped in Phase 13 (confirmed by codebase inspection — `backend/app/services/tts/fixtures/` only contains the three tone MP3s). Phase 14 must generate and commit it:

```bash
ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 0.7 -b:a 128k -f mp3 \
  backend/app/services/tts/fixtures/silence_700ms.mp3
```

Expected size: `0.7 × 128000 / 8 = 11,200 bytes` (~11 KB). This file is committed as a binary asset, read at module import time alongside the fixture tones.

The stitching function:

```python
silence = (_FIXTURES / "silence_700ms.mp3").read_bytes()

def stitch(kent: bytes, finch: bytes, chen: bytes) -> bytes:
    return kent + silence + finch + silence + chen
```

No leading pad before Kent, no trailing pad after Chen — matches PODGEN-04.

**Confidence:** HIGH — ffmpeg command derived from Phase 13's fixture generation pattern; byte-size math is deterministic CBR.

---

### Pattern 9: Cache Key Strategy

```python
import hashlib, json

def make_cache_key(game_name: str, debrief_text: str, voice_cfg: dict) -> str:
    payload = json.dumps({
        "game_name": game_name,
        "text": debrief_text,
        "voices": voice_cfg,  # {kent: voice_id, finch: voice_id, chen: voice_id}
    }, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()
```

Cache storage: `app.state.podcast_cache: dict[str, bytes]` — a plain dict on app state. No eviction needed for Phase 14 (single session, small MP3 size ~500 KB for a typical 3×3 min debrief). Re-generate bypasses cache by deleting the cache key before re-running synthesis.

**Why no `functools.lru_cache`:** lru_cache works on function arguments, but the cache key here is a compound of three fields. A plain dict keyed by SHA256 hex is simpler and gives explicit control over invalidation.

**Why not file system:** The project deploys to a single Windows Server process. File system cache adds OS-level concerns (permissions, cleanup, concurrent access). In-memory dict is sufficient for Phase 14 scope (one process, one facilitator at a time). Phase 16 can revisit if multi-process deployment is considered.

**Confidence:** HIGH — hashlib SHA256 is stdlib, plain dict is the simplest viable approach.

---

### Pattern 10: Client Cancel with AbortController

```typescript
const abortController = useRef<AbortController | null>(null)

const handleGenerate = async () => {
  abortController.current = new AbortController()
  try {
    const response = await fetch('/api/debrief/podcast', {
      method: 'POST',
      signal: abortController.current.signal,
      // ...
    })
    // read SSE stream from response.body
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      // cancelled — reset UI silently
    }
  }
}

const handleCancel = () => {
  abortController.current?.abort()
  // Reset UI to pre-generation state
}
```

**Backend disconnect detection:** When the client aborts, the TCP connection closes. The backend SSE generator must check `await request.is_disconnected()` between persona iterations to bail out:

```python
async def generator():
    for persona_name, text, voice_id in personas:
        if await request.is_disconnected():
            return  # abort — don't yield any more events
        audio_bytes = await run_in_threadpool(provider.synthesise, text, voice_id)
        completed[persona_name] = audio_bytes
        yield ServerSentEvent(event="persona_done", data=...)
```

**Critical limitation:** `request.is_disconnected()` is checked BETWEEN persona calls, not DURING the `run_in_threadpool` call. A `time.sleep(2.0)` inside `FakeTTSProvider.synthesise` cannot be interrupted mid-sleep by disconnect detection. The `run_in_threadpool` wraps the sync call in a thread; there is no cooperative cancellation mechanism for threads in Python. This means cancellation takes effect AFTER the current persona's synthesis completes — it will not abort mid-segment. For the fake provider (2s delay), the worst case is the user waits 2 more seconds after clicking Cancel. This is acceptable for Phase 14. Phase 16 can extend with a cancellation event or shorter polling if needed.

The Phase 13 base.py docstring explicitly states: "The Phase-14 audio_generator orchestrator will wrap provider calls in `starlette.concurrency.run_in_threadpool`." This is confirmed as the prescribed approach.

**Confidence:** MEDIUM — `request.is_disconnected()` is documented in FastAPI discussions (confirmed working on uvicorn). The mid-thread non-cancellability is a known Python threading limitation.

---

### Pattern 11: Client-Side Filename Generation

The CONTEXT.md decision: timestamp = local time at Generate click. This requires the client to know the local time (not UTC). `toISOString()` returns UTC. Therefore the filename timestamp must be built from `Date` local methods:

```typescript
function buildMp3Filename(gameName: string, clickedAt: Date): string {
  const kebab = gameName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')    // strip non-[a-z0-9\s-]
    .replace(/\s+/g, '-')             // spaces → hyphens
    .replace(/-+/g, '-')              // collapse runs
    .replace(/^-|-$/g, '')            // trim edges
    || 'session'                      // empty fallback

  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${clickedAt.getFullYear()}-${pad(clickedAt.getMonth()+1)}-${pad(clickedAt.getDate())}-${pad(clickedAt.getHours())}${pad(clickedAt.getMinutes())}`

  return `debrief-${kebab}-${ts}.mp3`
}
```

Note: the CONTEXT.md kebab spec says "strip non-`[a-z0-9-]`" after lowercasing. This differs slightly from `debriefExporter.toKebabFilename()` which also allows `\s` before the spaces→hyphens pass. The Phase 14 MP3 spec is stricter — strip BEFORE the space→hyphen substitution isn't quite right; the safe reading is: lowercase → replace spaces with hyphens → strip any remaining non-`[a-z0-9-]` → collapse runs. The planner should align this precisely with CONTEXT.md; the above function implements the stricter spec.

The existing `buildDebriefFilename` / `toKebabFilename` in `debriefExporter.ts` use `new Date().toISOString()` (UTC). The MP3 filename must use local time — this is a new utility function, not a reuse of the existing one.

**Confidence:** HIGH — client-side date formatting is deterministic; the kebab logic is straightforward.

---

### Pattern 12: Word-Count Dialog — Estimation Formulas

**Spoken audio minutes:**
- Speaking rate: 150 wpm (podcast narration midpoint; multiple authoritative sources agree on 150–160 wpm for podcast hosts).
- Formula: `Math.ceil(wordCount / 150)` minutes (rounded up).

**FakeTTSProvider render seconds:**
- The fake provider does `time.sleep(delay_seconds)` per persona call. Default `FAKE_TTS_DELAY_SECONDS=2.0`.
- Three personas = `3 × delay_seconds` seconds, plus negligible concat time.
- Formula (client-side, using a constant): `Math.ceil(3 * FAKE_TTS_DELAY_SECONDS)` seconds.
- The problem: the client doesn't know `FAKE_TTS_DELAY_SECONDS` unless the backend returns it or the frontend hardcodes it. Options:
  a. Backend returns it in the word-count pre-flight response (a separate `GET /api/debrief/podcast/estimate?word_count=N` endpoint).
  b. Frontend uses a hardcoded estimate (e.g., "~6 seconds" for fake, "~60 seconds" for real).
  c. Frontend sends word_count in the generate request body and backend returns estimated_seconds in a pre-validate call.
  
  **Recommendation:** add `estimated_generation_seconds` to the backend's podcast request validation (a light pre-flight `POST /api/debrief/podcast/estimate` returning `{audio_minutes: N, generation_seconds: M}`). This keeps the dialog numbers accurate across TTS provider changes and `FAKE_TTS_DELAY_SECONDS` overrides. However, if the planner wants to keep this simple, a hardcoded client-side formula is acceptable for Phase 14 (only fake provider runs in this phase).

**Confidence:** HIGH for the 150 wpm formula (multiple authoritative sources). MEDIUM for the generation time formula (fake is deterministic; real ElevenLabs timing is variable and only relevant in Phase 16).

---

### Pattern 13: React Component Decomposition

Based on CONTEXT.md's player layout, the existing codebase patterns (no `cn` utility, array join for classes, Tailwind 4 tokens, Zustand 5), and the 15 requirements:

```
PodcastSection (orchestrator — lives in FacilitatorInput area or ChatFeed bottom)
├── WordCountConfirmDialog (modal, shown before generation if words > 2000)
├── RegenerateConfirmDialog (modal, shown before re-generate)
├── GenerationPanel (visible DURING generation)
│   ├── PersonaStatusRow × 3 (Kent ✓ / Finch rendering… / Chen waiting)
│   ├── ProgressBar (0 → 33% → 66% → 100%)
│   └── CancelButton
├── PodcastPlayer (visible AFTER generation)
│   ├── NowPlayingLabel ("Now playing: Kent")
│   ├── <audio ref={audioRef} controls />
│   ├── SkipButtonRow (Kent | Finch | Chen — active one visually distinct)
│   └── DownloadMp3Button (or this belongs in ActionToolbar — see note)
└── TranscriptPanel (collapsible, collapsed by default)
    └── transcript text in <pre> or styled div
```

**Notes on the decomposition:**

1. `PodcastSection` renders into the `FacilitatorInput` area below the `ActionToolbar`, NOT into `ChatFeed`. This keeps the podcast surface separate from the game message feed. The `ActionToolbar` holds the Generate Podcast button (PODGEN-01: "adjacent to Download Debrief (.md)").

2. The "Generate Podcast" button lives in `ActionToolbar.tsx` alongside "Download Debrief (.md)". It is conditionally rendered when `hasDebrief === true` (same guard as the download button). Clicking it triggers state in a local hook or store slice.

3. `DownloadMp3Button` — CONTEXT.md says it lives in the existing `ActionToolbar`, not inside the player. This means `ActionToolbar` gains a third conditional button: `Generate Podcast` (before audio exists) → replaced by `Download MP3` + `Re-generate` (after audio exists).

4. `<audio>` element: use a `ref` (not a controlled prop for `src`) to avoid React re-rendering the audio element on state changes. Set `audioRef.current.src = blobUrl` imperatively after blob creation.

5. `GenerationPanel` and `PodcastPlayer` are mutually exclusive — the store tracks `podcastStatus: 'idle' | 'generating' | 'done' | 'error'`. Only one panel is rendered at a time.

6. The two dialog components are pure modal overlays — they don't need to be children of the component that owns the audio; they can be portaled or inline.

7. `TranscriptPanel` uses the markdown string from `generateDebriefMarkdown()` (already available via the existing debrief flow). Render it in a `<pre className="whitespace-pre-wrap text-sm ...">` or a `<div dangerouslySetInnerHTML>` with markdown converted to HTML. Since there is no `react-markdown` in the project and the REQUIREMENTS say "existing markdown rendering path," the safest rendering is `<pre>` with the raw markdown string. This is consistent with how the current system renders debrief content to users (the markdown download IS the debrief; there's no in-app rich render currently). The planner should confirm this interpretation.

8. No Zustand store slice is strictly required — a single `usePodcast` hook managing local state (status, blobUrl, offsets, activePersona, abortController ref) may be sufficient. If re-generate or cross-component access is needed, a lightweight store slice is the right call. The planner decides based on whether the ActionToolbar and the PodcastSection need to share podcast state.

**Confidence:** MEDIUM — the decomposition is derived from CONTEXT.md decisions and codebase patterns, but the exact file boundaries (which components get separate files, whether to use a local hook or store slice) are discretionary.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE endpoint | Custom chunked response parser | FastAPI `EventSourceResponse` (built-in 0.135.0+) | Already available in the installed version; handles keep-alive pings, Cache-Control, X-Accel-Buffering headers automatically |
| Binary duration calculation | ffprobe/mutagen frame parser | CBR bitrate formula (`bytes * 8 / bitrate`) | All audio is CBR 128 kbps by project contract; formula is exact |
| Silence pad generation at runtime | Python wave/audio synthesis | Pre-committed ffmpeg binary (7-line ffmpeg command) | Runtime ffmpeg dependency was explicitly rejected in Phase 13; commit the binary |
| Blob URL lifecycle | Custom reference counting | `URL.createObjectURL` + `URL.revokeObjectURL` in `useEffect` cleanup | Exact pattern already used in `debriefExporter.ts:downloadDebrief()` |
| In-memory cache | Redis/SQLite | Plain `dict` on `app.state` | Single-process deployment; over-engineering is rejected by project YAGNI principle |
| Markdown rich rendering | Installing `react-markdown` | `<pre>` element with raw markdown string | No markdown library is in `package.json`; installing one is out of scope |
| Filename kebab utility | New library | Inline regex (20 lines) mirroring existing `toKebabFilename` | Pattern established in `debriefExporter.ts` |

**Key insight:** The CBR formula eliminates the need for any MP3 parsing library. The Phase 13 fixture format invariant (`mp3_44100_128` CBR) was specifically chosen to enable this.

---

## Common Pitfalls

### Pitfall 1: Using `EventSource` API for POST-based SSE
**What goes wrong:** `EventSource` is GET-only by the browser spec. `new EventSource('/api/debrief/podcast')` will fail because the endpoint requires a POST body.
**How to avoid:** Use `fetch()` + `response.body.getReader()` to consume the SSE stream from a POST endpoint. Parse SSE lines manually (split on `\n\n`, extract `event:` and `data:` prefixes). A 20-line parser suffices.
**Warning signs:** 405 Method Not Allowed errors or missing request body on the backend.

### Pitfall 2: VBR MP3 Audio Seeking Breaks Offset Calculation
**What goes wrong:** If any provider returns VBR MP3, the CBR bitrate formula produces wrong offsets. ElevenLabs may return VBR in some configurations.
**How to avoid:** The Phase 13 decision locks `ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128` which is CBR. Assert in tests that stitched bytes are non-zero and offsets are positive. Phase 16 listen-through is the empirical verification gate for real ElevenLabs output.
**Warning signs:** Skip buttons land at wrong times when tested with real ElevenLabs audio in Phase 16.

### Pitfall 3: Audio Seeking Before Buffer is Ready
**What goes wrong:** Setting `audio.currentTime` immediately after setting `src` (before `canplay` or `canplaythrough` fires) may silently fail or snap back to 0.
**How to avoid:** Only expose skip buttons after the `canplay` event fires on the `<audio>` element. Set a `canPlay` boolean in component state, disable skip buttons until `true`.
**Warning signs:** `audio.currentTime` reads as `NaN` or returns to 0 immediately after setting.

### Pitfall 4: Blob URL Not Revoked on Re-generate
**What goes wrong:** Each generate creates a new Blob URL. If the old URL is not revoked before the new one is created, the browser leaks memory across re-generates.
**How to avoid:** In the re-generate flow: (1) revoke old blobUrl, (2) null out state, (3) run generation, (4) set new blobUrl. The `useEffect` cleanup handles unmount, but re-generate within the same mount must be handled explicitly.
**Warning signs:** Memory usage grows with each re-generate in long facilitator sessions.

### Pitfall 5: `run_in_threadpool` Does Not Cancel Mid-Sleep
**What goes wrong:** When the client aborts and the backend detects `request.is_disconnected()`, it can only stop BETWEEN persona calls. If `FakeTTSProvider.synthesise` is sleeping (2s default), the server thread sleeps through the abort signal.
**How to avoid:** Accept this limitation for Phase 14 (max 2s delay). Set `FAKE_TTS_DELAY_SECONDS=0` in all backend tests. Document the limitation in comments.
**Warning signs:** Cancel button appears to have a 0–2 second lag before the UI resets (this is expected behavior in Phase 14).

### Pitfall 6: Using UTC Timestamp for MP3 Filename
**What goes wrong:** `new Date().toISOString()` returns UTC. If the facilitator is in AEST (UTC+10) and generates at 3pm local, the file gets timestamped as 05:00 (the previous day in ISO UTC). This is confusing.
**How to avoid:** Use local `Date` methods (`getFullYear()`, `getMonth()`, `getDate()`, `getHours()`, `getMinutes()`) for the MP3 timestamp — exactly as CONTEXT.md specifies. Do NOT reuse `buildDebriefFilename()` from `debriefExporter.ts` (it uses UTC via `toISOString()`).
**Warning signs:** Downloaded MP3 timestamps don't match wall-clock time at generation.

### Pitfall 7: Registering the Debrief Router Before or After SPA Catch-All
**What goes wrong:** `main.py` registers routes in order; the SPA catch-all `SPAStaticFiles` is last. The new `/api/debrief/podcast` router MUST be registered before the SPA mount (same pattern as `llm`, `health`, `config_gen`).
**How to avoid:** Add `app.include_router(debrief.router)` alongside the existing three router registrations, before the `if os.path.isdir(_dist_dir)` block.
**Warning signs:** API calls to `/api/debrief/podcast` return `index.html` (200 with HTML body instead of JSON/SSE).

### Pitfall 8: Token Slot Leaks if Client Never Fetches Audio
**What goes wrong:** If the SSE stream completes, the server writes the audio to `app.state.podcast_tokens[token]`, but the client crashes or navigates away before fetching. The bytes leak in-process memory indefinitely.
**How to avoid:** Implement a simple TTL eviction: on each `GET /audio` call OR on a periodic check (e.g., via a background task in lifespan), sweep entries older than 60 seconds. For Phase 14 scope (fake provider, ~80KB × 3 = ~240KB per token entry), this is low priority but should be implemented for correctness.
**Warning signs:** Server memory grows over multiple game sessions in long facilitator workshops.

---

## Code Examples

### FastAPI SSE Endpoint (Verified Pattern from Official Docs)

```python
# Source: https://fastapi.tiangolo.com/tutorial/server-sent-events/
# FastAPI 0.135.0+

from fastapi.sse import ServerSentEvent, EventSourceResponse
from starlette.concurrency import run_in_threadpool

@router.post("/api/debrief/podcast", response_class=EventSourceResponse)
async def generate_podcast(body: PodcastRequest, request: Request):
    async def generator():
        for persona_name, text, voice_id in personas:
            if await request.is_disconnected():
                return
            audio_bytes = await run_in_threadpool(provider.synthesise, text, voice_id)
            yield ServerSentEvent(
                event="persona_done",
                data=json.dumps({"persona": persona_name})
            )
        # assemble + store
        token = store_audio(stitched)
        yield ServerSentEvent(
            event="done",
            data=json.dumps({"token": token, "offsets": offsets})
        )
    return EventSourceResponse(generator())
```

### Client SSE Consumer (Fetch + Manual Parser)

```typescript
// Source: MDN Streams API + community patterns (verified fetch+SSE pattern)

async function consumeSSE(
  url: string,
  body: object,
  signal: AbortSignal,
  onEvent: (event: string, data: string) => void
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop()!
    for (const part of parts) {
      const eventLine = part.match(/^event: (.+)$/m)?.[1] ?? 'message'
      const dataLine = part.match(/^data: (.+)$/m)?.[1] ?? ''
      onEvent(eventLine, dataLine)
    }
  }
}
```

### CBR Duration Calculation

```python
# Source: CBR MP3 bitrate formula — deterministic, no library needed
CBR_BITRATE = 128_000  # bits per second (mp3_44100_128)

def bytes_to_seconds(n: int) -> float:
    return (n * 8) / CBR_BITRATE

# For stitched audio segment offsets:
offsets = [0.0]
offsets.append(bytes_to_seconds(len(kent_bytes)) + 0.7)   # finch start
offsets.append(offsets[1] + bytes_to_seconds(len(finch_bytes)) + 0.7)  # chen start
```

### HTMLMediaElement Mock for jsdom Tests

```typescript
// Source: Community pattern — jsdom does not implement HTMLMediaElement
// Add to src/test/setup.ts or per-test beforeEach

Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
  configurable: true,
  get() { return () => {} },
})
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  configurable: true,
  get() { return () => Promise.resolve() },
})
Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  get() { return () => {} },
})
// currentTime is readable/writable by default in jsdom — no mock needed
```

---

## Backend Test Strategy

### Unit Tests (pytest + FastAPI TestClient)

1. **Audio generator orchestrator** (`test_audio_generator.py`):
   - Mock `TTSProvider` with a zero-delay fake. Assert output bytes = `kent + silence + finch + silence + chen`.
   - Assert offsets array length = 3, offset[0] == 0.0, offset[1] > 0, offset[2] > offset[1].
   - Assert cache hit returns same bytes without calling `provider.synthesise` again.
   - Assert re-generate (force_fresh=True) calls `provider.synthesise` again.

2. **SSE endpoint** (`test_debrief_podcast.py`):
   - Use `TestClient` (synchronous) with `stream=True` to consume the SSE response.
   - Assert three `persona_done` events fire in Kent→Finch→Chen order.
   - Assert `done` event contains `token`, `offsets` (list of 3 floats), `word_count`.
   - Test word_count > 2000 path: backend should not reject it (the dialog is client-side); endpoint accepts any word count.
   - Test disconnect: abort the request mid-stream (more complex — may need `httpx.AsyncClient` + cancel). This test may be LOW priority for Phase 14 and deferred.

3. **Audio token endpoint** (`test_debrief_podcast.py`):
   - Pre-populate `app.state.podcast_tokens[token] = bytes`. Assert GET returns `200 audio/mpeg` with correct body.
   - Assert second GET with same token returns `404` (token consumed on first fetch).

**TestClient streaming pattern:**

```python
from fastapi.testclient import TestClient

with TestClient(app) as client:
    with client.stream("POST", "/api/debrief/podcast", json=body) as response:
        events = []
        for line in response.iter_lines():
            if line.startswith("event:"):
                events.append(line)
        assert "persona_done" in events[0]
```

**Confidence:** MEDIUM — TestClient streaming is documented but has quirks. The `iter_lines()` approach for SSE event parsing in tests is LOW confidence; the planner should prototype this and fall back to collecting raw text if needed.

---

## Frontend Test Strategy

### jsdom Tests (Vitest + Testing Library)

jsdom does NOT implement `HTMLMediaElement.prototype.load`, `.play()`, `.pause()`, or real audio decoding. Key constraints:

- `audio.src = blobUrl` works (jsdom accepts it) but does NOT trigger `canplay`, `loadedmetadata`, etc.
- `audio.currentTime = N` can be set and read, but no actual seeking occurs.
- `URL.createObjectURL` has a known Vitest v4 + jsdom mismatch (`Blob` constructor conflict — GitHub issue vitest#8917 as of 2026).

**Workaround for Vitest v4 + jsdom Blob issue:**

```typescript
// In test setup or beforeEach:
// Option A: Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Option B: If the Blob mismatch persists, mock the audio fetch entirely
vi.mock('@/lib/podcastClient', () => ({
  generatePodcast: vi.fn().mockResolvedValue({
    blobUrl: 'blob:mock-url',
    offsets: [0.0, 5.0, 10.5],
  })
}))
```

**What to test with jsdom:**

- `PodcastSection` renders the Generate button when `hasDebrief === true`.
- Clicking Generate with word_count > 2000 renders the `WordCountConfirmDialog`.
- Clicking Cancel in dialog does not start generation.
- Clicking Generate (word_count ≤ 2000) triggers the API call mock.
- While `status === 'generating'`, shows `GenerationPanel` not `PodcastPlayer`.
- While `status === 'done'`, shows `PodcastPlayer` with audio element.
- Skip button click sets `audio.currentTime` to the correct offset.
- Re-generate button shows `RegenerateConfirmDialog`.
- Cancel button during generation calls `abortController.abort()`.
- Transcript toggle expands/collapses the panel.

**What NOT to test with jsdom (use Playwright instead):**

- Actual audio playback (blob loads, canplay fires, timeupdate fires).
- "Now playing" label updating at real segment boundaries.
- Real file download via anchor.click().

### Playwright Tests (E2E)

Playwright runs against a real Chromium with fake audio. Configure:

```typescript
// playwright.config.ts
use: {
  launchOptions: {
    args: ['--autoplay-policy=no-user-gesture-required']
  }
}
```

Key E2E scenarios:

1. **Happy path:** Click Generate → three persona events fire (check status text updates) → audio element appears → audio `src` is a blob URL → play/pause works → Skip Kent sets `currentTime` to 0 → Skip Finch sets to offset[1].
2. **Cancel mid-generation:** Click Generate → click Cancel before `done` event → Generate button reappears.
3. **Download MP3:** After generation, click Download MP3 → browser download occurs with correct filename pattern.
4. **Word-count dialog:** Inject a game with >2000 word debrief → click Generate → dialog appears → click Cancel → no generation starts.

**Note:** Playwright can interact with `audio.currentTime` via `page.evaluate()`:

```typescript
const currentTime = await page.evaluate(() => {
  const audio = document.querySelector('audio')
  return audio?.currentTime
})
```

This is the recommended verification for skip-to-persona functionality.

**Confidence:** MEDIUM for jsdom tests (Blob URL mock path is necessary due to Vitest v4 issue). HIGH for Playwright approach (real browser, real audio element APIs).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sse-starlette` third-party package | FastAPI native `EventSourceResponse` | FastAPI 0.135.0 (2024) | No new dependency needed for SSE |
| MediaSource Extensions for audio segments | Pre-stitched blob URL with `timeupdate` | N/A (simpler use case) | Avoids MSE complexity for a fully-buffered use case |
| `functools.lru_cache` on route function | Plain `dict` on `app.state` | N/A (design choice) | Explicit key control and invalidation |
| WebSocket for progress | SSE sidecar | N/A (design choice) | No WebSocket dependency; fetch-native |

---

## Open Questions

1. **Where does `PodcastSection` physically mount in the UI?**
   - What we know: CONTEXT.md says "Generate Podcast" button goes in `ActionToolbar` adjacent to "Download Debrief (.md)". The player/progress panel goes somewhere below the chat feed or in the facilitator input area.
   - What's unclear: Does `PodcastSection` live inside `FacilitatorInput` (below `ActionToolbar`) or inside `ChatFeed` (below messages) or as a separate sibling in `GameScreen`?
   - Recommendation: Place it inside `FacilitatorInput` below `ActionToolbar`, wrapped in a conditional `{hasDebrief && <PodcastSection />}`. This keeps all facilitator-control surfaces in one area.

2. **Does "existing markdown rendering path" mean `<pre>` or something richer?**
   - What we know: No markdown library is in `package.json`. The existing debrief export produces `.md` files, not rendered HTML. There is no React Markdown component in the codebase.
   - What's unclear: Should the transcript use a `<pre>` (raw markdown) or a simple regex-based stripper (strip `**`, `#`, etc.)?
   - Recommendation: `<pre className="whitespace-pre-wrap ...">` with the raw markdown string. This is the "existing path" — the system has never rendered markdown in the browser, only downloaded it.

3. **Token slot eviction: background task or lazy sweep?**
   - What we know: FastAPI lifespan supports background tasks. `asyncio.create_task` can run periodic sweeps.
   - What's unclear: Whether Phase 14 needs an actual sweeper or whether the single-session nature makes this a non-issue.
   - Recommendation: Implement a simple lazy sweep: on each `GET /audio` request, scan `app.state.podcast_tokens` and evict entries older than 60 seconds. Use a `dict[str, tuple[bytes, float]]` where the float is `time.time()` at insertion.

4. **SSE POST reconnect suppression:**
   - What we know: The browser `EventSource` API auto-reconnects. Since this uses `fetch` + manual SSE parsing (not `EventSource`), auto-reconnect is not an issue.
   - What's unclear: If the SSE stream drops mid-generation (network hiccup), should the client retry? 
   - Recommendation: No retry for Phase 14. If the stream drops, the client shows an error banner and the user can re-generate. Retry logic is Phase 15/16 scope.

---

## Sources

### Primary (HIGH confidence)
- FastAPI official docs — Server-Sent Events: https://fastapi.tiangolo.com/tutorial/server-sent-events/ — EventSourceResponse pattern, version 0.135.0+
- MDN — HTMLAudioElement: https://developer.mozilla.org/en-US/docs/Web/API/HTMLAudioElement — `currentTime`, `timeupdate`, blob URL support
- MDN — Using Readable Streams: https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams — fetch + ReadableStream for SSE consumption
- Codebase inspection: `backend/app/services/tts/base.py` — `run_in_threadpool` prescribed for Phase 14
- Codebase inspection: `src/lib/debriefExporter.ts` — `URL.createObjectURL` pattern, `toKebabFilename`, UTC vs local time
- Codebase inspection: `src/styles/index.css` — design tokens, animation patterns
- Codebase inspection: `src/components/game/FacilitatorInput/ActionToolbar.tsx` — where Generate button will live
- Codebase inspection: `backend/app/main.py` — router registration order, `app.state` usage

### Secondary (MEDIUM confidence)
- Marcelo Trylesinski blog (FastAPI core maintainer): https://marcelotryle.com/blog/2024/06/06/understanding-client-disconnection-in-fastapi/ — `request.is_disconnected()` + anyio task group pattern
- FastAPI GitHub discussion #7572 — `request.is_disconnected()` in StreamingResponse generators (confirmed working with uvicorn)
- LogRocket blog — Building audio player in React: https://blog.logrocket.com/building-audio-player-react/ — `audioRef`, `timeupdate`, `useEffect` cleanup
- VirtualSpeech — Average Speaking Rate: https://virtualspeech.com/blog/average-speaking-rate-words-per-minute — 150–160 wpm for podcasts
- Vitest GitHub issue #8917 — URL.createObjectURL Blob mismatch in Vitest v4 + jsdom (2025)

### Tertiary (LOW confidence)
- copyprogramming.com — Chrome HTML5 audio seeking with blob URLs (2026 features) — seek behavior confirmed for CBR; source is low authority but consistent with MDN
- Playwright mock browser APIs page — HTMLMediaElement mocking via `addInitScript` is possible but not specifically documented for audio elements

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components are in the existing package.json or stdlib; no new installs verified
- Architecture (SSE sidecar): MEDIUM — official FastAPI SSE is HIGH; the POST-based SSE consumer pattern is MEDIUM (verified by MDN + community but no official end-to-end example)
- Blob URL audio: HIGH — MDN confirmed, CBR math is deterministic
- Cancel detection: MEDIUM — `request.is_disconnected()` works but mid-thread non-cancellability is a known limitation
- Component decomposition: MEDIUM — derived from CONTEXT.md + codebase inspection; file structure is discretionary
- Test strategy: MEDIUM — jsdom Blob mismatch is a known active issue; workarounds are community-derived

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (FastAPI SSE API is stable post-0.135.0; browser audio behavior is very stable)
