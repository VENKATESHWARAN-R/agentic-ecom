"""Deterministic PC-part compatibility check, ported from src/lib/services.ts.

`owned` lets the check span *across orders*: parts the customer already owns
are unioned into the build and any warning that involves one is attributed to
its purchase ("…from your order VLT-1002 on 27 May 2026"). See docs/agent-contract.md.
"""

from __future__ import annotations

import math
from typing import Any

from .catalog import Product, get_products
from .format import format_date


def check_compatibility(product_ids: list[str], owned: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    owned = owned or []
    owned_map = {ref["productId"]: ref for ref in owned}
    candidate_ids = set(product_ids)
    # Union candidate + owned ids, de-duplicated, preserving order.
    all_ids: list[str] = []
    for product_id in [*product_ids, *(ref["productId"] for ref in owned)]:
        if product_id not in all_ids:
            all_ids.append(product_id)
    selected = get_products(all_ids)
    warnings: list[str] = []
    notes: list[str] = []

    def own(product: Product) -> str:
        """Attribution suffix for an owned part, '' for a candidate part."""
        ref = owned_map.get(product["id"])
        if ref:
            return f" (from your order {ref['orderNumber']} on {format_date(ref['orderedOn'])})"
        return ""

    def compat(product: Product) -> dict[str, Any]:
        return product.get("compat") or {}

    cpus = [p for p in selected if p["subcategory"] == "cpu"]
    boards = [p for p in selected if p["subcategory"] == "motherboard"]
    gpus = [p for p in selected if p["subcategory"] == "gpu"]
    ram_kits = [p for p in selected if p["subcategory"] == "ram"]
    psus = [p for p in selected if compat(p).get("psuWatts")]
    cases = [p for p in selected if compat(p).get("maxGpuLengthMm")]

    for cpu in cpus:
        for board in boards:
            cpu_socket = compat(cpu).get("socket")
            board_socket = compat(board).get("socket")
            if cpu_socket and board_socket and cpu_socket != board_socket:
                warnings.append(
                    f"{cpu['name']}{own(cpu)} uses socket {cpu_socket}, but {board['name']}{own(board)} "
                    f"is a {board_socket} board. These are not compatible."
                )

    memory_parts = [p for p in [*cpus, *boards, *ram_kits] if compat(p).get("memoryType")]
    memory_types = {compat(p)["memoryType"] for p in memory_parts}
    if len(memory_types) > 1:
        detail = ", ".join(f"{p['name']}{own(p)} ({compat(p)['memoryType']})" for p in memory_parts)
        warnings.append(
            f"Mixed memory generations in this build: {detail}. All parts must use the same memory type."
        )

    for gpu in gpus:
        for pc_case in cases:
            gpu_length = compat(gpu).get("gpuLengthMm")
            max_length = compat(pc_case).get("maxGpuLengthMm")
            if gpu_length and max_length and gpu_length > max_length:
                warnings.append(
                    f"{gpu['name']}{own(gpu)} is {gpu_length} mm long, but {pc_case['name']}{own(pc_case)} "
                    f"fits GPUs up to {max_length} mm."
                )

    estimated_draw = sum(compat(p).get("drawWatts") or 0 for p in selected)
    if estimated_draw > 0:
        headroom_target = math.ceil((estimated_draw + 150) * 1.3)
        notes.append(f"Estimated component draw ≈ {estimated_draw + 150} W including the rest of the system.")
        for psu in psus:
            psu_watts = compat(psu)["psuWatts"]
            if psu_watts < headroom_target:
                warnings.append(
                    f"{psu['name']}{own(psu)} ({psu_watts} W) is tight for this build — "
                    f"recommended at least {headroom_target} W for safe headroom."
                )

    for product in selected:
        if product["stock"] <= 0:
            warnings.append(f"{product['name']}{own(product)} is currently out of stock.")

    # Redundancy nudge (advisory note, never a blocking warning): a Wi-Fi adapter
    # in the candidate set when an owned motherboard already has built-in Wi-Fi.
    owned_wifi_boards = [b for b in boards if b["id"] in owned_map and "wifi" in b["tags"]]
    wifi_adapters = [p for p in selected if p["subcategory"] == "wifi-adapter" and p["id"] in candidate_ids]
    if owned_wifi_boards and wifi_adapters:
        board = owned_wifi_boards[0]
        notes.append(
            f"Your {board['name']}{own(board)} already has built-in Wi-Fi — "
            f"the {wifi_adapters[0]['name']} may be unnecessary."
        )

    if cpus and boards and not ram_kits:
        notes.append("No RAM kit selected yet.")
    if gpus and not psus:
        notes.append("No power supply selected yet.")

    return {
        "productIds": [p["id"] for p in selected],
        "compatible": len(warnings) == 0,
        "warnings": warnings,
        "notes": notes,
    }
