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


@app.post("/agui")
async def run_agent(request: Request) -> Response:
    """AG-UI endpoint the CopilotKit runtime's HttpAgent talks to.

    The AG-UI adapter ignores RunAgentInput.context, so we extract it here and
    hand it to the agent via deps — the agent's dynamic instructions inject it
    into the prompt (this is how useAgentContext data reaches the model).
    Starlette caches the request body, so reading it twice is fine.
    """
    body = await request.json()
    deps = AgentDeps(context=body.get("context") or [])
    return await AGUIAdapter.dispatch_request(
        request,
        agent=agent,
        deps=deps,
        usage_limits=UsageLimits(request_limit=10),  # mirrors the old maxSteps: 10
    )
