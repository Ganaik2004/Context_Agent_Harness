from __future__ import annotations

from pathlib import Path

from fastapi import Request
from fastapi.responses import FileResponse, Response

MIME = {
    "html": "text/html; charset=utf-8",
    "js": "text/javascript; charset=utf-8",
    "mjs": "text/javascript; charset=utf-8",
    "css": "text/css; charset=utf-8",
    "json": "application/json; charset=utf-8",
    "svg": "image/svg+xml",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "avif": "image/avif",
    "ico": "image/x-icon",
    "txt": "text/plain; charset=utf-8",
    "map": "application/json",
    "woff": "font/woff",
    "woff2": "font/woff2",
    "wasm": "application/wasm",
}


def create_static_handler(dist_dir: str | Path):
    dist = Path(dist_dir)
    index_file = dist / "index.html"

    async def handler(request: Request) -> Response:
        pathname = request.url.path
        segments = [s for s in pathname.split("/") if s and s not in (".", "..")]
        file = dist.joinpath(*segments) if segments else index_file

        try:
            if not file.resolve().is_relative_to(dist.resolve()):
                return Response("Not found", status_code=404)
        except (OSError, ValueError):
            return Response("Not found", status_code=404)

        if file.is_dir():
            file = file / "index.html"

        if not file.exists():
            file = index_file

        try:
            body = file.read_bytes()
        except (OSError, FileNotFoundError):
            return Response("Not found", status_code=404)

        ext = file.suffix.lstrip(".").lower()
        content_type = MIME.get(ext, "application/octet-stream")
        immutable = pathname.startswith("/assets/")
        headers = {
            "Cache-Control": "public, max-age=31536000, immutable" if immutable else "no-cache",
        }
        return Response(body, media_type=content_type, headers=headers)

    return handler
