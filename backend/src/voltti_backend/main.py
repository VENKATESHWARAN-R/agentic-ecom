"""FastAPI entrypoint: REST API + the AG-UI agent endpoint.

Run (dev):  uv run uvicorn voltti_backend.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from uuid import uuid4

from ag_ui.core import (
    RunFinishedEvent,
    RunStartedEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    TextMessageStartEvent,
)
from ag_ui.encoder import EventEncoder
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic_ai import UsageLimits
from pydantic_ai.ui.ag_ui import AGUIAdapter

from . import guard_client
from .abuse import POINTS_GUARD_BLOCK, abuse
from .agent.agent import AgentDeps, agent
from .api.routes import router
from .config import FRONTEND_ORIGIN, GUARD_ENABLED
from .db import init_db
from .ratelimit import RateLimiter
from .security import verify_assertion


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Voltti backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


def _identity_from(request: Request) -> str | None:
    """Identity for the agent run, from the BFF's signed assertion (P4). The BFF
    is the only minter, so a missing or invalid header → guest (None); the
    identity-scoped tools then return a 'sign in' result rather than data."""
    auth = request.headers.get("authorization")
    if not auth:
        return None
    scheme, _, token = auth.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    try:
        return verify_assertion(token)
    except Exception:
        return None


# Chat-gateway rate limit (P7): per-identity sliding window. Anonymous traffic is
# rate-limited by real client IP at the edge (nginx); the backend only sees the
# BFF, so it limits by the verified identity (guests share one coarse bucket).
agui_limiter = RateLimiter(limit=30, window_seconds=60.0)

_encoder = EventEncoder()

# Canned refusals (P3). A flagged message is answered structurally — the model is
# never run — so the user still gets a chat reply, not a dead-end error.
_REFUSAL_GUARD = "I can't help with that request. Let me know if there's something about our products I can help with instead."
_REFUSAL_ABUSE = "I've paused this conversation for a little while after several requests I couldn't process. Please try again shortly."


def _latest_user_message(body: dict) -> str | None:
    """The text of the last user-role message in the AG-UI RunAgentInput body."""
    for msg in reversed(body.get("messages") or []):
        if isinstance(msg, dict) and msg.get("role") == "user":
            content = msg.get("content")
            return content if isinstance(content, str) else None
    return None


def _refusal_stream(thread_id: str, run_id: str, message: str) -> StreamingResponse:
    """A minimal, valid AG-UI SSE stream carrying a single assistant message —
    so a screened-out message renders as a normal chat reply without running the
    model. Mirrors the event sequence the adapter would emit for a text turn."""
    message_id = uuid4().hex

    def events():
        for event in (
            RunStartedEvent(thread_id=thread_id, run_id=run_id),
            TextMessageStartEvent(message_id=message_id, role="assistant"),
            TextMessageContentEvent(message_id=message_id, delta=message),
            TextMessageEndEvent(message_id=message_id),
            RunFinishedEvent(thread_id=thread_id, run_id=run_id),
        ):
            yield _encoder.encode(event)

    return StreamingResponse(events(), media_type=_encoder.get_content_type())


@app.post("/agui")
async def run_agent(request: Request) -> Response:
    """AG-UI endpoint the CopilotKit runtime's HttpAgent talks to.

    The AG-UI adapter ignores RunAgentInput.context, so we extract it here and
    hand it to the agent via deps — the agent's dynamic instructions inject it
    into the prompt (this is how useAgentContext data reaches the model). The
    identity comes from the BFF assertion header, never the body (P4).
    Starlette caches the request body, so reading it twice is fine.
    """
    identity = _identity_from(request)
    key = identity or "anon"
    if not agui_limiter.allow(key):
        return Response(
            content='{"error":"Too many requests — slow down a moment."}',
            status_code=429,
            media_type="application/json",
        )
    body = await request.json()
    thread_id = body.get("threadId") or uuid4().hex
    run_id = body.get("runId") or uuid4().hex

    # Input safety (P3). Repeat offenders are paused outright; otherwise screen the
    # latest user message and, if flagged, refuse without ever running the agent —
    # a malicious message is data, not an instruction.
    if abuse.level(key) == "blocked":
        return _refusal_stream(thread_id, run_id, _REFUSAL_ABUSE)
    if GUARD_ENABLED:
        user_text = _latest_user_message(body)
        if user_text:
            verdict = await guard_client.screen(user_text)
            if verdict["blocked"]:
                abuse.record(key, POINTS_GUARD_BLOCK)
                return _refusal_stream(thread_id, run_id, _REFUSAL_GUARD)

    deps = AgentDeps(context=body.get("context") or [], identity=identity)
    return await AGUIAdapter.dispatch_request(
        request,
        agent=agent,
        deps=deps,
        # Per-run caps (P7): bound tool calls and total tokens so one run can't
        # run away (denial-of-wallet). The limiter above bounds the request rate.
        usage_limits=UsageLimits(request_limit=10, tool_calls_limit=10, total_tokens_limit=200_000),
    )
