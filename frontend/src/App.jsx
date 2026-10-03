import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import Admin from "./Admin.jsx";

// Who is this link for? Supports /i/Sarah and /?id=Sarah
function personFromUrl() {
  const m = window.location.pathname.match(/^\/i\/([^/]+)\/?$/);
  if (m) return decodeURIComponent(m[1]);
  const q = new URLSearchParams(window.location.search).get("id");
  return q ? decodeURIComponent(q) : "";
}

const CONFETTI_COLORS = ["#ff5d8f", "#ffb3c6", "#ffd166", "#a0e7a0", "#8ecae6", "#c77dff"];

// Tiny seeded PRNG so decorative randomness is stable across re-renders.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Logo() {
  return (
    <svg
      className="logo"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M12 13l-1-1.5a1.5 1.5 0 0 0-2.12 2.12L12 17l3.12-3.38a1.5 1.5 0 0 0-2.12-2.12L12 13Z" />
    </svg>
  );
}

function Envelope({ onOpen, person }) {
  return (
    <div className="stage">
      <div className="envelope-scene">
        <button type="button" className="envelope" onClick={onOpen} aria-label="Open the envelope">
          <span className="flap" />
          <span className="letter-peek">
            <Logo />
          </span>
          <span className="glow" />
        </button>
      </div>
      {person && <p className="addressed script">for {person} 💕</p>}
      <p className="hint">tap to open 💌</p>
    </div>
  );
}

function HeartsRain({ count = 24 }) {
  const hearts = useMemo(() => {
    const rand = mulberry32(count * 7 + 1);
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: rand() * 100,
      delay: rand() * 6,
      duration: 7 + rand() * 6,
      size: 10 + rand() * 16,
      drift: rand() * 60 - 30,
      opacity: 0.25 + rand() * 0.5,
    }));
  }, [count]);
  return (
    <div className="hearts-rain" aria-hidden="true">
      {hearts.map((h) => (
        <span
          key={h.id}
          style={{
            left: `${h.left}%`,
            animationDelay: `${h.delay}s`,
            animationDuration: `${h.duration}s`,
            fontSize: `${h.size}px`,
            opacity: h.opacity,
            ["--drift"]: `${h.drift}px`,
          }}
        >
          ❤
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Bikini-Bottom-style scene animations — one per stage
   (emoji homage: sponge 🧽, shell 🐚, star ⭐, snail 🐌,
    boat 🫼, bubbles 🫧, jellyfish 🪼, crab 🦀)
--------------------------------------------------------------- */

function BubblesScene() {
  const bubbles = useMemo(() => {
    const rand = mulberry32(7);
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: rand() * 100,
      delay: rand() * 8,
      duration: 6 + rand() * 7,
      size: 10 + rand() * 26,
    }));
  }, []);
  return (
    <div className="scene" aria-hidden="true">
      <span className="sea-critter critter-shell">🐚</span>
      {bubbles.map((b) => (
        <span
          key={b.id}
          className="bubble"
          style={{
            left: `${b.left}%`,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
            width: `${b.size}px`,
            height: `${b.size}px`,
          }}
        />
      ))}
    </div>
  );
}

function JellyfishScene() {
  const jellies = useMemo(() => {
    const rand = mulberry32(11);
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      top: 8 + rand() * 55,
      delay: rand() * 10,
      duration: 12 + rand() * 8,
      size: 22 + rand() * 22,
    }));
  }, []);
  return (
    <div className="scene" aria-hidden="true">
      {jellies.map((j) => (
        <span
          key={j.id}
          className="jellyfish"
          style={{
            top: `${j.top}%`,
            animationDelay: `${j.delay}s`,
            animationDuration: `${j.duration}s`,
            fontSize: `${j.size}px`,
          }}
        >
          🪼
        </span>
      ))}
      <span className="sea-critter critter-star">⭐</span>
      <span className="sea-critter critter-crab">🦀</span>
    </div>
  );
}

function SnailScene() {
  return (
    <div className="scene" aria-hidden="true">
      <span className="snail">🐌</span>
      <span className="sea-critter critter-boat">🫼</span>
      <span className="sea-critter critter-star">⭐</span>
    </div>
  );
}

function PartyScene() {
  const dancers = ["🧽", "🐚", "⭐", "🦀"];
  return (
    <div className="scene" aria-hidden="true">
      {dancers.map((d, i) => (
        <span key={d} className="dancer" style={{ animationDelay: `${i * 0.18}s` }}>
          {d}
        </span>
      ))}
      <span className="party-bubble b1">🫧</span>
      <span className="party-bubble b2">🫧</span>
      <span className="party-bubble b3">🫧</span>
    </div>
  );
}

const DATE_IDEAS = ["Coffee ☕", "Dinner 🍝", "A movie 🎬", "Stargazing 🌌", "Ice cream 🍦"];

function Question({ onYes, person }) {
  const [noCount, setNoCount] = useState(0);
  const [noStyle, setNoStyle] = useState(null);
  const [flying, setFlying] = useState(null);
  const parentRef = useRef(null);
  const lastMoveRef = useRef(0);

  // Derived during render — the Yes button grows with every rejected No.
  const yesScale = 1 + noCount * 0.35;

  const fleeNo = (e) => {
    // mouseenter, mousedown, focus and click can all fire for one gesture —
    // only move + count at most once per 150 ms so the counter stays honest.
    const now = Date.now();
    if (now - lastMoveRef.current < 150) return;
    lastMoveRef.current = now;

    const parent = parentRef.current;
    if (parent) {
      const bounds = parent.getBoundingClientRect();
      const margin = 24;
      const x = bounds.left + margin + Math.random() * Math.max(1, bounds.width - 2 * margin);
      const y = bounds.top + margin + Math.random() * Math.max(1, bounds.height - 2 * margin);
      setNoStyle({ left: x, top: y });
    }
    if (e && typeof e.clientX === "number") {
      setFlying({ x: e.clientX, y: e.clientY });
    }
    setNoCount((c) => c + 1);
  };

  const playfulLines = [
    "Are you sure? 🥺",
    "Really sure? 🥹",
    "Think again… 💭",
    "That button is getting tired 😤",
    "You can't catch it anyway 😜",
    "Just say yes already 🙏",
    "It's destiny at this point ✨",
  ];
  const nudge = playfulLines[Math.min(noCount - 1, playfulLines.length - 1)];

  return (
    <div className="stage">
      <h2 className="title">{person ? `Hey ${person} 💕` : "Hey you 💕"}</h2>
      <p className="subtitle">There's something I've been meaning to ask…</p>

      <div className="card question-card">
        <p className="question">Will you go out with me?</p>

        <div className="buttons" ref={parentRef}>
          <button type="button" className="btn yes" style={{ ["--yes-scale"]: yesScale }} onClick={onYes}>
            Yes! 💖
          </button>

          <button type="button" className="btn no" style={noStyle ? { left: noStyle.left, top: noStyle.top, position: "fixed" } : undefined} onMouseEnter={fleeNo} onMouseDown={fleeNo} onTouchStart={fleeNo} onFocus={fleeNo}>
            No
          </button>
        </div>
      </div>

      {flying && (
        <span
          className="broken"
          style={{ left: flying.x, top: flying.y }}
          onAnimationEnd={() => setFlying(null)}
        >
          💔
        </span>
      )}

      {nudge && <p className="nudge">{nudge}</p>}
      <p className="teaser">Psst… the Yes button grows a little with every No 😉</p>
    </div>
  );
}

function Confirm({ onReallyYes, onRethink, person }) {
  return (
    <div className="stage">
      <h2 className="title">{person ? `WAIT… ${person}?! 😳` : "WAIT… really?! 😳"}</h2>
      <p className="subtitle">Did you really say yes? Because my heart just did a backflip.</p>
      <div className="card confirm-card">
        <p className="big-heart">😳💖</p>
        <div className="buttons confirm-buttons">
          <button type="button" className="btn yes" onClick={onReallyYes}>
            Yes, really! 💘
          </button>
          <button type="button" className="btn rethink" onClick={onRethink}>
            Wait, let me rethink 🙈
          </button>
        </div>
      </div>
    </div>
  );
}

const DAY_OPTIONS = [
  "This Saturday 🎉",
  "This Sunday 😌",
  "Next Friday 🌆",
  "Next weekend 🗓️",
  "I'm flexible 😉",
];

const TIME_OPTIONS = [
  { value: "12:00", label: "12:00 PM" },
  { value: "13:30", label: "1:30 PM" },
  { value: "16:00", label: "4:00 PM" },
  { value: "18:00", label: "6:00 PM" },
  { value: "19:30", label: "7:30 PM" },
  { value: "21:00", label: "9:00 PM" },
];

// "2026-10-03" -> "Sat, Oct 3"; chip labels pass through untouched.
function prettyDay(day) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const d = new Date(`${day}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    }
  }
  return day;
}

// "19:30" -> "7:30 PM"
function prettyTime(time) {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m || 0).padStart(2, "0")} ${ampm}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function WhenFree({ onPick }) {
  const [pickedDay, setPickedDay] = useState(null);
  const [pickedTime, setPickedTime] = useState("");

  const complete = Boolean(pickedDay && pickedTime);

  const pickDay = (value) => {
    setPickedDay(value);
  };

  const hint = complete
    ? null
    : pickedDay
      ? "Great! Now pick a time ⏰"
      : pickedTime
        ? "Almost! Which day should I keep free? 📅"
        : "Pick a day and a time — then lock it in.";

  return (
    <div className="stage">
      <h2 className="title">When are you free? 📅</h2>
      <p className="subtitle">Two little steps so I can plan this properly 😉</p>
      <div className="card when-card">
        <div className="step-block">
          <div className="step-head">
            <span className="step-num">1</span>
            <span className="step-title">Pick a day</span>
            {pickedDay && (
              <>
                <span className="step-picked">{prettyDay(pickedDay)}</span>
                <i className="fa-solid fa-circle-check step-done" aria-hidden="true" />
              </>
            )}
          </div>
          <div className="chips day-grid">
            {DAY_OPTIONS.map((day) => (
              <button
                key={day}
                type="button"
                className={`chip ${pickedDay === day ? "chip-selected" : ""}`}
                onClick={() => pickDay(day)}
              >
                {day}
              </button>
            ))}
          </div>
          <div className="custom-row">
            <label htmlFor="date-input">or an exact date:</label>
            <input
              id="date-input"
              type="date"
              className="date-input"
              min={todayISO()}
              onChange={(e) => {
                if (e.target.value) pickDay(e.target.value);
              }}
            />
          </div>
        </div>

        <div className={`step-block ${pickedDay ? "step-active" : "step-locked"}`}>
          <div className="step-head">
            <span className="step-num">2</span>
            <span className="step-title">Pick a time</span>
            {pickedTime && (
              <>
                <span className="step-picked">{prettyTime(pickedTime)}</span>
                <i className="fa-solid fa-circle-check step-done" aria-hidden="true" />
              </>
            )}
          </div>
          {!pickedDay && <p className="step-hint">Choose a day first ☝️</p>}
          <div className="chips time-grid">
            {TIME_OPTIONS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`chip ${pickedTime === t.value ? "chip-selected" : ""}`}
                disabled={!pickedDay}
                onClick={() => setPickedTime(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="custom-row">
            <label htmlFor="time-input">or an exact time:</label>
            <input
              id="time-input"
              aria-label="Pick a time"
              type="time"
              className="date-input time-input"
              disabled={!pickedDay}
              onChange={(e) => setPickedTime(e.target.value)}
            />
          </div>
        </div>

        <div className="lock-row">
          {complete ? (
            <p className="chosen">
              📅 {prettyDay(pickedDay)} · ⏰ {prettyTime(pickedTime)} — lock it in?
            </p>
          ) : (
            <p className="time-hint nudge-text">{hint}</p>
          )}
          <button
            type="button"
            className="btn yes confirm-btn"
            onClick={() => onPick(pickedDay, pickedTime)}
            disabled={!complete}
          >
            Lock it in 🔒
          </button>
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(() => {
    const rand = mulberry32(42);
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: rand() * 100,
      delay: rand() * 0.8,
      duration: 2.2 + rand() * 2,
      drift: rand() * 80 - 40,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }));
  }, []);
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--drift"]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  // Admin dashboard lives at /admin (or /i/admin if a link was mistyped).
  if (/^\/(i\/)?admin\/?$/.test(window.location.pathname)) {
    return <Admin />;
  }

  return <AskHerOut />;
}

function NotFound() {
  return (
    <div className="app">
      <HeartsRain count={10} />
      <div className="stage">
        <h2 className="title">404 💌</h2>
        <p className="subtitle">
          This letter isn't addressed to anyone — no invite found for this link.
        </p>
        <div className="card notfound-card">
          <p className="big-heart">🔍</p>
          <p>Double-check the link you were sent, or ask for a fresh one.</p>
        </div>
      </div>
    </div>
  );
}

function AskHerOut() {
  const [stage, setStage] = useState("envelope");
  const [chosen, setChosen] = useState(null);
  const [person] = useState(personFromUrl);
  // Invite-only: with no name in the URL there is no letter to open — the
  // bare domain lands on the not-found page like a hand-edited link would.
  const [inviteState, setInviteState] = useState(person ? "checking" : "invalid");
  // Date-idea chips are admin-editable; start from the defaults and swap in
  // the live list once fetched (the /api/ideas endpoint never fails hard).
  const [ideas, setIdeas] = useState(DATE_IDEAS);
  const ideasFetchedRef = useRef(false);
  const rowIdRef = useRef(null);

  // Personal links only work when the name was issued from the dashboard;
  // hand-edited URLs land on the not-found page.
  useEffect(() => {
    let cancelled = false;
    if (!person) return;
    fetch(`/api/invite/${encodeURIComponent(person)}`)
      .then((res) => {
        if (!cancelled) setInviteState(res.ok ? "valid" : "invalid");
      })
      .catch(() => {
        if (!cancelled) setInviteState("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [person]);

  // Fetch the admin-curated date ideas once, just before the celebration
  // stage needs them (the "when" stage always precedes it). Failure keeps
  // the built-in defaults.
  useEffect(() => {
    if (stage !== "when" || ideasFetchedRef.current) return;
    ideasFetchedRef.current = true;
    let cancelled = false;
    fetch(`/api/invite/${encodeURIComponent(person)}/ideas`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const labels = (data?.ideas || []).filter(Boolean);
        if (!cancelled) setIdeas(labels);
      })
      .catch(() => {
        /* defaults stay */
      });
    return () => {
      cancelled = true;
    };
  }, [stage]);

  const postAnswer = async (payload) => {
    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, person }),
      });
      if (res.ok) {
        const data = await res.json();
        return data?.row?.id ?? null;
      }
    } catch {
      /* backend not running — the romance continues anyway */
    }
    return null;
  };

  const handleYes = async () => {
    setStage("confirm");
    if (rowIdRef.current == null) {
      const id = await postAnswer({ accepted: true });
      if (id != null) rowIdRef.current = id;
    }
  };

  const handleReallyYes = () => setStage("when");

  const handleRethink = () => {
    rowIdRef.current = null;
    setStage("question");
  };

  const handleWhenPicked = async (day, time) => {
    setStage("celebration");
    if (rowIdRef.current == null) {
      const id = await postAnswer({ accepted: true });
      if (id != null) rowIdRef.current = id;
    }
    if (rowIdRef.current != null) {
      postAnswer({ accepted: true, date_text: day, time_text: time || "", row_id: rowIdRef.current });
    }
  };

  const handleChip = async (idea) => {
    setChosen(idea);
    if (rowIdRef.current != null) {
      postAnswer({ accepted: true, reason: idea, row_id: rowIdRef.current });
    } else {
      // Yes-write still in flight: retry shortly with the row id once known.
      setTimeout(() => {
        if (rowIdRef.current != null) {
          postAnswer({ accepted: true, reason: idea, row_id: rowIdRef.current });
        }
      }, 1500);
    }
  };

  if (inviteState === "checking") {
    return (
      <div className="app">
        <HeartsRain count={8} />
        <div className="stage">
          <p className="hint">sealing the envelope… 💌</p>
        </div>
      </div>
    );
  }

  if (inviteState === "invalid") {
    return <NotFound />;
  }

  if (stage === "envelope") {
    return (
      <div className="app">
        <HeartsRain />
        <BubblesScene />
        <Envelope onOpen={() => setStage("question")} person={person} />
      </div>
    );
  }

  if (stage === "question") {
    return (
      <div className="app">
        <HeartsRain />
        <JellyfishScene />
        <Question onYes={handleYes} person={person} />
      </div>
    );
  }

  if (stage === "confirm") {
    return (
      <div className="app">
        <HeartsRain count={30} />
        <BubblesScene />
        <Confirm onReallyYes={handleReallyYes} onRethink={handleRethink} person={person} />
      </div>
    );
  }

  if (stage === "when") {
    return (
      <div className="app">
        <HeartsRain />
        <SnailScene />
        <WhenFree onPick={handleWhenPicked} />
      </div>
    );
  }

  return (
    <div className="app celebrate">
      <HeartsRain count={40} />
      <Confetti />
      <PartyScene />
      <div className="stage">
        <h2 className="title">IT'S A DATE! 🎉</h2>
        <p className="subtitle">You just made my whole week 💘</p>
        <div className="card celebrate-card">
          <p className="big-heart">💖</p>
          <p>So… what are we doing?</p>
          <div className="chips">
            {ideas.map((idea) => (
              <button
                key={idea}
                type="button"
                className={`chip ${chosen === idea ? "chip-selected" : ""}`}
                onClick={() => handleChip(idea)}
              >
                {idea}
              </button>
            ))}
          </div>
          {chosen && <p className="chosen">Excellent choice. It's a plan! 🥂</p>}
        </div>
      </div>
    </div>
  );
}
