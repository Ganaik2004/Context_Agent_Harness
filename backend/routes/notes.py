from __future__ import annotations

import re
import time

from fastapi import APIRouter, HTTPException
from pathlib import Path
from ..lib.doctext import as_note_doc
from ..seed import new_id
from ..store import NOTE_ID_RE, FsStore
import uuid
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def create_notes_api(store: FsStore) -> APIRouter:
    router = APIRouter()

    def read_index():
        return store.read_json(store.index_file, {"notes": []})

    def write_index(index):
        store.write_json(store.index_file, index)

    def read_note(id: str):
        if not NOTE_ID_RE.match(id):
            return None
        return store.read_json(store.note_file(id), None)

    @router.get("/")
    async def list_notes():
        return read_index()

    @router.post("/")
    async def create_note(body: dict = None):
        body = body or {}
        index = read_index()
        requested = body.get("title")
        title = (
            str(requested).strip()[:200]
            if isinstance(requested, str) and requested.strip()
            else f"Note {len(index['notes']) + 1}"
        )
        folder_id_raw = body.get("folderId")
        folder_id = str(folder_id_raw) if isinstance(folder_id_raw, str) and folder_id_raw else None
        color_raw = body.get("color")
        color = str(color_raw) if isinstance(color_raw, str) and COLOR_RE.match(color_raw) else None

        now = int(time.time() * 1000)
        note = {
            "id": new_id(),
            "title": title,
            "doc": {"type": "doc", "content": [{"type": "paragraph"}]},
            "folderId": folder_id,
            "color": color,
            "createdAt": now,
            "updatedAt": now,
        }
        store.write_json(store.note_file(note["id"]), note)
        write_index({
            "notes": [
                *index["notes"],
                {"id": note["id"], "title": title, "folderId": folder_id, "color": color, "createdAt": now, "updatedAt": now},
            ]
        })
        return note

    @router.get("/{id}")
    async def get_note(id: str):
        note = read_note(id)
        if not note:
            raise HTTPException(404, "Note not found")
        return note

    @router.put("/{id}")
    async def update_note(id: str, body: dict = None):
        body = body or {}
        existing = read_note(id)
        if not existing:
            raise HTTPException(404, "Note not found")

        doc = body.get("doc")
        if not isinstance(doc, dict) or doc.get("type") != "doc" or not isinstance(doc.get("content"), list):
            raise HTTPException(400, "Invalid note payload — expected { title, doc }")

        requested = body.get("title")
        title = (
            str(requested).strip()[:200]
            if isinstance(requested, str) and requested.strip()
            else existing["title"]
        )
        folder_id_raw = body.get("folderId")
        folder_id = str(folder_id_raw) if isinstance(folder_id_raw, str) and folder_id_raw else existing.get("folderId")
        color_raw = body.get("color")
        color = str(color_raw) if isinstance(color_raw, str) and COLOR_RE.match(color_raw) else existing.get("color")

        now = int(time.time() * 1000)
        store.write_json(store.note_file(id), {
            **existing,
            "title": title,
            "doc": doc,
            "folderId": folder_id,
            "color": color,
            "updatedAt": now,
        })
        index = read_index()
        write_index({
            "notes": [
                {**n, "title": title, "folderId": folder_id, "color": color, "updatedAt": now}
                if n["id"] == id else n
                for n in index["notes"]
            ]
        })
        return {"ok": True, "note": {"id": id, "title": title, "folderId": folder_id, "createdAt": existing["createdAt"], "updatedAt": now}}

    @router.delete("/{id}")
    async def delete_note(id: str):
        existing = read_note(id)
        if not existing:
            raise HTTPException(404, "Note not found")
        try:
            store.note_file(id).unlink()
        except FileNotFoundError:
            pass
        index = read_index()
        write_index({"notes": [n for n in index["notes"] if n["id"] != id]})
        return {"ok": True}

    def session_file(session_id: str) -> Path:
            return store.sessions_dir / f"{session_id}.json"
    
    def read_sessions_index() -> dict:
            return store.read_json(store.sessions_index_file, {"sessions": []})

    def write_sessions_index(index: dict) -> None:
            store.write_json(store.sessions_index_file, index)

    @router.get("/{note_id}/sessions")
    async def list_note_sessions(note_id: str):
        if not NOTE_ID_RE.match(note_id):
            raise HTTPException(400, "Invalid note id")
        note = read_note(note_id)
        if not note:
            raise HTTPException(404, "Note not found")
        index = read_sessions_index()
        sessions = [s for s in index["sessions"] if s["noteId"] == note_id]
        # Sort by updatedAt desc — frontend auto-selects the most recent
        sessions.sort(key=lambda s: s.get("updatedAt", 0), reverse=True)
        return {"sessions": sessions}

    @router.post("/{note_id}/sessions")
    async def create_note_session(note_id: str):
        if not NOTE_ID_RE.match(note_id):
            raise HTTPException(400, "Invalid note id")
        note = read_note(note_id)
        if not note:
            raise HTTPException(404, "Note not found")

        now = int(time.time() * 1000)
        session_id = str(uuid.uuid4())
        session = {
            "id": session_id,
            "noteId": note_id,
            "title": "New chat",
            "createdAt": now,
            "updatedAt": now,
            "messages": [],
        }
        store.write_json(session_file(session_id), session)

        index = read_sessions_index()
        index["sessions"].append({
            "id": session_id,
            "noteId": note_id,
            "title": "New chat",
            "createdAt": now,
            "updatedAt": now,
        })
        write_sessions_index(index)

        return session

    

    

    


    

    return router
