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


def _flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


# Input-safety guard (P3/P7). The chat gateway screens each user message against
# the standalone guard service before running the agent. The guard is
# non-mandatory by design: GUARD_FAIL_OPEN (default true) means a guard outage
# allows traffic through (logged) rather than taking chat down.
GUARD_ENABLED = _flag("GUARD_ENABLED", True)
GUARD_URL = os.getenv("GUARD_URL") or "http://localhost:8001"
GUARD_FAIL_OPEN = _flag("GUARD_FAIL_OPEN", True)
GUARD_TIMEOUT_SECONDS = float(os.getenv("GUARD_TIMEOUT_SECONDS", "2.0"))
