from __future__ import annotations

from typing import Any

from .doctext import each_text_node


def find_text_range(doc: dict[str, Any], query: str) -> dict[str, int] | None:
    if not query:
        return None
    needle = query.lower()

    chars = ""
    positions: list[int] = []
    each_text_node(doc, lambda text, pos: [
        (chars.__iadd__(text[i]), positions.append(pos + i))
        for i in range(len(text))
    ])

    index = chars.lower().find(needle)
    if index < 0:
        return None
    return {
        "from": positions[index],
        "to": positions[index + len(needle) - 1] + 1,
    }


def make_snippet(text: str, index: int, radius: int = 36) -> str:
    if not text:
        return ""
    start = max(0, min(index, len(text) - 1) - radius)
    end = min(len(text), max(index, 1) + radius)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    middle = " ".join(text[start:end].split())
    return f"{prefix}{middle}{suffix}"
