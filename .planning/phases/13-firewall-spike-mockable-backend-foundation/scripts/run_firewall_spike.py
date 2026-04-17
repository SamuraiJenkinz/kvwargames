"""
run_firewall_spike.py — PODDEP-01 Firewall Spike Script
========================================================

Purpose
-------
Empirically prove that the target deployment host (Windows Server inside the
MMC corporate network) can reach api.elevenlabs.io over TLS and receive a
>60-second MP3 payload intact.

This script is intended to be run ONCE per deployment-network change, executed
directly on the target Windows Server from inside the corporate proxy environment.
It is the entry-gate check for v1.2 Phase 13 — plans 13-02 and 13-03 must NOT
start until this script exits with code 0 and the evidence is committed.

Running from a developer laptop proves nothing about the corporate firewall posture.

Usage (Windows CMD):
    set ELEVENLABS_API_KEY=<your-real-key>
    set ELEVENLABS_VOICE_KENT=<voice-id>
    python .planning/phases/13-firewall-spike-mockable-backend-foundation/scripts/run_firewall_spike.py

Exit codes:
    0 — HTTP 200 received, response body >= 900,000 bytes (>60s at 128kbps CBR)
    1 — HTTP non-200 OR body < 900,000 bytes
    2 — Required environment variable missing (ELEVENLABS_API_KEY or ELEVENLABS_VOICE_KENT)

The raw MP3 response is written to:
    .planning/phases/13-firewall-spike-mockable-backend-foundation/13-firewall-spike-payload.mp3

Evidence gating
---------------
After a successful run, the operator fills in:
    .planning/phases/13-firewall-spike-mockable-backend-foundation/13-01-FIREWALL-SPIKE.md
with the stdout output from this script (paste verbatim into section 5).
"""

import json
import os
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Dependency check — requests is the ONLY external dependency for this spike.
# It is NOT added to backend/requirements.txt because production uses httpx.
# Install once on the target server: pip install requests
# ---------------------------------------------------------------------------
try:
    import requests
except ImportError:
    print("ERROR: 'requests' package not installed.", file=sys.stderr)
    print("Run: pip install requests", file=sys.stderr)
    sys.exit(2)

# ---------------------------------------------------------------------------
# Configuration — read from environment, NEVER hardcoded in source
# ---------------------------------------------------------------------------
_REQUIRED_ENV_VARS = ("ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_KENT")

# Headers that must never appear in sanitized output
_SENSITIVE_HEADER_FRAGMENTS = (
    "authorization",
    "api-key",
    "x-api-key",
    "xi-api-key",
    "set-cookie",
    "cookie",
)

# Output format pinned to match the production TTSProvider
_OUTPUT_FORMAT = "mp3_44100_128"
_MODEL_ID = "eleven_multilingual_v2"

# Minimum acceptable response size (bytes): >60s at 128kbps CBR
# 60 s * 128_000 bps / 8 = 960_000 bytes; 900_000 is a conservative floor
_MIN_BYTES = 900_000

# Generous timeout: long-form TTS render can take 30–180 s
_TIMEOUT_SECONDS = 180

# The spike text — verbatim to make the output deterministic across re-runs.
# ~500 chars of EDIP-domain prose at typical English reading rate (~150 wpm)
# comfortably exceeds 60 seconds of synthesised speech.
SPIKE_TEXT = (
    "This is a representative EDIP debrief segment for the v1.2 podcast "
    "firewall-reachability spike. Over the past three rounds the participants "
    "navigated escalating pressure on the eastern flank: Russia mobilised "
    "additional battalions, NATO and the EU coordinated responses, and defence "
    "stocks in frontline states began to deplete rapidly. The crisis severity "
    "reached level four. Kent Valentina advocated accepting broader EDIP powers. "
    "Doctor Alistair Finch flagged the transition to a security related supply "
    "crisis. Doctor Michael Chen catalogued the industrial and legal tradeoffs."
)

# Output path — resolved relative to this script's location
_OUTPUT_PATH = Path(__file__).parent.parent / "13-firewall-spike-payload.mp3"


def _check_env() -> tuple[str, str]:
    """Verify required env vars are present; exit code 2 if any are missing."""
    missing = [v for v in _REQUIRED_ENV_VARS if not os.environ.get(v)]
    if missing:
        for var in missing:
            print(f"ERROR: Required environment variable '{var}' is not set.", file=sys.stderr)
        print(
            "\nSet ELEVENLABS_API_KEY and ELEVENLABS_VOICE_KENT before running this script.",
            file=sys.stderr,
        )
        print(
            "Windows CMD:   set ELEVENLABS_API_KEY=<key>  &&  set ELEVENLABS_VOICE_KENT=<voice_id>",
            file=sys.stderr,
        )
        sys.exit(2)

    api_key = os.environ["ELEVENLABS_API_KEY"]
    voice_id = os.environ["ELEVENLABS_VOICE_KENT"]
    return api_key, voice_id


def _sanitize_headers(headers: dict) -> dict:
    """
    Return a copy of the response headers dict with sensitive entries removed.
    Strips any header whose name (case-insensitively) contains any of the
    _SENSITIVE_HEADER_FRAGMENTS strings.
    """
    sanitized = {}
    for name, value in headers.items():
        name_lower = name.lower()
        if not any(fragment in name_lower for fragment in _SENSITIVE_HEADER_FRAGMENTS):
            sanitized[name] = value
    return sanitized


def main() -> int:
    """Execute the firewall spike and return an exit code (0 = pass, 1 = fail)."""
    api_key, voice_id = _check_env()

    # Safety assertion: API key must NOT appear in any string we print.
    # This is evaluated dynamically after the prints; the structure below
    # ensures the key is never passed to any print() call.
    # We capture all output lines in a list for the post-print assertion.
    output_lines: list[str] = []

    url = (
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        f"?output_format={_OUTPUT_FORMAT}"
    )
    headers = {
        "xi-api-key": api_key,  # ElevenLabs uses xi-api-key, NOT Authorization: Bearer
        "Content-Type": "application/json",
    }
    payload = {
        "text": SPIKE_TEXT,
        "model_id": _MODEL_ID,
    }

    print(f"Sending request to api.elevenlabs.io (voice_id={voice_id!r}, "
          f"format={_OUTPUT_FORMAT!r}, model={_MODEL_ID!r}) ...")
    print(f"Text length: {len(SPIKE_TEXT)} characters")
    print("Waiting for response (timeout=180s) ...")

    start = time.monotonic()
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=_TIMEOUT_SECONDS)
    except requests.exceptions.Timeout:
        print("ERROR: Request timed out after 180 seconds.", file=sys.stderr)
        print("This may indicate a corporate firewall blocking the TLS connection.", file=sys.stderr)
        return 1
    except requests.exceptions.SSLError as exc:
        print(f"ERROR: TLS/SSL error: {exc}", file=sys.stderr)
        print("Possible causes: corporate proxy performing TLS inspection without cert injection.", file=sys.stderr)
        return 1
    except requests.exceptions.ConnectionError as exc:
        print(f"ERROR: Connection error: {exc}", file=sys.stderr)
        print("Possible causes: DNS failure, firewall blocking port 443 to api.elevenlabs.io.", file=sys.stderr)
        return 1

    elapsed = time.monotonic() - start
    bytes_received = len(response.content)
    sanitized = _sanitize_headers(dict(response.headers))

    # --- Structured output (paste into evidence section 5) ---
    lines = [
        f"HTTP status: {response.status_code}",
        f"Content-Type: {response.headers.get('Content-Type')}",
        f"Content-Length (reported): {response.headers.get('Content-Length') or 'not set'}",
        f"Bytes received: {bytes_received}",
        f"Elapsed wall-clock seconds: {elapsed:.3f}",
        f"Sanitized response headers (auth / trace / request-id removed): "
        f"{json.dumps(sanitized, indent=2)}",
        f"Output written: {_OUTPUT_PATH}",
    ]

    for line in lines:
        print(line)
        output_lines.append(line)

    # Post-print secret-leak assertion: verify the API key did not slip through.
    # os.environ.get("ELEVENLABS_API_KEY") is evaluated at runtime; if the key
    # appears in any printed line, this assertion catches it before the file is written.
    assert not any(
        os.environ.get("ELEVENLABS_API_KEY", "__UNSET__") in line
        for line in output_lines
    ), "SECURITY: API key appeared in stdout — this is a bug in run_firewall_spike.py"

    # --- Write raw response bytes to committed evidence binary ---
    _OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_OUTPUT_PATH, "wb") as f:
        f.write(response.content)

    # --- Exit code ---
    if response.status_code == 200 and bytes_received >= _MIN_BYTES:
        print(
            f"\nSPIKE RESULT: PASS — HTTP 200, {bytes_received:,} bytes "
            f"(>= {_MIN_BYTES:,} threshold), elapsed {elapsed:.1f}s"
        )
        return 0
    else:
        reasons = []
        if response.status_code != 200:
            reasons.append(f"HTTP {response.status_code} (expected 200)")
        if bytes_received < _MIN_BYTES:
            reasons.append(
                f"only {bytes_received:,} bytes received (minimum {_MIN_BYTES:,} required for >60s)"
            )
        print(f"\nSPIKE RESULT: FAIL — {'; '.join(reasons)}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
