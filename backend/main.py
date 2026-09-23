import sys
from pathlib import Path

# Reuse the same FastAPI app that runs on Vercel (api/index.py).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.index import app  # noqa: E402

__all__ = ["app"]

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8001)
