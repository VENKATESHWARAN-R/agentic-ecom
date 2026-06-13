"""Database setup and seeding.

- Products/users: wiped and re-seeded from the shared data/*.json files on every
  startup (the JSON files are the single source of truth, shared with the
  Next.js bundle).
- Seed demo orders (numbers VLT-1xxx / VLT-2xxx): regenerated on every startup
  with fresh relative dates, so the demo always shows an open return window, a
  freshly closed one, and an in-transit order no matter when it runs.
- User-placed orders (timestamp-based numbers): persist across restarts.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any

from sqlmodel import Session, SQLModel, create_engine, delete, select

from .config import DATA_DIR, DB_PATH
from .domain import catalog
from .domain.format import iso_from_ms
from .domain.orders import cart_total
from .models import OrderRow, ProductRow, UserRow

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})

DAY = 24 * 60 * 60 * 1000
SEED_NUMBER_PATTERN = re.compile(r"^VLT-[12]\d{3}$")

# ---------------------------------------------------------------- seed orders
# Ported from src/lib/orders.ts. Dates are "N days ago", materialized at seed
# time. See that file's comments for why each persona looks the way it does.

_AINO_SPECS = [
    {
        "number": "VLT-1001",
        "userId": "aino",
        "placedDaysAgo": 38,
        "status": "delivered",
        "deliveredDaysAgo": 34,  # window closed ~4 days ago
        "lines": [
            {"productId": "fractal-terra-itx", "quantity": 1},
            {"productId": "bequiet-pure-power-12m-650", "quantity": 1},
        ],
    },
    {
        "number": "VLT-1002",
        "userId": "aino",
        "placedDaysAgo": 16,
        "status": "delivered",
        "deliveredDaysAgo": 12,  # ~18 days left
        "lines": [
            {"productId": "msi-b650-tomahawk", "quantity": 1},
            {"productId": "corsair-vengeance-32gb-ddr5", "quantity": 1},
        ],
    },
    {
        "number": "VLT-1003",
        "userId": "aino",
        "placedDaysAgo": 4,
        "status": "shipped",  # awaiting delivery — the in-transit 7800X3D
        "lines": [{"productId": "ryzen-7-7800x3d", "quantity": 1}],
    },
]

_SAMI_DELIBERATE = [
    {
        "number": "VLT-1004",
        "userId": "sami",
        "placedDaysAgo": 60,
        "status": "delivered",
        "deliveredDaysAgo": 56,
        "lines": [
            {"productId": "nzxt-h5-flow", "quantity": 1},
            {"productId": "corsair-rm850e", "quantity": 1},
        ],
    },
    {
        "number": "VLT-1005",
        "userId": "sami",
        "placedDaysAgo": 45,
        "status": "delivered",
        "deliveredDaysAgo": 41,
        "lines": [
            {"productId": "msi-z790-tomahawk", "quantity": 1},
            {"productId": "core-i7-14700k", "quantity": 1},
        ],
    },
    {
        "number": "VLT-1006",
        "userId": "sami",
        "placedDaysAgo": 20,
        "status": "delivered",
        "deliveredDaysAgo": 16,
        "lines": [{"productId": "samsung-odyssey-g7-32", "quantity": 1}],
    },
]

# Long tail of everyday purchases — deliberately NONE in the six PC-part
# categories, so they never pollute the owned-hardware profile.
_SAMI_POOL = [
    "airpods-pro-2",
    "sony-wh-1000xm5",
    "jbl-flip-6",
    "hyperx-cloud-iii",
    "logitech-mx-master-3s",
    "keychron-k8-pro",
    "anker-737-gan-charger",
    "echo-dot-5",
    "nest-hub-2",
    "tapo-p115-smart-plug",
    "iphone-16",
    "galaxy-s25",
    "pixel-9a",
    "nothing-phone-3a",
    "logitech-g-pro-x-superlight-2",
    "samsung-990-pro-2tb",
    "wd-black-sn770-1tb",
    "philips-hue-starter-kit",
    "razer-blackwidow-v4",
    "steelseries-arctis-nova-7",
]


def _sami_generated() -> list[dict[str, Any]]:
    specs = []
    for i in range(25):
        placed_days_ago = 80 + i * 18  # spread back ~18 months
        lines = [{"productId": _SAMI_POOL[i % len(_SAMI_POOL)], "quantity": 1}]
        if i % 4 == 0:
            lines.append({"productId": _SAMI_POOL[(i + 7) % len(_SAMI_POOL)], "quantity": 1})
        specs.append(
            {
                "number": f"VLT-2{i + 1:03d}",
                "userId": "sami",
                "placedDaysAgo": placed_days_ago,
                "status": "delivered",
                "deliveredDaysAgo": placed_days_ago - 4,
                "lines": lines,
            }
        )
    return specs


def _build_seed_order(spec: dict[str, Any], users: dict[str, Any], now_ms: int) -> OrderRow:
    profile = users.get(spec["userId"]) or {}
    saved = profile.get("savedAddress") or {}
    details = {
        "fullName": saved.get("fullName") or profile.get("name") or "Customer",
        "email": saved.get("email") or profile.get("email") or "",
        "address": saved.get("address") or "",
        "city": saved.get("city") or "",
        "postalCode": saved.get("postalCode") or "",
        "country": saved.get("country") or "Finland",
        "paymentMethod": profile.get("preferredPayment") or "card",
    }
    delivered_days = spec.get("deliveredDaysAgo")
    return OrderRow(
        number=spec["number"],
        user_id=spec["userId"],
        lines=spec["lines"],
        total=cart_total(spec["lines"]),
        details=details,
        placed_at=iso_from_ms(now_ms - spec["placedDaysAgo"] * DAY),
        status=spec["status"],
        delivered_at=iso_from_ms(now_ms - delivered_days * DAY) if delivered_days is not None else None,
        seed=True,
    )


# ---------------------------------------------------------------- init


def load_json(name: str) -> Any:
    return json.loads((DATA_DIR / name).read_text())


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    products: list[dict[str, Any]] = load_json("catalog.json")
    users: dict[str, dict[str, Any]] = load_json("users.json")

    # The domain layer needs the catalog BEFORE order seeding: seed-order totals
    # are computed from product prices via cart_total().
    catalog.set_products(products)

    with Session(engine) as session:
        # Static seed data: products and users mirror the shared JSON exactly.
        session.exec(delete(ProductRow))
        for position, product in enumerate(products):
            session.add(ProductRow(id=product["id"], position=position, data=product))
        session.exec(delete(UserRow))
        for user_id, profile in users.items():
            session.add(UserRow(id=user_id, data=profile))

        # Demo order history: drop and regenerate with fresh relative dates.
        session.exec(delete(OrderRow).where(OrderRow.seed == True))  # noqa: E712
        now_ms = int(time.time() * 1000)
        for spec in [*_AINO_SPECS, *_SAMI_DELIBERATE, *_sami_generated()]:
            session.add(_build_seed_order(spec, users, now_ms))
        session.commit()


def get_all_orders(session: Session) -> list[dict[str, Any]]:
    return [row.to_order() for row in session.exec(select(OrderRow)).all()]


def get_users(session: Session) -> dict[str, dict[str, Any]]:
    return {row.id: row.data for row in session.exec(select(UserRow)).all()}
