# Build from the REPO ROOT so the shared seed data is in context:
#   docker build -f backend/Dockerfile .
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app/backend

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY backend/ ./
COPY data/ /app/data/
RUN uv sync --frozen --no-dev

EXPOSE 8000
CMD ["uv", "run", "--no-dev", "uvicorn", "voltti_backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
