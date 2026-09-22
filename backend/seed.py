from __future__ import annotations

import uuid
from pathlib import Path

from .store import FsStore


FOLDER_COLORS = ["#8b7cf6", "#34d399", "#f5b83d", "#ec6a9f", "#60a5fa", "#f87171"]


def random_folder_color() -> str:
    import random
    return random.choice(FOLDER_COLORS)


def new_id() -> str:
    return str(uuid.uuid4())


def _sample_svg(w: int, h: int, label: str, c1: str, c2: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">'
        f'<rect width="{w}" height="{h}" fill="#232a36"/>'
        f'<rect x="24" y="24" width="{w - 48}" height="{h - 48}" rx="16" fill="#2d3547"/>'
        f'<circle cx="{round(w * 0.28)}" cy="{round(h * 0.42)}" r="{round(h * 0.14)}" fill="{c1}" opacity=".85"/>'
        f'<path d="M40 {h - 60} L{round(w * 0.35)} {round(h * 0.45)} L{round(w * 0.55)} {round(h * 0.68)} L{round(w * 0.75)} {round(h * 0.38)} L{w - 40} {h - 60} Z" fill="{c2}"/>'
        f'<text x="{w / 2}" y="52" fill="#8b93a7" font-family="sans-serif" font-size="22" text-anchor="middle">{label}</text>'
        f"</svg>"
    )


def _para(text: str) -> dict:
    return {
        "type": "paragraph",
        "content": [{"type": "text", "text": text}] if text else [],
    }


def _image(src: str, width: int, nat_w: int, nat_h: int) -> dict:
    return {
        "type": "imageBlock",
        "attrs": {"src": src, "width": width, "left": 0, "natW": nat_w, "natH": nat_h},
    }


def welcome_doc() -> dict:
    return {
        "type": "doc",
        "content": [
            _para("Note 1 — the block editor"),
            _para(
                "This is a text block. Press Enter to create a new block below; Backspace on an empty block removes it. The document is just an ordered list of blocks — order is the layout."
            ),
            _image("/api/images/welcome-4-3.svg", 560, 800, 600),
            _para(
                "Images are blocks in the flow. Hover one and drag the purple handle on its right edge: width changes, height follows the aspect ratio at the same time, and the top-left corner stays pinned — position is written once at load, resize only ever touches width and height."
            ),
            _image("/api/images/welcome-16-9.svg", 420, 960, 540),
            _para(""),
        ],
    }


def _write_sample_images(images_dir: Path) -> None:
    files = [
        ("welcome-4-3.svg", _sample_svg(800, 600, "Sample image · 4:3", "#7c6ff0", "#4c5468")),
        ("welcome-16-9.svg", _sample_svg(960, 540, "Sample image · 16:9", "#ec6a9f", "#3d4557")),
    ]
    for name, svg in files:
        file = images_dir / name
        if not file.exists():
            file.write_text(svg, encoding="utf-8")


def seed_if_empty(store: FsStore) -> None:
    index = store.read_json(store.index_file, {"notes": []})
    folder_index = store.read_json(store.folders_file, {"folders": []})

    if index["notes"] and folder_index["folders"]:
        return

    import time
    now = int(time.time() * 1000)

    if not folder_index["folders"]:
        folder = {
            "id": new_id(),
            "name": "Notes",
            "color": random_folder_color(),
            "createdAt": now,
            "updatedAt": now,
        }
        store.write_json(store.folders_file, {"folders": [folder]})
        folder_index["folders"].append(folder)

    if not index["notes"]:
        _write_sample_images(store.images_dir)
        default_folder = folder_index["folders"][0]
        if not default_folder:
            return
        meta = {
            "id": new_id(),
            "title": "Note 1",
            "folderId": default_folder["id"],
            "createdAt": now,
            "updatedAt": now,
        }
        store.write_json(store.note_file(meta["id"]), {**meta, "doc": welcome_doc()})
        store.write_json(store.index_file, {"notes": [meta]})
