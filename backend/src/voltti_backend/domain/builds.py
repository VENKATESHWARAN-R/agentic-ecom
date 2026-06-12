"""Deterministic PC-build and gaming-setup recommenders, ported from
src/lib/services.ts. Budget-share allocation, platform consistency, and the
compatibility check keep recommendations grounded — the model never guesses.
"""

from __future__ import annotations

from typing import Any, Callable

from .catalog import Product, is_deal, discount_percent, search_products, all_products
from .compat import check_compatibility
from .format import format_price

BUILD_SHARE = {
    "gpu": 0.38,
    "cpu": 0.22,
    "motherboard": 0.12,
    "ram": 0.08,
    "ssd": 0.08,
    "psu": 0.06,
    "case": 0.06,
}


def _compat(product: Product) -> dict[str, Any]:
    return product.get("compat") or {}


def pick_part(
    subcategory: str,
    max_price: float,
    prefer: Callable[[Product], bool] | None = None,
    exclude: Callable[[Product], bool] | None = None,
) -> Product | None:
    pool = [p for p in all_products() if p["subcategory"] == subcategory and p["stock"] > 0]
    if exclude:
        pool = [p for p in pool if not exclude(p)]
    pool = sorted(pool, key=lambda p: -p["price"])
    preferred = [p for p in pool if prefer(p)] if prefer else pool

    def within_budget(candidates: list[Product]) -> Product | None:
        return next((p for p in candidates if p["price"] <= max_price), None)

    return (
        within_budget(preferred)
        or within_budget(pool)
        or (preferred[-1] if preferred else None)
        or (pool[-1] if pool else None)
    )


def recommend_pc_build(request: dict[str, Any]) -> dict[str, Any]:
    budget = request["budget"]
    brand_preference = request.get("brandPreference") or []

    def prefers_brand(product: Product) -> bool:
        if not brand_preference:
            return True
        return any(
            brand.lower() in product["brand"].lower() or brand.lower() in product["tags"]
            for brand in brand_preference
        )

    wants_amd = request.get("cpuPlatform") == "amd"
    wants_intel = request.get("cpuPlatform") == "intel"

    def cpu_prefer(product: Product) -> bool:
        platform_ok = (
            product["brand"] == "AMD" if wants_amd else product["brand"] == "Intel" if wants_intel else True
        )
        return platform_ok and prefers_brand(product)

    cpu = pick_part("cpu", budget * BUILD_SHARE["cpu"], cpu_prefer)
    memory_type = _compat(cpu).get("memoryType") if cpu else None

    board = None
    if cpu:
        cpu_socket = _compat(cpu).get("socket")

        def board_exclude(product: Product) -> bool:
            board_memory = _compat(product).get("memoryType")
            return _compat(product).get("socket") != cpu_socket or bool(
                memory_type and board_memory and board_memory != memory_type
            )

        board = pick_part("motherboard", budget * BUILD_SHARE["motherboard"], None, board_exclude)

    def ram_exclude(product: Product) -> bool:
        return _compat(product).get("memoryType") != memory_type if memory_type else False

    ram = pick_part("ram", budget * BUILD_SHARE["ram"], None, ram_exclude)
    gpu = pick_part("gpu", budget * BUILD_SHARE["gpu"], prefers_brand)
    storage = pick_part("ssd", budget * BUILD_SHARE["ssd"])

    def case_prefer(product: Product) -> bool:
        gpu_length = _compat(gpu).get("gpuLengthMm") if gpu else None
        if gpu_length:
            return (_compat(product).get("maxGpuLengthMm") or 0) >= gpu_length
        return True

    pc_case = pick_part("case", budget * BUILD_SHARE["case"], case_prefer)
    draw = (_compat(cpu).get("drawWatts") or 0 if cpu else 0) + (_compat(gpu).get("drawWatts") or 0 if gpu else 0)
    psu = pick_part("psu", budget * BUILD_SHARE["psu"], lambda p: (_compat(p).get("psuWatts") or 0) >= (draw + 150) * 1.3)

    parts = [p for p in [cpu, board, ram, gpu, storage, psu, pc_case] if p is not None]
    ids = [p["id"] for p in parts]
    total_price = sum(p["price"] for p in parts)
    compatibility = check_compatibility(ids)
    games = ", ".join(request["games"]) if request.get("games") else "modern AAA and competitive titles"

    tradeoffs: list[str] = []
    if total_price > budget:
        tradeoffs.append(
            f"The build lands at {format_price(total_price)}, {format_price(total_price - budget)} "
            f"over budget — the GPU or CPU could be stepped down."
        )
    else:
        tradeoffs.append(
            f"Total {format_price(total_price)} leaves {format_price(budget - total_price)} of the budget unspent."
        )
    if gpu and is_deal(gpu):
        tradeoffs.append(f"{gpu['name']} is currently discounted, which stretches the budget further.")
    if cpu and cpu["brand"] == "AMD":
        tradeoffs.append("The AM5 platform has a long upgrade path for future CPUs.")

    cpu_name = cpu["name"] if cpu else "—"
    gpu_name = gpu["name"] if gpu else "—"
    return {
        "ids": ids,
        "parts": parts,
        "totalPrice": total_price,
        "summary": f"A {cpu_name} + {gpu_name} build for {games}, targeting {format_price(budget)}.",
        "tradeoffs": tradeoffs,
        "compatibility": compatibility,
    }


def recommend_gaming_setup(request: dict[str, Any]) -> dict[str, Any]:
    budget = request["budget"]
    brand_preference = request.get("brandPreference") or []
    candidates = [
        p
        for p in search_products(
            {
                "category": "laptops" if request.get("preferLaptop") else "desktops",
                "tags": ["gaming"],
                "inStockOnly": True,
                "sort": "price-desc",
            }
        )
        if not brand_preference
        or any(brand.lower() in p["brand"].lower() for brand in brand_preference)
    ]

    base = (
        next((p for p in candidates if p["price"] <= budget * 0.85), None)
        or next((p for p in candidates if p["price"] <= budget), None)
        or (candidates[-1] if candidates else None)
    )
    if not base:
        return {
            "ids": [],
            "products": [],
            "totalPrice": 0,
            "summary": "No gaming systems matched.",
            "tradeoffs": [],
            "warnings": ["No in-stock gaming systems found for these preferences."],
            "alternatives": [],
        }

    extras: list[Product] = []
    remaining = budget - base["price"]
    if request.get("includeMonitor") and not request.get("preferLaptop"):
        monitors = search_products(
            {"category": "monitors", "tags": ["gaming"], "maxPrice": max(200, remaining), "inStockOnly": True}
        )
        if monitors:
            extras.append(monitors[0])
            remaining -= monitors[0]["price"]
    if request.get("includePeripherals"):
        headsets = search_products(
            {"query": "headset", "tags": ["gaming"], "maxPrice": max(80, remaining), "inStockOnly": True}
        )
        if headsets:
            extras.append(headsets[0])
            remaining -= headsets[0]["price"]
        mice = search_products(
            {"category": "accessories", "tags": ["gaming", "mouse"], "maxPrice": max(60, remaining), "inStockOnly": True}
        )
        if mice:
            extras.append(mice[0])
            remaining -= mice[0]["price"]

    selected = [base, *extras]
    total_price = sum(p["price"] for p in selected)
    games = ", ".join(request["games"]) if request.get("games") else "modern competitive and AAA games"

    tradeoffs = [
        "A laptop is portable and complete out of the box, but less upgradeable than a tower."
        if base["category"] == "laptops"
        else "A tower gives the best upgrade path; remember peripherals if you don't own any.",
        f"The full setup lands at {format_price(total_price)}, within budget."
        if total_price <= budget
        else f"The setup is {format_price(total_price - budget)} over budget — drop an accessory or step the system down.",
    ]
    if is_deal(base):
        tradeoffs.append(f"{base['name']} is currently {discount_percent(base)}% off.")

    return {
        "ids": [p["id"] for p in selected],
        "products": selected,
        "totalPrice": total_price,
        "summary": f"{base['name']} as the core system for {games}, around {format_price(budget)}.",
        "tradeoffs": tradeoffs,
        "warnings": [f"Total {format_price(total_price)} exceeds the {format_price(budget)} budget."]
        if total_price > budget
        else [],
        "alternatives": [p for p in candidates if p["id"] != base["id"]][:3],
    }
