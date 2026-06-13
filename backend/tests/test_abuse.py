"""Unit tests for the per-identity abuse scorer (P3/P7)."""

from voltti_backend.abuse import AbuseScorer


def test_score_accumulates_and_decays():
    a = AbuseScorer(window_seconds=600, restrict_at=3, block_at=6)
    a.record("k", 3, now=1000.0)
    assert a.score("k", now=1000.0) == 3
    a.record("k", 3, now=1100.0)
    assert a.score("k", now=1100.0) == 6
    # The first event ages out of the 600s window → only the second remains.
    assert a.score("k", now=1700.0) == 3


def test_levels_escalate_with_score():
    a = AbuseScorer(window_seconds=600, restrict_at=3, block_at=6)
    assert a.level("k", now=0.0) == "normal"
    a.record("k", 3, now=1.0)
    assert a.level("k", now=1.0) == "restricted"
    a.record("k", 3, now=2.0)
    assert a.level("k", now=2.0) == "blocked"


def test_keys_are_independent():
    a = AbuseScorer(window_seconds=600, restrict_at=3, block_at=6)
    a.record("aino", 6, now=1.0)
    assert a.level("aino", now=1.0) == "blocked"
    assert a.level("sami", now=1.0) == "normal"  # different identity, own score
