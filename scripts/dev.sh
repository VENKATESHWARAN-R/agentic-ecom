#!/usr/bin/env bash
# Run the Voltti stack for development:
#   - agent backend (FastAPI + Pydantic AI) on :8000, with reload
#   - Next.js storefront on :3000
# Ctrl-C stops both.
set -euo pipefail
cd "$(dirname "$0")/.."

(cd backend && uv run uvicorn voltti_backend.main:app --reload --port 8000) &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null' EXIT

npm run dev
