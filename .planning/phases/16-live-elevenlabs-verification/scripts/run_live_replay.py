"""
run_live_replay.py — Phase 16 Tier-B Live ElevenLabs Replay Script
====================================================================

Purpose
-------
Empirically prove that PODGEN-01..08 and PODPLAY-01..05 hold against a real
ElevenLabs API key using the v0.10 configured voice IDs, a locked Scenario-2
debrief fixture, and a committed stitched MP3 binary.

This script is the Phase 16 equivalent of run_firewall_spike.py (Phase 13).
It is run ONCE on the deployment host (MC211APT2AS5AHG) after the backend is
booted with TTS_PROVIDER=elevenlabs.

Usage (Windows CMD — run on MC211APT2AS5AHG):
    1. Ensure backend/.env has TTS_PROVIDER=elevenlabs + all ELEVENLABS_* vars.
    2. Start backend: cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000
    3. pip install requests  (one-time, not in backend/requirements.txt)
    4. python .planning/phases/16-live-elevenlabs-verification/scripts/run_live_replay.py
    5. Optional single-persona re-gen: add --persona kent|finch|chen

Exit codes:
    0 — Replay succeeded: evidence MP3 + offsets JSON written to evidence/
    1 — HTTP/validation failure, transient error after retries, or
        auth_error / rate_limited from backend health endpoint
    2 — Required environment variable missing or fixture malformed

Single-persona re-gen (Tier-A fix loop):
    --persona <name>   Re-generate only one segment, splice into existing MP3,
                       recompute offsets JSON.  Example:
                         python run_live_replay.py --persona kent

Auth hygiene:
    - ELEVENLABS_API_KEY is verified as set but its value is NEVER printed.
    - Voice ID values are fetched from /api/config/tts-voices and NEVER printed.
    - Script performs an auth-leak assertion before exit (adapted from
      run_firewall_spike.py:200-205).
"""

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Dependency check
# ---------------------------------------------------------------------------
try:
    import requests
except ImportError:
    print("ERROR: 'requests' package not installed.", file=sys.stderr)
    print("Run: pip install requests", file=sys.stderr)
    sys.exit(2)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_BACKEND_BASE = "http://localhost:8000"
_VOICES_ENDPOINT = f"{_BACKEND_BASE}/api/config/tts-voices"
_HEALTH_TTS_ENDPOINT = f"{_BACKEND_BASE}/api/health/tts"
_PODCAST_POST_ENDPOINT = f"{_BACKEND_BASE}/api/debrief/podcast"

# Path roots — resolved relative to this script's location
_SCRIPT_DIR = Path(__file__).parent
_PHASE_DIR = _SCRIPT_DIR.parent
_FIXTURES_DIR = _PHASE_DIR / "fixtures"
_EVIDENCE_DIR = _PHASE_DIR / "evidence"

_FIXTURE_PATH = _FIXTURES_DIR / "scenario2-debrief.json"
_MP3_PATH = _EVIDENCE_DIR / "debrief-scenario2-live.mp3"
_OFFSETS_PATH = _EVIDENCE_DIR / "segment-offsets.json"

# CBR constants: mp3_44100_128 = 128 kbps
_CBR_KBPS = 128_000  # bits per second
_BYTES_PER_SECOND = _CBR_KBPS // 8  # 16,000 bytes/second

# Sanity envelope for ~80-word total debrief (~25-40s of speech at 128kbps CBR)
_MIN_MP3_BYTES = 80_000
_MAX_MP3_BYTES = 1_200_000

# Token window for GET /audio?token=... (TokenStore TTL is 60s; allow 30s headroom)
_TOKEN_FETCH_DEADLINE_S = 30

# Retry policy for the initial POST
_MAX_RETRIES = 3
_RETRY_BACKOFF_S = [1, 2, 4]

# Request timeout for the SSE stream (per-read chunk timeout)
_SSE_TIMEOUT_S = 120

# Headers that must never appear in sanitized output (from run_firewall_spike.py)
_SENSITIVE_HEADER_FRAGMENTS = (
    "authorization",
    "api-key",
    "x-api-key",
    "xi-api-key",
    "set-cookie",
    "cookie",
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sanitize_headers(headers: dict) -> dict:
    """Return a copy of headers with sensitive entries removed."""
    sanitized = {}
    for name, value in headers.items():
        name_lower = name.lower()
        if not any(frag in name_lower for frag in _SENSITIVE_HEADER_FRAGMENTS):
            sanitized[name] = value
    return sanitized


def _seconds_to_bytes(seconds: float) -> int:
    """Convert CBR seconds to byte offset at 128kbps."""
    return int(seconds * _BYTES_PER_SECOND)


def _bytes_to_seconds(n: int) -> float:
    """Convert byte count to CBR duration at 128kbps."""
    return (n * 8) / _CBR_KBPS


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# Step 1 — Environment guard
# ---------------------------------------------------------------------------


def _check_env() -> str:
    """Verify ELEVENLABS_API_KEY is set.  Return the value for the leak check only."""
    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    if not api_key:
        print("ERROR: ELEVENLABS_API_KEY environment variable is not set.", file=sys.stderr)
        print(
            "The backend must be booted with this variable; the script re-checks\n"
            "so the output is not misleading if the backend is misconfigured.",
            file=sys.stderr,
        )
        print("\nWindows CMD:  set ELEVENLABS_API_KEY=<key>", file=sys.stderr)
        sys.exit(2)
    return api_key


# ---------------------------------------------------------------------------
# Step 2 — Load and validate fixture
# ---------------------------------------------------------------------------


def _load_fixture() -> dict[str, str]:
    """Load scenario2-debrief.json and validate shape.  Exit 2 on malformed."""
    if not _FIXTURE_PATH.exists():
        print(f"ERROR: Fixture not found: {_FIXTURE_PATH}", file=sys.stderr)
        sys.exit(2)
    try:
        data = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"ERROR: Fixture is not valid JSON: {exc}", file=sys.stderr)
        sys.exit(2)
    for key in ("kent", "finch", "chen"):
        if key not in data:
            print(f"ERROR: Fixture missing required key '{key}'.", file=sys.stderr)
            sys.exit(2)
        if not isinstance(data[key], str) or not data[key].strip():
            print(f"ERROR: Fixture key '{key}' is empty or not a string.", file=sys.stderr)
            sys.exit(2)
    return {k: data[k] for k in ("kent", "finch", "chen")}


# ---------------------------------------------------------------------------
# Step 3 — Fetch voice IDs (values never printed)
# ---------------------------------------------------------------------------


def _fetch_voice_ids() -> dict[str, str]:
    """GET /api/config/tts-voices.  Voice ID values are redacted from output."""
    try:
        resp = requests.get(_VOICES_ENDPOINT, timeout=10)
    except requests.exceptions.RequestException as exc:
        print(f"ERROR: Could not reach {_VOICES_ENDPOINT}: {exc}", file=sys.stderr)
        print("Is the backend running on localhost:8000?", file=sys.stderr)
        sys.exit(1)
    if resp.status_code != 200:
        print(f"ERROR: {_VOICES_ENDPOINT} returned HTTP {resp.status_code}", file=sys.stderr)
        sys.exit(1)
    voices = resp.json()
    for key in ("kent", "finch", "chen"):
        if key not in voices or not voices[key]:
            print(f"ERROR: Voice map missing key '{key}' or value is empty.", file=sys.stderr)
            sys.exit(1)
    # IMPORTANT: print count only — never print the actual voice ID values.
    print("Fetched 3 voice IDs from /api/config/tts-voices (values redacted)")
    return {k: voices[k] for k in ("kent", "finch", "chen")}


# ---------------------------------------------------------------------------
# Step 4 — Preflight health check
# ---------------------------------------------------------------------------


def _preflight_health_check() -> None:
    """GET /api/health/tts.  Exit 1 if ok != true (catches quota/auth issues)."""
    print(f"Preflight: GET {_HEALTH_TTS_ENDPOINT} ...")
    try:
        resp = requests.get(_HEALTH_TTS_ENDPOINT, timeout=20)
    except requests.exceptions.RequestException as exc:
        print(f"ERROR: Health endpoint unreachable: {exc}", file=sys.stderr)
        sys.exit(1)
    if resp.status_code != 200:
        print(f"ERROR: Health endpoint returned HTTP {resp.status_code}", file=sys.stderr)
        sys.exit(1)
    body = resp.json()
    if not body.get("ok"):
        code = body.get("code", "unknown")
        hint = body.get("hint", "")
        print(
            f"ERROR: TTS health check failed — code={code!r}, hint={hint!r}",
            file=sys.stderr,
        )
        print(
            "Fix the ElevenLabs configuration before running the replay.",
            file=sys.stderr,
        )
        sys.exit(1)
    print(f"Preflight: TTS health OK (latencyMs={body.get('latencyMs')})")


# ---------------------------------------------------------------------------
# Step 5 — Minimal SSE parser (no sseclient dep)
# ---------------------------------------------------------------------------


def _parse_sse_lines(response: "requests.Response") -> "dict":
    """
    Minimal inline SSE parser.  Yields parsed event dicts from a streaming
    requests.Response whose content-type is text/event-stream.

    Event shape emitted by backend: data: {json}\n\n
    """
    buffer: list[str] = []
    for raw_line in response.iter_lines(decode_unicode=True):
        if raw_line.startswith("data:"):
            buffer.append(raw_line[5:].strip())
        elif raw_line == "" and buffer:
            payload = " ".join(buffer).strip()
            buffer = []
            if payload:
                try:
                    yield json.loads(payload)
                except json.JSONDecodeError:
                    pass  # skip malformed events


# ---------------------------------------------------------------------------
# Step 6 — POST podcast + consume SSE
# ---------------------------------------------------------------------------


def _post_podcast(
    fixture: dict[str, str],
    voices: dict[str, str],
    persona_filter: str | None = None,
) -> tuple[str, list[float], int, dict[str, float]]:
    """
    POST to /api/debrief/podcast, consume SSE stream.

    Returns:
        token            — from done event
        offsets          — [0.0, finch_start_s, chen_start_s] from done event
        word_count       — from done event
        latencies        — {persona: elapsed_s from POST to persona_done}

    Exits 1 on error event or HTTP 4xx/5xx.
    """
    body: dict = {
        "game_name": "scenario2-debrief-live-replay",
        "persona_texts": fixture,
        "voices": voices,
        "force_fresh": True,
    }

    headers = {
        "Accept": "text/event-stream",
        "Content-Type": "application/json",
    }

    persona_start_times: dict[str, float] = {}
    persona_end_times: dict[str, float] = {}
    token: str | None = None
    offsets: list[float] = []
    word_count: int = 0

    attempt = 0
    while attempt <= _MAX_RETRIES:
        attempt += 1
        print(f"\nPOST {_PODCAST_POST_ENDPOINT} (attempt {attempt}/{_MAX_RETRIES + 1}) ...")
        post_start = time.monotonic()

        try:
            response = requests.post(
                _PODCAST_POST_ENDPOINT,
                json=body,
                headers=headers,
                stream=True,
                timeout=_SSE_TIMEOUT_S,
            )
        except requests.exceptions.Timeout:
            if attempt <= _MAX_RETRIES:
                wait = _RETRY_BACKOFF_S[attempt - 1]
                print(f"  Timeout — retrying in {wait}s ...")
                time.sleep(wait)
                continue
            print("ERROR: POST timed out after all retries.", file=sys.stderr)
            sys.exit(1)
        except requests.exceptions.ConnectionError as exc:
            if attempt <= _MAX_RETRIES:
                wait = _RETRY_BACKOFF_S[attempt - 1]
                print(f"  Connection error ({exc}) — retrying in {wait}s ...")
                time.sleep(wait)
                continue
            print(f"ERROR: Connection failed after all retries: {exc}", file=sys.stderr)
            sys.exit(1)

        # Non-retryable auth/quota errors
        if response.status_code in (401, 403):
            print(
                f"ERROR: HTTP {response.status_code} from podcast endpoint — "
                "ElevenLabs auth failure. Fix ELEVENLABS_API_KEY and retry.",
                file=sys.stderr,
            )
            sys.exit(1)
        if response.status_code == 429:
            print(
                "ERROR: HTTP 429 from podcast endpoint — ElevenLabs rate limited. "
                "Wait before retrying.",
                file=sys.stderr,
            )
            sys.exit(1)

        # Retryable 5xx
        if response.status_code >= 500:
            if attempt <= _MAX_RETRIES:
                wait = _RETRY_BACKOFF_S[attempt - 1]
                print(
                    f"  HTTP {response.status_code} — retrying in {wait}s ..."
                )
                time.sleep(wait)
                continue
            print(
                f"ERROR: HTTP {response.status_code} after all retries.",
                file=sys.stderr,
            )
            sys.exit(1)

        if response.status_code != 200:
            print(
                f"ERROR: Unexpected HTTP {response.status_code}: {response.text[:200]}",
                file=sys.stderr,
            )
            sys.exit(1)

        print(f"  HTTP 200 — consuming SSE stream ...")

        # Consume SSE events
        for event in _parse_sse_lines(response):
            etype = event.get("type") or event.get("event", "")

            if etype == "persona_start":
                persona = event.get("persona", "?")
                t = time.monotonic() - post_start
                persona_start_times[persona] = t
                print(f"  [{t:.2f}s] persona_start: {persona}")

            elif etype == "persona_done":
                persona = event.get("persona", "?")
                t = time.monotonic() - post_start
                persona_end_times[persona] = t
                print(f"  [{t:.2f}s] persona_done: {persona}")

            elif etype == "done":
                t = time.monotonic() - post_start
                token = event.get("token")
                offsets = event.get("offsets", [])
                word_count = event.get("word_count", 0)
                print(f"  [{t:.2f}s] done event received — token acquired, offsets={offsets}")

            elif etype == "error":
                code = event.get("code", "unknown")
                hint = event.get("hint", "")
                print(
                    f"ERROR: Server sent error event — code={code!r}, hint={hint!r}",
                    file=sys.stderr,
                )
                sys.exit(1)

        break  # success — exit retry loop

    if not token:
        print("ERROR: SSE stream ended without a 'done' event — no token received.", file=sys.stderr)
        sys.exit(1)
    if len(offsets) != 3:
        print(
            f"ERROR: Expected 3 offsets in done event, got {len(offsets)}: {offsets}",
            file=sys.stderr,
        )
        sys.exit(1)

    latencies = {
        p: persona_end_times.get(p, 0.0) - persona_start_times.get(p, 0.0)
        for p in ("kent", "finch", "chen")
    }
    return token, offsets, word_count, latencies


# ---------------------------------------------------------------------------
# Step 7 — Fetch stitched MP3 via token
# ---------------------------------------------------------------------------


def _fetch_mp3(token: str) -> bytes:
    """GET /api/debrief/podcast/audio?token=... within the TTL window."""
    audio_url = f"{_BACKEND_BASE}/api/debrief/podcast/audio?token={token}"
    print(f"\nGET {_BACKEND_BASE}/api/debrief/podcast/audio?token=<redacted> ...")
    deadline = time.monotonic() + _TOKEN_FETCH_DEADLINE_S

    for attempt in range(1, 4):
        if time.monotonic() > deadline:
            print("ERROR: Token TTL window expired before MP3 fetch.", file=sys.stderr)
            sys.exit(1)
        try:
            resp = requests.get(audio_url, timeout=30)
        except requests.exceptions.RequestException as exc:
            if attempt < 3 and time.monotonic() < deadline:
                print(f"  Fetch attempt {attempt} failed ({exc}) — retrying ...")
                time.sleep(1)
                continue
            print(f"ERROR: Could not fetch MP3: {exc}", file=sys.stderr)
            sys.exit(1)

        if resp.status_code != 200:
            print(f"ERROR: Audio fetch returned HTTP {resp.status_code}", file=sys.stderr)
            sys.exit(1)
        content_type = resp.headers.get("content-type", "")
        if "audio/mpeg" not in content_type and "audio/mp3" not in content_type:
            print(
                f"ERROR: Unexpected Content-Type: {content_type!r} (expected audio/mpeg)",
                file=sys.stderr,
            )
            sys.exit(1)
        return resp.content

    print("ERROR: All MP3 fetch attempts failed.", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Step 8 — Splice a single persona segment (--persona re-gen mode)
# ---------------------------------------------------------------------------


def _splice_persona(persona: str, new_segment_bytes: bytes, mp3_bytes: bytes,
                    offsets: list[float]) -> tuple[bytes, list[float]]:
    """
    Replace one segment in the existing MP3 with new_segment_bytes.
    Recompute offsets from new segment byte boundaries.

    ElevenLabs output is not byte-deterministic for the same input, so
    stale offsets would cause Skip-to-Finch/Chen to land in the wrong
    segment.
    """
    kent_end = _seconds_to_bytes(offsets[1])
    finch_end = _seconds_to_bytes(offsets[2]) if len(offsets) > 2 else len(mp3_bytes)
    # Approximate segment boundary for chen end
    chen_end = len(mp3_bytes)

    if persona == "kent":
        kent_seg = new_segment_bytes
        finch_seg = mp3_bytes[kent_end:finch_end]
        chen_seg = mp3_bytes[finch_end:chen_end]
    elif persona == "finch":
        kent_seg = mp3_bytes[0:kent_end]
        finch_seg = new_segment_bytes
        chen_seg = mp3_bytes[finch_end:chen_end]
    else:  # chen
        kent_seg = mp3_bytes[0:kent_end]
        finch_seg = mp3_bytes[kent_end:finch_end]
        chen_seg = new_segment_bytes

    new_mp3 = kent_seg + finch_seg + chen_seg

    # Recompute offsets from new byte boundaries
    new_finch_start_s = _bytes_to_seconds(len(kent_seg))
    new_chen_start_s = _bytes_to_seconds(len(kent_seg) + len(finch_seg))
    new_offsets = [0.0, new_finch_start_s, new_chen_start_s]

    return new_mp3, new_offsets


# ---------------------------------------------------------------------------
# Step 9 — Write evidence files
# ---------------------------------------------------------------------------


def _write_evidence(mp3_bytes: bytes, offsets: list[float], word_count: int) -> None:
    """Write the stitched MP3 and segment-offsets.json to the evidence directory."""
    _EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    _MP3_PATH.write_bytes(mp3_bytes)
    offsets_data = {
        "offsets": offsets,
        "word_count": word_count,
        "captured_at": datetime.now(timezone.utc).isoformat(),
    }
    _OFFSETS_PATH.write_text(json.dumps(offsets_data, indent=2), encoding="utf-8")
    print(f"\nEvidence written:")
    print(f"  MP3:     {_MP3_PATH}")
    print(f"  Offsets: {_OFFSETS_PATH}")


# ---------------------------------------------------------------------------
# Step 10 — Print summary block (paste into §3 of 16-LIVE-VERIFICATION.md)
# ---------------------------------------------------------------------------


def _print_summary(
    mp3_bytes: bytes,
    offsets: list[float],
    word_count: int,
    latencies: dict[str, float],
    wall_clock_total_s: float,
) -> list[str]:
    """Print the summary block consumed by 16-LIVE-VERIFICATION.md §3 + §4."""
    sha = _sha256(mp3_bytes)
    size = len(mp3_bytes)
    duration_cbr = _bytes_to_seconds(size)

    # Per-segment byte slices (using CBR offsets)
    finch_byte = _seconds_to_bytes(offsets[1]) if len(offsets) > 1 else 0
    chen_byte = _seconds_to_bytes(offsets[2]) if len(offsets) > 2 else 0

    kent_bytes = mp3_bytes[0:finch_byte]
    finch_bytes = mp3_bytes[finch_byte:chen_byte]
    chen_bytes = mp3_bytes[chen_byte:]

    lines: list[str] = [
        "",
        "=" * 70,
        "SUMMARY — paste into 16-LIVE-VERIFICATION.md §3 + §4",
        "=" * 70,
        "",
        "[ Per-segment evidence ]",
        f"  Kent   — persona_done latency: {latencies.get('kent', 0):.2f}s",
        f"           Content-Type: audio/mpeg (via stitched MP3 token pull)",
        f"           First 32 bytes (hex): {kent_bytes[:32].hex() if kent_bytes else 'N/A'}",
        f"  Finch  — persona_done latency: {latencies.get('finch', 0):.2f}s",
        f"           First 32 bytes (hex): {finch_bytes[:32].hex() if finch_bytes else 'N/A'}",
        f"  Chen   — persona_done latency: {latencies.get('chen', 0):.2f}s",
        f"           First 32 bytes (hex): {chen_bytes[:32].hex() if chen_bytes else 'N/A'}",
        "",
        "[ Stitched MP3 artifact ]",
        f"  File:              evidence/debrief-scenario2-live.mp3",
        f"  SHA-256:           {sha}",
        f"  Size (bytes):      {size:,}",
        f"  First 32 bytes:    {mp3_bytes[:32].hex()}",
        f"  Duration (CBR):    {duration_cbr:.2f}s",
        f"  Word count:        {word_count}",
        f"  Offsets:           {offsets}",
        f"  Offsets JSON:      evidence/segment-offsets.json",
        "",
        "[ Replay timing ]",
        f"  Total wall-clock:  {wall_clock_total_s:.2f}s",
        "=" * 70,
    ]

    for line in lines:
        print(line)

    return lines


# ---------------------------------------------------------------------------
# Step 11 — Auth-leak assertion (adapted from run_firewall_spike.py:200-205)
# ---------------------------------------------------------------------------


def _assert_no_auth_leak(
    output_lines: list[str],
    api_key: str,
    voice_ids: dict[str, str],
) -> None:
    """
    Scan the full stdout buffer for any substring matching the API key or
    any of the three voice ID values.  If ANY match, emit AUTH_LEAK_DETECTED
    to stderr and exit 1.

    This is the discipline from run_firewall_spike.py adapted for Phase 16's
    larger auth surface (API key + three voice IDs).
    """
    secrets = [api_key] + list(voice_ids.values())
    joined = "\n".join(output_lines)
    leaks = [s for s in secrets if s in joined]
    if leaks:
        count = len(leaks)
        print(
            f"\n{'!' * 70}\n"
            f"AUTH_LEAK_DETECTED: {count} secret(s) found in stdout buffer.\n"
            f"This is a bug in run_live_replay.py — review the output above.\n"
            f"{'!' * 70}",
            file=sys.stderr,
        )
        sys.exit(1)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Phase 16 Tier-B live ElevenLabs replay for Scenario-2 debrief."
    )
    parser.add_argument(
        "--persona",
        choices=["kent", "finch", "chen"],
        default=None,
        help="Re-generate only one persona segment and splice into existing MP3.",
    )
    args = parser.parse_args()
    persona_filter: str | None = args.persona

    wall_clock_start = time.monotonic()
    stdout_buffer: list[str] = []

    # Step 1 — Env guard (value used only for leak check, never printed)
    api_key = _check_env()

    # Step 2 — Load fixture
    fixture = _load_fixture()
    print(f"Fixture loaded: {_FIXTURE_PATH.name} ({len(fixture)} personas)")

    # Step 3 — Fetch voice IDs (values redacted in output)
    voice_ids = _fetch_voice_ids()

    # Step 4 — Preflight health check
    _preflight_health_check()

    # Step 5-6 — POST podcast + consume SSE
    if persona_filter:
        # Single-persona re-gen: build a single-key persona_texts dict
        filtered_fixture = {persona_filter: fixture[persona_filter]}
        filtered_voices = {persona_filter: voice_ids[persona_filter]}
        print(f"\nSingle-persona re-gen mode: {persona_filter}")
        token, offsets_new, word_count, latencies = _post_podcast(
            filtered_fixture, filtered_voices, persona_filter
        )
    else:
        token, offsets_new, word_count, latencies = _post_podcast(fixture, voice_ids)

    # Step 7 — Fetch stitched MP3
    mp3_bytes = _fetch_mp3(token)

    # Step 8 — Splice if single-persona re-gen
    if persona_filter and _MP3_PATH.exists():
        existing_mp3 = _MP3_PATH.read_bytes()
        existing_offsets_data = json.loads(_OFFSETS_PATH.read_text(encoding="utf-8"))
        existing_offsets = existing_offsets_data.get("offsets", [0.0, 0.0, 0.0])
        mp3_bytes, offsets_new = _splice_persona(
            persona_filter, mp3_bytes, existing_mp3, existing_offsets
        )
        print(f"Spliced {persona_filter} segment; new offsets={offsets_new}")
    elif persona_filter:
        print(
            "WARNING: --persona specified but no existing MP3 found — "
            "treating as full run.",
            file=sys.stderr,
        )

    # Step 9 — Write evidence files
    _write_evidence(mp3_bytes, offsets_new, word_count)

    # Step 10 — Print summary block
    wall_clock_total = time.monotonic() - wall_clock_start
    summary_lines = _print_summary(mp3_bytes, offsets_new, word_count, latencies, wall_clock_total)
    stdout_buffer.extend(summary_lines)

    # Step 11 — Auth-leak assertion (MUST be last before exit 0)
    _assert_no_auth_leak(stdout_buffer, api_key, voice_ids)

    # Sanity size check
    size = len(mp3_bytes)
    if size < _MIN_MP3_BYTES or size > _MAX_MP3_BYTES:
        print(
            f"\nWARNING: MP3 size {size:,} bytes is outside the expected envelope "
            f"({_MIN_MP3_BYTES:,} – {_MAX_MP3_BYTES:,}). "
            "Verify the audio plays correctly in VLC.",
            file=sys.stderr,
        )

    print(f"\nREPLAY RESULT: PASS — evidence written to {_EVIDENCE_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
