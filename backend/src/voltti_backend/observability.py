"""Observability & audit (P7) — if you can't observe the agent, you can't safely
operate it.

Logfire (OpenTelemetry) gives three things for little code:
- **Auto-instrumentation** — every HTTP request, every agent run (with a child span
  per tool call + token usage), and the outbound guard call become traces.
- **Audit surfacing** — the security layers already log their decisions to
  ``voltti.*`` stdlib loggers (tool-gateway, guard, output-validation); we route
  those into Logfire so they're queryable, not buried in uvicorn's stdout.
- **Metrics** — counters for the §19 security signals (guard blocks, unauthorized
  tool attempts, throttles, output-validation drops, refusals).

**P6 discipline:** ``include_content=False`` keeps raw prompts/responses out of
telemetry, and the agent never receives PII to begin with — so traces carry shape,
tool names, token counts, and a (non-PII, mock) identity handle, never chat text or
personal data. **Nothing leaves the process unless ``LOGFIRE_TOKEN`` is set**
(``send_to_logfire="if-token-present"``); tokenless dev stays local.
"""

from __future__ import annotations

import logging

import logfire

_configured = False
_counters: dict[str, object] = {}


def configure(app) -> None:
    """Configure Logfire once per process and instrument the app. Idempotent."""
    global _configured
    if _configured:
        return
    _configured = True

    logfire.configure(
        service_name="voltti-backend",
        # No external export unless a token is present — tokenless dev sends nowhere.
        send_to_logfire="if-token-present",
        console=False,
    )
    logfire.instrument_fastapi(app, capture_headers=False)
    logfire.instrument_httpx()
    # Structure, tool names, token usage — but NOT raw prompt/response content (P6).
    logfire.instrument_pydantic_ai(include_content=False)

    # Surface the existing security audit loggers (voltti.toolgateway / .guard /
    # .outputvalidation …) as structured Logfire logs — closes the "audit logger
    # not surfaced by uvicorn" gap. Children propagate to this parent.
    voltti_logger = logging.getLogger("voltti")
    voltti_logger.addHandler(logfire.LogfireLoggingHandler())
    voltti_logger.setLevel(logging.INFO)


def count(name: str) -> None:
    """Increment a §19 security metric counter. Defensive — observability must never
    affect the request."""
    try:
        counter = _counters.get(name)
        if counter is None:
            counter = _counters[name] = logfire.metric_counter(name)
        counter.add(1)
    except Exception:
        pass
