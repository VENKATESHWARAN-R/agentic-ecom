"""Tests for the output-validation layer (P6): tool-result field-filtering and the
best-effort free-text scanners."""

import asyncio

from pydantic_ai import Agent
from pydantic_ai.models.test import TestModel
from pydantic_ai.toolsets.function import FunctionToolset

from voltti_backend.agent.output_validation import (
    OutputValidationToolset,
    filter_result,
    scan_text,
)


def test_filter_drops_forbidden_keys_at_any_depth():
    leaky = {
        "signedIn": True,
        "orders": [
            {"number": "VLT-1002", "total": 99.0, "email": "a@b.com", "details": {"address": "x"}},
        ],
        "userId": "aino",
    }
    cleaned, dropped, _ = filter_result(leaky)
    assert "userId" not in cleaned
    assert "email" not in cleaned["orders"][0]
    assert "details" not in cleaned["orders"][0]
    # The legitimate fields survive untouched.
    assert cleaned["orders"][0] == {"number": "VLT-1002", "total": 99.0}
    assert set(dropped) == {"email", "details", "userId"}


def test_filter_is_noop_on_curated_result():
    # A real getMyOrders-shaped page carries no forbidden keys → byte-identical.
    page = {
        "signedIn": True,
        "total": 3,
        "offset": 0,
        "returned": 1,
        "orders": [{"number": "VLT-1002", "placedAt": "2026-05-27", "status": "delivered", "total": 1299.0, "items": ["Sony WH-1000XM5"]}],
    }
    cleaned, dropped, findings = filter_result(page)
    assert cleaned == page
    assert dropped == [] and findings == []


def test_scan_text_flags_secrets_prompt_leak_and_links():
    assert any(f.startswith("secret:") for f in scan_text("here is hf_abcdefgh12345678 token"))
    assert "secret:jwt" in scan_text("token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhaW5vIn0.aZ9-_cdef123 here")
    assert "prompt-leak" in scan_text("I am a sharp, friendly electronics-store employee, the kind who...")
    assert any(f.startswith("unsafe-link:") for f in scan_text("visit http://evil.example.com/now"))


def test_scan_text_passes_benign_and_allowed_links():
    assert scan_text("Here are some great gaming laptops under 1500 euros.") == []
    assert scan_text("Drop off at https://voltti.example/returns or any Posti point") == []


def test_toolset_wrapper_filters_before_model_sees_it():
    # A deliberately leaky tool, wrapped by the output-validation toolset, must hand
    # the model a result with the forbidden field already stripped.
    ts = FunctionToolset()

    @ts.tool_plain
    def leakyTool() -> dict:
        return {"ok": True, "email": "leak@voltti.test"}

    agent = Agent(TestModel(call_tools=["leakyTool"]), toolsets=[OutputValidationToolset(ts)])
    res = asyncio.run(agent.run("go"))
    returns = [p for m in res.all_messages() for p in getattr(m, "parts", []) if type(p).__name__ == "ToolReturnPart"]
    assert returns, "the tool should have been called"
    assert returns[0].content == {"ok": True}  # email stripped before the model
