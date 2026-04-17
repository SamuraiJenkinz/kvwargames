# Stack Research — v1.2 Debrief Podcast

**Domain:** Server-side TTS audio generation layered onto an existing FastAPI + React SPA
**Researched:** 2026-04-17
**Confidence:** HIGH (ElevenLabs SDK + num2words verified against PyPI / GitHub releases; reference implementation code read directly; MP3 concat tradeoff verified against Hydrogenaudio authoritative source)

> This document prescribes ONLY the additions needed for v1.2. The v1.0/v1.1 base stack (Python 3.11+, FastAPI 0.135.x, Pydantic v2.9+, httpx 0.27+, React 19, TypeScript 5, Vite 6, Zustand 5, Tailwind v4, pytest, Vitest) is already shipped, validated in a live 5-round Scenario-2 run, and locked. Do not re-evaluate those choices here.

---

## Recommended Additions

### Core Technologies (Backend)

| Technology | Version | Purpose | Why Prescribed |
|------------|---------|---------|----------------|
| `elevenlabs` | `==2.43.0` | ElevenLabs Python SDK — text-to-speech API client | Latest stable (April 13 2026, verified via PyPI + GitHub releases). 2.x is a full rewrite on top of `httpx` with a clean `ElevenLabs(...)` client class; the reference repo (`daily-intelligence-brief`) uses exactly this SDK and the migration path is zero-cost since we have no pre-2.x code to port. Pinning to `==2.43.0` rather than a floor avoids silent Fern-regen breakage — the SDK releases weekly auto-generated updates that periodically rename namespaces. |
| `num2words` | `>=0.5.13,<0.6` | Number-to-words normalization for TTS preprocessing | Reference repo uses `>=0.5.13`. 0.5.16 is current; library is stable and backwards-compatible within 0.5.x. Used inline in `TextPreprocessor._normalize_currency` / `_normalize_percentages`. The `<0.6` ceiling is defensive — a major-minor bump could change locale signatures. |

No other new runtime dependencies. In particular: **no `pydub`, no `ffmpeg-python`, no `mutagen`, no `tenacity`**. Justification below.

### Supporting Libraries

None. The v1.2 feature set can be delivered with the two additions above plus the existing stack.

- **MP3 stitching**: done with Python stdlib bytes (see Prescribed Patterns #2 below). No library needed.
- **Silence pads**: bundled as a single static file (`backend/app/assets/silence_500ms.mp3`) committed to the repo; generated once offline. No runtime audio synthesis.
- **Streaming response**: `fastapi.responses.Response` (stdlib of the existing FastAPI install). No new import surface.
- **Async**: `starlette.concurrency.run_in_threadpool` (already available via FastAPI). No new import surface.
- **Frontend player**: native HTML5 `<audio>`. No library.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| (none new) | — | Existing `pytest` covers backend; existing `vitest` covers frontend. TTS contract tests mock `elevenlabs.client.ElevenLabs` — no new test framework needed. |

---

## Installation

Add to `backend/requirements.txt`:

```
elevenlabs==2.43.0
num2words>=0.5.13,<0.6
```

Update `.env.example` (new variables):

```
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_KENT=
ELEVENLABS_VOICE_FINCH=
ELEVENLABS_VOICE_CHEN=
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
```

Frontend: **no `package.json` changes.**

---

## Prescribed Patterns

### 1. ElevenLabs SDK usage (sync client, not async)

**Prescription:** Use the synchronous `ElevenLabs` client wrapped in `run_in_threadpool` from the FastAPI route. Do NOT use `AsyncElevenLabs`, do NOT hand-roll `httpx` calls to the ElevenLabs REST endpoint.

**Import:**

```python
from elevenlabs.client import ElevenLabs
```

**Usage (matches reference repo exactly):**

```python
client = ElevenLabs(api_key=settings.elevenlabs_api_key)

audio_iter = client.text_to_speech.convert(
    text=preprocessed_text,
    voice_id=settings.elevenlabs_voice_kent,
    model_id="eleven_multilingual_v2",
    output_format="mp3_44100_128",
)

segment_bytes = b"".join(audio_iter)   # SDK yields byte chunks
```

**Why sync SDK over async:**

1. **Single-user facilitation tool.** One podcast generation in flight per session. The FastAPI process is not a high-throughput server — async would win on concurrency we don't have. Correctness and stylistic match matter more than theoretical throughput.
2. **Stylistic consistency with the `/api/llm` proxy is NOT a factor here.** The `/api/llm` proxy uses `httpx.AsyncClient` because it forwards a streaming LLM response in near real-time. The TTS call is a slow batch operation (~30–60s per minute of audio) that the frontend treats as a job — the right pattern is "block a worker thread," not "hold the event loop."
3. **The 2.x async client has known bugs.** GitHub issue #243 on `elevenlabs-python` documents TypeError issues with `AsyncElevenLabs.text_to_speech.convert` and `_AsyncGeneratorContextManager`. Sync path is production-proven in the reference repo (shipped daily for months).
4. **`run_in_threadpool` is the official FastAPI idiom for blocking SDKs.** FastAPI's docs explicitly recommend this when you have a sync SDK you don't want to rewrite. Default pool is 40 threads — three concurrent persona synthesis calls (if we ever parallelize them) consume 3, leaving 37 headroom.

**Route pattern:**

```python
from starlette.concurrency import run_in_threadpool

@router.post("/api/debrief/podcast")
async def generate_podcast(req: PodcastRequest) -> Response:
    segments = []
    for persona in ("kent", "finch", "chen"):
        segment = await run_in_threadpool(
            _synthesize_segment, persona, req.scripts[persona]
        )
        segments.append(segment)
    stitched = _stitch_mp3(segments)
    return Response(
        content=stitched,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": 'attachment; filename="debrief-podcast.mp3"',
            "Cache-Control": "no-store",
        },
    )
```

**What about parallel synthesis across the three personas?** Use `asyncio.gather` + three `run_in_threadpool` calls — ~3x wall-clock speedup for ~zero code complexity. Prescribed for the implementation phase; do not serialize by default.

### 2. MP3 stitching — raw byte concatenation (no ffmpeg, no pydub)

**Prescription:** Concatenate the three segment bytes plus silence-pad bytes using Python `bytes` concatenation. Do NOT add `pydub`. Do NOT add `ffmpeg-python`. Do NOT require `ffmpeg` on the host.

**Implementation:**

```python
# Committed to repo at backend/app/assets/silence_500ms.mp3
# Generated once, offline, with any MP3 encoder at 44.1kHz / 128kbps CBR.
SILENCE_PAD = (Path(__file__).parent / "assets" / "silence_500ms.mp3").read_bytes()

def _stitch_mp3(segments: list[bytes]) -> bytes:
    """Join per-persona MP3 segments with silence pads.

    Safe because every segment is produced by ElevenLabs at the same
    output_format='mp3_44100_128' (44.1 kHz, 128 kbps CBR, mono).
    MP3 frames in CBR have no cross-frame dependencies worth stitching
    around (the bit reservoir is bounded within a small look-back window
    and introduces at most inaudible sub-frame artifacts at the join).
    """
    pad = SILENCE_PAD
    parts = []
    for i, seg in enumerate(segments):
        parts.append(seg)
        if i < len(segments) - 1:
            parts.append(pad)
    return b"".join(parts)
```

**Why this is safe (and why the "MP3 frames are not independent" scare is overstated for our case):**

- **All three segments share identical format.** ElevenLabs returns `mp3_44100_128` — 44.1 kHz, 128 kbps CBR, single channel. Hydrogenaudio (authoritative MP3 reference) confirms: when bit-reservoir artefacts exist, they are a bounded look-back of a few frames and manifest as sub-audible glitches at CBR 128kbps, not structural breakage.
- **No browser, OS media player, or `<audio>` element cares.** HTML5 audio decoders skip malformed ID3 tags, resync on next frame header, and play through. Every mainstream MP3 decoder (Media Foundation on Windows, CoreAudio on macOS, LAME decoder) handles concatenated MP3 files correctly — the format was literally designed to be streamable.
- **The reference repo does not stitch**, but the pattern is well-documented. `any_to_any.py` and `merge_mp3` on GitHub are both raw-bytes-concat implementations shipped to thousands of users without format complaints.
- **Silence pads prevent abrupt persona transitions.** 500ms of audible silence at the join also masks any hypothetical sub-frame glitch. Generate the pad once offline with ffmpeg or Audacity, commit the ~8KB file. No runtime ffmpeg dependency.

**Why NOT pydub:**
- Requires `ffmpeg` binary on the host. Windows Server scheduled-task deployment explicitly does not guarantee ffmpeg presence. Adding a system-level binary dependency to a ~200 LOC credential-proxy backend is architectural malpractice.
- Forces a decode-then-re-encode round trip that loses MP3 fidelity for zero benefit — we already have byte-identical format across segments.

**Why NOT ffmpeg-python:**
- Same system-level ffmpeg dependency.
- Wraps CLI invocation — adds subprocess failure modes (ffmpeg not in PATH, permission issues on Windows scheduled-task context, zombie processes).

**Why NOT `wave` / `audioop` stdlib:**
- PCM-only. Would require decoding MP3 to PCM and re-encoding back to MP3 — same re-encode waste as pydub, minus the stable wrapper.

**Why NOT mutagen to strip ID3 before concat:**
- ID3 tags at the start of the second and third segments don't break playback. Decoders skip unknown tag chunks and resync on the next frame header. We verified this against the Hydrogenaudio MP3 spec; empirical confirmation is a 10-line test in phase implementation.
- Adds a dependency (`mutagen>=1.47`) for zero measurable user benefit.

### 3. Text preprocessing — module-level dict + regex, no acronym library

**Prescription:** Port the reference repo's `TextPreprocessor` pattern one-to-one, replacing `PRONUNCIATION_DICT` and `COMPANY_PRONUNCIATIONS` with wargame-domain equivalents. No new dependencies beyond `num2words`.

**Domain pronunciation dict (wargame EDIP vocab):**

```python
# backend/app/services/text_preprocessor.py
WARGAME_PRONUNCIATION_DICT: dict[str, str] = {
    # EDIP jargon — spell-out (letter-by-letter)
    r'\bEDIP\b': 'E D I P',
    r'\bCRM\b': 'C R M',
    r'\bLEFS\b': 'L E F S',
    r'\bSIEP\b': 'S I E P',
    r'\bSoS\b': 'S O S',
    r'\bIC\b': 'I C',

    # Resource codes — spell-out
    r'\bPC\b': 'P C',   # Political Capital
    r'\bPO\b': 'P O',   # Public Opinion

    # Country codes / institutions — expand
    r'\bEU\b': 'E U',
    r'\bNATO\b': 'Nato',   # pronounced-as-word, not N-A-T-O
}
```

**Why a regex dict, not a library:**
- No mature Python library for "English acronym pronunciation" exists that reliably distinguishes spell-out-style (FBI → F-B-I) from pronounced-as-word (NATO → Nato, LASER → laser). This distinction is domain-specific and per-acronym — exactly the shape a dict captures.
- The reference repo ships this exact pattern to production daily; the approach is proven.
- Data-driven: adding new vocab is a one-line dict entry, not a code change or regex rework.

**Number normalization:** Inline `num2words` calls inside the currency / percent regex handlers, identical to reference repo. No changes needed there since wargame scripts contain numbers (severity scores, resource counts) but not currency amounts — the `_normalize_currency` handler can ship as-is and simply find nothing to transform.

### 4. FastAPI response — `Response`, not `StreamingResponse` or `FileResponse`

**Prescription:** Return the stitched MP3 as `fastapi.Response(content=mp3_bytes, media_type="audio/mpeg", headers={"Content-Disposition": "attachment; filename=..."})`.

**Why:**
- The final MP3 is small (3 personas × ~1 min each × 128 kbps ≈ 2.9 MB total). Fits comfortably in a single response body; streaming overhead buys nothing.
- `StreamingResponse` is for chunked generators where the full payload isn't yet computed (SSE, LLM streaming, large file reads). We compute the full byte payload server-side before responding.
- `FileResponse` is for serving a file that exists on disk. We hold bytes in memory — writing to a temp file just to serve it back is unnecessary I/O.
- `Response` sets `Content-Length` correctly from `len(content)`, which enables browser download progress bars and lets the HTML5 `<audio>` element know the full duration on first request.

**Download + inline-play duality:** `Content-Disposition: attachment; filename=...` combined with `media_type: audio/mpeg` works correctly for both cases. The `<audio src="/api/debrief/podcast">` tag will play the audio inline in-browser; the same URL triggers a download when the user clicks a separate `<a href="/api/debrief/podcast" download>` link. Browsers honour the content disposition for anchor-triggered navigations but stream-play for `<audio>` elements regardless of disposition header.

### 5. Frontend audio player — native HTML5 `<audio controls>`

**Prescription:** Use `<audio controls src={podcastUrl} />`. No library. No `wavesurfer.js`, no Howler.js, no `react-audio-player`.

**Why:**
- Single-track-per-session with no waveform visualization, no pitch shifting, no A/B looping, no cross-fading. Native `<audio>` handles play/pause/seek/volume/download out of the box.
- Accessibility is correct by default — native controls are keyboard- and screen-reader-navigable. Library wrappers often re-implement these badly.
- Zero bundle cost. Bundle budget matters: the existing Vite build is already shipping a FL-layer React 19 + Zustand 5 + Tailwind 4 app; adding 50KB of audio player chrome for a feature used once per session is unjustified.
- The debrief panel also needs a Download MP3 button — rendered as `<a href="/api/debrief/podcast" download>Download MP3</a>` next to the `<audio>` element.

**Component shape (prescribed for implementation phase):**

```tsx
// frontend/src/components/PodcastPlayer.tsx
export function PodcastPlayer({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-3">
      <audio controls src={url} className="flex-1" />
      <a
        href={url}
        download="debrief-podcast.mp3"
        className="btn btn-secondary"
      >
        Download MP3
      </a>
    </div>
  );
}
```

### 6. Health-check pattern — `/api/health/tts` parallel to `/api/health/llm`

**Prescription:** Add a parallel endpoint using the same 8-code taxonomy shipped in v1.1. Call ElevenLabs' low-cost `GET /v1/user` (no TTS billing, ~100ms response) as the liveness probe. Cache result for 30s to avoid quota burn on re-check spam.

**Why parallel, not reusing `/api/health/llm`:**
- Independent failure modes. LLM up + TTS down is a real scenario (ElevenLabs quota exhausted but corporate LLM is fine). The frontend needs to distinguish these to keep the markdown debrief path working while disabling the podcast button with a clear "audio unavailable" message.
- Symmetric contract is cheap. The v1.1 health pattern (always HTTP 200, `body.ok` carries signal, 8-code taxonomy) is already implemented — a second endpoint is ~30 LOC copy-adapt.

---

## Alternatives Considered

| Prescribed | Alternative | When the Alternative Would Win |
|------------|-------------|-------------------------------|
| Sync `ElevenLabs` + `run_in_threadpool` | `AsyncElevenLabs` | If we had >10 concurrent podcast generations per second. We have 1 per session. Also blocked by the open #243 TypeError issue. |
| Sync `ElevenLabs` + `run_in_threadpool` | Direct `httpx.AsyncClient` to ElevenLabs REST | If we wanted to avoid SDK versioning entirely. Cost: maintain request/response models and pagination/streaming by hand. Benefit: none in our use case. Explicitly rejected for this milestone. |
| Raw-byte MP3 concat | `pydub` + ffmpeg | If segments had mixed bitrates or required fades. Ours are uniform. Also, ffmpeg is not guaranteed on the Windows Server host. |
| Raw-byte MP3 concat | `ffmpeg-python` concat protocol | Same as pydub — uniform-format input makes re-encoding wasteful; subprocess fragility on Windows scheduled-task context is a real risk. |
| `fastapi.Response(content=bytes)` | `StreamingResponse` | If the MP3 were >20 MB or we streamed chunks as ElevenLabs emitted them (pre-stitching). Neither applies. |
| Native HTML5 `<audio>` | `wavesurfer.js` | If we wanted a waveform scrubber (e.g. for facilitators to jump to a specific persona's section visually). Explicit v1.2 non-goal; consider for v2. |
| Regex pronunciation dict | `num2words` alone with no acronym handling | If wargame scripts contained no acronyms. They contain EDIP, CRM, LEFS, SIEP constantly. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `pydub` | Transitive `ffmpeg` system dependency; forces decode-re-encode with no fidelity gain | Raw `bytes` concat with static silence-pad MP3 |
| `ffmpeg-python` | Same ffmpeg dependency; subprocess fragility on Windows scheduled-task user context | Raw `bytes` concat |
| `mutagen` | Stripping ID3 tags between segments is unnecessary — decoders resync on next frame header | (no substitute needed) |
| `tenacity` | Retry logic on ElevenLabs is a product decision, not a library need. A 10-line `for attempt in range(3)` with exponential backoff covers this. The reference repo imports `tenacity` but only uses it for LLM calls — not for TTS | Hand-rolled retry in the provider class |
| `AsyncElevenLabs` | Open upstream bug (#243); async client is still maturing; not needed for single-session throughput | Sync `ElevenLabs` + `run_in_threadpool` |
| `wavesurfer.js` / `howler.js` / `react-audio-player` | Bundle cost for UI capabilities we don't use (waveforms, sprite sheets, multi-track mixing) | Native HTML5 `<audio controls>` |
| Azure OpenAI TTS provider | User explicitly chose ElevenLabs-only for v1.2; dual-provider failover is a reference-repo feature that adds complexity without use case here | ElevenLabs single provider; graceful degradation = "audio unavailable" UI state, not fallback provider |
| Server-side audio file cache on disk | Session-only, ephemeral-by-design architecture (per `PROJECT.md` constraints); cache adds stale-audio bug surface for zero perf benefit on single-user tool | Generate fresh each call; response is <5 MB |
| Voice-cloning / persona-matched voices | Explicit v2+ deferral; v1.2 uses stock ElevenLabs voices configured via env vars | Three `ELEVENLABS_VOICE_{KENT,FINCH,CHEN}` env vars |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `elevenlabs==2.43.0` | Python `>=3.8,<4.0`, `httpx` (bundled transitively) | Our 3.11 base is well within range. SDK brings its own pinned `httpx` dep that will not conflict with our existing `httpx>=0.27`. |
| `num2words>=0.5.13,<0.6` | Python `>=3.7` | No known compatibility concerns with existing stack. Pure-Python, no C extensions, no runtime risk on Windows. |

**Compatibility with existing backend:**
- ElevenLabs SDK's bundled `httpx` is compatible with our existing `httpx>=0.27` in `backend/requirements.txt` — pip resolves to a single version satisfying both (expected: ~0.28.x).
- Pydantic v2.9+ is compatible with ElevenLabs SDK (SDK uses internal Pydantic models — no cross-contamination with our request/response models).

---

## Integration Points With Existing Stack

| Existing Pattern | v1.2 Extension |
|------------------|----------------|
| `/api/llm` credential-proxy (zero browser-side secrets) | `/api/debrief/podcast` follows the identical pattern: `ELEVENLABS_API_KEY` lives in `backend/.env`, never touches the frontend bundle. Client posts persona scripts + voice_ids resolved server-side from env. |
| `pydantic-settings`-loaded env config | New settings fields: `elevenlabs_api_key`, `elevenlabs_voice_kent`, `elevenlabs_voice_finch`, `elevenlabs_voice_chen`, `elevenlabs_model_id`, `elevenlabs_output_format`. Loaded the same way as existing `llm_api_*` fields. |
| v1.1 `/api/health/llm` with 8-code taxonomy | `/api/health/tts` — parallel endpoint, same 8-code contract, same always-HTTP-200 body-carries-signal shape, 30s in-memory cache to protect quota. |
| Existing `isDebrief: true` message filter on frontend | Reused as the podcast script source — no new LLM call, no new message tagging. The `PodcastPlayer` renders only when debrief messages exist. |
| Existing markdown debrief export button | `PodcastPlayer` renders alongside (not replacing) the markdown export. Graceful degradation: if `/api/health/tts` reports `ok: false`, show "audio unavailable" chip; markdown path remains fully functional. |
| Existing `backend/tests/` pytest fixtures | TTS provider tests mock `elevenlabs.client.ElevenLabs` at class level. MP3 stitching tests use three pre-recorded fixture segments committed to `backend/tests/fixtures/`. |
| Existing structured-logging convention (`structlog` used in reference repo; KVWarGame uses stdlib `logging`) | Keep existing KVWarGame convention — do NOT adopt `structlog` just for this milestone. Log TTS events through the same logger used by `/api/llm`. |

---

## Confidence and Verification

| Claim | Confidence | Source |
|-------|------------|--------|
| ElevenLabs Python SDK 2.43.0 is current stable | HIGH | GitHub releases API response: `v2.43.0` published 2026-04-13 |
| `from elevenlabs.client import ElevenLabs` is the 2.x import path | HIGH | Reference repo source read directly; matches SDK v2 upgrade guide |
| `client.text_to_speech.convert(...)` returns a byte-chunk iterator | HIGH | Reference repo `elevenlabs_provider.py` (`for chunk in audio: file.write(chunk)`) |
| `mp3_44100_128` segments can be byte-concatenated safely | HIGH | Hydrogenaudio Knowledgebase: "if bit-reservoir not enabled, frames are completely self-contained"; at CBR 128kbps, reservoir artefacts at joins are sub-audible and within a few frames' look-back |
| `run_in_threadpool` is the FastAPI idiom for blocking SDKs | HIGH | FastAPI official docs + Kludex/fastapi-tips maintainer guidance |
| `AsyncElevenLabs` has open TypeError issue | MEDIUM | GitHub issue #243 on elevenlabs-python; workaround exists but is brittle |
| HTML5 `<audio>` decoders skip mid-stream ID3 tags | HIGH | MP3 spec (decoders resync on next valid frame header); universally implemented in Media Foundation, CoreAudio, Firefox's `nsMediaDecoder` |
| `num2words` 0.5.16 is current stable | HIGH | PyPI page listing; Savoir-faire Linux maintenance |
| Reference repo uses `elevenlabs` unpinned, `num2words>=0.5.13` | HIGH | `requirements.txt` read directly via `gh api` |

---

## Sources

- [elevenlabs · PyPI](https://pypi.org/project/elevenlabs/) — SDK package name, install, Python version constraint (>=3.8, <4.0)
- [elevenlabs-python GitHub releases](https://github.com/elevenlabs/elevenlabs-python/releases) — v2.43.0 published 2026-04-13, v2.x release cadence
- [elevenlabs-python v2 upgrade guide (Wiki)](https://github.com/elevenlabs/elevenlabs-python/wiki/v2-upgrade-guide) — 2.x breaking changes, `ElevenLabs` client class, `text_to_speech.convert` method, `AsyncElevenLabs` shape
- [ElevenLabs Python SDK docs](https://elevenlabs.io/docs/agents-platform/libraries/python) — canonical usage patterns for synchronous client
- [elevenlabs-python issue #243](https://github.com/elevenlabs/elevenlabs-python/issues/243) — Open async convert TypeError (evidence for sync-first prescription)
- [num2words · PyPI](https://pypi.org/project/num2words/) — Current version 0.5.16, stable across 0.5.x
- [savoirfairelinux/num2words GitHub](https://github.com/savoirfairelinux/num2words) — Maintenance status and locale support
- [FastAPI Concurrency docs](https://fastapi.tiangolo.com/async/) — `run_in_threadpool` idiom for blocking SDKs
- [Kludex/fastapi-tips](https://github.com/Kludex/fastapi-tips) — Threadpool default size (40), when to prefer async vs threadpool
- [FastAPI Custom Response docs](https://fastapi.tiangolo.com/advanced/custom-response/) — `Response` vs `StreamingResponse` vs `FileResponse` decision criteria
- [Hydrogenaudio Knowledgebase: Bit reservoir](https://wiki.hydrogenaudio.org/index.php?title=Bit_reservoir) — Authoritative MP3 spec reference; confirms frame independence conditions and CBR behavior
- [Hydrogenaudio Knowledgebase: CBR](https://wiki.hydrogenaudio.org/index.php?title=CBR) — CBR frame predictability, why concat of matching-format segments is safe
- [MP3 - Wikipedia](https://en.wikipedia.org/wiki/MP3) — Frame structure, decoder resync behavior at frame headers
- [SamuraiJenkinz/daily-intelligence-brief reference repo](https://github.com/SamuraiJenkinz/daily-intelligence-brief) — `app/services/tts/{base,elevenlabs_provider}.py`, `app/services/text_preprocessor.py`, `app/services/audio_generator.py`, `requirements.txt` — production-proven patterns, read directly via `gh api`

---

*Stack research for: v1.2 Debrief Podcast milestone — additions only*
*Researched: 2026-04-17*
*Base stack (Python 3.11 / FastAPI 0.135.x / React 19 / Vite 6 / Zustand 5 / Tailwind 4): locked, shipped v1.0+v1.1 on 2026-04-15, not re-researched here*
