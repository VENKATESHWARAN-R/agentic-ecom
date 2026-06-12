"""REST API for the storefront.

Identity model (demo): the persona id in the path is trusted as-is — there is
no auth, matching the original client-side persona switcher. In a real system
this would come from the session, never from the client. What still holds even
in the demo: identity is never a model-supplied parameter — the frontend
resolves the active persona and calls these endpoints itself.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ..db import engine, get_all_orders, get_users
from ..domain.catalog import all_products, get_alternatives, get_product, search_products
from ..domain.compat import check_compatibility
from ..domain.orders import (
    cart_total,
    get_order_detail,
    get_orders_for,
    new_order_number,
    orders_for_user,
    owned_hardware_profile,
)
from ..models import OrderRow
from ..security import optional_identity

router = APIRouter(prefix="/api")

RETURN_POLICY = "30-day free returns from the delivery date; item unopened or unused. Drop off at any Posti point (demo)."


def owner_or_403(user_id: str, identity: str | None = Depends(optional_identity)) -> str:
    """Authorize a user-scoped resource: the BFF-asserted identity must own it.
    Guests (no identity) → 401; someone else's data → 403. Identity comes from the
    signed assertion, never the path — the path id names the requested resource,
    it is not proof of identity (P2/P4)."""
    if identity is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    if identity != user_id:
        raise HTTPException(status_code=403, detail="You can only access your own data.")
    return identity


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/me")
def me(identity: str | None = Depends(optional_identity)) -> dict[str, Any]:
    """Whoami for the BFF-asserted session. Identity comes from the signed
    assertion (P4) — never from a client-supplied parameter. Proves the
    BFF→backend trust channel end to end."""
    return {"identity": identity, "signedIn": identity is not None}


# ---------------------------------------------------------------- catalog


@router.get("/products")
def list_products(
    query: str | None = None,
    category: str | None = None,
    maxPrice: float | None = None,
    minPrice: float | None = None,
    brands: str | None = None,
    dealsOnly: bool = False,
    inStockOnly: bool = False,
    tags: str | None = None,
    sort: str | None = None,
) -> list[dict[str, Any]]:
    if not any([query, category, maxPrice, minPrice, brands, dealsOnly, inStockOnly, tags, sort]):
        return all_products()
    return search_products(
        {
            "query": query,
            "category": category,
            "maxPrice": maxPrice,
            "minPrice": minPrice,
            "brands": brands.split(",") if brands else None,
            "dealsOnly": dealsOnly,
            "inStockOnly": inStockOnly,
            "tags": tags.split(",") if tags else None,
            "sort": sort,
        }
    )


@router.get("/products/{product_id}")
def product_detail(product_id: str) -> dict[str, Any]:
    product = get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail=f'No product with id "{product_id}".')
    return product


@router.get("/products/{product_id}/alternatives")
def product_alternatives(product_id: str) -> list[dict[str, Any]]:
    return get_alternatives(product_id)


class CompatRequest(BaseModel):
    productIds: list[str]
    owned: list[dict[str, Any]] | None = None


@router.post("/compat")
def compat(request: CompatRequest) -> dict[str, Any]:
    return check_compatibility(request.productIds, request.owned or [])


# ---------------------------------------------------------------- users


@router.get("/users")
def list_users() -> list[dict[str, Any]]:
    with Session(engine) as session:
        users = get_users(session)
        orders = get_all_orders(session)
    # No email/PII here — this is the demo login surface (pick a persona), not a
    # public user directory (P6). Order counts are demo flavor, not sensitive.
    return [
        {
            "id": user_id,
            "name": profile["name"],
            "personaLabel": profile["personaLabel"],
            "ordersTotal": len(orders_for_user(user_id, orders)),
        }
        for user_id, profile in users.items()
    ]


@router.get("/users/{user_id}/agent-profile")
def agent_profile(user_id: str, _identity: str = Depends(owner_or_403)) -> dict[str, Any]:
    """Derived, bounded facts for the agent's context: ≤6 owned-hardware entries
    (enriched with the compat facts the agent needs) + the order count. Raw
    order history stays behind the paginated endpoints."""
    with Session(engine) as session:
        orders = get_all_orders(session)
    owned_hardware = []
    for part in owned_hardware_profile(user_id, orders):
        product = get_product(part["productId"])
        compat_meta = (product or {}).get("compat") or {}
        owned_hardware.append(
            {
                "productId": part["productId"],
                "category": part["category"],
                "socket": compat_meta.get("socket"),
                "memoryType": compat_meta.get("memoryType"),
                "wifi": bool(product and "wifi" in product["tags"]),
                "orderNumber": part["orderNumber"],
                "orderedOn": part["orderedOn"],
                "inTransit": bool(part.get("inTransit")),
            }
        )
    return {
        "ordersTotal": len(orders_for_user(user_id, orders)),
        "ownedHardware": owned_hardware,
        "ownedRefs": [
            {"productId": p["productId"], "orderNumber": p["orderNumber"], "orderedOn": p["orderedOn"]}
            for p in owned_hardware
        ],
    }


@router.get("/users/{user_id}/orders")
def user_orders(user_id: str, _identity: str = Depends(owner_or_403)) -> list[dict[str, Any]]:
    """Full order list with line details + return eligibility (account page)."""
    with Session(engine) as session:
        orders = get_all_orders(session)
    details = []
    for order in orders_for_user(user_id, orders):
        detail = get_order_detail(user_id, order["number"], orders)
        if detail:
            details.append(detail)
    return details


@router.get("/users/{user_id}/orders/summaries")
def user_order_summaries(
    user_id: str, limit: int = 5, offset: int = 0, _identity: str = Depends(owner_or_403)
) -> dict[str, Any]:
    """Paginated compact summaries (default 5, max 20 per call) — the getMyOrders tool."""
    with Session(engine) as session:
        orders = get_all_orders(session)
    page = get_orders_for(user_id, orders, limit=limit, offset=offset)
    return {"total": page["total"], "offset": max(0, offset), "returned": len(page["orders"]), "orders": page["orders"]}


@router.get("/users/{user_id}/orders/{order_number}")
def user_order_detail(
    user_id: str, order_number: str, _identity: str = Depends(owner_or_403)
) -> dict[str, Any]:
    with Session(engine) as session:
        orders = get_all_orders(session)
    detail = get_order_detail(user_id, order_number, orders)
    if not detail:
        raise HTTPException(status_code=404, detail=f"No order {order_number} for this user.")
    return {**detail, "policy": RETURN_POLICY}


# ---------------------------------------------------------------- orders


class OrderLineIn(BaseModel):
    productId: str
    quantity: int


class PlaceOrderRequest(BaseModel):
    lines: list[OrderLineIn]
    details: dict[str, Any]


@router.post("/orders", status_code=201)
def place_order(request: PlaceOrderRequest, identity: str | None = Depends(optional_identity)) -> dict[str, Any]:
    if not request.lines:
        raise HTTPException(status_code=400, detail="Cart is empty.")
    # Identity is the session's, never the request body — a client cannot place an
    # order as someone else (P4). Guests place orders attributed to "guest".
    user_id = identity or "guest"
    lines = [line.model_dump() for line in request.lines]
    from ..domain.format import iso_from_ms
    import time

    now_ms = int(time.time() * 1000)
    row = OrderRow(
        number=new_order_number(now_ms),
        user_id=user_id,
        lines=lines,
        total=cart_total(lines),
        details=request.details,
        placed_at=iso_from_ms(now_ms),
        status="processing",
        seed=False,
    )
    with Session(engine) as session:
        session.add(row)
        session.commit()
        session.refresh(row)
    return row.to_order()
