import os
from pathlib import Path


def default_data_dir() -> Path:
    if os.environ.get("AI_NOTE_HOME"):
        return Path(os.environ["AI_NOTE_HOME"]).resolve()
    return Path.home() / ".ai_note"


def default_dist_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "dist"


DEFAULT_PORT = 4311
