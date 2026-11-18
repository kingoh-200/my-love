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

const CONFETTI_COLORS = ["#3b82f6", "#60a5fa", "#22d3ee", "#1d4ed8", "#93c5fd", "#0ea5e9"];

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

/* Two mascots, drawn as line-art SVG so they sit inside the technical look:
   a lifter for the moment before the answer, dancers for afterwards. */
function RobotLifting() {
  return (
    <svg
      className="robot robot-lift"
      viewBox="0 0 64 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g className="robot-bar">
        <path d="M22 50 11 22" />
        <path d="M42 50 53 22" />
        <path d="M10 20h44" />
        <rect x="2" y="12" width="8" height="16" rx="2" />
        <rect x="54" y="12" width="8" height="16" rx="2" />
      </g>
      <path d="M32 20v-6" />
      <circle cx="32" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <rect x="22" y="26" width="20" height="16" rx="4" />
      <circle cx="28" cy="33" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="36" cy="33" r="1.6" fill="currentColor" stroke="none" />
      <path d="M29 37q3 2.5 6 0" />
      <path d="M32 42v4" />
      <rect x="20" y="46" width="24" height="18" rx="4" />
      <rect x="27" y="52" width="10" height="7" rx="2" />
      <path d="M26 64v10M38 64v10" />
      <path d="M22 74h8M34 74h8" />
    </svg>
  );
}

const DANCE_POSES = {
  up: { left: "M21 38 11 25", right: "M43 38 53 25", leftHand: [11, 25], rightHand: [53, 25] },
  out: { left: "M21 38 9 46", right: "M43 38 55 46", leftHand: [9, 46], rightHand: [55, 46] },
};

function RobotDancing({ pose = "up", wink = false }) {
  const arms = DANCE_POSES[pose] || DANCE_POSES.up;
  return (
    <svg
      className="robot robot-dancer"
      viewBox="0 0 64 76"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M32 14V8" />
      <circle cx="32" cy="6" r="1.8" fill="currentColor" stroke="none" />
      <rect x="22" y="14" width="20" height="16" rx="4" />
      <circle cx="28" cy="21" r="1.6" fill="currentColor" stroke="none" />
      {wink ? (
        <path d="M34 21h4" />
      ) : (
        <circle cx="36" cy="21" r="1.6" fill="currentColor" stroke="none" />
      )}
      <path d="M28 26q3 2 6 0" />
      <path d={arms.left} />
      <path d={arms.right} />
      <circle cx={arms.leftHand[0]} cy={arms.leftHand[1]} r="2" fill="currentColor" stroke="none" />
      <circle cx={arms.rightHand[0]} cy={arms.rightHand[1]} r="2" fill="currentColor" stroke="none" />
      <rect x="21" y="34" width="22" height="18" rx="4" />
      <rect x="27" y="40" width="10" height="6" rx="2" />
      <path d="M28 52v12M36 52v12" />
      <path d="M24 64h8M32 64h8" />
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
      {person && <p className="addressed script">for {person}</p>}
      <p className="hint">tap to open</p>
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
            opacity: h.opacity,
            ["--drift"]: `${h.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Ambient scene animations — one per stage. Everything is drawn from
   CSS shapes and monospace glyphs: bubbles, hex packets, a trace line
   and floating brackets. No emoji anywhere.
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
      size: 11 + rand() * 7,
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
          {`0x${(0x7f00 + j.id * 0x11).toString(16)}`}
        </span>
      ))}
    </div>
  );
}

function SnailScene() {
  return (
    <div className="scene" aria-hidden="true">
      <span className="trace" />
      <span className="snail">{"[==========>"}</span>
    </div>
  );
}

function PartyScene() {
  const robots = [
    { slot: "slot-a", pose: "up", wink: false },
    { slot: "slot-b", pose: "out", wink: true },
    { slot: "slot-c", pose: "up", wink: true },
  ];
  return (
    <div className="scene" aria-hidden="true">
      {robots.map((robot, i) => (
        <span
          key={robot.slot}
          className={`robot-slot ${robot.slot}`}
          style={{ animationDelay: `${i * 0.25}s` }}
        >
          <RobotDancing pose={robot.pose} wink={robot.wink} />
        </span>
      ))}
    </div>
  );
}

const DATE_IDEAS = ["Coffee", "Dinner", "A movie", "Stargazing", "Ice cream"];

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
    "Are you sure?",
    "Really sure?",
    "Think again…",
    "That button is getting tired",
    "You can't catch it anyway",
    "Just say yes already",
    "It's destiny at this point",
  ];
  const nudge = playfulLines[Math.min(noCount - 1, playfulLines.length - 1)];

  return (
    <div className="stage">
      <h2 className="title">{person ? `Hey ${person}` : "Hey you"}</h2>
      <p className="subtitle">There's something I've been meaning to ask…</p>

      <div className="card question-card">
        <p className="question">Will you go out with me?</p>

        <div className="buttons" ref={parentRef}>
          <button type="button" className="btn yes" style={{ ["--yes-scale"]: yesScale }} onClick={onYes}>
            Yes!
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
          404
        </span>
      )}

      {nudge && <p className="nudge">{nudge}</p>}

      <div className="robot-mascot">
        <RobotLifting />
        <span className="robot-caption">warming up for your answer</span>
      </div>

      <p className="teaser">Psst… the Yes button grows a little with every No.</p>
    </div>
  );
}

function Confirm({ onReallyYes, onRethink, person }) {
  return (
    <div className="stage">
      <h2 className="title">{person ? `WAIT… ${person}?!` : "WAIT… really?!"}</h2>
      <p className="subtitle">Did you really say yes? Because my heart just did a backflip.</p>
      <div className="card confirm-card">
        <span className="date-night-icon confirm-date-icon" aria-hidden="true"><i className="fa-solid fa-martini-glass-citrus" /></span>
        <div className="buttons confirm-buttons">
          <button type="button" className="btn yes" onClick={onReallyYes}>
            Yes, really!
          </button>
          <button type="button" className="btn rethink" onClick={onRethink}>
            Wait, let me rethink
          </button>
        </div>
      </div>
    </div>
  );
}

const DAY_OPTIONS = [
  "This Saturday",
  "This Sunday",
  "Next Friday",
  "Next weekend",
  "I'm flexible",
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
      ? "Great! Now pick a time."
      : pickedTime
        ? "Almost! Which day should I keep free?"
        : "Pick a day and a time — then lock it in.";

  return (
    <div className="stage">
      <h2 className="title">When are you free?</h2>
      <p className="subtitle">Two little steps so I can plan this properly.</p>
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
          {!pickedDay && <p className="step-hint">Choose a day first</p>}
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
              {prettyDay(pickedDay)} · {prettyTime(pickedTime)} — lock it in?
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
            Lock it in
          </button>
        </div>
      </div>
    </div>
  );
}

function DateReceipt({ date, time, person, idea, onContinue }) {
  const dateLabel = prettyDay(date);
  const timeLabel = prettyTime(time);

  const downloadReceipt = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1120;
    const context = canvas.getContext("2d");
    context.fillStyle = "#f8fbff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#d5e3f5";
    context.lineWidth = 3;
    context.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
    context.fillStyle = "#0c1d34";
    context.fillRect(0, 0, canvas.width, 260);
    context.textAlign = "center";
    context.fillStyle = "#7dd3fc";
    context.font = "500 27px monospace";
    context.fillText("A LITTLE SOMETHING TO LOOK FORWARD TO", 450, 82);
    context.fillStyle = "#f0f7ff";
    context.font = "700 66px sans-serif";
    context.fillText("DATE RECEIPT", 450, 166);
    context.save();
    context.translate(760, 174);
    context.rotate(-0.17);
    context.strokeStyle = "#fb7185";
    context.fillStyle = "#fb7185";
    context.lineWidth = 5;
    context.beginPath();
    context.arc(0, 0, 66, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(0, 0, 57, 0, Math.PI * 2);
    context.lineWidth = 2;
    context.stroke();
    context.textAlign = "center";
    context.font = "700 27px monospace";
    context.fillText("LOVE", 0, 3);
    context.font = "24px sans-serif";
    context.fillText("♥", 0, 34);
    context.restore();
    context.fillStyle = "#3b82f6";
    context.fillRect(84, 324, 732, 3);
    context.textAlign = "left";
    context.fillStyle = "#58708c";
    context.font = "500 25px monospace";
    context.fillText("RESERVED FOR", 100, 420);
    context.fillStyle = "#10243e";
    context.font = "600 42px sans-serif";
    context.fillText(person || "You & me", 100, 478);
    context.fillStyle = "#58708c";
    context.font = "500 25px monospace";
    context.fillText("DATE", 100, 590);
    context.fillStyle = "#10243e";
    context.font = "600 42px sans-serif";
    context.fillText(dateLabel, 100, 648);
    context.fillStyle = "#58708c";
    context.font = "500 25px monospace";
    context.fillText("TIME", 100, 738);
    context.fillStyle = "#10243e";
    context.font = "600 42px sans-serif";
    context.fillText(timeLabel, 100, 786);
    context.fillStyle = "#58708c";
    context.font = "500 25px monospace";
    context.fillText("DATE IDEA", 100, 878);
    context.fillStyle = "#10243e";
    context.font = "600 38px sans-serif";
    context.fillText(idea, 100, 928, 700);
    context.setLineDash([10, 12]);
    context.strokeStyle = "#b9c9dc";
    context.beginPath();
    context.moveTo(84, 980);
    context.lineTo(816, 980);
    context.stroke();
    context.setLineDash([]);
    context.textAlign = "center";
    context.fillStyle = "#2563eb";
    context.font = "600 27px sans-serif";
    context.fillText("One date. Two people. A good story.", 450, 1030);
    context.fillStyle = "#718198";
    context.font = "22px monospace";
    context.fillText("CONFIRMED WITH A YES", 450, 1080);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "date-receipt.png";
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <div className="stage receipt-stage">
      <h2 className="title">It's officially a date</h2>
      <p className="subtitle">Here's your little receipt. Save it for the big day.</p>
      <p className="receipt-note">
        {person
          ? `${person}, your date is officially on the books! Download this little receipt before your future self asks, “Wait, what time was it?”`
          : "Your date is officially on the books! Download this little receipt before your future self asks, “Wait, what time was it?”"}
      </p>
      <div className="date-receipt" aria-label={`Date receipt for ${dateLabel} at ${timeLabel}`}>
        <div className="receipt-top">
          <span className="receipt-mark"><Logo /></span>
          <span className="receipt-kicker">A LITTLE SOMETHING TO LOOK FORWARD TO</span>
          <h3>DATE RECEIPT</h3>
          <span className="receipt-status"><i /> CONFIRMED</span>
          <span className="receipt-love-stamp" aria-label="Stamped with love"><b>LOVE</b><i>♥</i></span>
        </div>
        <div className="receipt-details">
          <div className="receipt-line">
            <span>RESERVED FOR</span>
            <strong>{person || "You & me"}</strong>
          </div>
          <div className="receipt-line">
            <span>DATE</span>
            <strong>{dateLabel}</strong>
          </div>
          <div className="receipt-line">
            <span>TIME</span>
            <strong>{timeLabel}</strong>
          </div>
          <div className="receipt-line">
            <span>DATE IDEA</span>
            <strong>{idea}</strong>
          </div>
        </div>
        <div className="receipt-total">
          <span>THE PLAN</span>
          <strong>One date. Two people. A good story.</strong>
        </div>
        <p className="receipt-footer">KEEP THIS SOMEWHERE SAFE</p>
      </div>
      <div className="receipt-actions">
        <button type="button" className="btn yes" onClick={downloadReceipt}>Download receipt</button>
        <button type="button" className="btn rethink" onClick={onContinue}>Back to celebration</button>
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
        <h2 className="title">Not found</h2>
        <p className="subtitle">
          This letter isn't addressed to anyone — no invite found for this link.
        </p>
        <div className="card notfound-card">
          <p className="big-heart">404</p>
          <p>Double-check the link you were sent, or ask for a fresh one.</p>
        </div>
      </div>
    </div>
  );
}

function AskHerOut() {
  const [stage, setStage] = useState("envelope");
  const [chosen, setChosen] = useState([]);
  const [customIdeas, setCustomIdeas] = useState([]);
  const [customIdea, setCustomIdea] = useState("");
  const [datePlan, setDatePlan] = useState(null);
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
    setDatePlan({ day, time });
    setStage("celebration");
    if (rowIdRef.current == null) {
      const id = await postAnswer({ accepted: true });
      if (id != null) rowIdRef.current = id;
    }
    if (rowIdRef.current != null) {
      postAnswer({ accepted: true, date_text: day, time_text: time || "", row_id: rowIdRef.current });
    }
  };

  const saveIdeas = (ideasToSave) => {
    const reason = ideasToSave.join(", ");
    if (rowIdRef.current != null) {
      postAnswer({ accepted: true, reason, row_id: rowIdRef.current });
    } else {
      // Yes-write still in flight: retry shortly with the row id once known.
      setTimeout(() => {
        if (rowIdRef.current != null) {
          postAnswer({ accepted: true, reason, row_id: rowIdRef.current });
        }
      }, 1500);
    }
  };

  const toggleIdea = (idea) => {
    setChosen((current) => {
      const next = current.includes(idea) ? current.filter((item) => item !== idea) : [...current, idea];
      saveIdeas(next);
      return next;
    });
  };

  const addCustomIdea = (value) => {
    const idea = value.trim();
    if (!idea) return;
    setCustomIdeas((current) => current.some((item) => item.toLowerCase() === idea.toLowerCase()) ? current : [...current, idea]);
    setChosen((current) => {
      if (current.includes(idea)) return current;
      const next = [...current, idea];
      saveIdeas(next);
      return next;
    });
    setCustomIdea("");
  };

  if (inviteState === "checking") {
    return (
      <div className="app">
        <HeartsRain count={8} />
        <div className="stage">
          <p className="hint">verifying invite…</p>
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

  if (stage === "receipt" && datePlan) {
    return (
      <div className="app">
        <HeartsRain count={16} />
        <DateReceipt date={datePlan.day} time={datePlan.time} person={person} idea={chosen.join(", ")} onContinue={() => setStage("celebration")} />
      </div>
    );
  }

  return (
    <div className="app celebrate">
      <HeartsRain count={40} />
      <Confetti />
      <PartyScene />
      <div className="stage">
        <h2 className="title">IT'S A DATE!</h2>
        <p className="subtitle">You just made my whole week.</p>
        <div className="card celebrate-card">
          <span className="date-night-icon" aria-hidden="true"><i className="fa-solid fa-martini-glass-citrus" /></span>
          <p>So… what are we doing?</p>
          <div className="chips">
            {[...ideas, ...customIdeas].map((idea) => (
              <button
                key={idea}
                type="button"
                className={`chip ${chosen.includes(idea) ? "chip-selected" : ""}`}
                aria-pressed={chosen.includes(idea)}
                onClick={() => toggleIdea(idea)}
              >
                {idea}
              </button>
            ))}
          </div>
          <form className="custom-idea-form" onSubmit={(event) => { event.preventDefault(); addCustomIdea(customIdea); }}>
            <label htmlFor="custom-date-idea">Or suggest your own idea</label>
            <div className="custom-idea-row">
              <input id="custom-date-idea" value={customIdea} onChange={(event) => setCustomIdea(event.target.value)} maxLength={60} placeholder="Your fun date idea…" />
              <button type="submit" className="btn yes" disabled={!customIdea.trim()}>Add idea</button>
            </div>
          </form>
          {chosen.length > 0 && <p className="chosen">{chosen.length === 1 ? "Excellent choice. It's a plan!" : `${chosen.length} lovely ideas. It's a plan!`}</p>}
          {datePlan && chosen.length > 0 && (
            <button type="button" className="btn yes receipt-open-btn" onClick={() => setStage("receipt")}>
              View date receipt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
