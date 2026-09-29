import { useCallback, useEffect, useState } from "react";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/solid.min.css";

const TOKEN_KEY = "admin_token";

function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [generated, setGenerated] = useState("");
  const [copied, setCopied] = useState(false);

  const [rows, setRows] = useState(null);
  const [storage, setStorage] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [invites, setInvites] = useState(null);
  const [revoking, setRevoking] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadResponses = useCallback(async (authToken) => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/responses", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken("");
        setError("Session expired — sign in again.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || "Could not load responses.");
        return;
      }
      const data = await res.json();
      setRows(data.answers || []);
      setStorage(data.storage || "");
      setError("");
    } catch {
      setError("Could not load responses.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadInvites = useCallback(async (authToken) => {
    try {
      const res = await fetch("/api/admin/invites", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites || []);
      }
    } catch {
      /* invites list is non-critical */
    }
  }, []);

  // Load responses whenever the auth token changes (login or restored session).
  useEffect(() => {
    if (token) {
      loadResponses(token);
      loadInvites(token);
    }
  }, [token, loadResponses, loadInvites]);

  const deleteRow = async (id) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/responses/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setRows((current) => (current || []).filter((r) => r.id !== id));
        setError("");
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || `Delete failed (HTTP ${res.status}).`);
      }
    } catch {
      setError("Delete failed — could not reach the server.");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Login failed");
        return;
      }
      sessionStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const generate = async (e) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Could not create invite");
        return;
      }
      setGenerated(`${window.location.origin}/i/${encodeURIComponent(data.invite.name)}`);
      setCopied(false);
      loadInvites(token);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const revokeInvite = async (inviteName) => {
    setRevoking(inviteName);
    try {
      const res = await fetch(`/api/admin/invites/${encodeURIComponent(inviteName)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setInvites((current) => (current || []).filter((i) => i.name !== inviteName));
        setError("");
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || `Revoke failed (HTTP ${res.status}).`);
      }
    } catch {
      setError("Revoke failed — could not reach the server.");
    } finally {
      setRevoking("");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — user can select manually */
    }
  };

  if (!token) {
    return (
      <div className="admin-wrap">
        <form className="admin-card admin-gate" onSubmit={login}>
          <h1><i className="fa-solid fa-lock" aria-hidden="true" /> Admin</h1>
          <p>Enter the passcode to manage links and responses.</p>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode"
            autoFocus
          />
          <button type="submit" className="admin-btn" disabled={busy || !passcode}>
            {busy ? "Checking…" : "Unlock"}
          </button>
          {error && <p className="admin-error">{error}</p>}
        </form>
      </div>
    );
  }

  const answered = (rows || []).filter((r) => r.accepted);
  const pending = (rows || []).filter((r) => !r.accepted);

  return (
    <div className="admin-wrap">
      <header className="admin-header">
        <h1><i className="fa-solid fa-heart" aria-hidden="true" /> Admin Dashboard</h1>
        <button
          type="button"
          className="admin-btn admin-ghost"
          onClick={() => {
            sessionStorage.removeItem(TOKEN_KEY);
            setToken("");
          }}
        >
          Log out
        </button>
      </header>

      {error && (
        <p className="admin-banner" role="alert">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {error}
        </p>
      )}

      <section className="admin-card">
        <h2>Generate a personal link</h2>
        <form className="admin-gen" onSubmit={generate}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Her name, e.g. Sarah"
          />
          <button type="submit" className="admin-btn" disabled={!name.trim() || busy}>
            {busy ? "Creating…" : "Create link"}
          </button>
        </form>
        {generated && (
          <div className="admin-link-row">
            <code>{generated}</code>
            <button type="button" className="admin-btn admin-small" onClick={copy}>
              {copied ? (
                <>
                  <i className="fa-solid fa-check" aria-hidden="true" /> Copied
                </>
              ) : (
                <>
                  <i className="fa-solid fa-copy" aria-hidden="true" /> Copy
                </>
              )}
            </button>
          </div>
        )}
      </section>

      <section className="admin-card">
        <div className="admin-table-head">
          <h2>Issued invites</h2>
          <span className="admin-meta">only these names will open a letter</span>
        </div>
        {Array.isArray(invites) && invites.length === 0 && (
          <p className="admin-empty">
            <i className="fa-solid fa-envelope" aria-hidden="true" /> No invites yet — create one
            above.
          </p>
        )}
        {Array.isArray(invites) && invites.length > 0 && (
          <div className="admin-invites">
            {invites.map((inv) => (
              <span key={inv.name} className="admin-invite-chip">
                {inv.name}
                <button
                  type="button"
                  className="admin-delete"
                  title="Revoke this invite (link stops working)"
                  disabled={revoking === inv.name}
                  onClick={() => revokeInvite(inv.name)}
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="admin-card">
        <div className="admin-table-head">
          <h2>Responses</h2>
          <span className="admin-meta">
            {storage === "supabase" ? "● live from Supabase" : "● local file"} ·{" "}
            <button
              type="button"
              className="admin-refresh"
              onClick={() => loadResponses(token)}
              disabled={refreshing}
            >
              <i
                className={`fa-solid fa-arrows-rotate ${refreshing ? "fa-spin" : ""}`}
                aria-hidden="true"
              /> {refreshing ? "refreshing…" : "refresh"}
            </button>
          </span>
        </div>

        {rows === null && <p>Loading…</p>}
        {Array.isArray(rows) && rows.length === 0 && (
          <p className="admin-empty">
            <i className="fa-solid fa-envelope" aria-hidden="true" /> No responses yet. Send someone
            a link!
          </p>
        )}

        {Array.isArray(rows) && rows.length > 0 && (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Answer</th>
                  <th>Date idea</th>
                  <th>When</th>
                  <th>Time</th>
                  <th>At</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...answered, ...pending].map((r) => (
                  <tr key={r.id} className={r.accepted ? "row-yes" : "row-no"}>
                    <td>{r.person || "—"}</td>
                    <td>
                      {r.accepted ? (
                        <>
                          YES <i className="fa-solid fa-heart heart-ic" aria-hidden="true" />
                        </>
                      ) : (
                        "no"
                      )}
                    </td>
                    <td>{r.reason || "—"}</td>
                    <td>{r.date_text || "—"}</td>
                    <td>{r.time_text || "—"}</td>
                    <td>{r.at ? new Date(r.at).toLocaleString() : "—"}</td>
                    <td>
                      {confirmId === r.id ? (
                        <span className="admin-confirm">
                          <button
                            type="button"
                            className="admin-btn admin-small admin-danger"
                            onClick={() => deleteRow(r.id)}
                            disabled={deletingId === r.id}
                          >
                            {deletingId === r.id ? "…" : "Delete"}
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-small admin-ghost"
                            onClick={() => setConfirmId(null)}
                          >
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="admin-delete"
                          title="Delete this response"
                          onClick={() => setConfirmId(r.id)}
                        >
                          <i className="fa-solid fa-trash-can" aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Admin;
