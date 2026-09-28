import { useMemo, useRef, useState } from "react";
import "./App.css";

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

function Envelope({ onOpen }) {
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
   (emoji homage: sponge 🧽, pineapple 🍍, star ⭐, snail 🐌,
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
      <span className="sea-critter critter-sponge">🧽</span>
      <span className="sea-critter critter-pineapple">🍍</span>
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
  const dancers = ["🧽", "🍍", "⭐", "🦀"];
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

function Question({ onYes }) {
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
      <h2 className="title">Hey you 💕</h2>
      <p className="subtitle">There's something I've been meaning to ask…</p>

      <div className="card question-card">
        <p className="question">Will you go out with me?</p>

        <div className="buttons" ref={parentRef}>
          <button
            type="button"
            className="btn yes"
            style={{ transform: `scale(${yesScale})` }}
            onClick={onYes}
          >
            Yes! 💖
          </button>

          <button
            type="button"
            className="btn no"
            style={noStyle ? { left: noStyle.left, top: noStyle.top, position: "fixed" } : undefined}
            onMouseEnter={fleeNo}
            onMouseDown={fleeNo}
            onTouchStart={fleeNo}
            onFocus={fleeNo}
          >
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

function Confirm({ onReallyYes, onRethink }) {
  return (
    <div className="stage">
      <h2 className="title">WAIT… really?! 😳</h2>
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

function WhenFree({ onPick }) {
  const [pickedDay, setPickedDay] = useState(null);
  const [pickedTime, setPickedTime] = useState("");

  const pickDay = (value) => {
    setPickedDay(value);
    onPick(value, pickedTime);
  };

  const pickTime = (value) => {
    setPickedTime(value);
    if (pickedDay) onPick(pickedDay, value);
  };

  const label =
    pickedDay && pickedTime
      ? `${pickedDay} at ${pickedTime}`
      : pickedDay || (pickedTime ? `Sometime at ${pickedTime}` : null);

  return (
    <div className="stage">
      <h2 className="title">When are you free? 📅</h2>
      <p className="subtitle">Pick a day (and a time if you're brave) — I'll handle the rest.</p>
      <div className="card when-card">
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
        <div className="date-row">
          <label htmlFor="date-input">or choose an exact date:</label>
          <div className="datetime-pair">
            <input
              id="date-input"
              type="date"
              className="date-input"
              onChange={(e) => {
                if (e.target.value) pickDay(e.target.value);
              }}
            />
            <input
              aria-label="Pick a time"
              type="time"
              className="date-input time-input"
              onChange={(e) => pickTime(e.target.value)}
            />
          </div>
          <p className="time-hint">time optional — but dinner needs a reservation 😌</p>
        </div>
        {label && <p className="chosen">Locked in: {label} ✨</p>}
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
  const [stage, setStage] = useState("envelope");
  const [chosen, setChosen] = useState(null);
  const rowIdRef = useRef(null);

  const postAnswer = async (payload) => {
    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, at: new Date().toISOString() }),
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

  if (stage === "envelope") {
    return (
      <div className="app">
        <HeartsRain />
        <BubblesScene />
        <Envelope onOpen={() => setStage("question")} />
      </div>
    );
  }

  if (stage === "question") {
    return (
      <div className="app">
        <HeartsRain />
        <JellyfishScene />
        <Question onYes={handleYes} />
      </div>
    );
  }

  if (stage === "confirm") {
    return (
      <div className="app">
        <HeartsRain count={30} />
        <BubblesScene />
        <Confirm onReallyYes={handleReallyYes} onRethink={handleRethink} />
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
            {DATE_IDEAS.map((idea) => (
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
