from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..store import FsStore

MAX_HISTORY = 400


def is_message(value) -> bool:
    if not isinstance(value, dict):
        return False
    return value.get("role") in ("user", "assistant", "system") and isinstance(value.get("content"), str)


def create_chat_api(store: FsStore) -> APIRouter:
    router = APIRouter()

    @router.get("/")
    async def get_chat():
        return store.read_json(store.chat_file, {"messages": []})

    @router.put("/")
    async def put_chat(body: dict = None):
        body = body or {}
        messages = body.get("messages")
        if not isinstance(messages, list):
            raise HTTPException(400, "Invalid chat history — expected { messages: [] }")
        cleaned = [m for m in messages if is_message(m)][-MAX_HISTORY:]
        store.write_json(store.chat_file, {"messages": cleaned})
        return {"ok": True, "kept": len(cleaned)}

    return router
