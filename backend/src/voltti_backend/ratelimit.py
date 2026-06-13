"""In-memory rate limiter for the chat gateway (P7).

A sliding-window counter keyed by client. The backend keys by the verified
assertion identity (guests share one coarse bucket) because, behind the BFF, it
only ever sees the BFF's address — real per-IP limiting for anonymous traffic is
the edge/nginx layer's job. In-memory and single-instance by design for the demo;
production swaps the store for Redis. The algorithm is real; the store is mock.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, limit: int, window_seconds: float) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, *, now: float | None = None) -> bool:
        """Record a hit for ``key`` and return whether it is within the limit.
        ``now`` is injectable for deterministic tests."""
        now = time.monotonic() if now is None else now
        hits = self._hits[key]
        cutoff = now - self.window
        while hits and hits[0] < cutoff:
            hits.popleft()
        if len(hits) >= self.limit:
            return False
        hits.append(now)
        return True
