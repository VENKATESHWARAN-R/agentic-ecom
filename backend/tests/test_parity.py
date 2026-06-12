"""Behavior-parity tests: replay fixtures generated from the original
TypeScript domain logic (scripts/generate-parity-fixtures.ts) and assert the
Python port produces identical outputs — ids, prices, and the exact strings
embedded in tool results.

Regenerate fixtures after changing the TS logic:
    npx tsx scripts/generate-parity-fixtures.ts
"""

import json
from pathlib import Path

import pytest

from voltti_backend.domain import catalog
from voltti_backend.domain.builds import recommend_gaming_setup, recommend_pc_build
from voltti_backend.domain.catalog import get_alternatives, product_summary, search_products
from voltti_backend.domain.compat import check_compatibility
from voltti_backend.domain.format import format_date, format_price

FIXTURES = json.loads((Path(__file__).parent / "fixtures" / "parity.json").read_text())
DATA_DIR = Path(__file__).parent.parent.parent / "data"


@pytest.fixture(scope="session", autouse=True)
def load_catalog():
    catalog.set_products(json.loads((DATA_DIR / "catalog.json").read_text()))


@pytest.mark.parametrize("case", FIXTURES["formatPrice"], ids=lambda c: str(c["input"]))
def test_format_price(case):
    assert format_price(case["input"]) == case["output"]


@pytest.mark.parametrize("case", FIXTURES["formatDate"], ids=lambda c: c["input"])
def test_format_date(case):
    assert format_date(case["input"]) == case["output"]


@pytest.mark.parametrize("case", FIXTURES["searchProducts"], ids=lambda c: json.dumps(c["input"]))
def test_search_products(case):
    assert [p["id"] for p in search_products(case["input"])] == case["output"]


@pytest.mark.parametrize("case", FIXTURES["searchCatalogTool"], ids=lambda c: json.dumps(c["input"]))
def test_search_catalog_tool_shape(case):
    results = search_products(case["input"])
    output = {
        "totalMatches": len(results),
        "products": [product_summary(p) for p in results[:8]],
    }
    assert output == case["output"]


@pytest.mark.parametrize("case", FIXTURES["getAlternatives"], ids=lambda c: c["input"])
def test_get_alternatives(case):
    assert [p["id"] for p in get_alternatives(case["input"])] == case["output"]


@pytest.mark.parametrize("case", FIXTURES["checkCompatibility"], ids=lambda c: ",".join(c["input"]["productIds"]))
def test_check_compatibility(case):
    result = check_compatibility(case["input"]["productIds"], case["input"].get("owned") or [])
    assert result == case["output"]


@pytest.mark.parametrize("case", FIXTURES["recommendPcBuild"], ids=lambda c: json.dumps(c["input"]))
def test_recommend_pc_build(case):
    result = recommend_pc_build(case["input"])
    subset = {key: result[key] for key in ("ids", "totalPrice", "summary", "tradeoffs", "compatibility")}
    assert subset == case["output"]


@pytest.mark.parametrize("case", FIXTURES["recommendGamingSetup"], ids=lambda c: json.dumps(c["input"]))
def test_recommend_gaming_setup(case):
    result = recommend_gaming_setup(case["input"])
    subset = {key: result[key] for key in ("ids", "totalPrice", "summary", "tradeoffs", "warnings")}
    subset["alternatives"] = [p["id"] for p in result["alternatives"]]
    assert subset == case["output"]
