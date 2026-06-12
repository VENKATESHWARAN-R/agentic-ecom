"""Environment configuration. Loads backend/.env first, then the repo-root .env
(so the existing ANTHROPIC_API_KEY / COPILOTKIT_MODEL keep working)."""

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
REPO_ROOT = BACKEND_DIR.parent
DATA_DIR = REPO_ROOT / "data"

load_dotenv(BACKEND_DIR / ".env")
load_dotenv(REPO_ROOT / ".env")

# Same provider:model convention as before (e.g. "anthropic:claude-sonnet-4-6").
AGENT_MODEL = os.getenv("AGENT_MODEL") or os.getenv("COPILOTKIT_MODEL") or "anthropic:claude-sonnet-4-6"

DB_PATH = Path(os.getenv("VOLTTI_DB_PATH") or BACKEND_DIR / "voltti.db")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

# Shared secret for the BFF→backend identity assertion (P4). The Next.js BFF
# signs a short-lived JWT with this; the backend verifies it. Mock credential,
# real enforcement — set a strong value via env in any non-dev environment.
INTERNAL_JWT_SECRET = os.getenv("INTERNAL_JWT_SECRET") or "dev-only-insecure-internal-secret-change-me"
