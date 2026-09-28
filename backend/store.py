import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any, TypeVar

T = TypeVar("T")

NOTE_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$")
IMAGE_NAME_RE = re.compile(
    r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,80}\.(png|jpe?g|gif|webp|svg|bmp|avif)$", re.IGNORECASE
)
MAX_IMAGE_BYTES = 25 * 1024 * 1024
SESSION_ID_RE = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$")

class FsStore:
    def __init__(self, root: str | Path):
        self.root = Path(root)
        self.notes_dir = self.root / "notes"
        self.images_dir = self.root / "images"
        self.sessions_dir = self.root / "sessions"
        self.index_file = self.root / "notes.json"
        self.prefs_file = self.root / "prefs.json"
        self.chat_file = self.root / "chat.json"
        self.folders_file = self.root / "folders.json"
        self.sessions_index_file = self.root / "sessions.json"


    def init(self) -> None:
        self.notes_dir.mkdir(parents=True, exist_ok=True)
        self.images_dir.mkdir(parents=True, exist_ok=True)
        self.sessions_dir.mkdir(parents=True, exist_ok=True)

    def note_file(self, id: str) -> Path:
        return self.notes_dir / f"{id}.json"

    def read_json(self, file: str | Path, fallback: T) -> T:
        try:
            with open(file, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return fallback

    def write_json(self, file: str | Path, data: Any) -> None:
        path = Path(file)
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
                f.write("\n")
            os.replace(tmp, path)
        except:
            os.unlink(tmp)
            raise

    def write_image(self, name: str, data: bytes) -> None:
        (self.images_dir / name).write_bytes(data)

    def read_image(self, name: str) -> bytes | None:
        try:
            return (self.images_dir / name).read_bytes()
        except FileNotFoundError:
            return None
