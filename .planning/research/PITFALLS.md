# Pitfalls Research — v1.2 Debrief Podcast

**Domain:** ElevenLabs TTS integration into existing FastAPI + React facilitation tool (Windows Server scheduled task, corporate firewall, session-ephemeral state)
**Researched:** 2026-04-17
**Confidence:** HIGH for verified technical items (ElevenLabs concurrency/pricing, httpx defaults, pydub/ffmpeg Windows behaviour, SDK timeout, MP3 VBR concat). MEDIUM for v1.2-specific integration invariants — those are derived from v1.0/v1.1 code decisions in `PROJECT.md` rather than external docs.

**Scope note:** v1.0 pitfalls (LLM JSON parsing, context-window, state-clamping, persona drift, browser-side credentials) are already mitigated and documented — NOT re-covered here. The previous v1.0 PITFALLS.md is superseded by this file for the v1.2 milestone; v1.0/v1.1 pitfalls remain governed by the original research, which should be archived under `.planning/milestones/` alongside the v1.0 and v1.1 milestone artifacts.

**Phase tag legend** (used in each pitfall and in the mapping table):
- **P-TTS** — backend TTS-provider module (ElevenLabs client, preprocessing, voice map)
- **P-STITCH** — backend audio-stitching module (three-segment → single MP3, silence pads)
- **P-API** — FastAPI endpoint (`POST /api/debrief/podcast`, health parity)
- **P-UI** — React `PodcastPlayer` component (audio element, blob URL, download)
- **P-E2E** — end-to-end test + facilitator-run verification
- **P-AUDIT** — milestone audit / "looks done but isn't" gate before tagging

---

## Critical Pitfalls

### Pitfall 1: ElevenLabs free-tier character budget evaporates during dev

**What goes wrong:**
ElevenLabs free tier is 10,000 characters/month; `multilingual_v2` is 1 char = 1 credit ([help.elevenlabs.io](https://help.elevenlabs.io/hc/en-us/articles/13298164480913)). A five-round EDIP debrief has three personas × several `isDebrief:true` messages — typically 1,500–2,500 characters per full generation. That gives 4–6 full regenerations before the monthly quota is exhausted, at which point the API returns 429 mid-session and the facilitator sees "audio unavailable" during a rehearsal.

**Why it happens:**
Developers test against live ElevenLabs during development instead of using a fixture-based fake provider; repeated regenerations during UI iteration burn through the quota invisibly. Nobody instruments character-count-per-call, so the quota cliff is only discovered when it's hit.

**How to avoid:**
1. Build `ElevenLabsTTSProvider` against a `TTSProvider` ABC with a `FakeTTSProvider` (returns pre-recorded 5-second beep MP3s) selectable via `TTS_PROVIDER=fake|elevenlabs` env var — identical shape to how `/api/llm` could be faked but isn't. Default to `fake` in dev.
2. Before every ElevenLabs call, log `character_count` and cumulative session total to the structured logger with key `tts.characters_sent`.
3. Hard-cap per-request character count (e.g. `MAX_CHARS_PER_SEGMENT=800`) and fail-closed with a clear 4xx if exceeded. MDInsights' 250–600 word guard is precedent for this exact pattern.
4. Optional: maintain an in-memory session counter (since KVWarGame has no DB) and refuse to regenerate past a configurable `MAX_CHARS_PER_SESSION` (e.g. 6,000).

**Warning signs:**
- ElevenLabs dashboard shows >30% of monthly quota consumed inside the first dev day
- 429 `"quota_exceeded"` responses appear in backend logs
- Audio generation succeeds on clean test account but fails against the team's shared key

**Phase to address:** **P-TTS** (build-time architecture) + **P-API** (per-request guard) + **P-AUDIT** (verify fake provider exists and is the dev default).

---

### Pitfall 2: Concurrent-request limit (2 on free, 3 on starter) hit by parallel per-persona calls

**What goes wrong:**
Free tier allows only 2 concurrent ElevenLabs requests; Starter allows 3 ([help.elevenlabs.io](https://help.elevenlabs.io/hc/en-us/articles/14312733311761)). The obvious optimisation — fire all three persona synthesis calls in parallel with `asyncio.gather` — will return `too_many_concurrent_requests` on free tier or fail nondeterministically if another session overlaps. The error looks like a transient network failure, so it gets retried, which compounds.

**Why it happens:**
`asyncio.gather` is the idiomatic way to parallelise; nobody thinks about the provider's concurrency ceiling. Errors surface only under contention, not in single-call smoke tests.

**How to avoid:**
1. Serial by default: fire Kent, then Finch, then Chen sequentially. Latency is 3× one call (~30–60s total) but deterministic. Total wall-clock for a 3-minute podcast is ~90 s on turbo_v2 — acceptable.
2. If parallelism is later required, bound it with `asyncio.Semaphore(MAX_CONCURRENT_TTS)` read from env; default 1 (serial), bump to 2 only when the target plan is confirmed ≥Creator.
3. Catch `too_many_concurrent_requests` specifically in the provider layer and translate to an 8-code taxonomy entry (e.g. `TTS_RATE_LIMIT`).

**Warning signs:**
- Generation succeeds in isolation but fails intermittently when a second facilitator triggers a run nearby
- Error code 429 with body containing `"too_many_concurrent_requests"` vs `"quota_exceeded"` — both are 429, different root cause
- Retry logic masks the failure and doubles the cost

**Phase to address:** **P-TTS** (serial sequencer + semaphore) + **P-AUDIT** (verify no unbounded `gather` in the call graph).

---

### Pitfall 3: httpx 5 s default timeout cuts ElevenLabs mid-synthesis

**What goes wrong:**
httpx enforces a 5-second default timeout on every phase of the request ([python-httpx.org/advanced/timeouts](https://www.python-httpx.org/advanced/timeouts/)). ElevenLabs synthesis for a 60-second audio segment regularly takes 20–60 s via streaming, longer for `multilingual_v2`. If the backend uses a raw `httpx.AsyncClient()` or passes the LLM-proxy's client config through, calls fail with `ReadTimeout` at 5 s and the SDK surfaces a useless exception.

**Why it happens:**
The ElevenLabs Python SDK uses httpx under the hood and accepts a `timeout` kwarg — but it defaults to 240 s ([elevenlabs-python client.py](https://github.com/elevenlabs/elevenlabs-python)). If you wrap the SDK's HTTP layer, share a client with `/api/llm`, or build your own `httpx.AsyncClient` to hit the REST API directly (as v1.0 does for the LLM proxy), you inherit httpx's 5 s default instead of the SDK's 240 s.

**How to avoid:**
1. Use the official `elevenlabs` Python SDK, not raw httpx calls — it ships with a sensible 240 s default.
2. If you must roll your own client, set `httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=300.0, write=30.0, pool=10.0))` explicitly. Do NOT use `timeout=300` as a scalar — that applies to every phase including connect, which masks real network problems.
3. Do NOT reuse the `/api/llm` httpx client — the LLM endpoint is inside corporate network (fast), ElevenLabs is external (slow + long-running). Timeout profiles differ.

**Warning signs:**
- `httpx.ReadTimeout` or `httpx.ConnectTimeout` after exactly 5.00 s in logs
- ElevenLabs dashboard shows the request completed successfully (bytes were generated) but the server logs a timeout
- Facilitator sees "audio unavailable" after ~5 s when generation should take ~30 s

**Phase to address:** **P-TTS** (explicit timeout config) + **P-E2E** (one test with a synthetic slow endpoint that proves >5 s latency is tolerated).

---

### Pitfall 4: Corporate firewall drops long-running TLS connections silently

**What goes wrong:**
The corporate network has been validated for the internal LLM proxy — but `api.elevenlabs.io` is a NEW external endpoint that hasn't been tested. Many corporate proxies terminate TLS connections idle for >30 s or enforce a 60–120 s hard cap on any single outbound connection. The symptom is an abrupt `ConnectionResetError` partway through audio streaming, with no 4xx/5xx response from ElevenLabs (the API call was already in flight).

**Why it happens:**
Nobody tests external long-running streaming from inside the corporate network during dev (dev happens on localhost / home laptops). The firewall behaviour only surfaces in the production scheduled task.

**How to avoid:**
1. Before P-STITCH and P-API build, run a spike from the target Windows Server: a bare-metal `curl` or `python -c "requests.post(...)"` against `api.elevenlabs.io/v1/text-to-speech/.../stream` generating a known >60 s payload. Confirm full response arrives intact.
2. If streaming is blocked, switch to the non-streaming endpoint — returns the full MP3 in one response, trading slight latency for firewall compatibility.
3. Document the firewall verification as a milestone entry-gate (same pattern as the LLM-endpoint tier-B replay from v1.1).
4. Keep the abstraction boundary: `ElevenLabsTTSProvider` shouldn't care whether it's streaming or not — expose `synthesise(text, voice_id) -> bytes`.

**Warning signs:**
- `ConnectionResetError`, `RemoteProtocolError`, or `IncompleteRead` after 30–90 s
- Generation works on dev laptop but fails on production Windows Server
- Partial MP3 payloads (file exists but ffmpeg rejects it during stitching)

**Phase to address:** **P-TTS** (spike first, code second) + **P-AUDIT** (spike results documented as part of milestone entry).

---

### Pitfall 5: Markdown in debrief messages read aloud literally

**What goes wrong:**
LLM persona responses sometimes emit markdown formatting — `**bold**`, `*italic*`, bullet lists (`- item`), headers (`### Summary`), or numbered lists. When this text is passed straight to ElevenLabs, the TTS engine reads the punctuation: "asterisk asterisk security of supply asterisk asterisk", bullets become long pauses, and numeric headers distort pacing. This silently degrades audio quality without producing any error.

**Why it happens:**
The markdown debrief feature (shipped v1.0) actively encourages the LLM to use markdown in debrief messages because the existing download is rendered in a markdown viewer. The new TTS path shares the same source text but needs plain prose.

**How to avoid:**
1. Introduce a `sanitize_for_tts(text: str) -> str` step between message selection and ElevenLabs call. Strip: `**`, `*`, `_`, `#` at line start, leading `- ` and `* ` and `1. `, backticks, HTML tags. Use a well-tested markdown-to-plaintext routine (e.g. `markdown-it-py` render + strip, or a regex battery with unit tests).
2. Preserve sentence terminators — don't eat `.`, `!`, `?` since TTS uses them for pacing.
3. Unit-test with real debrief samples from v1.0 live run (Scenario 2 R3/R4 transcripts are in the repo).
4. Keep sanitisation separate from the acronym/number preprocessing (pitfall 6) — different failure modes, different tests.

**Warning signs:**
- First listen-through: you hear "asterisk" or "hash" spoken aloud
- Unnatural long pauses inside sentences (bullets)
- Headers read as numbers ("three, summary…")

**Phase to address:** **P-TTS** (preprocessing stage with unit tests against v1.0 debrief corpus).

---

### Pitfall 6: EDIP vocabulary pronounced phonetically wrong

**What goes wrong:**
"EDIP" is read as "ee-dip" (rhymes with "see-dip") instead of "E-D-I-P". "PC", "PO", "CRM", "IC", "LEFS", "SIEP" all have the same problem — TTS guesses a pronunciation and picks wrong. Numbers like "2026" are read "two thousand twenty-six" when the facilitator context expects "twenty twenty-six". This isn't an error — the audio plays fine — but it immediately breaks immersion for anyone familiar with the domain.

**Why it happens:**
ElevenLabs (and every TTS engine) doesn't know domain acronyms. The v1.0 prompt contains these acronyms in their all-caps form, which TTS heuristics sometimes misread as words. Numbers follow locale-default pronunciation rules that don't match defence-policy conventions.

**How to avoid:**
1. Build an explicit acronym map and apply it in `sanitize_for_tts`:
   ```python
   ACRONYM_MAP = {
       "EDIP": "E D I P",
       "PC": "P C",
       "PO": "P O",
       "CRM": "C R M",
       "IC": "I C",
       "LEFS": "L E F S",
       "SIEP": "S I E P",
       "EU": "E U",
       # ... pull the full list from WARGAME_ENGINE_DEV_SPEC.md
   }
   ```
   Match on word boundaries only (`\bEDIP\b`) to avoid corrupting words that happen to contain the letters.
2. For numbers, use `num2words` with `to='year'` for 4-digit years ("twenty twenty-six") and default for everything else; detect years with a regex `\b(19|20)\d{2}\b`. Apply only after acronym expansion.
3. Consider ElevenLabs' SSML-like pronunciation dictionary feature as a fallback — but the string-replacement approach is simpler, testable, and provider-agnostic.
4. Hard requirement: unit test covers every acronym from the v1.0 EDIP config JSON, with a golden-file assertion.

**Warning signs:**
- First listen-through: "ee-dip" or "pee-oh" instead of letter-spelled pronunciation
- Dates sound like census data, not headlines
- Facilitator feedback: "it sounds wrong but I can't explain why"

**Phase to address:** **P-TTS** (preprocessing module + test corpus) + **P-E2E** (listen-through check in facilitator walkthrough).

---

### Pitfall 7: Raw byte-concat of MP3 segments produces clicks, pops, or corrupted output

**What goes wrong:**
The "simple" way to join three MP3s is byte concatenation: `open(out, 'wb').write(a.read() + b.read() + c.read())`. This works IF every segment has identical sample rate, bitrate, channel count, and CBR encoding — AND frame boundaries happen to line up. In practice, even ElevenLabs' own outputs can vary (especially between model versions), and the result is:
- Audible click/pop at segment boundaries
- Duration metadata that lies (player shows wrong length, seek bar broken)
- Some decoders refuse to play VBR concat output ([gearspace.com/CBR vs VBR](https://gearspace.com/board/mastering-forum/1304131-cbr-vs-vbr-encoding.html))
- On strict decoders (Safari, some Windows media players): silent failure or first-segment-only playback

**Why it happens:**
MP3 looks like a byte stream but is actually a sequence of frames with headers; concatenating two CBR streams at matching bitrates happens to work because frame sync is tolerant, but this is a coincidence, not a guarantee. VBR streams have a Xing/LAME header describing the whole file — concat produces a file whose header lies about everything after byte N.

**How to avoid:**
1. Use `pydub.AudioSegment` to decode each segment, concatenate `AudioSegment` objects, and re-export as a single MP3 with explicit parameters:
   ```python
   from pydub import AudioSegment
   segs = [AudioSegment.from_mp3(p) for p in [kent, finch, chen]]
   # Normalise sample rate + channels to avoid mismatch
   segs = [s.set_frame_rate(44100).set_channels(1) for s in segs]
   pad = AudioSegment.silent(duration=400)  # 400ms pad between personas
   out = segs[0] + pad + segs[1] + pad + segs[2]
   out.export(path, format="mp3", bitrate="128k", parameters=["-codec:a", "libmp3lame"])
   ```
2. Request the SAME output format from ElevenLabs for every segment — pin `output_format="mp3_44100_128"` (44.1 kHz, 128 kbps CBR). Do not rely on the default.
3. Add a short silence pad (200–500 ms) between personas — matches natural conversational pacing AND gives MP3 decoders a clean frame boundary.
4. Apply `.fade_in(20).fade_out(20)` to each segment to eliminate the 1–2 sample click that ElevenLabs edges sometimes have. (Also: pydub's own `silent()` can generate a sharp click at the end — [pydub issue #423](https://github.com/jiaaro/pydub/issues/423) — but `+ AudioSegment.silent()` as a pad inside a longer stream doesn't trigger it because the click is suppressed by adjacent audio; still, fade is cheap insurance.)

**Warning signs:**
- Audible click/pop at timestamp = duration-of-segment-1
- Player duration display wrong (shows 1:30 for a 3:00 file)
- Scrubbing past a persona boundary causes playback to skip or stop
- Safari users report the file won't play while Chrome users are fine

**Phase to address:** **P-STITCH** (pydub-based concat with normalisation, silence pad, fades) + **P-E2E** (listen-through on at least Chrome, Edge, Safari if reachable).

---

### Pitfall 8: ffmpeg missing from PATH in Windows scheduled-task context

**What goes wrong:**
`pydub` shells out to `ffmpeg.exe` (and `ffprobe.exe`) for decode/encode. Windows scheduled tasks run with a minimal environment — even if `ffmpeg` is on PATH for the interactive user, it may not be on PATH for the scheduled task's service account. Result: every call to `AudioSegment.from_mp3` raises `CouldntDecodeError` or emits the cryptic `RuntimeWarning: Couldn't find ffmpeg or avconv - defaulting to ffmpeg, but may not work` and then fails ([pydub #348](https://github.com/jiaaro/pydub/issues/348), [#668](https://github.com/jiaaro/pydub/issues/668)).

**Why it happens:**
The v1.0 scheduled task ships with a Python venv and no ffmpeg. Developers install ffmpeg on their laptops for testing and forget the server needs it too. Scheduled tasks inherit a different PATH than the deploying user's shell session.

**How to avoid:**
1. Ship a vendored `ffmpeg.exe` + `ffprobe.exe` inside the repo (e.g. `vendor/ffmpeg/`) or pin a known version downloaded by the deployment script. Set `AudioSegment.converter` and `AudioSegment.ffprobe` to absolute paths at import time:
   ```python
   import os
   from pydub import AudioSegment
   HERE = os.path.dirname(os.path.abspath(__file__))
   FFMPEG = os.path.join(HERE, "..", "vendor", "ffmpeg", "ffmpeg.exe")
   FFPROBE = os.path.join(HERE, "..", "vendor", "ffmpeg", "ffprobe.exe")
   AudioSegment.converter = FFMPEG
   AudioSegment.ffprobe = FFPROBE
   ```
2. Check presence at server start-up — fail fast with a clear error message if the binaries aren't there (same pattern as the v1.1 LLM health check at launch).
3. Add a backend smoke test that calls `AudioSegment.from_file(tiny_fixture.mp3)` — catches the issue in CI without requiring a live TTS call.
4. Document the ffmpeg requirement in the Windows Server deployment guide (next to the venv setup).

**Warning signs:**
- `CouldntDecodeError: Decoding failed. ffmpeg returned error code: 1` in logs
- `RuntimeWarning: Couldn't find ffmpeg or avconv` on first import
- Smoke test passes on dev laptop, fails on server
- Audio generation 500s on production but works end-to-end in local `uvicorn`

**Phase to address:** **P-STITCH** (vendored binaries + explicit path config) + **P-AUDIT** (deployment-guide update + server-side smoke test in milestone-audit checklist).

---

### Pitfall 9: Client disconnect mid-generation keeps charging ElevenLabs

**What goes wrong:**
User clicks Generate. Browser request fires. 45 seconds in, user refreshes the tab or navigates away. The browser drops the TCP connection — but the FastAPI handler keeps running, finishes all three ElevenLabs calls (still charged), stitches the MP3, and returns nothing to anyone. If the user clicks Generate again on reload, that's 2× the character cost for one session ([fastapi #1342](https://github.com/fastapi/fastapi/issues/1342)).

**Why it happens:**
FastAPI's default behaviour for non-streaming responses is to complete the handler even if the client disconnected. Detecting disconnect requires actively checking `request.is_disconnected()` in an async loop — nobody does this by default.

**How to avoid:**
1. At each natural checkpoint in the handler (after each persona's TTS call, before stitching, before writing final output), check `await request.is_disconnected()` and raise `asyncio.CancelledError` if true.
2. Use a `StreamingResponse` that yields chunks — the async generator will receive `CancelledError` automatically when the client drops ([fastapi discussion #14552](https://github.com/fastapi/fastapi/discussions/14552)).
3. Add an in-session "generation in progress" flag in the frontend (Zustand slice) that disables the Generate button while a request is outstanding and shows "Generating... (this takes ~90 s)". Prevents the user's "click-it-again-it's-slow" reflex.
4. Log every ElevenLabs call with a session-scoped correlation ID so that wasted spend is visible after the fact.

**Warning signs:**
- ElevenLabs character count higher than session audio duration × voice-rate would predict
- Logs show `tts.characters_sent` events without a matching `podcast.delivered` event
- User reports "I clicked twice and now it took forever"

**Phase to address:** **P-API** (disconnect check + streaming response) + **P-UI** (in-flight button disable + progress state) + **P-AUDIT** (log-trace verification: every session has N_personas TTS calls, no orphans).

---

### Pitfall 10: Blob URL leak + audio element src-set-before-ready race

**What goes wrong:**
Two related React pitfalls, both around the audio player:

(a) **Leak**: Every regenerate call receives a fresh MP3 blob. If the `<audio src>` is set from `URL.createObjectURL(blob)` but the previous blob URL is never revoked with `URL.revokeObjectURL`, the browser retains every prior blob in memory. After ten regenerates, ~100 MB of audio data is pinned ([MDN revokeObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static)).

(b) **Race**: A controlled `<audio src={audioUrl} />` where `audioUrl` is populated asynchronously can render with `src=""` on first paint, then rerender with the real URL, causing a transient 404 in DevTools and sometimes a browser console "no supported source" error.

**Why it happens:**
Developers new to Blob URLs treat them like regular URLs and don't realise the browser holds the underlying data until `revokeObjectURL` is called. And the "render-first, fetch-second" React pattern doesn't play well with media elements that validate `src` on mount.

**How to avoid:**
1. Manage the blob URL in a `useEffect` with a cleanup function:
   ```tsx
   useEffect(() => {
     if (!audioBlob) return;
     const url = URL.createObjectURL(audioBlob);
     setAudioUrl(url);
     return () => URL.revokeObjectURL(url);
   }, [audioBlob]);
   ```
2. Conditionally render the `<audio>` element — don't render it at all until `audioUrl` is truthy:
   ```tsx
   {audioUrl && <audio controls src={audioUrl} />}
   ```
3. On component unmount AND on new-generation-request, revoke the previous URL explicitly.
4. Cover with a unit test that spies on `URL.revokeObjectURL` and asserts it's called on regenerate + unmount.

**Warning signs:**
- Chrome Task Manager shows the tab's memory climbing by ~5 MB per regenerate, never released
- DevTools console: "The element has no supported sources" briefly on mount
- After many regenerates, audio playback becomes choppy or the browser throttles

**Phase to address:** **P-UI** (effect cleanup + conditional render + unit test).

---

### Pitfall 11: Download filename is generic ("podcast.mp3") or duplicated by browser

**What goes wrong:**
If the backend response sets no `Content-Disposition` header, the browser guesses a filename from the URL path (often the endpoint name or the final path segment). User downloads three podcasts from the same session → filenames are `podcast.mp3`, `podcast (1).mp3`, `podcast (2).mp3`. No link to session, no timestamp, no scenario. Facilitator cannot later tell which file came from which run.

**Why it happens:**
`FileResponse` and `StreamingResponse` don't set `Content-Disposition` unless you ask them to; `application/octet-stream` is the fallback.

**How to avoid:**
1. Set `Content-Disposition` on the response with a descriptive filename:
   ```python
   from fastapi.responses import StreamingResponse
   filename = f"wargame-debrief-{scenario_slug}-{timestamp}.mp3"
   headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
   return StreamingResponse(audio_iter, media_type="audio/mpeg", headers=headers)
   ```
2. Include: scenario slug (e.g. "edip-scenario-2"), ISO-8601 timestamp to the minute (e.g. "2026-04-17T1530"). Avoid spaces and colons (Windows filename rules).
3. Use `filename*=UTF-8''...` form if the scenario name could contain non-ASCII — but EDIP is ASCII-only today, so plain `filename="..."` is fine.
4. Frontend Download button should use `<a href={audioUrl} download={derivedFilename}>` — `download` attribute is a secondary hint that matters if the server's header is stripped by a proxy.

**Warning signs:**
- Downloaded files in facilitator's Downloads folder all named `podcast.mp3`, `podcast (1).mp3`
- Facilitator asks "which run was this from?"

**Phase to address:** **P-API** (header) + **P-UI** (anchor `download` attribute).

---

### Pitfall 12: Existing markdown-debrief download breaks because of coupling to podcast code

**What goes wrong:**
The PodcastPlayer is added alongside the existing markdown debrief download in the debrief panel. An enthusiastic refactor consolidates the download button into a shared "DebriefExport" component. Podcast generation requires state the markdown path doesn't (audio blob, loading flag), and the shared component now silently blocks the markdown download when TTS is down — violating the graceful-degradation contract explicit in the v1.2 milestone goal: "ElevenLabs down must not block the markdown debrief".

**Why it happens:**
DRY instinct; the two buttons look similar. Nobody re-reads the milestone goal before refactoring adjacent code.

**How to avoid:**
1. Keep the two download paths structurally independent: separate components, separate state slices, separate backend endpoints. They sit side-by-side in the UI, not nested.
2. Add a regression test: "with TTS health = red, the markdown download still works end-to-end". This is trivial with the v1.1 health-check fake.
3. The podcast UI surface degrades to "audio unavailable" without removing any existing UI.

**Warning signs:**
- Markdown download button grays out when ElevenLabs is down
- Unit test for markdown export requires a TTS fixture
- PR review comment "can we share this component?" — pause and re-check the invariant

**Phase to address:** **P-UI** (structural separation) + **P-E2E** (graceful-degradation test case) + **P-AUDIT** (milestone-goal check).

---

### Pitfall 13: Exception-handler ordering drift breaks v1.1 load-bearing comment

**What goes wrong:**
v1.1 shipped with a deliberate exception-handler order in the LLM endpoint, documented with a load-bearing comment (PROJECT.md key decisions: "later handlers are superclasses; refactor regressions must be prevented"). Adding a new `TTSError` or `TTSTimeoutError` exception translation, if inserted at the wrong point in the chain, can be caught by an existing superclass handler (e.g. generic `httpx.HTTPError`) instead of reaching its specific translator — producing a vague 500 instead of a clean 8-code error.

**Why it happens:**
The ordering invariant is in a comment, not a test. Developers adding a new handler see "these look similar, I'll add mine at the end" without reading the comment.

**How to avoid:**
1. Read the v1.1 handler-ordering comment before touching the endpoint module. If it has moved, the comment has to move with it.
2. Add unit tests that exercise each exception path: `TTS_AUTH_FAILED`, `TTS_QUOTA_EXCEEDED`, `TTS_RATE_LIMIT`, `TTS_TIMEOUT`, `TTS_UNAVAILABLE`. Each test mocks the ElevenLabs client to raise the specific exception, then asserts the endpoint returns the corresponding 8-code string. Drift = test failure.
3. If the LLM endpoint and the TTS endpoint share a handler module, keep them as two distinct dispatch trees — do NOT share the exception-translation chain. Same ordering principle, separate scopes.

**Warning signs:**
- A TTS error surfaces as `LLM_UNAVAILABLE` or generic `INTERNAL_ERROR` instead of a TTS-specific code
- Existing LLM tests still pass but new TTS test is flaky
- PR adds a handler without adding a test for it

**Phase to address:** **P-API** (test matrix per error path) + **P-AUDIT** (run v1.0 + v1.1 LLM test suite after changes — prove zero regression).

---

### Pitfall 14: Debrief bucketing invariant (halt at `lastDebriefIdx`) broken by new podcast plumbing

**What goes wrong:**
v1.0 08-05 decision: the chat-feed bucketing loop halts at `lastDebriefIdx` so post-debrief messages don't double-render in Round-N transcripts. If podcast work touches the message-selection logic (e.g. to filter `isDebrief: true` messages for TTS input), a thoughtless refactor of the shared message-walking code can drop the halt and reintroduce the bug.

**Why it happens:**
The podcast feature needs the same messages the bucketing feature needs; developers factor out a shared selector and accidentally change behaviour. The invariant is encoded in loop control flow, not in a type or a test assertion.

**How to avoid:**
1. Podcast message selection must be a SEPARATE pure function, not a refactor of the bucketing loop. Input: `messages[]`. Output: `ScriptLine[]` for TTS. The existing loop stays untouched.
2. Keep the v1.0 08-05 regression test green throughout v1.2 (it already covers the bucketing invariant). Do not move it.
3. When adding the podcast message selector, add a second regression test: "messages after the debrief block must not appear in podcast script" — symmetric to the bucketing guard.

**Warning signs:**
- v1.0 regression test fails after the podcast patch
- Round-N transcript shows debrief messages embedded in it
- Podcast script contains messages from before the end-game trigger

**Phase to address:** **P-TTS** (pure selector, no bucketing-loop refactor) + **P-E2E** (both regression tests green).

---

### Pitfall 15: Prompt-token CI assertion (`withinLimit`) tripped by TTS-prep prompt changes

**What goes wrong:**
v1.1 promoted `withinLimit` from informational to a hard CI assertion — any prompt edit that pushes total context past 7500 tokens fails the build (v1.1 Key Decisions). If the v1.2 work quietly adds a prompt instruction like "write debrief in a style suitable for audio narration" (tempting — it reads clean in prose), that appends tokens to a budget with 642 tokens of headroom. The CI turns red on merge.

**Why it happens:**
The milestone scope says "Script source: existing `isDebrief: true` persona messages (no new LLM call — the in-character scripts already exist at end-of-game)" — but mid-implementation, someone thinks "it would sound better if the LLM was told it's for audio" and adds a system-prompt line without running the token measurement.

**How to avoid:**
1. Hold the milestone line: NO prompt changes for v1.2. Preprocessing (acronym expansion, markdown stripping, number normalisation) happens AFTER the LLM, in Python, before ElevenLabs.
2. If a prompt change becomes genuinely necessary, measure before and after with the existing `withinLimit` script; budget extension is a separate scope decision and must be logged as a Key Decision in PROJECT.md.
3. CI gate stays green throughout v1.2.

**Warning signs:**
- `withinLimit` test shows headroom < 642 tokens (current baseline) partway through the milestone
- PR diff touches `prompt.py` / `prompts/` — stop and ask why
- Someone is "improving debrief tone" for audio — that's a post-TTS preprocessing job, not a prompt job

**Phase to address:** **P-TTS** (discipline: post-LLM preprocessing only) + **P-AUDIT** (milestone-audit check: confirm prompts unchanged, `withinLimit` headroom intact).

---

### Pitfall 16: Voice ID stale or retired, failure not surfaced to facilitator

**What goes wrong:**
Stock ElevenLabs voice IDs occasionally get renamed or retired. If the voice ID configured in `.env` for Kent/Finch/Chen is invalidated upstream, the API returns 404 or `voice_not_found`. If the error surfaces as a bland 500 in the UI, the facilitator sees "audio unavailable" with no actionable detail.

**Why it happens:**
Voice IDs are opaque hex strings; nobody cross-checks them against the ElevenLabs voice library unless something fails. The deployment sits for months between uses (tabletop exercises are quarterly).

**How to avoid:**
1. `/api/health/tts` (or unified `/api/health/llm` — TBD during planning) probes each configured voice by calling ElevenLabs' voices-list endpoint and asserting every configured voice_id is present. Runs on app start and on demand. Same 8-code taxonomy pattern as v1.1.
2. If a voice is missing, the health badge shows the voice name missing, not just "TTS unavailable".
3. Document the stock voice IDs in the deployment guide with ElevenLabs voice library URLs next to them — facilitators can rediscover the replacement voice in minutes rather than hours.
4. On generation failure with `voice_not_found`, return a specific 8-code `TTS_VOICE_INVALID` so the frontend can show "Kent's voice configuration is invalid" — actionable even to a non-technical facilitator.

**Warning signs:**
- Generation worked in last exercise, fails in current exercise with no code change
- ElevenLabs dashboard shows the voice ID as "unavailable" or missing from voice library
- Health check reports green but generation fails

**Phase to address:** **P-API** (health probe + 8-code translation) + **P-E2E** (test: invalid voice_id → specific error code, not generic 500).

---

### Pitfall 17: API key leaks into logs via structured-logging context

**What goes wrong:**
The MDInsights reference implementation uses structured logging with rich context (per PROJECT.md). If the ElevenLabs client passes its own `xi-api-key` header into the shared logger as part of request-context (e.g. to help debug rate-limit issues), the key ends up in log files — readable by anyone with log access, synced to log-aggregation tools, searchable forever. Same class of bug as committing `.env` but harder to audit.

**Why it happens:**
httpx and most SDKs include the full request (including headers) in their debug logging. When you wire ElevenLabs into the existing logger and turn up verbosity while debugging, the header is in the dump before you notice.

**How to avoid:**
1. Configure the logger with a redaction filter that scrubs any value for known sensitive header names (`xi-api-key`, `authorization`, `api-key`, `bearer`). Apply it globally, not just to the TTS module.
2. Never log the request headers dict. If you need to log a request, log method + URL + body-size + custom correlation ID only.
3. Unit test: invoke the client with a decoy key, capture log output, assert the key is nowhere in the captured text.
4. Credential audit check in milestone-audit (v1.0 already has "zero browser-side Authorization" — extend to "zero sensitive headers in server logs").

**Warning signs:**
- Grep of log files finds the API key
- ElevenLabs dashboard shows usage from unexpected IPs (key leaked externally)
- Debug log dumps include `"xi-api-key": "sk_..."`

**Phase to address:** **P-TTS** (logger redaction filter) + **P-AUDIT** (credential audit extended).

---

### Pitfall 18: Health check reports OK without exercising a real ElevenLabs call

**What goes wrong:**
A "health check" that only confirms the `.env` has `ELEVENLABS_API_KEY` populated, or that `api.elevenlabs.io` is reachable on port 443, reports green — but the key might be expired, the voice IDs might be invalid, the account might be over quota, or the firewall might block the specific streaming endpoint. The facilitator sees "TTS ready" in the badge, clicks Generate at exercise-time, and it fails. Same pattern as v1.0 before v1.1's health-check hardening.

**Why it happens:**
Shallow health checks are cheap and feel sufficient. The v1.1 `/api/health/llm` precedent is the example for how deep it needs to go.

**How to avoid:**
1. Health probe actually calls ElevenLabs — the voices-list endpoint is cheap (no character cost), validates auth, validates quota state (dashboard data comes with it), and confirms firewall reachability. Same SLA pattern as v1.1 (≤15 s, always HTTP 200, body.ok carries signal).
2. Probe asserts every configured voice_id resolves to a real voice.
3. The badge distinguishes: `ok`, `auth_failed`, `quota_exhausted`, `voice_missing`, `firewall_blocked`, `rate_limited`, `timeout`, `unknown`. Eight codes, same taxonomy shape as v1.1.
4. Setup-screen gate: if the health probe is red, Launch is gated (same as v1.1 did for LLM).

**Warning signs:**
- Health badge green, generation fails
- Health check latency < 100 ms (suspicious — likely not hitting the network)
- Health probe never detects expired key until generation fails

**Phase to address:** **P-API** (probe hits real API) + **P-UI** (8-code badge + Launch gate parity) + **P-AUDIT** (verify empirically: flip a voice_id to garbage, confirm badge goes red).

---

### Pitfall 19: No cost guard — user clicks Generate 10× in frustration

**What goes wrong:**
Generation takes 60–90 s. User thinks it's hung, clicks Generate again (button not disabled, or they hit reload). Each click charges another full character cost for three personas. Ten clicks = 10× cost. On free tier this exhausts the monthly quota in a single session. Even on paid tier, unchecked regeneration is waste.

**Why it happens:**
"Click again if it's slow" is a universal user instinct. Default browser behaviour on reload doesn't cancel in-flight requests. No rate limit on the endpoint.

**How to avoid:**
1. Frontend: Generate button disabled while a request is in-flight (same state machine as the v1.1 Launch gate). Show "Generating… ~90 s" next to a spinner. Disable until response arrives OR error.
2. Backend: per-session soft rate limit: at most 1 generation in-flight at a time per session, 503 `TTS_IN_FLIGHT` if re-requested.
3. Backend: per-session character-budget ceiling (from pitfall 1). At the hard cap, return 402 `TTS_SESSION_BUDGET_EXCEEDED` with an explanation, not silent failure.
4. Don't auto-retry on the frontend. Errors surface explicitly; the facilitator decides whether to retry.

**Warning signs:**
- Logs show three `podcast.generate_started` events inside 30 s for the same session
- ElevenLabs monthly character count climbs way faster than expected
- Facilitator reports "I had to click a few times to get it going"

**Phase to address:** **P-UI** (in-flight disable + progress copy) + **P-API** (per-session rate limit + budget ceiling) + **P-E2E** (test: rapid double-click → second request rejected with specific code).

---

### Pitfall 20: Three-voice mapping correct but personas speak in wrong order

**What goes wrong:**
Voice mapping Kent→voiceA, Finch→voiceB, Chen→voiceC is correctly configured. But the order of segments in the stitched MP3 is driven by the order messages appear in the debrief, which is the order the LLM emitted them — which on a given run may not be Kent-Finch-Chen. Audio plays with Chen first, then Kent, then Finch. Each voice is right for their persona, but the narrative flow is wrong, and the podcast sounds like three unrelated monologues.

**Why it happens:**
Natural-seeming logic: "iterate debrief messages in order, synthesise each with the speaker's voice". The LLM's emission order is not guaranteed to match a canonical persona order. No test catches this because single-message-per-persona happens to be in the expected order in the v1.0 fixture.

**How to avoid:**
1. Define a canonical persona order: Kent, Finch, Chen (or whatever the spec says — confirm during planning). Sort debrief messages by persona in that canonical order before TTS; within a persona, preserve emit order.
2. If a persona has multiple debrief messages, group them into one TTS call (one segment, one voice) — avoids awkward voice-toggling.
3. End-to-end test with a fixture where debrief messages arrive in `Chen, Kent, Finch` order — assert the output MP3 has Kent's voice in segment 1, Finch in 2, Chen in 3.
4. If a persona has zero debrief messages, skip their segment silently — don't emit a silent pad for them (maintains natural flow).

**Warning signs:**
- Listening to the podcast, a persona speaks before they've been introduced
- The narrative arc doesn't match the visual debrief order
- Podcast is three monologues that don't connect

**Phase to address:** **P-TTS** (canonical order + grouping) + **P-STITCH** (explicit segment order contract) + **P-E2E** (fixture with non-canonical input order).

---

### Pitfall 21: Temp-file accumulation on Windows (file handle retention)

**What goes wrong:**
Each generation writes three per-persona MP3 temp files + one stitched MP3 temp file. pydub's `export()` opens the ffmpeg subprocess, writes, and expects Python to close the handle on return. Windows locks files aggressively while any handle is open. If an exception interrupts cleanup, temp files remain locked and undeletable until the Python process exits. Scheduled task sits on the same process for weeks — temp dir grows, disk eventually fills.

**Why it happens:**
Developers use `tempfile.NamedTemporaryFile` but forget that on Windows, `delete=True` + open-for-writing doesn't work the way it does on POSIX. Exception paths leak handles.

**How to avoid:**
1. Use `tempfile.TemporaryDirectory()` context manager — one temp dir per generation, Python manages cleanup of the directory and everything in it.
2. Explicit `try/finally` with `os.unlink` on every temp path; log a warning on cleanup failure instead of silently leaving debris.
3. On generation start, run a best-effort sweep of orphaned temp files older than 1 hour (belt + braces against process restart loss).
4. Keep the final MP3 in memory (bytes) — return it from the endpoint directly — never persist the stitched output. Only the three per-persona segments need temp-file round-trip (because pydub needs to read from disk). Stitched result can be exported to an `io.BytesIO`.

**Warning signs:**
- `%TEMP%` on the Windows Server growing steadily across weeks
- `PermissionError: [WinError 32] The process cannot access the file because it is being used by another process` in logs
- Disk-space monitor warnings

**Phase to address:** **P-STITCH** (context manager + in-memory final output) + **P-AUDIT** (deployment-guide entry: monitor temp dir).

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Raw byte-concat of MP3 segments | 5 LOC, no pydub dep | Click/pop artefacts, VBR breakage, Safari failures | Never for three-voice stitching; acceptable only if all segments are identical-format output from the same model call |
| Single shared httpx client for LLM + TTS | One client = simpler DI | Timeout profiles collide (5 s LLM vs 300 s TTS); debug sessions conflate failures | Never — two distinct external dependencies need distinct timeout budgets |
| Skipping the `FakeTTSProvider` — always hit real ElevenLabs in dev | "Faster to see real output" | Free-tier quota burnt before the milestone ships; no regression tests for provider behaviour | Never — fake provider is cheap insurance |
| Shallow health check ("env var is set") | Five-minute implementation | Facilitator sees green badge, generation fails at exercise time; repeat of the v1.0→v1.1 gap | Never — v1.1 already paid this lesson's tuition |
| In-flight Generate request not deduplicated | "Users won't double-click" | They do, and every click is ~$0.06 — ten sessions of frustration = measurable cost | Never — rate-limit on day one |
| Parallel per-persona TTS with `asyncio.gather` and no semaphore | Latency drops from 90 s to 30 s | Free-tier 429 `too_many_concurrent_requests`; flaky tests | Acceptable ONLY after semaphore bounded to subscription concurrency limit |
| `Content-Disposition` left to default | Saves two lines of code | Facilitator can't tell files apart; forensic reconstruction painful | Never — filename is a trivial win |
| "We'll add ffmpeg to PATH on the server at deploy time" | Local dev works | Deploy forgets it, production fails in a way that isn't caught by backend tests | Acceptable only if an at-startup binary check fails fast with a clear error |
| No per-session character-budget ceiling | Short sprint scope | Single bad session can exhaust the monthly quota | Acceptable ONLY with per-call logging AND dashboard alerting — if you can't see the spend, you can't control it |
| Using the non-streaming endpoint instead of streaming | Simpler, firewall-safer | Longer perceived latency; can't show progress granularity | Acceptable for v1.2 — streaming is an optimisation, not a requirement |
| In-memory session TTS counter (no DB) | No schema cost | State lost on process restart | Acceptable — matches existing ephemeral-state architecture; ElevenLabs dashboard is the source of truth for cumulative spend |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| ElevenLabs REST via raw httpx | Inherit httpx's 5 s default timeout, resulting in false failures | Use SDK (240 s default) OR construct `httpx.Timeout(connect=10, read=300, write=30, pool=10)` explicitly |
| ElevenLabs streaming endpoint | Assume it works through the corporate firewall because the LLM proxy did | Spike from the target Windows Server BEFORE building; fall back to non-streaming if blocked |
| ElevenLabs voice IDs | Pin a voice ID in `.env` and never validate it again | Health probe asserts every configured voice_id is still in the voices list |
| ElevenLabs model parameter | Default to whatever the SDK picks this month | Pin `model_id` in config (`eleven_turbo_v2` for speed + cost, `eleven_multilingual_v2` for quality — pick per milestone decision, document the trade-off) |
| ElevenLabs `output_format` | Let the SDK default shift between calls / SDK versions | Pin `output_format="mp3_44100_128"` — every segment matches every other segment, stitching is safe |
| ElevenLabs error responses | Treat all 429s the same | `quota_exceeded` and `too_many_concurrent_requests` are both 429 with different bodies — translate to different 8-code entries |
| pydub + ffmpeg on Windows | Assume ffmpeg is on PATH in the scheduled task's environment | Set `AudioSegment.converter` to an absolute, vendored path; fail at startup if the binary is missing |
| pydub `AudioSegment.silent()` | Use it directly as a pad between segments | It can produce a click at the end ([issue #423](https://github.com/jiaaro/pydub/issues/423)); add `.fade_in(20).fade_out(20)` to adjacent segments as insurance |
| FastAPI long handler | Return the final bytes; don't check for disconnect | Use `StreamingResponse` OR check `await request.is_disconnected()` at every natural checkpoint; cancel outstanding TTS work |
| Reuse `/api/health/llm` wholesale | Add a ninth code to the existing taxonomy | Spike first: does a parallel `/api/health/tts` with its own 8-code taxonomy cost less than overloading the LLM endpoint? Decision must land as a Key Decision in PROJECT.md |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Holding 4× MP3s in RAM (three segments + stitched) | Memory creep on long-running process | Use `BytesIO` for segments, release refs immediately after stitching; final bytes to response, nothing kept | ~18 MB/session × concurrent sessions × leaked refs — negligible at N=1, meaningful if v2+ ever multi-tenants |
| Temp file accumulation on Windows | Disk slowly fills; eventually writes fail | `TemporaryDirectory()` context manager per generation; sweep orphans on start | Weeks of scheduled-task uptime without cleanup |
| Blob URL leak in React | Browser tab memory grows per regenerate | `URL.revokeObjectURL` in `useEffect` cleanup | After ~10 regenerates, ~100 MB pinned in tab |
| Unbounded concurrent TTS requests | 429s, cost blow-up | Serial by default; semaphore bound to plan's concurrency limit | At N>1 concurrent facilitator sessions, or parallel per-persona with no cap |
| 5-second httpx default timeout on TTS | Every call fails | Explicit timeout config | Every time — this is a config bug, not scale |
| Full-response (non-streaming) for 3-minute audio | User waits 90 s with no progress signal | Streaming response OR in-flight progress UI (polling a status endpoint) | At audio lengths >60 s; cognitive-patience limit ~30 s |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| API key in server logs via structured-logger context capture | Key exfiltrated via log aggregation or file access; billable fraud | Logger redaction filter for sensitive header names; unit test asserts key not in captured logs |
| API key in frontend env / bundle | Zero-browser-side-credentials constraint (v1.0) violated | Server-side proxy only, `.env` loaded server-side, `VITE_*` prefix never touched for TTS config — mirror v1.0 LLM pattern exactly |
| API key in git via `.env` commit | Standard secret-in-repo risk | `.env` in `.gitignore` (already done v1.0); add `.env.example` with placeholder keys; pre-commit hook scans for ElevenLabs key pattern (`sk_...`) |
| Voice ID treated as sensitive | Not sensitive, but treating it as secret wastes effort | Voice IDs are not secrets — document in `.env.example` and deployment guide alongside voice library URLs |
| Debrief text (potentially exercise-sensitive) transmitted to third-party cloud | Corporate policy on data residency may apply | Milestone entry-gate: confirm the exercise-sensitivity classification is compatible with ElevenLabs' data handling (they do not train on API input per ToS; verify current ToS version); document in PROJECT.md Key Decisions |
| API key rotation has no code path | Stale key at next exercise | Rotation docs in deployment guide; health check distinguishes `auth_failed` explicitly; `.env` reload on scheduled-task restart |
| ElevenLabs response body cached on disk with permissive ACL | Audio recovery by unauthorised user | `TemporaryDirectory()` uses OS-default ACLs (restrictive); final MP3 streamed to response, not written to disk |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent failure when TTS is down | Facilitator clicks Generate, nothing happens, doesn't know why | Error state surfaced prominently in UI with the 8-code taxonomy label; markdown debrief still available (graceful degradation maintained) |
| No progress indicator during 60–90 s generation | Facilitator clicks Generate multiple times, exhausting quota | Spinner + "Generating... ~90 s" copy; button disabled during in-flight |
| Generic filename `podcast.mp3` on download | Facilitators can't tell files apart | `wargame-debrief-{scenario}-{ISO-timestamp}.mp3` |
| Autoplay on generation success | Disruptive in a live exercise setting; some browsers block autoplay | Never autoplay (confirmed anti-feature in milestone scope); user presses play explicitly |
| Audio plays in-app but layout shifts when it appears | Debrief-panel reflow, facilitator loses scroll position | Reserve space for the PodcastPlayer (skeleton) before audio is ready; fixed height on the container |
| No indication that ElevenLabs quota is low | First exercise works, second exercise fails mid-run | Health badge surfaces quota state (green / yellow / red) based on dashboard data; deployment docs include "check quota before exercise day" |
| Markdown download subtly changes position when podcast UI appears | Facilitator muscle-memory broken | Two download paths sit side-by-side in a stable layout; podcast UI degrades to "audio unavailable" without moving the markdown button |
| Regenerate button resets without confirmation | Accidental click wipes current audio | Either keep current audio visible during regenerate, or confirm "Regenerate? This will charge TTS again" for session-protection — design call |

---

## "Looks Done But Isn't" Checklist

Specific to v1.2. Check every one before tagging.

- [ ] **Podcast plays in-app but has a click/pop at persona boundaries** → verify pydub concat with normalisation + fade + silence pad, not raw byte concat (P-STITCH)
- [ ] **Podcast MP3 downloads but the filename is `podcast.mp3` or `(1).mp3`** → verify `Content-Disposition: attachment; filename="wargame-debrief-{scenario}-{timestamp}.mp3"` on the response (P-API) AND `download` attribute on the anchor (P-UI)
- [ ] **Podcast generates but EDIP is pronounced "ee-dip"** → verify acronym map applied; unit test passes against v1.0 EDIP config (P-TTS)
- [ ] **Health check reports OK but ElevenLabs auth was never actually validated** → verify `/api/health/tts` (or extended `/api/health/llm`) hits the voices-list endpoint and asserts every configured voice_id is present (P-API)
- [ ] **Generation works first time, fails silently on regenerate** → verify blob URL revocation + state-slice reset; second generate fixture test (P-UI)
- [ ] **Three-voice mapping is correct but personas speak in wrong order** → verify canonical persona order (Kent, Finch, Chen) enforced before TTS; fixture test with `Chen, Kent, Finch` emit order asserts output is `Kent, Finch, Chen` (P-TTS, P-E2E)
- [ ] **Facilitator can't tell generation failed** → verify error state surfaces 8-code taxonomy label in UI, not a generic "something went wrong" toast (P-UI)
- [ ] **Audio sounds fine but one MP3 is 10 MB** → verify `output_format="mp3_44100_128"` pinned; check file-size budget in E2E test (<5 MB for a 3-minute podcast at 128 kbps) (P-TTS, P-E2E)
- [ ] **Generation takes 3 minutes; user refreshes at 2:30; regenerate charges again** → verify disconnect detection server-side (`is_disconnected()` checkpoints) AND frontend button disabled in-flight (P-API, P-UI)
- [ ] **Markdown in debrief messages read aloud literally** → verify sanitiser strips `**`, `*`, `#`, `- `, backticks; unit test with v1.0 live-run debrief transcript as input (P-TTS)
- [ ] **ffmpeg missing on production Windows Server** → verify vendored binary + `AudioSegment.converter` absolute path + startup binary-presence check (P-STITCH)
- [ ] **LLM endpoint tests still green after TTS error-handler additions** → verify v1.0 + v1.1 backend suite (17/17) is unchanged; TTS tests added in a separate module (P-API, P-AUDIT)
- [ ] **Markdown debrief download still works when ElevenLabs is down** → verify graceful-degradation fixture test: TTS health red → markdown path succeeds end-to-end (P-E2E)
- [ ] **Prompt-token `withinLimit` CI assertion still green** → verify no prompt changes this milestone; `withinLimit` headroom ≥642 tokens (P-AUDIT)
- [ ] **v1.0 debrief-bucketing regression test still green** → verify 08-05 `lastDebriefIdx` halt intact; post-debrief messages do not leak into Round-N bucketing (P-E2E)
- [ ] **No API key in logs** → verify logger redaction filter active; capture-log test against decoy key asserts absence (P-TTS, P-AUDIT)
- [ ] **Temp files cleaned up after every session** → verify `TemporaryDirectory()` context manager used; post-generation temp-dir inspection empty (P-STITCH)
- [ ] **Per-session character budget enforced** → verify 7th regenerate in the same session returns `TTS_SESSION_BUDGET_EXCEEDED` (or whatever cap is set); log trace shows character counts (P-API)
- [ ] **Blob URL revoked on unmount + regenerate** → verify Chrome Task Manager: memory does not climb across 10 regenerates; unit test spies on `revokeObjectURL` (P-UI)
- [ ] **Corporate-firewall spike documented** → verify PROJECT.md Key Decisions entry exists for "ElevenLabs reachability from Windows Server confirmed YYYY-MM-DD" with either streaming or non-streaming endpoint choice documented (P-TTS, P-AUDIT)

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Free-tier quota exhausted mid-exercise | LOW | Switch env to fake provider for the rest of the exercise (markdown debrief still covers the facilitator need); top up account or move to paid tier for next exercise |
| Voice ID retired upstream | LOW | Find replacement in ElevenLabs voice library, update `.env`, restart scheduled task; deployment guide documents the procedure |
| Corporate firewall blocks streaming | MEDIUM | Provider config flag to fall back to non-streaming endpoint (all-at-once response); slower but functional; retest streaming on firewall-policy review |
| Click/pop at persona boundaries in shipped output | MEDIUM | Add silence pad + fade to stitching module; redeploy; existing recorded podcasts cannot be fixed retroactively (accept and note) |
| ffmpeg missing on server post-deploy | LOW | Drop vendored `ffmpeg.exe` into vendor dir; restart scheduled task; backend smoke test confirms |
| API key leaked in logs | HIGH | Rotate ElevenLabs API key immediately; review log-aggregation retention policy; purge affected log files; add redaction filter retroactively; post-mortem entry |
| Debrief bucketing regression (v1.0 test red) | MEDIUM | Revert the offending refactor; reinstate pure-function separation; verify both regression tests green; PR post-mortem note |
| Health check flips from green to red mid-exercise | MEDIUM | Facilitator sees badge change; graceful degradation to markdown debrief path; note the run; post-exercise investigate quota / network / auth specifically |
| Blob URL memory leak detected late | LOW | Ship a targeted patch with `useEffect` cleanup; users restart browser to reclaim memory in the interim |
| Temp-file accumulation (disk full) | MEDIUM | Emergency sweep of `%TEMP%\*.mp3` older than 1 hour; add scheduled-task sweep to cron/Task Scheduler; audit for leaked handles with Sysinternals Handle |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| # | Pitfall | Prevention Phase | Verification |
|---|---------|------------------|--------------|
| 1 | Free-tier quota burn | P-TTS + P-API | Fake provider is dev default; log shows `tts.characters_sent` per call; per-request cap enforced |
| 2 | Concurrency-limit hit | P-TTS | Serial execution; semaphore bounded; translated 429 → `TTS_RATE_LIMIT` |
| 3 | 5 s httpx timeout | P-TTS | Explicit timeout config; E2E test tolerates >30 s synthesis |
| 4 | Corporate firewall drops stream | P-TTS + P-AUDIT | Pre-build spike from target Windows Server documented in PROJECT.md |
| 5 | Markdown read aloud | P-TTS | `sanitize_for_tts` unit test passes against v1.0 debrief corpus |
| 6 | EDIP mispronounced | P-TTS + P-E2E | Acronym map unit test + facilitator listen-through checklist item |
| 7 | MP3 byte-concat artefacts | P-STITCH + P-E2E | pydub-based concat with normalisation + fade + pad; listen-through on Chrome/Edge |
| 8 | ffmpeg missing on Windows | P-STITCH + P-AUDIT | Vendored binary + absolute converter path + startup check; smoke test on server |
| 9 | Client disconnect charges anyway | P-API + P-UI | `is_disconnected()` checkpoints; log-trace: no orphan TTS calls; in-flight button disable |
| 10 | Blob URL leak + src race | P-UI | `useEffect` cleanup + conditional render; unit test on `revokeObjectURL` |
| 11 | Generic download filename | P-API + P-UI | `Content-Disposition` header + `download` attribute; E2E check filename pattern |
| 12 | Break markdown debrief | P-UI + P-E2E + P-AUDIT | Separate components, separate endpoints; graceful-degradation E2E test |
| 13 | Exception-handler ordering drift | P-API + P-AUDIT | Per-error-path test matrix; full v1.0 + v1.1 suite green |
| 14 | Debrief bucketing invariant break | P-TTS + P-E2E | Pure-function selector (no bucketing-loop refactor); 08-05 regression test + symmetric new test |
| 15 | Prompt-token budget CI break | P-TTS + P-AUDIT | No prompt changes; `withinLimit` headroom intact |
| 16 | Stale voice ID | P-API + P-E2E | Health probe validates every voice_id; `TTS_VOICE_INVALID` code path tested |
| 17 | API key in logs | P-TTS + P-AUDIT | Logger redaction filter; decoy-key test asserts absence |
| 18 | Shallow health check | P-API + P-UI + P-AUDIT | Health hits real voices-list; 8-code badge; empirical flip-test (garbage voice_id → red) |
| 19 | Cost blow-up via double-click | P-UI + P-API + P-E2E | Button disabled in-flight; per-session rate limit; rapid-double-click test |
| 20 | Wrong persona speaking order | P-TTS + P-STITCH + P-E2E | Canonical order enforced; fixture test with non-canonical input |
| 21 | Temp-file accumulation on Windows | P-STITCH + P-AUDIT | `TemporaryDirectory()` context manager; in-memory final output; deployment-guide monitoring entry |

---

## Sources

- ElevenLabs concurrency + pricing: [help.elevenlabs.io/Rate Limits](https://help.elevenlabs.io/hc/en-us/articles/14312733311761-How-many-Text-to-Speech-requests-can-I-make-and-can-I-increase-it), [help.elevenlabs.io/Error 429](https://help.elevenlabs.io/hc/en-us/articles/19571824571921-API-Error-Code-429), [deepgram.com/ElevenLabs limits at scale](https://deepgram.com/learn/elevenlabs-production-limits-concurrency-credits-compliance), [flexprice.io/ElevenLabs 2026 pricing](https://flexprice.io/blog/elevenlabs-pricing-breakdown)
- ElevenLabs free-tier character quota: [help.elevenlabs.io/maximum characters](https://help.elevenlabs.io/hc/en-us/articles/13298164480913)
- ElevenLabs Python SDK timeout behaviour: [github.com/elevenlabs/elevenlabs-python](https://github.com/elevenlabs/elevenlabs-python), [github.com/elevenlabs/elevenlabs-python streaming timeout #127](https://github.com/elevenlabs/elevenlabs-python/issues/127), [deepwiki.com/Client Wrapper System](https://deepwiki.com/elevenlabs/elevenlabs-python/3.1-client-wrapper-system)
- httpx default timeouts: [python-httpx.org/advanced/timeouts](https://www.python-httpx.org/advanced/timeouts/)
- FastAPI disconnect handling: [github.com/fastapi/fastapi #1342](https://github.com/fastapi/fastapi/issues/1342), [github.com/fastapi/fastapi discussion #14552](https://github.com/fastapi/fastapi/discussions/14552), [github.com/fastapi/fastapi discussion #7572](https://github.com/fastapi/fastapi/discussions/7572)
- pydub + ffmpeg + Windows: [github.com/jiaaro/pydub #348 (missing ffmpeg)](https://github.com/jiaaro/pydub/issues/348), [#668 (Windows PATH workaround)](https://github.com/jiaaro/pydub/issues/668), [#173 (CouldntDecodeError)](https://github.com/jiaaro/pydub/issues/173)
- pydub silence click artefact: [github.com/jiaaro/pydub #423](https://github.com/jiaaro/pydub/issues/423), [#215 (concat-with-silence)](https://github.com/jiaaro/pydub/issues/215)
- MP3 VBR/CBR concat issues: [gearspace.com/CBR vs VBR encoding](https://gearspace.com/board/mastering-forum/1304131-cbr-vs-vbr-encoding.html), [mp3decoders.mp3-tech.org/vbr](http://mp3decoders.mp3-tech.org/vbr.html), [trac.ffmpeg.org/Encode/MP3](https://trac.ffmpeg.org/wiki/Encode/MP3)
- React blob URL + useEffect cleanup: [MDN URL.revokeObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static), [github.com/VitorLuizC/use-object-url](https://github.com/VitorLuizC/use-object-url)
- KVWarGame internal references: `C:\KVWarGame\.planning\PROJECT.md` (v1.0 + v1.1 Key Decisions); MDInsights `SamuraiJenkinz/daily-intelligence-brief` (TTSProvider ABC pattern, 10x-cost warning, atomic temp + rename, `api_events` logging)

---
*Pitfalls research for: v1.2 Debrief Podcast — ElevenLabs-driven three-voice MP3 generation layered onto shipped FastAPI + React facilitation tool on Windows Server scheduled task*
*Researched: 2026-04-17*
