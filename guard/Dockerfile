# Input-safety (Prompt Guard) service. Build from the guard/ directory:
#   docker build -t voltti-guard --secret id=hf_token,env=HF_TOKEN guard/
# (compose passes the HF_TOKEN secret automatically — see docker-compose.yml).
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app/guard

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY . ./
RUN uv sync --frozen --no-dev

# Bake the (gated) model weights into the image at build time using HF_TOKEN as a
# build secret — never an ENV/layer, so the token isn't baked in. At runtime the
# container then runs fully offline (HF_HUB_OFFLINE=1): no gated download, no auth.
ARG GUARD_MODEL_ID=meta-llama/Llama-Prompt-Guard-2-22M
RUN --mount=type=secret,id=hf_token \
    HF_TOKEN="$(cat /run/secrets/hf_token 2>/dev/null)" GUARD_MODEL_ID="$GUARD_MODEL_ID" \
    uv run --no-dev python -c "import os; from transformers import AutoModelForSequenceClassification, AutoTokenizer; m=os.environ['GUARD_MODEL_ID']; AutoTokenizer.from_pretrained(m); AutoModelForSequenceClassification.from_pretrained(m)"

ENV HF_HUB_OFFLINE=1
ENV GUARD_MODEL_ID=meta-llama/Llama-Prompt-Guard-2-22M

EXPOSE 8001
CMD ["uv", "run", "--no-dev", "uvicorn", "voltti_guard.main:app", "--host", "0.0.0.0", "--port", "8001"]
