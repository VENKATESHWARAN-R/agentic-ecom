"""Per-identity abuse scoring with progressive enforcement (P3/P7).

A blocked message or an unauthorized-tool attempt isn't just refused in isolation
— it counts. We keep a small, decaying, per-identity score (guests share the
``anon`` bucket, same as the rate limiter). As the recent score climbs, the chat
gateway tightens: ``normal`` → ``restricted`` → ``blocked``. This turns a stream
of probing attempts into an escalating cost for the attacker, without a database.

The scoring is a weighted sliding window: each offence adds points stamped with a
time; points outside the window age out (decay). In-memory and single-instance by
design for the demo — production swaps the store for Redis. The algorithm is real;
the store is mock. Mirrors ``ratelimit.RateLimiter`` in shape and testability.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

# Offence weights. A guard "malicious" verdict is the strongest signal; a guest
# reaching for an identity-scoped tool is a weaker probe.
POINTS_GUARD_BLOCK = 3
POINTS_UNAUTHORIZED_TOOL = 2


class AbuseScorer:
    def __init__(
        self,
        *,
        window_seconds: float = 600.0,
        restrict_at: int = 3,
        block_at: int = 6,
    ) -> None:
        self.window = window_seconds
        self.restrict_at = restrict_at
        self.block_at = block_at
        self._events: dict[str, deque[tuple[float, int]]] = defaultdict(deque)

    def _prune(self, key: str, now: float) -> deque[tuple[float, int]]:
        events = self._events[key]
        cutoff = now - self.window
        while events and events[0][0] < cutoff:
            events.popleft()
        return events

    def record(self, key: str, points: int, *, now: float | None = None) -> None:
        """Add ``points`` to ``key``'s recent score. ``now`` is injectable for tests."""
        now = time.monotonic() if now is None else now
        events = self._prune(key, now)
        events.append((now, points))

    def score(self, key: str, *, now: float | None = None) -> int:
        """Current decayed score for ``key`` (sum of in-window points)."""
        now = time.monotonic() if now is None else now
        return sum(p for _, p in self._prune(key, now))

    def level(self, key: str, *, now: float | None = None) -> str:
        """Enforcement level: ``"normal"`` | ``"restricted"`` | ``"blocked"``."""
        s = self.score(key, now=now)
        if s >= self.block_at:
            return "blocked"
        if s >= self.restrict_at:
            return "restricted"
        return "normal"


# Module-level singleton shared by the chat gateway and the tool gateway.
abuse = AbuseScorer()
