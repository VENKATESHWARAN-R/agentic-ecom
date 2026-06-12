"""Integration tests for the REST API: seeding, identity-scoped order access,
the derived owned-hardware profile, and order placement."""

import pytest
from fastapi.testclient import TestClient

from voltti_backend.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:  # runs the lifespan (init_db)
        yield test_client


def test_products_seeded(client):
    products = client.get("/api/products").json()
    assert len(products) == 61
    assert products[0]["id"]  # catalog order preserved


def test_product_search_via_api(client):
    results = client.get("/api/products", params={"query": "noise cancelling headphones"}).json()
    assert [p["id"] for p in results] == ["sony-wh-1000xm5"]


def test_users_with_order_counts(client):
    users = {u["id"]: u for u in client.get("/api/users").json()}
    assert users["elina"]["ordersTotal"] == 0
    assert users["aino"]["ordersTotal"] == 3
    assert users["sami"]["ordersTotal"] == 28


def test_orders_are_identity_scoped(client):
    # Aino can see her order; Sami cannot see Aino's.
    assert client.get("/api/users/aino/orders/VLT-1002").status_code == 200
    assert client.get("/api/users/sami/orders/VLT-1002").status_code == 404


def test_seed_order_totals_priced_from_catalog(client):
    # Regression: seeding must happen AFTER the catalog is loaded, or totals are 0.
    order = client.get("/api/users/aino/orders/VLT-1002").json()
    assert order["total"] == sum(line["unitPrice"] * line["quantity"] for line in order["lines"])
    assert order["total"] > 0


def test_return_eligibility_states(client):
    closed = client.get("/api/users/aino/orders/VLT-1001").json()
    assert closed["returnEligibility"]["status"] == "closed"
    eligible = client.get("/api/users/aino/orders/VLT-1002").json()
    assert eligible["returnEligibility"]["status"] == "eligible"
    assert eligible["returnEligibility"]["daysLeft"] == 18
    in_transit = client.get("/api/users/aino/orders/VLT-1003").json()
    assert in_transit["returnEligibility"]["status"] == "awaiting-delivery"


def test_order_summaries_paginated(client):
    page = client.get("/api/users/sami/orders/summaries", params={"limit": 50, "offset": 0}).json()
    assert page["total"] == 28
    assert page["returned"] == 20  # limit clamped to 20
    assert page["orders"][0]["number"] == "VLT-1006"


def test_agent_profile_aino(client):
    profile = client.get("/api/users/aino/agent-profile").json()
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
    profile = client.get("/api/users/sami/agent-profile").json()
    # 28 orders → tiny derived profile: only the PC-part categories he owns.
    categories = [part["category"] for part in profile["ownedHardware"]]
    assert categories == ["motherboard", "cpu", "case", "psu"]


def test_guest_has_empty_profile(client):
    profile = client.get("/api/users/guest/agent-profile").json()
    assert profile == {"ordersTotal": 0, "ownedHardware": [], "ownedRefs": []}


def test_place_order_and_read_back(client):
    placed = client.post(
        "/api/orders",
        json={
            "userId": "elina",
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

    detail = client.get(f"/api/users/elina/orders/{order['number']}").json()
    assert detail["returnEligibility"]["status"] == "cancellable"
    summaries = client.get("/api/users/elina/orders/summaries").json()
    assert summaries["total"] == 1

    # A processing order is not "owned" yet.
    profile = client.get("/api/users/elina/agent-profile").json()
    assert profile["ordersTotal"] == 1
    assert profile["ownedHardware"] == []


def test_empty_cart_rejected(client):
    response = client.post("/api/orders", json={"userId": "guest", "lines": [], "details": {}})
    assert response.status_code == 400
