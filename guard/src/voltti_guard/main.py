"""Input-safety service (P3/P7): HTTP wrapper around the Prompt Guard classifier.

A separate service on purpose — the heavy ML deps (torch/transformers) stay out of
the agent backend, and this can be upgraded/scaled/disabled independently. The
agent backend calls POST /classify before running the model; a flagged message is
treated as data and never reaches the agent.

Run (dev):  uv run uvicorn voltti_guard.main:app --port 8001
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import logfire
from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from .classify import Classifier
from .config import MAX_CHARS, MODEL_ID, THRESHOLD


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the model once at startup and warm it (the first inference pays JIT /
    # allocation cost — don't make a real request pay it).
    clf = Classifier(MODEL_ID)
    clf.score("warmup")
    app.state.clf = clf
    yield


app = FastAPI(title="Voltti guard", lifespan=lifespan)

# Observability (P7): trace /classify. No external export unless LOGFIRE_TOKEN is set.
logfire.configure(service_name="voltti-guard", send_to_logfire="if-token-present", console=False)
logfire.instrument_fastapi(app, capture_headers=False)


class ClassifyIn(BaseModel):
    text: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL_ID}


@app.post("/classify")
async def classify(req: ClassifyIn) -> dict[str, object]:
    text = (req.text or "")[:MAX_CHARS]
    if not text.strip():
        return {"label": "benign", "score": 0.0, "blocked": False, "windows": 0, "model": MODEL_ID}
    # Inference is sync + CPU-bound — offload so it can't block the event loop.
    result = await run_in_threadpool(app.state.clf.score, text)
    blocked = result["score"] >= THRESHOLD
    return {
        "label": "malicious" if blocked else "benign",
        "score": result["score"],
        "blocked": blocked,
        "windows": result["windows"],
        "model": MODEL_ID,
    }
