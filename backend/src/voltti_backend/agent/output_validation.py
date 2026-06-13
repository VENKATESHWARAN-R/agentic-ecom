"""Output validation (P6) — the last trust boundary, between the agent and the user.

Two checks, matched to what each surface can actually guarantee:

1. **Tool results** run server-side, so we filter them *fully* before the model
   (and the UI) ever see them. A central wrapper drops any field on the PII/secret
   deny-list — so a future serialization bug (a raw ``Order.details`` dump, a
   stray ``userId``) can't leak structured data, regardless of which tool slipped.
   This is the strong, structural control.

2. **The model's free text** streams to the browser token-by-token over SSE — you
   can't un-send a delta — so full mid-stream validation isn't possible (see
   target-architecture.md). We do the honest thing: keep sensitive data *out of the
   model* (sanitized context + filtered tool results above), so it can't leak what
   it never had, and run a **best-effort audit** on the completed text for the one
   thing it does hold (its system prompt) and any secret-shaped string.

The field deny-list is the layer-classification.md §2 table; allowed low-sensitivity
facts (``preferredPayment``, ``hasSavedAddress``) are deliberately absent so we don't
over-redact.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from pydantic_ai.toolsets.wrapper import WrapperToolset

from ..config import INTERNAL_JWT_SECRET

logger = logging.getLogger("voltti.outputvalidation")

# PII / secret field names that must never appear in a tool result (P6). Matched
# case-insensitively. Curated tool shapes never include these — a hit is a bug.
FORBIDDEN_KEYS = frozenset(
    {
        "email",
        "address",
        "postalcode",
        "fullname",
        "city",
        "savedaddress",
        "details",
        "userid",
        "paymentmethod",
        "password",
        "token",
        "secret",
        "apikey",
        "authorization",
    }
)

# Hosts whose links are allowed in output; anything else is flagged as unsafe.
_ALLOWED_LINK_HOSTS = ("voltti", "posti")

_URL_RE = re.compile(r"https?://([^/\s)\"']+)", re.IGNORECASE)
_SECRET_RES = (
    ("openai-key", re.compile(r"\bsk-[A-Za-z0-9]{12,}")),
    ("hf-token", re.compile(r"\bhf_[A-Za-z0-9]{12,}")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+")),
)

# Distinctive system-prompt fragments — if the model echoes one, it's leaking its
# instructions. Internal-only phrasing, unlikely to surface in normal replies.
_PROMPT_SENTINELS = (
    "electronics-store employee, the kind",
    "actually builds pcs at home",
)


def scan_text(text: str) -> list[str]:
    """Best-effort findings in a piece of free text: leaked secrets, a system-prompt
    echo, or an off-site link. Returns finding labels (empty = clean)."""
    if not text:
        return []
    findings: list[str] = []
    lowered = text.lower()

    for label, pattern in _SECRET_RES:
        if pattern.search(text):
            findings.append(f"secret:{label}")
    # The configured assertion secret, if it's a real (non-default) value.
    if INTERNAL_JWT_SECRET and "change-me" not in INTERNAL_JWT_SECRET and INTERNAL_JWT_SECRET in text:
        findings.append("secret:internal-jwt")

    if any(s in lowered for s in _PROMPT_SENTINELS):
        findings.append("prompt-leak")

    for host in _URL_RE.findall(text):
        if not any(h in host.lower() for h in _ALLOWED_LINK_HOSTS):
            findings.append(f"unsafe-link:{host}")

    return findings


def filter_result(value: Any) -> tuple[Any, list[str], list[str]]:
    """Recursively drop forbidden keys from a tool result and scan string values.

    Returns ``(cleaned, dropped_keys, text_findings)``. Redacts rather than raising:
    a dropped key signals a bug to audit, but must never break the user's request."""
    dropped: list[str] = []
    findings: list[str] = []

    def walk(node: Any) -> Any:
        if isinstance(node, dict):
            out: dict[Any, Any] = {}
            for k, v in node.items():
                if isinstance(k, str) and k.lower() in FORBIDDEN_KEYS:
                    dropped.append(k)
                    continue
                out[k] = walk(v)
            return out
        if isinstance(node, (list, tuple)):
            return [walk(v) for v in node]
        if isinstance(node, str):
            findings.extend(scan_text(node))
        return node

    return walk(value), dropped, findings


class OutputValidationToolset(WrapperToolset[Any]):
    """Wraps the agent's toolset so every tool result is field-filtered and scanned
    before it reaches the model or the UI (P6). The strong, fully-enforced half of
    output validation — tool execution is server-side, so this can't be bypassed."""

    async def call_tool(self, name: str, tool_args: dict[str, Any], ctx: Any, tool: Any) -> Any:
        result = await self.wrapped.call_tool(name, tool_args, ctx, tool)
        cleaned, dropped, findings = filter_result(result)
        if dropped or findings:
            logger.warning(
                "output-validation tool=%s dropped=%s findings=%s",
                name,
                dropped or "[]",
                findings or "[]",
            )
            from .. import observability

            observability.count("voltti.output.dropped")
        return cleaned


def audit_final_text(text: str) -> list[str]:
    """Best-effort audit of the agent's completed free text (P6). Can't un-stream an
    SSE delta — this surfaces leaks for observability (Slice 6), not prevention."""
    findings = scan_text(text)
    if findings:
        logger.warning("output-validation final-text findings=%s", findings)
    return findings
