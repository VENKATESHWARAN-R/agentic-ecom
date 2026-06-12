import os
import tempfile
from pathlib import Path

# Point the app at a throwaway DB before any voltti_backend import.
os.environ["VOLTTI_DB_PATH"] = str(Path(tempfile.mkdtemp()) / "test.db")
