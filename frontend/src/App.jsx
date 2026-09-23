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
  const [yesLogged, setYesLogged] = useState(false);
  const [reasonLogged, setReasonLogged] = useState(false);

  const postAnswer = (payload) => {
    fetch("/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, at: new Date().toISOString() }),
    }).catch(() => {
      /* backend not running — the romance continues anyway */
    });
  };

  const handleYes = () => {
    if (!yesLogged) {
      setYesLogged(true);
      postAnswer({ accepted: true });
    }
    setStage("celebration");
  };

  const handleChip = (idea) => {
    setChosen(idea);
    if (!reasonLogged) {
      setReasonLogged(true);
      postAnswer({ accepted: true, reason: idea });
    }
  };

  if (stage === "envelope") {
    return (
      <div className="app">
        <HeartsRain />
        <Envelope onOpen={() => setStage("question")} />
      </div>
    );
  }

  if (stage === "question") {
    return (
      <div className="app">
        <HeartsRain />
        <Question onYes={handleYes} />
      </div>
    );
  }

  return (
    <div className="app celebrate">
      <HeartsRain count={40} />
      <Confetti />
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
