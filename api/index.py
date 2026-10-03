import json
import os
import urllib.parse
from datetime import datetime, timezone
from typing import Optional

import base64
import hashlib
import hmac

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
RAW_SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


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

ADMIN_PASSCODE = os.environ.get("ADMIN_PASSCODE", "")

INVITES_URL = "invites"
ANSWERS_URL = "answers"
IDEAS_URL = "ideas"

# The celebration chips are admin-editable; these seed the store on first
# use and also serve as a resilient fallback if the ideas table is missing.
DEFAULT_IDEAS = ["Coffee ☕", "Dinner 🍝", "A movie 🎬", "Stargazing 🌌", "Ice cream 🍦"]


def _make_token() -> str:
    """Time-limited signed token from the passcode (no server-side session)."""
    expires = int((datetime.now(timezone.utc).timestamp() // 3600) + 24)  # ~24h validity
    msg = f"admin:{expires}".encode()
    sig = hmac.new(ADMIN_PASSCODE.encode(), msg, hashlib.sha256).hexdigest()[:32]
    return base64.urlsafe_b64encode(f"{expires}:{sig}".encode()).decode()


def _verify_token(token: str) -> bool:
    if not ADMIN_PASSCODE or not token:
        return False
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        expires_str, sig = raw.split(":", 1)
        expires = int(expires_str)
    except Exception:
        return False
    if expires * 3600 < datetime.now(timezone.utc).timestamp():
        return False
    msg = f"admin:{expires}".encode()
    expected = hmac.new(ADMIN_PASSCODE.encode(), msg, hashlib.sha256).hexdigest()[:32]
    return hmac.compare_digest(sig, expected)

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
    date_text: str = ""
    time_text: str = ""
    person: str = ""
    row_id: Optional[int] = None


def _supabase_update(row_id: int, fields: dict) -> list:
    """PATCH a row, gracefully dropping fields whose columns don't exist yet
    (PGRST204) so a pending migration never breaks the experience."""
    import json as _json
    import re
    import urllib.error
    import urllib.request

    remaining = dict(fields)
    dropped = []
    for _ in range(3):
        if not remaining:
            return []
        url = f"{SUPABASE_URL}/rest/v1/answers?id=eq.{int(row_id)}"
        data = _json.dumps(remaining).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            method="PATCH",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            m = re.search(r"Could not find the '([a-zA-Z_]+)' column", body)
            if e.code == 400 and m and m.group(1) in remaining:
                dropped.append(remaining.pop(m.group(1)))
                continue
            raise HTTPException(status_code=502, detail=f"Supabase update failed ({e.code}): {body}")
        except urllib.error.URLError as e:
            raise HTTPException(status_code=502, detail=f"Supabase unreachable: {e.reason}")
    return []


# ---------------------------------------------------------------------------
# Storage: Supabase (Postgres) when configured, local JSON file otherwise
# ---------------------------------------------------------------------------
def _supabase_insert(entry: dict) -> dict:
    """Insert a row, gracefully dropping fields whose columns don't exist yet
    (PGRST204) so a pending migration never blocks a Yes."""
    import json as _json
    import re
    import urllib.error
    import urllib.request

    remaining = dict(entry)
    for _ in range(4):
        url = f"{SUPABASE_URL}/rest/v1/answers"
        data = _json.dumps(remaining).encode("utf-8")
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
            return rows[0] if rows else remaining
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            m = re.search(r"Could not find the '([a-zA-Z_]+)' column", body)
            if e.code == 400 and m and m.group(1) in remaining:
                remaining.pop(m.group(1))
                continue
            raise HTTPException(status_code=502, detail=f"Supabase insert failed ({e.code}): {body}")
        except urllib.error.URLError as e:
            raise HTTPException(status_code=502, detail=f"Supabase unreachable: {e.reason}")
    return remaining


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


def _supabase_delete(row_id: int) -> None:
    """Delete and verify: RLS can silently delete zero rows, so confirm."""
    import urllib.error
    import urllib.request

    url = f"{SUPABASE_URL}/rest/v1/answers?id=eq.{int(row_id)}"
    req = urllib.request.Request(
        url,
        method="DELETE",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Prefer": "return=representation",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            deleted = json.loads(resp.read().decode("utf-8"))
            if not deleted:
                raise HTTPException(
                    status_code=409,
                    detail="Delete blocked by database policies — run the RLS delete policy SQL for answers",
                )
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise HTTPException(status_code=502, detail=f"Supabase delete failed ({e.code}): {body}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Supabase unreachable: {e.reason}")


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
    if not _using_supabase():
        return {
            "ok": True,
            "storage": "local-file",
            "database_connected": False,
            "schema_ready": False,
        }
    try:
        # Check the table and column required by personalized date selections.
        _rest_select(INVITES_URL, "select=id,idea_labels&limit=0")
    except HTTPException as e:
        detail = str(e.detail)
        reachable = "Supabase unreachable" not in detail
        if "PGRST204" in detail or "idea_labels" in detail:
            message = "Supabase is reachable, but public.invites.idea_labels is missing from the REST schema cache. Apply the invites migration in the Supabase project configured on Vercel."
        elif "Could not find the table" in detail or "PGRST205" in detail:
            message = "Supabase is reachable, but the invites table is missing from the REST schema cache. Apply the invites section of supabase.sql in the project configured on Vercel."
        elif not reachable:
            message = "Could not reach Supabase. Check the Vercel SUPABASE_URL and network status."
        else:
            message = "Supabase returned an API error during the schema check. Verify the Vercel Supabase project URL, key, and anon table permissions."
        return {
            "ok": False,
            "storage": "supabase",
            "database_connected": reachable,
            "schema_ready": False,
            "detail": message,
        }
    return {
        "ok": True,
        "storage": "supabase",
        "database_connected": True,
        "schema_ready": True,
    }


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
    now = datetime.now(timezone.utc).isoformat()

    # Follow-up: attach her date-idea choice and/or availability to the Yes row.
    if answer.row_id is not None:
        fields = {}
        if answer.reason:
            fields["reason"] = answer.reason
        if answer.date_text:
            fields["date_text"] = answer.date_text
        if answer.time_text:
            fields["time_text"] = answer.time_text
        if answer.person:
            fields["person"] = answer.person
        if fields:
            if _using_supabase():
                rows = _supabase_update(answer.row_id, fields)
                row = rows[0] if rows else {"id": answer.row_id, **fields}
            else:
                entries = _local_read()
                row = None
                for e in entries:
                    if e.get("id") == answer.row_id:
                        e.update(fields)
                        row = e
                        break
                _local_write(entries)
                row = row or {"id": answer.row_id, **fields}
            return {"ok": True, "storage": _storage_name(), "row": row}

    # Fresh answer (the Yes click) — create a new row.
    entry = {
        "accepted": answer.accepted,
        "reason": answer.reason,
        "person": answer.person,
        "at": now,
    }
    if _using_supabase():
        row = _supabase_insert(entry)
    else:
        entries = _local_read()
        entry = {"id": len(entries) + 1, **entry}
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


# ---------------------------------------------------------------------------
# Admin (passcode-gated)
# ---------------------------------------------------------------------------
@app.post("/api/admin/login")
def admin_login(body: dict):
    code = str(body.get("passcode", ""))
    if not ADMIN_PASSCODE:
        raise HTTPException(status_code=503, detail="ADMIN_PASSCODE env var is not set")
    if not hmac.compare_digest(code, ADMIN_PASSCODE):
        raise HTTPException(status_code=401, detail="Wrong passcode")
    return {"ok": True, "token": _make_token()}


@app.get("/api/admin/responses")
def admin_responses(authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not _verify_token(token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if _using_supabase():
        rows = _supabase_select()
    else:
        rows = _local_read()
    return {"answers": rows, "storage": _storage_name()}


@app.delete("/api/admin/responses/{row_id}")
def admin_delete_response(row_id: int, authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not _verify_token(token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if _using_supabase():
        _supabase_delete(row_id)
    else:
        entries = [e for e in _local_read() if e.get("id") != row_id]
        _local_write(entries)
    return {"ok": True, "deleted": row_id}


# ---------------------------------------------------------------------------
# Invites: only admin-created names resolve at /i/<name>
# ---------------------------------------------------------------------------
def _rest_delete(table: str, query: str) -> None:
    import urllib.error
    import urllib.request

    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    req = urllib.request.Request(
        url,
        method="DELETE",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10):
            pass
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise HTTPException(status_code=502, detail=f"Supabase delete failed ({e.code}): {body}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Supabase unreachable: {e.reason}")


def _rest_insert(table: str, entry: dict) -> dict:
    import urllib.error
    import urllib.request

    url = f"{SUPABASE_URL}/rest/v1/{table}"
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
        return rows[0] if rows else entry
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        if table == INVITES_URL and "idea_labels" in entry and "PGRST204" in body:
            raise HTTPException(
                status_code=503,
                detail="Supabase received the request, but public.invites.idea_labels is missing from its REST schema cache. Run ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS idea_labels jsonb; then NOTIFY pgrst, 'reload schema'; in the Supabase project configured on Vercel.",
            )
        raise HTTPException(status_code=502, detail=f"Supabase insert failed ({e.code}): {body}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Supabase unreachable: {e.reason}")


def _rest_select(table: str, query: str = "select=*") -> list:
    import urllib.error
    import urllib.request

    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
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


def _rest_patch(table: str, query: str, entry: dict) -> list:
    import urllib.error
    import urllib.request

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Editing existing links requires SUPABASE_SERVICE_ROLE_KEY to be set in the server environment.",
        )
    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    data = json.dumps(entry).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="PATCH",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        raise HTTPException(status_code=502, detail=f"Supabase update failed ({e.code}): {body}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Supabase unreachable: {e.reason}")


def _invite_read() -> list:
    try:
        with open(
            os.path.join(os.path.dirname(FALLBACK_FILE), "invites.json"), encoding="utf-8"
        ) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return []


def _invite_write(entries: list) -> None:
    path = os.path.join(os.path.dirname(FALLBACK_FILE), "invites.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)


def _invite_valid(name: str) -> bool:
    lowered = (name or "").strip().lower()
    if not lowered:
        return False
    if _using_supabase():
        rows = _rest_select(INVITES_URL, f"select=name&name=eq.{urllib.parse.quote(lowered)}")
        return len(rows) > 0
    return any(e.get("name", "").lower() == lowered for e in _invite_read())


@app.get("/api/invite/{name}")
def check_invite(name: str):
    """Public: does this personal link exist? Invalid names get a 404 so
    hand-edited URLs land on the not-found page."""
    if not _invite_valid(name):
        raise HTTPException(status_code=404, detail="Invite not found")
    return {"ok": True}


@app.get("/api/invite/{name}/ideas")
def invite_ideas(name: str):
    """Public: date ideas selected for this invite, or the global list for legacy invites."""
    lowered = (name or "").strip().lower()
    if _using_supabase():
        query = f"select=name,idea_labels&name=eq.{urllib.parse.quote(lowered)}"
        rows = _rest_select(INVITES_URL, query)
        if not rows:
            raise HTTPException(status_code=404, detail="Invite not found")
        selected = rows[0].get("idea_labels")
    else:
        invite = next(
            (entry for entry in _invite_read() if entry.get("name", "").lower() == lowered),
            None,
        )
        if invite is None:
            raise HTTPException(status_code=404, detail="Invite not found")
        selected = invite.get("idea_labels")
    if selected is None:
        entries = _supabase_ideas_seeded_list() if _using_supabase() else _ideas_local_list()
        labels = [entry["label"] for entry in entries]
        return {"ideas": labels or DEFAULT_IDEAS}
    if not selected:
        return {"ideas": DEFAULT_IDEAS}
    return {"ideas": selected}


@app.get("/api/admin/invites")
def admin_list_invites(authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not _verify_token(token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if _using_supabase():
        rows = _rest_select(INVITES_URL, "select=*&order=created_at.asc")
    else:
        rows = _invite_read()
    return {"invites": rows}


@app.post("/api/admin/invites")
def admin_create_invite(body: dict, authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not _verify_token(token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    name = str(body.get("name", "")).strip()
    if not name or len(name) > 60:
        raise HTTPException(status_code=400, detail="Name must be 1-60 characters")
    requested_ideas = body.get("idea_labels")
    idea_labels = None
    if requested_ideas is not None:
        if not isinstance(requested_ideas, list) or any(
            not isinstance(label, str) for label in requested_ideas
        ):
            raise HTTPException(status_code=400, detail="Date ideas must be a list of labels")
        available = (
            _supabase_ideas_seeded_list() if _using_supabase() else _ideas_local_list()
        )
        available_labels = {str(entry.get("label", "")) for entry in available}
        if any(label not in available_labels and label not in DEFAULT_IDEAS for label in requested_ideas):
            raise HTTPException(status_code=400, detail="Choose date ideas from the current list")
        # An empty selection means use the built-in choices for this invite.
        idea_labels = requested_ideas or DEFAULT_IDEAS
    if _using_supabase():
        row = _rest_insert(INVITES_URL, {"name": name.lower(), "idea_labels": idea_labels})
    else:
        entries = _invite_read()
        if any(e.get("name", "").lower() == name.lower() for e in entries):
            row = {"name": name.lower()}
        else:
            row = {"id": len(entries) + 1, "name": name.lower(), "idea_labels": idea_labels}
            entries.append(row)
            _invite_write(entries)
    return {"ok": True, "invite": row}


@app.patch("/api/admin/invites/{name}")
def admin_update_invite(name: str, body: dict, authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not _verify_token(token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    requested_ideas = body.get("idea_labels")
    if not isinstance(requested_ideas, list) or any(
        not isinstance(label, str) for label in requested_ideas
    ):
        raise HTTPException(status_code=400, detail="Date ideas must be a list of labels")
    lowered = name.strip().lower()
    if _using_supabase():
        existing_rows = _rest_select(
            INVITES_URL,
            f"select=name,idea_labels&name=eq.{urllib.parse.quote(lowered)}",
        )
        if not existing_rows:
            raise HTTPException(status_code=404, detail="Invite not found")
        current_invite = existing_rows[0]
    else:
        entries = _invite_read()
        current_invite = next(
            (entry for entry in entries if entry.get("name", "").lower() == lowered),
            None,
        )
        if current_invite is None:
            raise HTTPException(status_code=404, detail="Invite not found")

    available = _supabase_ideas_seeded_list() if _using_supabase() else _ideas_local_list()
    available_labels = {str(entry.get("label", "")) for entry in available}
    current_labels = current_invite.get("idea_labels") or []
    allowed_labels = available_labels | set(DEFAULT_IDEAS) | set(current_labels)
    if any(label not in allowed_labels for label in requested_ideas):
        raise HTTPException(status_code=400, detail="Choose date ideas from the current list")
    idea_labels = requested_ideas or DEFAULT_IDEAS
    if _using_supabase():
        rows = _rest_patch(
            INVITES_URL,
            f"name=eq.{urllib.parse.quote(lowered)}",
            {"idea_labels": idea_labels},
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Invite not found or update not permitted")
        invite = rows[0]
    else:
        invite = current_invite
        invite["idea_labels"] = idea_labels
        _invite_write(entries)
    return {"ok": True, "invite": invite}


@app.delete("/api/admin/invites/{name}")
def admin_delete_invite(name: str, authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not _verify_token(token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    lowered = name.lower()
    if _using_supabase():
        _rest_delete(INVITES_URL, f"name=eq.{urllib.parse.quote(lowered)}")
    else:
        _invite_write([e for e in _invite_read() if e.get("name", "").lower() != lowered])
    return {"ok": True, "deleted": lowered}


# ---------------------------------------------------------------------------
# Date ideas: celebration chips, editable from the dashboard. Seeded with
# DEFAULT_IDEAS on first use; the public endpoint never fails hard — if the
# ideas table is missing it falls back to the defaults so the celebration
# page always shows chips.
# ---------------------------------------------------------------------------
def _ideas_read() -> list:
    try:
        with open(
            os.path.join(os.path.dirname(FALLBACK_FILE), "ideas.json"), encoding="utf-8"
        ) as f:
            return json.load(f)
    except FileNotFoundError:
        return _seed_ideas_locally()
    except (OSError, json.JSONDecodeError):
        return []


def _ideas_write(entries: list) -> None:
    path = os.path.join(os.path.dirname(FALLBACK_FILE), "ideas.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)


def _seed_ideas_locally() -> list:
    entries = [{"id": i + 1, "label": label} for i, label in enumerate(DEFAULT_IDEAS)]
    _ideas_write(entries)
    return entries


def _ideas_local_list() -> list:
    entries = _ideas_read()
    return entries


def _ideas_supabase_list_or_none() -> Optional[list]:
    """Select the ideas rows, or None when Supabase is unreachable/misconfigured
    (e.g. the table hasn't been created yet)."""
    try:
        return _rest_select(IDEAS_URL, "select=*&order=created_at.asc")
    except HTTPException:
        return None


def _ideas_guard(call):
    """Run a Supabase ideas write; translate a missing-table error into an
    actionable message instead of raw PostgREST jargon."""
    try:
        return call()
    except HTTPException as e:
        if "Could not find the table" in str(e.detail):
            raise HTTPException(
                status_code=502,
                detail="The ideas table doesn't exist in Supabase yet — run the 'ideas' block from supabase.sql in the SQL Editor, then try again",
            )
        raise


def _supabase_ideas_seeded_list() -> list:
    rows = _ideas_supabase_list_or_none()
    if rows is None:
        return [
            {"id": None, "label": label}
            for label in DEFAULT_IDEAS
        ]
    return rows


@app.get("/api/ideas")
def list_ideas():
    """Public: the celebration chip labels. Never 5xx — falls back to defaults."""
    if _using_supabase():
        return {"ideas": [entry["label"] for entry in _supabase_ideas_seeded_list()]}
    return {"ideas": [e["label"] for e in _ideas_local_list()]}


@app.get("/api/admin/ideas")
def admin_list_ideas(authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not _verify_token(token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if _using_supabase():
        rows = _ideas_supabase_list_or_none()
        if rows is None:
            fallback = [{"id": None, "label": label} for label in DEFAULT_IDEAS]
            return {"ideas": fallback, "configured": False}
        return {"ideas": rows, "configured": True}
    return {"ideas": _ideas_local_list(), "configured": True}


@app.post("/api/admin/ideas")
def admin_create_idea(body: dict, authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not _verify_token(token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    label = str(body.get("label", "")).strip()
    if not label or len(label) > 60:
        raise HTTPException(status_code=400, detail="Idea must be 1-60 characters")
    if _using_supabase():
        existing = _ideas_supabase_list_or_none()
        if existing is not None and any(
            str(r.get("label", "")).strip().lower() == label.lower() for r in existing
        ):
            raise HTTPException(status_code=400, detail="That idea is already on the list")
        try:
            row = _ideas_guard(lambda: _rest_insert(IDEAS_URL, {"label": label}))
        except HTTPException as e:
            if "already exists" in str(e.detail) or "duplicate key" in str(e.detail):
                raise HTTPException(status_code=400, detail="That idea is already on the list")
            raise
    else:
        entries = _ideas_local_list()
        if any(str(e.get("label", "")).strip().lower() == label.lower() for e in entries):
            raise HTTPException(status_code=400, detail="That idea is already on the list")
        row = {"id": max((e.get("id", 0) for e in entries), default=0) + 1, "label": label}
        entries.append(row)
        _ideas_write(entries)
    return {"ok": True, "idea": row}


@app.delete("/api/admin/ideas/{idea_id}")
def admin_delete_idea(idea_id: int, authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not _verify_token(token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if _using_supabase():
        _ideas_guard(lambda: _rest_delete(IDEAS_URL, f"id=eq.{int(idea_id)}"))
    else:
        _ideas_write([e for e in _ideas_local_list() if e.get("id") != idea_id])
    return {"ok": True, "deleted": idea_id}
