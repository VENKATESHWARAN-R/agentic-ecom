"""Order history domain logic, ported from src/lib/orders.ts: return
eligibility, paginated summaries, order detail, and the derived owned-hardware
profile. Operates on plain order dicts (camelCase) supplied by the caller.
"""

from __future__ import annotations

import math
import random
import time
from typing import Any

from .catalog import get_product
from .format import iso_from_ms, parse_iso_ms

DAY = 24 * 60 * 60 * 1000
RETURN_WINDOW_DAYS = 30

OWNED_CATEGORIES = ("motherboard", "cpu", "gpu", "ram", "psu", "case")

Order = dict[str, Any]


def cart_total(lines: list[dict[str, Any]]) -> float:
    total = 0
    for line in lines:
        product = get_product(line["productId"])
        total += (product["price"] if product else 0) * line["quantity"]
    return total


def orders_for_user(user_id: str, all_orders: list[Order]) -> list[Order]:
    """A persona's orders, newest first."""
    mine = [order for order in all_orders if order["userId"] == user_id]
    return sorted(mine, key=lambda order: -parse_iso_ms(order["placedAt"]))


def return_eligibility(order: Order, now_ms: int | None = None) -> dict[str, Any]:
    """30-day free returns counted from delivery date — computed by code, never
    reasoned by the model. The tool result carries the explicit deadline; the
    prompt forbids the model from doing date math."""
    if order["status"] == "processing":
        return {"status": "cancellable"}
    if order["status"] == "shipped":
        return {"status": "awaiting-delivery"}
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    delivered_ms = parse_iso_ms(order.get("deliveredAt") or order["placedAt"])
    deadline_ms = delivered_ms + RETURN_WINDOW_DAYS * DAY
    if now <= deadline_ms:
        return {
            "status": "eligible",
            "deadline": iso_from_ms(deadline_ms),
            "daysLeft": math.ceil((deadline_ms - now) / DAY),
        }
    return {"status": "closed"}


def summarize(order: Order) -> dict[str, Any]:
    names = []
    for line in order["lines"]:
        product = get_product(line["productId"])
        names.append(product["name"] if product else line["productId"])
    items = [*names[:3], f"+{len(names) - 3} more"] if len(names) > 3 else names
    return {
        "number": order["number"],
        "placedAt": order["placedAt"],
        "status": order["status"],
        "total": order["total"],
        "items": items,
    }


def get_orders_for(user_id: str, all_orders: list[Order], limit: int = 5, offset: int = 0) -> dict[str, Any]:
    """Paginated compact summaries (default 5, max 20 per call)."""
    orders = orders_for_user(user_id, all_orders)
    clamped_limit = max(1, min(20, math.floor(limit)))
    clamped_offset = max(0, math.floor(offset))
    return {
        "total": len(orders),
        "orders": [summarize(order) for order in orders[clamped_offset : clamped_offset + clamped_limit]],
    }


def get_order_detail(user_id: str, order_number: str, all_orders: list[Order]) -> dict[str, Any] | None:
    order = next((o for o in orders_for_user(user_id, all_orders) if o["number"] == order_number), None)
    if not order:
        return None
    lines = []
    for line in order["lines"]:
        product = get_product(line["productId"])
        lines.append(
            {
                "productId": line["productId"],
                "name": product["name"] if product else line["productId"],
                "quantity": line["quantity"],
                "unitPrice": product["price"] if product else 0,
            }
        )
    detail: dict[str, Any] = {
        "number": order["number"],
        "placedAt": order["placedAt"],
        "status": order["status"],
    }
    if "deliveredAt" in order:
        detail["deliveredAt"] = order["deliveredAt"]
    detail.update(
        {
            "total": order["total"],
            "lines": lines,
            "returnEligibility": return_eligibility(order),
        }
    )
    return detail


def owned_hardware_profile(user_id: str, all_orders: list[Order]) -> list[dict[str, Any]]:
    """Derived, bounded profile of what the customer already owns: one entry per
    PC-part category, newest purchase wins, max 6. A customer with 1,000 orders
    produces the same tiny profile as one with 3. Only delivered or shipped
    orders count — a just-placed (processing) order isn't owned yet."""
    owned: list[dict[str, Any]] = []
    seen: set[str] = set()
    for order in orders_for_user(user_id, all_orders):
        if order["status"] == "processing":
            continue
        for line in order["lines"]:
            product = get_product(line["productId"])
            if not product:
                continue
            category = product["subcategory"]
            if category not in OWNED_CATEGORIES or category in seen:
                continue
            seen.add(category)
            owned.append(
                {
                    "productId": product["id"],
                    "category": category,
                    "orderNumber": order["number"],
                    "orderedOn": order["placedAt"],
                    "inTransit": order["status"] != "delivered",
                }
            )
            if len(owned) >= 6:
                return owned
    return owned


_BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz"


def _to_base36(value: int) -> str:
    if value == 0:
        return "0"
    digits = []
    while value:
        value, rem = divmod(value, 36)
        digits.append(_BASE36[rem])
    return "".join(reversed(digits))


def new_order_number(now_ms: int | None = None) -> str:
    """Same scheme as the original frontend: VLT-<base36 ms timestamp>-<3 digits>."""
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    return f"VLT-{_to_base36(now).upper()}-{random.randint(100, 999)}"
