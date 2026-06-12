"""BFF→backend identity assertion (mock credential, real enforcement).

The Next.js BFF owns the session and mints a short-lived signed JWT — the
"identity assertion" — on every backend call. This module verifies it and yields
the persona id. The browser never holds INTERNAL_JWT_SECRET, so it cannot forge
identity: this is the trust boundary that retires browser-trusted identity
(P4, see docs/target-architecture.md).

Issuance is fake (no real IdP); enforcement is real — a missing assertion is a
guest, but a present-but-invalid one is rejected fail-closed (P2).
"""

from __future__ import annotations

import jwt
from fastapi import Depends, Header, HTTPException

from .config import INTERNAL_JWT_SECRET

ASSERTION_TYP = "assertion"


def verify_assertion(token: str) -> str:
    """Return the persona id carried by a valid assertion, or raise."""
    claims = jwt.decode(
        token,
        INTERNAL_JWT_SECRET,
        algorithms=["HS256"],
        options={"require": ["exp", "sub"]},
    )
    if claims.get("typ") != ASSERTION_TYP:
        raise jwt.InvalidTokenError("unexpected token type")
    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub:
        raise jwt.InvalidTokenError("missing subject")
    return sub


def optional_identity(authorization: str | None = Header(default=None)) -> str | None:
    """FastAPI dependency → persona id from the assertion, or None for a guest.

    Missing header → None (anonymous/public). Present but malformed, expired, or
    forged → 401 (a bad token is an attack, not a guest). Fail-closed (P2).
    """
    if authorization is None:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Malformed authorization header.")
    try:
        return verify_assertion(token)
    except Exception as exc:  # invalid signature / expiry / type / subject
        raise HTTPException(status_code=401, detail="Invalid identity assertion.") from exc


def require_identity(identity: str | None = Depends(optional_identity)) -> str:
    """FastAPI dependency for user-scoped routes: a verified persona id, or 401."""
    if identity is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return identity
