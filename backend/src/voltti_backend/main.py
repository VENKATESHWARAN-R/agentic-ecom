"""FastAPI entrypoint: REST API + the AG-UI agent endpoint.

Run (dev):  uv run uvicorn voltti_backend.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic_ai import UsageLimits
from pydantic_ai.ui.ag_ui import AGUIAdapter

from .agent.agent import AgentDeps, agent
from .api.routes import router
from .config import FRONTEND_ORIGIN
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
    if not agui_limiter.allow(identity or "anon"):
        return Response(
            content='{"error":"Too many requests — slow down a moment."}',
            status_code=429,
            media_type="application/json",
        )
    body = await request.json()
    deps = AgentDeps(context=body.get("context") or [], identity=identity)
    return await AGUIAdapter.dispatch_request(
        request,
        agent=agent,
        deps=deps,
        # Per-run caps (P7): bound tool calls and total tokens so one run can't
        # run away (denial-of-wallet). The limiter above bounds the request rate.
        usage_limits=UsageLimits(request_limit=10, tool_calls_limit=10, total_tokens_limit=200_000),
    )
