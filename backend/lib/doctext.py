from __future__ import annotations

from typing import Any, Callable


LEAF_TYPES = {"text", "hardBreak", "horizontalRule", "image", "imageBlock"}


def node_size(node: dict[str, Any]) -> int:
    if node.get("type") == "text":
        return len(node.get("text", ""))
    content = node.get("content")
    if not content:
        return 1 if node.get("type") in LEAF_TYPES else 2
    return 2 + sum(node_size(child) for child in content)


def each_text_node(
    doc: dict[str, Any], fn: Callable[[str, int], None]
) -> None:
    def walk(nodes: list[dict[str, Any]], base: int) -> None:
        pos = base
        for node in nodes:
            if node.get("type") == "text":
                fn(node.get("text", ""), pos)
            elif "content" in node:
                walk(node["content"], pos + 1)
            pos += node_size(node)

    walk(doc.get("content", []), 0)


def collect_text(node: dict[str, Any], fn: Callable[[str], None]) -> None:
    if node.get("type") == "text":
        fn(node.get("text", ""))
        return
    for child in node.get("content", []):
        collect_text(child, fn)


def doc_to_text(doc: dict[str, Any]) -> str:
    lines: list[str] = []
    for block in doc.get("content", []):
        line = ""
        collect_text(block, lambda text: line.__iadd__(text))
        lines.append(line)
    return "\n".join(lines)


def as_note_doc(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        if value.get("type") == "doc" and isinstance(value.get("content"), list):
            return {"type": "doc", "content": value["content"]}
    return {"type": "doc", "content": [{"type": "paragraph"}]}
