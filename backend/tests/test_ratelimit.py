"""Unit tests for the chat-gateway rate limiter (P7)."""

from voltti_backend.ratelimit import RateLimiter


def test_sliding_window_blocks_after_limit():
    rl = RateLimiter(limit=3, window_seconds=60)
    t = 1000.0
    assert all(rl.allow("k", now=t + i * 0.1) for i in range(3))  # first 3 allowed
    assert not rl.allow("k", now=t + 0.4)  # 4th in the window is blocked


def test_window_slides_and_recovers():
    rl = RateLimiter(limit=2, window_seconds=60)
    assert rl.allow("k", now=1.0)
    assert rl.allow("k", now=2.0)
    assert not rl.allow("k", now=3.0)  # over the limit
    assert rl.allow("k", now=63.0)  # the first hit (t=1) has aged out of the window


def test_keys_are_independent():
    rl = RateLimiter(limit=1, window_seconds=60)
    assert rl.allow("aino", now=1.0)
    assert rl.allow("sami", now=1.0)  # different identity, own bucket
    assert not rl.allow("aino", now=1.1)
