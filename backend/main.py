from __future__ import annotations

import os

import uvicorn

from .app import create_app
from .config import DEFAULT_PORT


def main():
    port = int(os.environ.get("PORT", DEFAULT_PORT))
    app = create_app()
    uvicorn.run(app, host="127.0.0.1", port=port)


if __name__ == "__main__":
    main()
