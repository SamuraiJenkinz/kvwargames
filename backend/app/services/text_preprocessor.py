"""
Text preprocessor for TTS input.

Pipeline order (FIXED — re-ordering breaks test cases):
  1. markdown_strip — remove emphasis markers, headers, bullets, backticks, HTML tags
  2. acronym_expand — letter-space wargame acronyms via explicit dict (word-boundary, case-sensitive)
  3. number_normalize — years/ordinals/percentages/plain integers via num2words

Why this order:
  - markdown must strip FIRST so ``**EDIP**`` does not become ``**E D I P**``
  - acronyms expand BEFORE numbers so ``PC 2024`` becomes ``P C 2024`` (acronym
    expanded, year still intact for year-detection)

Unknown acronyms pass through unchanged (the golden-file corpus is the safety net;
new acronyms surface during Phase-16 listen-through and are added in a follow-up).

See ``.planning/phases/13-firewall-spike-mockable-backend-foundation/13-CONTEXT.md``
§decisions.preprocessor for the locked design.
"""

import re
from num2words import num2words


# ---------------------------------------------------------------------------
# Acronym dictionary — explicit entries only, no heuristic fallback.
# Pluralized forms are explicit entries (no runtime suffix logic).
# Word-boundary match, case-sensitive.
#
# IMPORTANT: longer forms (EDIPs) appear BEFORE shorter (EDIP) so that the
# regex alternation matches the longer form greedily.  Python 3.7+ dicts
# preserve insertion order; the order below is authoritative.
# ---------------------------------------------------------------------------
ACRONYMS: dict[str, str] = {
    "EDIPs": "E D I Ps",
    "EDIP": "E D I P",
    "PCs": "P Cs",
    "PC": "P C",
    "POs": "P Os",
    "PO": "P O",
    "CRM": "C R M",
    "ICs": "I Cs",
    "IC": "I C",
    "LEFS": "L E F S",
    "SIEP": "S I E P",
    "SoS": "S O S",  # pronounced letter-by-letter (emergency/military convention)
    "EU": "E U",
    "NATO": "Nato",  # pronounced as a word — Title-case hints phonetic word-pronunciation to TTS
}


def _strip_markdown(text: str) -> str:
    """Remove markdown and HTML emphasis while preserving sentence terminators."""
    # HTML tags first (they might contain chars that look like markdown)
    text = re.sub(r"<[^>]+>", "", text)
    # Backticks
    text = text.replace("`", "")
    # Line-start headers (# Heading, ## Subhead, ...)
    text = re.sub(r"(?m)^#+\s+", "", text)
    # Line-start bullets (- item, * item, 1. item, 2. item, ...)
    text = re.sub(r"(?m)^(?:[-*]\s+|\d+\.\s+)", "", text)
    # Bold markers — two asterisks (must be stripped before single-asterisk pass)
    text = text.replace("**", "")
    # Single * (italic) — only when adjacent to non-space to avoid eating stray asterisks
    text = re.sub(r"\*(?=\S)|(?<=\S)\*", "", text)
    # Single _ (italic) — only when adjacent to non-space
    text = re.sub(r"_(?=\S)|(?<=\S)_", "", text)
    return text


def _expand_acronyms(text: str) -> str:
    """Replace wargame acronyms with their letter-spaced or phonetic expansions."""
    # Build an alternation pattern in insertion order (longest first for EDIPs-vs-EDIP).
    pattern = r"\b(" + "|".join(re.escape(k) for k in ACRONYMS.keys()) + r")\b"

    def replace(match: re.Match) -> str:  # type: ignore[type-arg]
        return ACRONYMS[match.group(1)]

    return re.sub(pattern, replace, text)


def _normalize_numbers(text: str) -> str:
    """Convert years, ordinals, percentages, and plain integers to spelled-out words.

    Rule order: year → ordinal → percentage → plain (non-overlapping by regex guards).
    Each prior substitution removes matched digits from the string, so later regexes
    do not re-match already-converted text.
    """
    # 1. Years 1900–2099
    def year_sub(m: re.Match) -> str:  # type: ignore[type-arg]
        return num2words(int(m.group(0)), to="year")

    text = re.sub(r"\b(?:19|20)\d{2}\b", year_sub, text)

    # 2. Ordinals: e.g. 3rd, 22nd, 1st, 2nd
    def ord_sub(m: re.Match) -> str:  # type: ignore[type-arg]
        return num2words(int(m.group(1)), to="ordinal")

    text = re.sub(r"\b(\d+)(?:st|nd|rd|th)\b", ord_sub, text)

    # 3. Percentages: integer or decimal followed immediately by %
    def pct_sub(m: re.Match) -> str:  # type: ignore[type-arg]
        raw = m.group(1)
        n: float | int = float(raw) if "." in raw else int(raw)
        return f"{num2words(n)} percent"

    text = re.sub(r"\b(\d+(?:\.\d+)?)%", pct_sub, text)

    # 4. Plain integers / decimals (catch-all — runs LAST so prior rules own their regions)
    def num_sub(m: re.Match) -> str:  # type: ignore[type-arg]
        raw = m.group(0)
        n_plain: float | int = float(raw) if "." in raw else int(raw)
        return num2words(n_plain)

    text = re.sub(r"\b\d+(?:\.\d+)?\b", num_sub, text)

    return text


def preprocess(text: str) -> str:
    """Apply the fixed preprocessing pipeline: strip markdown, expand acronyms, normalize numbers.

    Pipeline order is load-bearing (see module docstring).
    """
    text = _strip_markdown(text)
    text = _expand_acronyms(text)
    text = _normalize_numbers(text)
    return text
