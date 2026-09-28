import { useCallback, useEffect, useState } from "react";

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

  const loadResponses = useCallback(async (authToken) => {
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
      const data = await res.json();
      setRows(data.answers || []);
      setStorage(data.storage || "");
    } catch {
      setError("Could not load responses.");
    }
  }, []);

  // Load responses whenever the auth token changes (login or restored session).
  useEffect(() => {
    if (token) loadResponses(token);
  }, [token, loadResponses]);

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

  const generate = (e) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setGenerated(`${window.location.origin}/i/${encodeURIComponent(clean)}`);
    setCopied(false);
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
          <h1>🔒 Admin</h1>
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
        <h1>💘 Admin Dashboard</h1>
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

      <section className="admin-card">
        <h2>Generate a personal link</h2>
        <form className="admin-gen" onSubmit={generate}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Her name, e.g. Sarah"
          />
          <button type="submit" className="admin-btn" disabled={!name.trim()}>
            Create link
          </button>
        </form>
        {generated && (
          <div className="admin-link-row">
            <code>{generated}</code>
            <button type="button" className="admin-btn admin-small" onClick={copy}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        )}
      </section>

      <section className="admin-card">
        <div className="admin-table-head">
          <h2>Responses</h2>
          <span className="admin-meta">
            {storage === "supabase" ? "● live from Supabase" : "● local file"} ·{" "}
            <button type="button" className="admin-refresh" onClick={() => loadResponses(token)}>
              refresh
            </button>
          </span>
        </div>

        {rows === null && <p>Loading…</p>}
        {Array.isArray(rows) && rows.length === 0 && (
          <p className="admin-empty">No responses yet. Send someone a link! 💌</p>
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
                </tr>
              </thead>
              <tbody>
                {[...answered, ...pending].map((r) => (
                  <tr key={r.id} className={r.accepted ? "row-yes" : "row-no"}>
                    <td>{r.person || "—"}</td>
                    <td>{r.accepted ? "YES 💖" : "no"}</td>
                    <td>{r.reason || "—"}</td>
                    <td>{r.date_text || "—"}</td>
                    <td>{r.time_text || "—"}</td>
                    <td>{r.at ? new Date(r.at).toLocaleString() : "—"}</td>
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
