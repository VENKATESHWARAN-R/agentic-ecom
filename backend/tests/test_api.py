"""Integration tests for the REST API: seeding, identity-scoped order access
(now authorization-enforced), the derived owned-hardware profile, and order
placement attributed to the session identity."""

import time

import jwt
import pytest
from fastapi.testclient import TestClient

from voltti_backend.config import INTERNAL_JWT_SECRET
from voltti_backend.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:  # runs the lifespan (init_db)
        yield test_client


def auth(persona: str) -> dict[str, str]:
    """Headers carrying a valid BFF identity assertion for `persona` — mirrors
    what the Next BFF mints for a logged-in session."""
    token = jwt.encode(
        {"typ": "assertion", "sub": persona, "exp": int(time.time()) + 60},
        INTERNAL_JWT_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def test_products_seeded(client):
    products = client.get("/api/products").json()
    assert len(products) == 61
    assert products[0]["id"]  # catalog order preserved


def test_product_search_via_api(client):
    results = client.get("/api/products", params={"query": "noise cancelling headphones"}).json()
    assert [p["id"] for p in results] == ["sony-wh-1000xm5"]


def test_users_list_has_no_pii(client):
    # The login surface lists personas + order counts, but never emails (P6).
    users = {u["id"]: u for u in client.get("/api/users").json()}
    assert users["elina"]["ordersTotal"] == 0
    assert users["aino"]["ordersTotal"] == 3
    assert users["sami"]["ordersTotal"] == 28
    assert all("email" not in u for u in users.values())


def test_orders_are_authorization_scoped(client):
    # Aino can read her own order.
    assert client.get("/api/users/aino/orders/VLT-1002", headers=auth("aino")).status_code == 200
    # Aino, asserting her identity, cannot reach Sami's namespace → 403 (ownership).
    assert client.get("/api/users/sami/orders/VLT-1002", headers=auth("aino")).status_code == 403
    # No assertion at all → 401 (fail-closed).
    assert client.get("/api/users/aino/orders/VLT-1002").status_code == 401
    # Sami owns the path but the order isn't his → 404.
    assert client.get("/api/users/sami/orders/VLT-1002", headers=auth("sami")).status_code == 404


def test_user_routes_require_auth(client):
    # No assertion → 401. (The guest "empty profile" is now a frontend short-circuit.)
    assert client.get("/api/users/aino/agent-profile").status_code == 401
    assert client.get("/api/users/aino/orders").status_code == 401
    assert client.get("/api/users/aino/orders/summaries").status_code == 401


def test_seed_order_totals_priced_from_catalog(client):
    # Regression: seeding must happen AFTER the catalog is loaded, or totals are 0.
    order = client.get("/api/users/aino/orders/VLT-1002", headers=auth("aino")).json()
    assert order["total"] == sum(line["unitPrice"] * line["quantity"] for line in order["lines"])
    assert order["total"] > 0


def test_return_eligibility_states(client):
    closed = client.get("/api/users/aino/orders/VLT-1001", headers=auth("aino")).json()
    assert closed["returnEligibility"]["status"] == "closed"
    eligible = client.get("/api/users/aino/orders/VLT-1002", headers=auth("aino")).json()
    assert eligible["returnEligibility"]["status"] == "eligible"
    assert eligible["returnEligibility"]["daysLeft"] == 18
    in_transit = client.get("/api/users/aino/orders/VLT-1003", headers=auth("aino")).json()
    assert in_transit["returnEligibility"]["status"] == "awaiting-delivery"


def test_order_summaries_paginated(client):
    page = client.get(
        "/api/users/sami/orders/summaries", params={"limit": 50, "offset": 0}, headers=auth("sami")
    ).json()
    assert page["total"] == 28
    assert page["returned"] == 20  # limit clamped to 20
    assert page["orders"][0]["number"] == "VLT-1006"


def test_agent_profile_aino(client):
    profile = client.get("/api/users/aino/agent-profile", headers=auth("aino")).json()
    assert profile["ordersTotal"] == 3
    categories = [part["category"] for part in profile["ownedHardware"]]
    assert categories == ["cpu", "motherboard", "ram", "case", "psu"]
    cpu = profile["ownedHardware"][0]
    assert cpu["productId"] == "ryzen-7-7800x3d"
    assert cpu["inTransit"] is True  # shipped, not delivered
    assert cpu["socket"] == "AM5"
    board = profile["ownedHardware"][1]
    assert board["wifi"] is True
    assert board["orderNumber"] == "VLT-1002"


def test_agent_profile_sami_bounded(client):
    profile = client.get("/api/users/sami/agent-profile", headers=auth("sami")).json()
    # 28 orders → tiny derived profile: only the PC-part categories he owns.
    categories = [part["category"] for part in profile["ownedHardware"]]
    assert categories == ["motherboard", "cpu", "case", "psu"]


def test_place_order_attributed_to_session(client):
    # The body carries no userId — the order is attributed to the asserted identity.
    placed = client.post(
        "/api/orders",
        headers=auth("elina"),
        json={
            "lines": [{"productId": "iphone-16", "quantity": 1}],
            "details": {
                "fullName": "Elina Laine",
                "email": "elina.laine@example.com",
                "address": "Testikatu 1",
                "city": "Tampere",
                "postalCode": "33100",
                "country": "Finland",
                "paymentMethod": "card",
            },
        },
    )
    assert placed.status_code == 201
    order = placed.json()
    assert order["number"].startswith("VLT-")
    assert order["status"] == "processing"
    assert order["total"] > 0

    # Elina reads it back; another user asserting their own identity is refused (403).
    detail = client.get(f"/api/users/elina/orders/{order['number']}", headers=auth("elina")).json()
    assert detail["returnEligibility"]["status"] == "cancellable"
    assert (
        client.get(f"/api/users/elina/orders/{order['number']}", headers=auth("aino")).status_code == 403
    )
    summaries = client.get("/api/users/elina/orders/summaries", headers=auth("elina")).json()
    assert summaries["total"] == 1

    # A processing order is not "owned" yet.
    profile = client.get("/api/users/elina/agent-profile", headers=auth("elina")).json()
    assert profile["ordersTotal"] == 1
    assert profile["ownedHardware"] == []


def test_empty_cart_rejected(client):
    response = client.post("/api/orders", json={"lines": [], "details": {}})
    assert response.status_code == 400
