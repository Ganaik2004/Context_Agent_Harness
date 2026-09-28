from __future__ import annotations

import json
import time
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..llm import stream_sse, to_llm_messages
from ..store import FsStore, SESSION_ID_RE




def now_ms() -> int:
    return int(time.time() * 1000)

def new_msg_id() -> str:
    return str(uuid.uuid4())

def create_sessions_api(store: FsStore) -> APIRouter:
    router = APIRouter()

    def session_file(session_id: str):
            return store.sessions_dir / f"{session_id}.json"

    def load_session(session_id: str) -> dict | None:
            if not SESSION_ID_RE.match(session_id):
                return None
            return store.read_json(session_file(session_id), None)

    def save_session(session: dict) -> None:
            store.write_json(session_file(session["id"]), session)

    def update_index_entry(session_id: str, title: str, updated_at: int) -> None:
            index = store.read_json(store.sessions_index_file, {"sessions": []})
            for entry in index["sessions"]:
                if entry["id"] == session_id:
                    entry["title"] = title
                    entry["updatedAt"] = updated_at
                    break
            store.write_json(store.sessions_index_file, index)

    @router.get("/{session_id}")
    async def get_session(session_id: str):
        session = load_session(session_id)
        if not session:
            raise HTTPException(404, "Session not found")
        return session

    @router.delete("/{session_id}")
    async def delete_session(session_id: str):
        session = load_session(session_id)
        if not session:
            raise HTTPException(404, "Session not found")
        try:
            session_file(session_id).unlink()
        except FileNotFoundError:
            pass
        index = store.read_json(store.sessions_index_file, {"sessions": []})
        index["sessions"] = [s for s in index["sessions"] if s["id"] != session_id]
        store.write_json(store.sessions_index_file, index)
        return {"ok": True}
    
    @router.post("/{session_id}/messages")
    async def post_message(session_id: str, body: dict = None):
        body = body or {}

        # 1. Validate session
        session = load_session(session_id)
        if not session:
            raise HTTPException(404, "Session not found")

        # 2. Parse request
        model = body.get("model", "").strip()
        message = body.get("message") or {}
        text = message.get("text", "")
        content = message.get("content", [])

        if not model:
            raise HTTPException(400, "model is required")
        if not content:
            raise HTTPException(400, "message.content is required")

        # 3. Read AI config from prefs
        prefs = store.read_json(store.prefs_file, {})
        ai = prefs.get("ai", {})
        provider = ai.get("provider", "openrouter")
        api_key = ai.get("apiKey") or None

        # 4. Persist user message
        user_msg = {
            "id": new_msg_id(),
            "role": "user",
            "text": text,
            "content": content,
            "createdAt": now_ms(),
        }
        session["messages"].append(user_msg)

        # Auto-generate title from first user message
        if len(session["messages"]) == 1 and text.strip():
            session["title"] = text.strip()[:60]

        session["updatedAt"] = now_ms()
        save_session(session)

        # 5. Build full conversation for the provider
        llm_messages = to_llm_messages(session["messages"])

        # 6. Stream response
        async def generate():
            accumulated = ""
            try:
                async for line in stream_sse(llm_messages, model, provider, api_key):
                    if '"delta"' in line:
                        try:
                            data = json.loads(line.removeprefix("data: ").strip())
                            if data.get("type") == "delta":
                                accumulated += data.get("content", "")
                        except json.JSONDecodeError:
                            pass
                    yield line
            except Exception as exc:
                error_payload = {"type": "error", "message": str(exc)}
                yield f"data: {json.dumps(error_payload)}\n\n"

            # 7. Persist assistant message after stream
            session["messages"].append({
                "id": new_msg_id(),
                "role": "assistant",
                "content": accumulated,
                "createdAt": now_ms(),
            })
            session["updatedAt"] = now_ms()
            save_session(session)
            update_index_entry(session_id, session["title"], session["updatedAt"])

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    return router



























