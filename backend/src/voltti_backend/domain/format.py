"""Display formatting, ported from src/lib/services.ts (formatPrice/formatDate).

Output must match the TypeScript Intl formatting byte-for-byte: these strings
are embedded in tool results (compat attributions, build tradeoffs) and are
asserted by the parity test suite.
"""

import math
from datetime import datetime, timezone

NBSP = " "

_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def format_price(value: float) -> str:
    """fi-FI EUR with 0 fraction digits: '1 234 €' (NBSP separators, halfExpand rounding)."""
    rounded = math.floor(value + 0.5)  # Intl's default "halfExpand" for non-negative values
    grouped = f"{rounded:,}".replace(",", NBSP)
    return f"{grouped}{NBSP}€"


def format_date(iso: str) -> str:
    """en-GB '27 May 2026' in the server's local timezone (matches JS Date semantics)."""
    parsed = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    local = parsed.astimezone()
    return f"{local.day} {_MONTHS[local.month - 1]} {local.year}"


def iso_from_ms(ms: int) -> str:
    """JS Date.toISOString() equivalent: '2026-06-12T10:30:00.000Z'."""
    dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S") + f".{ms % 1000:03d}Z"


def parse_iso_ms(iso: str) -> int:
    """JS Date.parse() equivalent for the ISO strings used in this app."""
    parsed = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp() * 1000)
