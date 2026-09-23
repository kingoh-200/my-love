import json
import os
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

# Writable on your machine and on `vercel dev`; read-only on Vercel prod,
# where the Supabase table is used instead.
FALLBACK_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "answers.json")

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:5174",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Answer(BaseModel):
    accepted: bool
    reason: str = ""
    at: str = ""


# ---------------------------------------------------------------------------
# Storage: Supabase (Postgres) when configured, local JSON file otherwise
# ---------------------------------------------------------------------------
def _supabase_insert(entry: dict) -> dict:
    import urllib.request

    url = f"{SUPABASE_URL}/rest/v1/answers"
    data = json.dumps(entry).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        rows = json.loads(resp.read().decode("utf-8"))
    return rows[0] if rows else entry


def _supabase_select() -> list:
    import urllib.request

    url = f"{SUPABASE_URL}/rest/v1/answers?select=*&order=at.asc"
    req = urllib.request.Request(
        url,
        method="GET",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _local_read() -> list:
    try:
        with open(FALLBACK_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return []


def _local_write(entries: list) -> None:
    os.makedirs(os.path.dirname(FALLBACK_FILE), exist_ok=True)
    with open(FALLBACK_FILE, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)


def _using_supabase() -> bool:
    return bool(SUPABASE_URL and SUPABASE_KEY)


def _storage_name() -> str:
    return "supabase" if _using_supabase() else "local-file"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
def home():
    return {"message": "Backend connected successfully ❤️", "storage": _storage_name()}


@app.get("/api/health")
def health():
    return {"ok": True, "storage": _storage_name()}


@app.post("/api/answer")
def log_answer(answer: Answer):
    entry = {
        "accepted": answer.accepted,
        "reason": answer.reason,
        "at": answer.at or datetime.now(timezone.utc).isoformat(),
    }
    if _using_supabase():
        row = _supabase_insert(entry)
    else:
        entries = _local_read()
        entries.append(entry)
        _local_write(entries)
        row = entry
    return {"ok": True, "storage": _storage_name(), "row": row}


@app.get("/api/answers")
def get_answers():
    if _using_supabase():
        rows = _supabase_select()
    else:
        rows = _local_read()
    return {"answers": rows, "storage": _storage_name()}
