"""TTSProviderError — the single exception shape provider implementations raise.

The `code` field must be one of the 8-code taxonomy so Phase 15's /api/health/tts
endpoint can reuse this vocabulary verbatim. Taxonomy matches
backend/app/routers/health.py:30 exactly.
"""

from typing import Literal, Optional

TTSErrorCode = Literal[
    "timeout",
    "auth_error",
    "not_found",
    "rate_limited",
    "upstream_error",
    "network_error",
    "tls_error",
    "invalid_response",
]


class TTSProviderError(Exception):
    """Raised by TTSProvider implementations when synthesise() fails."""

    def __init__(
        self,
        code: TTSErrorCode,
        message: str,
        status: Optional[int] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status

    def __repr__(self) -> str:  # pragma: no cover — debugging aid
        return f"TTSProviderError(code={self.code!r}, status={self.status}, message={self.message!r})"
