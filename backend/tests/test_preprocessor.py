"""
Tests for backend/app/services/text_preprocessor.py

Three sections:
  A — Golden-file parametrized suite (primary coverage)
  B — Pipeline-order regression tests (guard the fixed ordering invariant)
  C — Per-rule unit tests (fast defence-in-depth; independent of the JSON corpus)
"""

import json
from pathlib import Path

import pytest

from app.services.text_preprocessor import preprocess

# ---------------------------------------------------------------------------
# Section A — Golden-file parametrized suite
# ---------------------------------------------------------------------------

_GOLDEN = json.loads(
    (Path(__file__).parent / "fixtures" / "preprocessor_golden.json").read_text(
        encoding="utf-8"
    )
)


@pytest.mark.parametrize(
    "entry",
    _GOLDEN,
    ids=[
        f"golden_{i:02d}_{e['comment'][:40].replace(' ', '_')}"
        for i, e in enumerate(_GOLDEN)
    ],
)
def test_preprocess_golden(entry):
    """Every golden-corpus entry must round-trip through preprocess() exactly."""
    actual = preprocess(entry["input"])
    assert actual == entry["expected"], (
        f"\nINPUT:    {entry['input']!r}\n"
        f"EXPECTED: {entry['expected']!r}\n"
        f"ACTUAL:   {actual!r}\n"
        f"COMMENT:  {entry['comment']}"
    )


# ---------------------------------------------------------------------------
# Section B — Pipeline-order regression tests
# ---------------------------------------------------------------------------


def test_markdown_must_strip_before_acronym():
    """Bold markers must be stripped BEFORE acronym expansion.

    If acronym ran first, '**EDIP**' would become '**E D I P**'
    (stars still wrapping the expanded form).
    Correct order strips markdown first, leaving bare 'EDIP' for expansion.
    """
    assert preprocess("**EDIP**") == "E D I P"


def test_acronym_must_expand_before_number():
    """Acronym expansion must run BEFORE number normalization.

    'PC 2024' — acronym expands to 'P C 2024', then year '2024' is normalized.
    The composed output must contain both the expanded acronym and the spelled year.
    """
    result = preprocess("PC 2024")
    assert "P C" in result, f"'P C' not found in {result!r}"
    assert "twenty twenty-four" in result, f"'twenty twenty-four' not found in {result!r}"
    assert "2024" not in result, f"bare '2024' should be gone but found in {result!r}"
    assert "PC" not in result, f"unexpanded 'PC' should be gone but found in {result!r}"


def test_pluralized_acronym_preferred_over_singular():
    """EDIPs (longest-match-first) must expand to 'E D I Ps', not 'E D I P' + bare 's'."""
    assert preprocess("Multiple EDIPs deployed.") == "Multiple E D I Ps deployed."


# ---------------------------------------------------------------------------
# Section C — Per-rule unit tests
# ---------------------------------------------------------------------------


class TestAcronyms:
    def test_edip_singular(self):
        assert preprocess("The EDIP framework") == "The E D I P framework"

    def test_edip_plural(self):
        assert preprocess("Two EDIPs active") == "Two E D I Ps active"

    def test_pc_singular(self):
        assert preprocess("PC token") == "P C token"

    def test_pc_plural(self):
        assert preprocess("All PCs spent") == "All P Cs spent"

    def test_po_singular(self):
        assert preprocess("PO raised") == "P O raised"

    def test_po_plural(self):
        assert preprocess("Three POs requested") == "Three P Os requested"

    def test_crm_expanded(self):
        assert preprocess("CRM shortage") == "C R M shortage"

    def test_ic_singular(self):
        assert preprocess("IC token") == "I C token"

    def test_ic_plural(self):
        assert preprocess("Two ICs allocated") == "Two I Cs allocated"

    def test_lefs_expanded(self):
        assert preprocess("LEFS activated") == "L E F S activated"

    def test_siep_expanded(self):
        assert preprocess("SIEP programme") == "S I E P programme"

    def test_sos_letter_spelled(self):
        # Military/emergency convention: letter-by-letter
        assert preprocess("SoS invoked") == "S O S invoked"

    def test_eu_expanded(self):
        assert preprocess("EU position") == "E U position"

    def test_nato_word_cased(self):
        # NATO pronounced as a word; Title-case hints TTS
        assert preprocess("NATO members") == "Nato members"

    def test_unknown_acronym_passes_through(self):
        assert preprocess("The XYZ department") == "The XYZ department"

    def test_acronym_embedded_in_word_does_not_match(self):
        """Word-boundary guard: 'JEDIPS' contains 'EDIP' but must NOT match."""
        result = preprocess("The JEDIPS model")
        assert result == "The JEDIPS model", f"Unexpected match in {result!r}"


class TestNumbers:
    def test_year_2024(self):
        out = preprocess("in 2024")
        assert "twenty twenty-four" in out
        assert "2024" not in out

    def test_year_2026(self):
        out = preprocess("since 2026")
        assert "twenty twenty-six" in out
        assert "2026" not in out

    def test_ordinal_1st(self):
        out = preprocess("the 1st round")
        assert "first" in out
        assert "1st" not in out

    def test_ordinal_3rd(self):
        out = preprocess("the 3rd round")
        assert "third" in out
        assert "3rd" not in out

    def test_ordinal_22nd(self):
        out = preprocess("the 22nd meeting")
        assert "twenty-second" in out
        assert "22nd" not in out

    def test_percentage_integer(self):
        out = preprocess("50% reduction")
        assert "fifty percent" in out
        assert "50%" not in out

    def test_percentage_decimal(self):
        out = preprocess("12.5% growth")
        assert "twelve point five percent" in out
        assert "12.5%" not in out

    def test_plain_integer(self):
        assert preprocess("There were 123 units.") == "There were one hundred and twenty-three units."

    def test_plain_integer_50(self):
        out = preprocess("50 tokens")
        assert "fifty" in out
        assert "50" not in out

    def test_year_does_not_double_convert(self):
        """After year conversion, the spelled digits must not be re-converted."""
        # 'twenty twenty-four' should emerge, not 'twenty twenty-four' looped again
        out = preprocess("2024")
        assert out == "twenty twenty-four"


class TestMarkdown:
    def test_bold(self):
        assert preprocess("**bold text**") == "bold text"

    def test_italic_underscore(self):
        assert preprocess("_italic text_") == "italic text"

    def test_header_h1(self):
        assert preprocess("# Round Three\nThe analysis...") == "Round Three\nThe analysis..."

    def test_header_h2(self):
        assert preprocess("## Subhead\nContent here.") == "Subhead\nContent here."

    def test_bullet_dash(self):
        assert preprocess("- item one") == "item one"

    def test_bullet_asterisk(self):
        assert preprocess("* item two") == "item two"

    def test_html_br_tag(self):
        assert preprocess("line one<br>line two") == "line oneline two"

    def test_html_em_tag(self):
        assert preprocess("<em>emphasis</em>") == "emphasis"

    def test_backtick(self):
        assert preprocess("use `code` here") == "use code here"

    def test_sentence_terminators_preserved(self):
        """TTS pacing depends on sentence terminators."""
        out = preprocess("Hello. Is it working? Yes!")
        assert "." in out
        assert "?" in out
        assert "!" in out

    def test_no_markdown_passes_through(self):
        """Plain text with no markdown should be returned unchanged (modulo number/acronym rules)."""
        text = "The council convenes tomorrow."
        assert preprocess(text) == text
