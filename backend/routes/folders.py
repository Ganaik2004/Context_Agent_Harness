from __future__ import annotations

import re
import time

from fastapi import APIRouter, HTTPException

from ..seed import new_id, random_folder_color
from ..store import FsStore

COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def create_folders_api(store: FsStore) -> APIRouter:
    router = APIRouter()

    def read_index():
        return store.read_json(store.folders_file, {"folders": []})

    def write_index(index):
        store.write_json(store.folders_file, index)

    @router.get("/")
    async def list_folders():
        return read_index()

    @router.post("/")
    async def create_folder(body: dict = None):
        body = body or {}
        requested = body.get("name")
        name = (
            str(requested).strip()[:100]
            if isinstance(requested, str) and requested.strip()
            else "New Folder"
        )
        color_raw = body.get("color")
        color = str(color_raw) if isinstance(color_raw, str) and COLOR_RE.match(color_raw) else random_folder_color()

        now = int(time.time() * 1000)
        folder = {"id": new_id(), "name": name, "color": color, "createdAt": now, "updatedAt": now}
        index = read_index()
        write_index({"folders": [*index["folders"], folder]})
        return folder

    @router.get("/{id}")
    async def get_folder(id: str):
        index = read_index()
        folder = next((f for f in index["folders"] if f["id"] == id), None)
        if not folder:
            raise HTTPException(404, "Folder not found")
        return folder

    @router.put("/{id}")
    async def update_folder(id: str, body: dict = None):
        body = body or {}
        index = read_index()
        existing = next((f for f in index["folders"] if f["id"] == id), None)
        if not existing:
            raise HTTPException(404, "Folder not found")

        requested = body.get("name")
        name = (
            str(requested).strip()[:100]
            if isinstance(requested, str) and requested.strip()
            else existing["name"]
        )
        color_raw = body.get("color")
        color = str(color_raw) if isinstance(color_raw, str) and COLOR_RE.match(color_raw) else existing["color"]

        now = int(time.time() * 1000)
        updated = {**existing, "name": name, "color": color, "updatedAt": now}
        write_index({"folders": [updated if f["id"] == id else f for f in index["folders"]]})
        return updated

    @router.delete("/{id}")
    async def delete_folder(id: str):
        index = read_index()
        existing = next((f for f in index["folders"] if f["id"] == id), None)
        if not existing:
            raise HTTPException(404, "Folder not found")
        write_index({"folders": [f for f in index["folders"] if f["id"] != id]})
        return {"ok": True}

    return router
