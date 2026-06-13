"""Tool gateway / policy engine (P2/P5).

Every agent tool is classified by a risk tier. User-data tools are authorized
against the **session identity** — resolved from the BFF assertion, never a model
parameter — and every call is audited. This is the deterministic checkpoint the
model's tool calls pass through: the model orchestrates tools, but it neither
supplies identity (P4) nor authorizes the call (P2). It is also the seam where
rate limits and abuse scoring attach in later slices.
"""

from __future__ import annotations

import logging

from ..abuse import POINTS_UNAUTHORIZED_TOOL, abuse

logger = logging.getLogger("voltti.toolgateway")

READ_ONLY = "read-only"  # T1 — public catalog & deterministic recommendations
USER_DATA = "user-data"  # T2 — identity-scoped (orders, returns)

TOOL_TIERS: dict[str, str] = {
    "searchCatalog": READ_ONLY,
    "getProductDetails": READ_ONLY,
    "getProductAlternatives": READ_ONLY,
    "checkCompatibility": READ_ONLY,
    "recommendPcBuild": READ_ONLY,
    "recommendGamingSetup": READ_ONLY,
    "getMyOrders": USER_DATA,
    "getReturnInfo": USER_DATA,
}


def authorize(tool: str, identity: str | None) -> str | None:
    """Authorize a user-data tool call and audit it. Returns the identity the
    tool must scope its data to (``None`` = guest → the tool yields a "sign in"
    result, never another user's data). Read-only tools are public by tier.

    An unknown tool is treated as sensitive (deny-by-default posture). The model
    never reaches this with an identity it chose — identity comes from the
    request's verified assertion (P4)."""
    tier = TOOL_TIERS.get(tool, USER_DATA)
    logger.info("tool-gateway tool=%s tier=%s identity=%s", tool, tier, identity or "guest")
    # A guest reaching for an identity-scoped tool is a probe (the tool will yield
    # a "sign in" result, never data) — feed it to abuse scoring so repeated
    # attempts escalate enforcement at the chat gateway (P3/P7).
    if tier is USER_DATA and identity is None:
        abuse.record("anon", POINTS_UNAUTHORIZED_TOOL)
    return identity
