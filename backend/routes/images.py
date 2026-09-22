from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Query, UploadFile
from fastapi.responses import Response

from ..seed import new_id
from ..store import IMAGE_NAME_RE, MAX_IMAGE_BYTES, FsStore

MIME_TO_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/avif": "avif",
}

EXT_TO_TYPE = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "svg": "image/svg+xml",
    "bmp": "image/bmp",
    "avif": "image/avif",
}


def create_images_api(store: FsStore) -> APIRouter:
    router = APIRouter()

    @router.post("/")
    async def upload_image(
        file: UploadFile,
        width: int = Query(0, ge=0, le=20000),
        height: int = Query(0, ge=0, le=20000),
    ):
        content = await file.read()
        if not content:
            raise HTTPException(400, 'No image file provided (multipart field "file")')

        content_type = file.content_type or ""
        ext = MIME_TO_EXT.get(content_type)
        if not ext:
            filename = file.filename or ""
            from_name = filename.split(".")[-1] if "." in filename else ""
            ext = re.sub(r"[^a-z0-9]", "", from_name.lower())
        if not ext or ext not in EXT_TO_TYPE:
            raise HTTPException(400, f"Unsupported image type: {content_type or file.filename}")

        if len(content) > MAX_IMAGE_BYTES:
            raise HTTPException(400, "Image too large (max 25 MB)")

        name = f"{new_id()}.{ext}"
        store.write_image(name, content)
        return {"url": f"/api/images/{name}", "width": width, "height": height}

    @router.get("/{name}")
    async def get_image(name: str):
        if not IMAGE_NAME_RE.match(name):
            raise HTTPException(400, "Invalid image name")
        data = store.read_image(name)
        if data is None:
            raise HTTPException(404, "Image not found")
        ext = name.split(".")[-1]
        return Response(
            data,
            media_type=EXT_TO_TYPE.get(ext, "application/octet-stream"),
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    return router
