"""Product catalog: in-memory list of product dicts (camelCase keys, identical
to data/catalog.json), loaded once at startup. Search/alternatives/summary are
a faithful port of src/lib/services.ts — the parity tests in tests/test_parity.py
assert identical behavior, so keep changes mirrored in both places.
"""

from __future__ import annotations

import re
from typing import Any, Callable

Product = dict[str, Any]

_products: list[Product] = []


def set_products(products: list[Product]) -> None:
    global _products
    _products = products


def all_products() -> list[Product]:
    return _products


def get_product(product_id: str) -> Product | None:
    return next((p for p in _products if p["id"] == product_id), None)


def get_products(ids: list[str]) -> list[Product]:
    found = (get_product(product_id) for product_id in ids)
    return [p for p in found if p is not None]


def is_deal(product: Product) -> bool:
    original = product.get("originalPrice")
    return bool(original and original > product["price"])


def discount_percent(product: Product) -> int:
    if not is_deal(product):
        return 0
    # JS Math.round rounds .5 up; Python round() is banker's — match JS.
    import math

    return math.floor((1 - product["price"] / product["originalPrice"]) * 100 + 0.5)


def search_products(filters: dict[str, Any] | None = None) -> list[Product]:
    filters = filters or {}
    query = (filters.get("query") or "").strip().lower()
    terms = [t for t in re.split(r"\s+", query) if t] if query else []

    def matches(product: Product) -> bool:
        if filters.get("inStockOnly") and product["stock"] <= 0:
            return False
        if filters.get("dealsOnly") and not is_deal(product):
            return False
        if filters.get("category") == "gaming":
            if "gaming" not in product["tags"]:
                return False
        elif filters.get("category") and product["category"] != filters["category"]:
            return False
        if filters.get("maxPrice") and product["price"] > filters["maxPrice"]:
            return False
        if filters.get("minPrice") and product["price"] < filters["minPrice"]:
            return False
        brands = filters.get("brands")
        if brands and not any(product["brand"].lower() == brand.lower() for brand in brands):
            return False
        tags = filters.get("tags")
        if tags and not all(tag in product["tags"] for tag in tags):
            return False
        if not terms:
            return True
        haystack_parts = [
            product["name"],
            product["brand"],
            product["category"],
            product["subcategory"],
            product["blurb"],
            product["description"],
            *product["tags"],
        ]
        for key, value in product["specs"].items():
            haystack_parts.extend([key, value])
        haystack = " ".join(haystack_parts).lower()
        return all(term in haystack for term in terms)

    matched = [p for p in _products if matches(p)]

    sort = filters.get("sort") or "relevance"
    if sort == "price-asc":
        return sorted(matched, key=lambda p: p["price"])
    if sort == "price-desc":
        return sorted(matched, key=lambda p: -p["price"])
    if sort == "rating":
        return sorted(matched, key=lambda p: -p["rating"])
    return sorted(
        matched,
        key=lambda p: (
            -(1 if p["stock"] > 0 else 0),
            -(1 if is_deal(p) else 0),
            -p["rating"],
            p["price"],
        ),
    )


def get_deals() -> list[Product]:
    return search_products({"dealsOnly": True})


def get_alternatives(product_id: str, limit: int = 4) -> list[Product]:
    """In-stock alternatives for an unavailable or unsuitable product, closest price first."""
    product = get_product(product_id)
    if not product:
        return []

    def is_candidate(candidate: Product) -> bool:
        if candidate["id"] == product_id or candidate["stock"] <= 0:
            return False
        same_sub = (
            candidate["category"] == product["category"]
            and candidate["subcategory"] == product["subcategory"]
        )
        shared_tag = candidate["category"] == product["category"] and any(
            tag in product["tags"] for tag in candidate["tags"]
        )
        return same_sub or shared_tag

    candidates = [p for p in _products if is_candidate(p)]
    return sorted(candidates, key=lambda p: abs(p["price"] - product["price"]))[:limit]


def product_summary(product: Product) -> dict[str, Any]:
    """Compact product shape for agent context / tool results (keeps token use down).

    Optional keys (originalPrice, compat) are omitted when absent, matching the
    JSON serialization of the original TypeScript shape.
    """
    summary: dict[str, Any] = {
        "id": product["id"],
        "name": product["name"],
        "brand": product["brand"],
        "category": product["category"],
        "subcategory": product["subcategory"],
        "price": product["price"],
    }
    if "originalPrice" in product:
        summary["originalPrice"] = product["originalPrice"]
    summary.update(
        {
            "inStock": product["stock"] > 0,
            "stock": product["stock"],
            "rating": product["rating"],
            "tags": product["tags"],
            "blurb": product["blurb"],
        }
    )
    if "compat" in product:
        summary["compat"] = product["compat"]
    return summary


PickPredicate = Callable[[Product], bool]
