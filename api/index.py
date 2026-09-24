import json
import os
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
RAW_SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")


def _resolve_supabase_url(raw: str) -> str:
    """Return a proper https://<ref>.supabase.co REST base URL.

    Forgives the common mistake of pasting the Postgres connection string
    (postgresql://postgres.<ref>:<password>@host/db) or a bare project ref
    instead of the Project URL. Never logs or echoes the raw value.
    """
    import re

    if not raw:
        return ""
    if raw.startswith("https://"):
        return raw
    if raw.startswith(("http://", "postgresql://", "postgres://")):
        m = re.search(r"postgres\.([a-z0-9]{18,24})", raw)  # pooler/user form
        if not m:
            m = re.search(r"db\.([a-z0-9]{18,24})\.supabase\.co", raw)  # direct form
        if m:
            return f"https://{m.group(1)}.supabase.co"
        return ""
    if re.fullmatch(r"[a-z0-9]{18,24}", raw):  # bare project ref
        return f"https://{raw}.supabase.co"
    return ""


SUPABASE_URL = _resolve_supabase_url(RAW_SUPABASE_URL)

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
    import urllib.error
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
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise HTTPException(status_code=502, detail=f"Supabase insert failed ({e.code}): {body}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Supabase unreachable: {e.reason}")
    return rows[0] if rows else entry


def _supabase_select() -> list:
    import urllib.error
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
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise HTTPException(status_code=502, detail=f"Supabase select failed ({e.code}): {body}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Supabase unreachable: {e.reason}")


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


def _url_normalized() -> bool:
    """True when SUPABASE_URL was not a clean https:// Project URL."""
    return bool(RAW_SUPABASE_URL) and not RAW_SUPABASE_URL.startswith("https://")


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


@app.get("/api/debug")
def debug():
    """Safe diagnostics — booleans only, never echoes config values."""
    return {
        "supabase_configured": _using_supabase(),
        "url_is_https": SUPABASE_URL.startswith("https://") if SUPABASE_URL else False,
        "url_normalized_from_raw": _url_normalized(),
        "key_is_set": bool(SUPABASE_KEY),
    }


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
