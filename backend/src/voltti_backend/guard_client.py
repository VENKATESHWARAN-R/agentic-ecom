"""Client for the input-safety guard service (P3).

The chat gateway calls ``screen()`` on each user message *before* running the
agent. A flagged message is treated as data and never reaches the model or a
tool — that's the structural guarantee (P3), enforced here in code, not by asking
the model nicely.

The guard is a *separate*, non-mandatory service (heavy ML deps live there). So
this client fails **open** by default (``GUARD_FAIL_OPEN``): if the guard is down
or slow, we log and allow rather than take chat offline. Flip the flag to fail
closed where strictness must win over availability.
"""

from __future__ import annotations

import logging

import httpx

from .config import GUARD_ENABLED, GUARD_FAIL_OPEN, GUARD_TIMEOUT_SECONDS, GUARD_URL

logger = logging.getLogger("voltti.guard")

# Reused across requests; httpx pools connections to the guard service.
_client = httpx.AsyncClient(timeout=GUARD_TIMEOUT_SECONDS)

_ALLOW = {"blocked": False, "score": 0.0, "label": "benign"}


async def screen(text: str) -> dict:
    """Screen one user message. Returns ``{blocked, score, label}``.

    Disabled or empty → allow. On any transport/HTTP error, honor
    ``GUARD_FAIL_OPEN``: open ⇒ allow (logged); closed ⇒ block."""
    if not GUARD_ENABLED or not text or not text.strip():
        return dict(_ALLOW)
    try:
        resp = await _client.post(f"{GUARD_URL}/classify", json={"text": text})
        resp.raise_for_status()
        data = resp.json()
        return {
            "blocked": bool(data.get("blocked")),
            "score": float(data.get("score", 0.0)),
            "label": str(data.get("label", "benign")),
        }
    except Exception as exc:  # network error, timeout, non-2xx, bad JSON
        if GUARD_FAIL_OPEN:
            logger.warning("guard unavailable, failing open: %s", exc)
            return dict(_ALLOW)
        logger.warning("guard unavailable, failing closed: %s", exc)
        return {"blocked": True, "score": 1.0, "label": "guard-unavailable"}
