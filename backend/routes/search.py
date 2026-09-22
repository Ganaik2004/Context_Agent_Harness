from __future__ import annotations

from fastapi import APIRouter, Query

from ..lib.doctext import doc_to_text
from ..lib.search import make_snippet
from ..store import FsStore

MAX_RESULTS = 50


def create_search_api(store: FsStore) -> APIRouter:
    router = APIRouter()

    @router.get("/")
    async def search(q: str = Query("")):
        q = q.strip().lower()
        if not q:
            return {"results": []}

        index = store.read_json(store.index_file, {"notes": []})
        results = []
        for meta in index["notes"]:
            if len(results) >= MAX_RESULTS:
                break
            note = store.read_json(store.note_file(meta["id"]), None)
            if not note:
                continue
            text = doc_to_text(note.get("doc", {}))
            in_title = meta["title"].lower().find(q) >= 0
            at = text.lower().find(q)
            if not in_title and at < 0:
                continue
            snippet = make_snippet(text, at) if at >= 0 else make_snippet(text, 0, 60)
            results.append({"noteId": meta["id"], "title": meta["title"], "snippet": snippet})
        return {"results": results}

    return router
