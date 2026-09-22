from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..store import FsStore


def create_prefs_api(store: FsStore) -> APIRouter:
    router = APIRouter()

    @router.get("/")
    async def get_prefs():
        return store.read_json(store.prefs_file, {})

    @router.put("/")
    async def put_prefs(body: dict = None):
        if not isinstance(body, dict):
            raise HTTPException(400, "Invalid prefs payload")
        current = store.read_json(store.prefs_file, {})
        merged = {**current, **body}
        store.write_json(store.prefs_file, merged)
        return merged

    return router
