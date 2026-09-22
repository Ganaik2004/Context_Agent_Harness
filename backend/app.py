from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request

from .config import default_data_dir, default_dist_dir
from .routes.chat import create_chat_api
from .routes.folders import create_folders_api
from .routes.images import create_images_api
from .routes.notes import create_notes_api
from .routes.prefs import create_prefs_api
from .routes.search import create_search_api
from .seed import seed_if_empty
from .static import create_static_handler
from .store import FsStore


def create_app(data_dir: str | Path | None = None, dist_dir: str | Path | None = None) -> FastAPI:
    data_dir = Path(data_dir) if data_dir else default_data_dir()
    dist_dir = Path(dist_dir) if dist_dir else default_dist_dir()

    store = FsStore(data_dir)
    store.init()
    seed_if_empty(store)

    app = FastAPI()

    @app.get("/api/health")
    async def health():
        return {"ok": True}

    app.include_router(create_notes_api(store), prefix="/api/notes")
    app.include_router(create_folders_api(store), prefix="/api/folders")
    app.include_router(create_prefs_api(store), prefix="/api/prefs")
    app.include_router(create_chat_api(store), prefix="/api/chat")
    app.include_router(create_images_api(store), prefix="/api/images")
    app.include_router(create_search_api(store), prefix="/api/search")

    if not dist_dir.exists():
        print(f"[ai-notepad] frontend bundle not found at {dist_dir} — run `npm run build`")

    static_handler = create_static_handler(dist_dir)

    @app.get("/{full_path:path}")
    async def serve_static(full_path: str, request: Request):
        return await static_handler(request)

    return app
