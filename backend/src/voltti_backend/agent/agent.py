"""The Voltti shopping agent (Pydantic AI).

- The system prompt lives in prompt.md next to this file — edit it freely, no
  application code needs to change.
- The six catalog tools keep the exact names from the original CopilotKit
  BuiltInAgent so the frontend's generative-UI renderers keep working.
- Live app context (cart, persona, owned hardware…) arrives per-request via
  AG-UI's `RunAgentInput.context` (sent by the frontend's useAgentContext).
  The AG-UI adapter does not surface it by itself, so main.py extracts it into
  AgentDeps and the dynamic instructions below inject it into the prompt.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from sqlmodel import Session

from ..config import AGENT_MODEL
from ..db import engine, get_all_orders
from ..domain.builds import recommend_gaming_setup, recommend_pc_build
from ..domain.catalog import get_alternatives, get_product, product_summary, search_products
from ..domain.compat import check_compatibility
from ..domain.orders import get_order_detail, get_orders_for
from . import policy

SYSTEM_PROMPT = (Path(__file__).parent / "prompt.md").read_text()

Category = Literal[
    "phones", "laptops", "desktops", "components", "monitors", "audio", "accessories", "smart-home", "gaming"
]


@dataclass
class AgentDeps:
    """Per-request dependencies: the AG-UI context items from the frontend, plus
    the session identity resolved from the BFF assertion (never model-supplied)."""

    context: list[dict[str, Any]] = field(default_factory=list)
    identity: str | None = None


class OwnedRef(BaseModel):
    """Minimal reference to an owned product (ids + order provenance only)."""

    productId: str
    orderNumber: str
    orderedOn: str


agent = Agent(
    AGENT_MODEL,
    deps_type=AgentDeps,
    instructions=SYSTEM_PROMPT,
)


@agent.instructions
def live_app_context(ctx: RunContext[AgentDeps]) -> str | None:
    if not ctx.deps or not ctx.deps.context:
        return None
    sections: list[str] = []
    for item in ctx.deps.context:
        description = item.get("description") or "Context"
        value = item.get("value")
        rendered = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
        sections.append(f"## {description}\n{rendered}")
    return "# Live application context\n" + "\n\n".join(sections)


@agent.tool_plain
def searchCatalog(
    query: Annotated[str | None, Field(description="Free-text search, e.g. 'noise cancelling headphones' or 'rtx 5070'.")] = None,
    category: Category | None = None,
    maxPrice: Annotated[float | None, Field(description="Maximum price in EUR.")] = None,
    brands: list[str] | None = None,
    dealsOnly: Annotated[bool | None, Field(description="Only discounted products.")] = None,
    inStockOnly: Annotated[bool | None, Field(description="Defaults to false so out-of-stock items are visible; mention when something is out of stock.")] = None,
) -> dict[str, Any]:
    """Search Voltti's product catalog. Always use this before recommending or discussing specific products — never invent products, prices, or stock levels. Category 'gaming' matches gaming-tagged products across categories."""
    results = search_products(
        {
            "query": query,
            "category": category,
            "maxPrice": maxPrice,
            "brands": brands,
            "dealsOnly": dealsOnly,
            "inStockOnly": inStockOnly,
        }
    )
    return {
        "totalMatches": len(results),
        "products": [product_summary(p) for p in results[:8]],
    }


@agent.tool_plain
def getProductDetails(productId: str) -> dict[str, Any]:
    """Get full details for one product by id: description, specs, stock, and compatibility metadata."""
    product = get_product(productId)
    if not product:
        return {"error": f'No product with id "{productId}".'}
    return {
        **product_summary(product),
        "description": product["description"],
        "specs": product["specs"],
        "highlights": product["highlights"],
    }


@agent.tool_plain
def getProductAlternatives(
    productId: Annotated[str, Field(description="The product to find alternatives for.")],
) -> dict[str, Any]:
    """Find in-stock alternatives when a product is out of stock, over budget, or otherwise unsuitable."""
    original = get_product(productId)
    result: dict[str, Any] = {}
    if original:
        result["original"] = {"id": original["id"], "name": original["name"], "inStock": original["stock"] > 0}
    result["alternatives"] = [product_summary(p) for p in get_alternatives(productId)]
    return result


@agent.tool_plain
def checkCompatibility(
    productIds: Annotated[list[str], Field(min_length=1, description="Product ids of the candidate parts to check.")],
    owned: Annotated[
        list[OwnedRef] | None,
        Field(description="Parts the user already owns, copied verbatim from context.ownedHardware (ids + order provenance)."),
    ] = None,
) -> dict[str, Any]:
    """Check whether a set of PC parts work together: CPU socket vs motherboard, memory generation, GPU length vs case, PSU headroom, and stock. ALWAYS call this before telling the user a set of components is compatible. When the user is signed in, ALSO pass `owned` (their ownedHardware from context) so the check spans across past orders — conflicts and PSU/length issues against parts they already bought get attributed to the right order."""
    return check_compatibility(productIds, [ref.model_dump() for ref in owned] if owned else [])


@agent.tool_plain
def recommendPcBuild(
    budget: Annotated[float, Field(description="Budget in EUR.")],
    cpuPlatform: Annotated[Literal["amd", "intel"] | None, Field(description="CPU platform preference, if the user stated one.")] = None,
    brandPreference: Annotated[list[str] | None, Field(description="GPU/part brand preferences, e.g. ['nvidia'].")] = None,
    games: Annotated[list[str] | None, Field(description="Games or genres the user plans to play.")] = None,
) -> dict[str, Any]:
    """Build a custom gaming PC part list (CPU, motherboard, RAM, GPU, storage, PSU, case) from the catalog for a budget. Deterministic and compatibility-checked. Ask the user about budget and platform/brand preferences first if unknown."""
    result = recommend_pc_build(
        {"budget": budget, "cpuPlatform": cpuPlatform, "brandPreference": brandPreference, "games": games}
    )
    return {**result, "parts": [product_summary(p) for p in result["parts"]]}


@agent.tool_plain
def recommendGamingSetup(
    budget: Annotated[float, Field(description="Budget in EUR.")],
    games: list[str] | None = None,
    brandPreference: list[str] | None = None,
    includeMonitor: bool = False,
    includePeripherals: bool = False,
    preferLaptop: bool = False,
) -> dict[str, Any]:
    """Recommend a complete prebuilt gaming setup (desktop or gaming laptop, optionally monitor and peripherals) within a budget. Use for users who don't want to assemble parts themselves."""
    result = recommend_gaming_setup(
        {
            "budget": budget,
            "games": games,
            "brandPreference": brandPreference,
            "includeMonitor": includeMonitor,
            "includePeripherals": includePeripherals,
            "preferLaptop": preferLaptop,
        }
    )
    return {
        **result,
        "products": [product_summary(p) for p in result["products"]],
        "alternatives": [product_summary(p) for p in result["alternatives"]],
    }


# Mirror of api.routes.RETURN_POLICY (demo copy — kept here so the order/return
# tools don't import the API layer).
RETURN_POLICY = "30-day free returns from the delivery date; item unopened or unused. Drop off at any Posti point (demo)."


# ---------------------------------------------------------------- identity-scoped tools
# Run in the backend (unlike the catalog tools, these touch user data). Identity
# comes from the session via deps — there is NO userId parameter for the model to
# supply, hallucinate, or be talked into changing (P4). Each call passes the tool
# gateway (P2/P5) and is scoped to the authenticated owner.


@agent.tool
def getMyOrders(
    ctx: RunContext[AgentDeps],
    limit: Annotated[int, Field(ge=1, le=20, description="How many orders to return (default 5, max 20).")] = 5,
    offset: Annotated[int, Field(ge=0, description="Skip this many of the newest orders, for pagination.")] = 0,
) -> dict[str, Any]:
    """List the signed-in customer's recent orders as compact summaries. Paginated — default 5, max 20 per call; use `total`/`offset` to page only if the user asks. The customer is whoever is signed in; you cannot pass a user id."""
    identity = policy.authorize("getMyOrders", ctx.deps.identity)
    if identity is None:
        return {"signedIn": False}
    with Session(engine) as session:
        orders = get_all_orders(session)
    page = get_orders_for(identity, orders, limit=limit, offset=offset)
    return {
        "signedIn": True,
        "total": page["total"],
        "offset": max(0, offset),
        "returned": len(page["orders"]),
        "orders": page["orders"],
    }


@agent.tool
def getReturnInfo(
    ctx: RunContext[AgentDeps],
    orderNumber: Annotated[str, Field(description="Order number, e.g. VLT-1002.")],
) -> dict[str, Any]:
    """Return status and the exact return-by date for one of the signed-in customer's orders. Quote the deadline verbatim — never compute dates yourself. Scoped to the signed-in customer; you cannot pass a user id."""
    identity = policy.authorize("getReturnInfo", ctx.deps.identity)
    if identity is None:
        return {"signedIn": False}
    with Session(engine) as session:
        orders = get_all_orders(session)
    detail = get_order_detail(identity, orderNumber, orders)
    if not detail:
        return {"signedIn": True, "found": False, "orderNumber": orderNumber}
    return {
        "signedIn": True,
        "found": True,
        "policy": RETURN_POLICY,
        "order": {
            "number": detail["number"],
            "status": detail["status"],
            "deliveredAt": detail.get("deliveredAt"),
            "returnEligibility": detail["returnEligibility"],
            "items": [line["name"] for line in detail["lines"]],
        },
    }
