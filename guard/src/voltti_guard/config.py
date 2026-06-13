"""Configuration for the input-safety (Prompt Guard) service.

Loads guard/.env first, then the repo-root .env — so the shared HF_TOKEN (needed
to download the gated Prompt Guard weights) is picked up without duplicating it.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

GUARD_DIR = Path(__file__).resolve().parent.parent.parent
REPO_ROOT = GUARD_DIR.parent

load_dotenv(GUARD_DIR / ".env")
load_dotenv(REPO_ROOT / ".env")  # picks up HF_TOKEN (gated model auth)

# The classifier model. Default is Meta's Llama Prompt Guard 2 (22M) — gated, so
# it needs an approved license + HF_TOKEN. Until that clears, point this at an
# ungated stand-in (e.g. protectai/deberta-v3-base-prompt-injection-v2) so the
# service runs; the pipeline is identical (DeBERTa seq-classifier, malicious = 1).
MODEL_ID = os.getenv("GUARD_MODEL_ID", "meta-llama/Llama-Prompt-Guard-2-22M")

# Decision threshold for the malicious-class probability (0..1). Scores cluster at
# the extremes, so 0.5 is a reasonable default; tune per model.
THRESHOLD = float(os.getenv("GUARD_THRESHOLD", "0.5"))

# Hard cap on the characters of a single message we screen (longer is truncated
# before windowing — bounds work and blocks oversized-input abuse).
MAX_CHARS = int(os.getenv("GUARD_MAX_CHARS", "8000"))
