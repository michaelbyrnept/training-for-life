import { useState, useEffect, useRef } from "react";
import { doc, getDoc, collection, addDoc, getDocs, query, where, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Link, useParams, useNavigate } from "react-router-dom";
import PortalNav from "../components/PortalNav";

const REP_QUICK = ["1", "2", "3", "4", "5", "6", "8", "10", "12", "15", "20"];
const WEIGHT_QUICK = ["BW", "5", "10", "15", "20", "25", "30", "40", "50", "60", "70", "80", "100", "120", "140"];
const DURATION_QUICK = ["10", "15", "20", "25", "30", "35", "40", "45", "50", "60"];
const RPE_OPTIONS = ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10"];

const EFFORT_LEVELS = [
  { id: "easy",     label: "Easy",     sub: "Conversational pace",  color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  { id: "moderate", label: "Moderate", sub: "Slightly breathless",  color: "#2d6a4f", bg: "#eaf5ef", border: "#6ee7b7" },
  { id: "brisk",    label: "Brisk",    sub: "Elevated heart rate",  color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  { id: "hard",     label: "Hard",     sub: "Difficult to talk",    color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
];

const ANIMALS = [
  { name: "a chihuahua", weight: 3, emoji: "🐕" },{ name: "a domestic cat", weight: 5, emoji: "🐱" },
  { name: "a cocker spaniel", weight: 12, emoji: "🐶" },{ name: "a labrador", weight: 30, emoji: "🐕" },
  { name: "a giant panda", weight: 100, emoji: "🐼" },{ name: "a male lion", weight: 190, emoji: "🦁" },
  { name: "a grizzly bear", weight: 360, emoji: "🐻" },{ name: "a moose", weight: 500, emoji: "🫎" },
  { name: "a grand piano", weight: 600, emoji: "🎹" },{ name: "a polar bear", weight: 700, emoji: "🐻‍❄️" },
  { name: "a dairy cow", weight: 750, emoji: "🐄" },{ name: "a Mini Cooper", weight: 1100, emoji: "🚗" },
  { name: "a small elephant", weight: 2500, emoji: "🐘" },{ name: "a hippo", weight: 3000, emoji: "🦛" },
  { name: "a T-Rex", weight: 8000, emoji: "🦖" },
];
function getAnimalComparison(kg) {
  let closest = ANIMALS[0], diff = Math.abs(kg - ANIMALS[0].weight);
  for (const a of ANIMALS) { const d = Math.abs(kg - a.weight); if (d < diff) { diff = d; closest = a; } }
  return closest;
}

function normalizeDate(val) {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (val.toDate) return val.toDate().toISOString();
  if (val.seconds) return new Date(val.seconds * 1000).toISOString();
  return null;
}

// ----------------------------------------------------------------
// Rest Timer
// ----------------------------------------------------------------
function RestTimer({ defaultSeconds = 90, onDismiss }) {
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) { clearInterval(intervalRef.current); setRunning(false); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); return 0; }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const adjust = (delta) => { setSeconds(s => Math.max(0, s + delta)); if (!running) setRunning(true); };
  const restart = (secs) => { clearInterval(intervalRef.current); setSeconds(secs); setRunning(true); };
  const mins = Math.floor(seconds / 60), secs = seconds % 60;
  const isDone = seconds === 0;
  const r = 54, circ = 2 * Math.PI * r, dash = circ * (seconds / defaultSeconds);

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
      <div style={{ backgroundColor: "#1a3a2a", borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 24px 48px" }}>
        <div style={{ width: 36, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, margin: "0 auto 24px" }} />
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.12em", textAlign: "center", margin: "0 0 20px" }}>{isDone ? "Rest complete" : "Rest timer"}</p>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ position: "relative", width: 140, height: 140 }}>
            <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle cx="70" cy="70" r={r} fill="none" stroke="#4ade80" strokeWidth="8" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              {isDone ? <span style={{ fontSize: 36, fontWeight: 800, color: "#4ade80" }}>Go!</span> : (
                <><span style={{ fontSize: 38, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{mins}:{String(secs).padStart(2, "0")}</span><span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>remaining</span></>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          {[-30, -10, +10, +30].map(delta => (
            <button key={delta} onClick={() => adjust(delta)} style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, color: delta < 0 ? "#fca5a5" : "#86efac", cursor: "pointer" }}>
              {delta > 0 ? `+${delta}s` : `${delta}s`}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
          {[60, 90, 120, 180, 240].map(s => (
            <button key={s} onClick={() => restart(s)} style={{ backgroundColor: seconds === s && running ? "#2d6a4f" : "rgba(255,255,255,0.08)", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setRunning(r => !r)} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", border: "none", borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer" }}>{running ? "Pause" : "Resume"}</button>
          <button onClick={onDismiss} style={{ flex: 2, backgroundColor: isDone ? "#4ade80" : "#2d6a4f", border: "none", borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 700, color: isDone ? "#1a3a2a" : "#fff", cursor: "pointer" }}>{isDone ? "Next set ✓" : "Skip rest"}</button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Log Sheet
// ----------------------------------------------------------------
function LogSheet({ field, current, suggestedWeight, onSave, onClose }) {
  const isReps = field === "reps";
  const isRpe = field === "rpe";
  const [value, setValue] = useState(current || (suggestedWeight ? String(suggestedWeight) : ""));
  const quick = isRpe ? RPE_OPTIONS : isReps ? REP_QUICK : WEIGHT_QUICK;

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", paddingBottom: 32 }}>
        <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2, margin: "12px auto 8px" }} />
        <div style={{ padding: "4px 16px 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>
          {isRpe ? "Log actual RPE" : isReps ? "Log reps" : "Log weight"}
        </div>
        {!isReps && !isRpe && suggestedWeight && (
          <div style={{ padding: "0 16px 10px" }}>
            <div onClick={() => onSave(String(suggestedWeight))} style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 20, padding: "6px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>⚡ Use suggested: {suggestedWeight}kg</span>
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, padding: "0 16px 14px", overflowX: "auto" }}>
          {quick.map(v => (
            <div key={v} onClick={() => onSave(String(v))} style={{ flexShrink: 0, minWidth: 52, padding: "10px 14px", borderRadius: 10, border: "0.5px solid #e5e5e5", fontSize: 15, fontWeight: 700, cursor: "pointer", backgroundColor: "#f7f5f2", color: "#111", textAlign: "center" }}>{v}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "0 16px" }}>
          <input autoFocus type="text" inputMode="decimal" placeholder={isRpe ? "e.g. 8.5" : isReps ? "e.g. 5" : suggestedWeight ? `${suggestedWeight}kg suggested` : "e.g. 100kg"} value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && value) onSave(value); }} style={{ flex: 1, border: "1.5px solid #2d6a4f", borderRadius: 12, padding: "14px 16px", fontSize: 18, fontWeight: 700, color: "#111", outline: "none", textAlign: "center" }} />
          <button onClick={() => { if (value) onSave(value); }} style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: 12, padding: "14px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Top Set + Back Off Card
// ----------------------------------------------------------------
function TopSetCard({ exercise, logs, openSheet, toggleSetDone, setRestTimer, onSwap, onViewHistory }) {
  const topSetLogs = logs[`${exercise.exerciseId}_top`] || [{ reps: null, weight: null, rpe: null, done: false }];
  const backOffLogs = logs[`${exercise.exerciseId}_backoff`] || Array.from({ length: exercise.backOff?.sets || 3 }, () => ({ reps: null, weight: null, done: false }));

  // Get top set weight for back-off suggestion
  const topSetWeight = topSetLogs.find(s => s.weight)?.weight;
  const pct = exercise.backOff?.pct || 80;
  const suggestedBackOff = topSetWeight ? Math.round(parseFloat(topSetWeight) * (pct / 100)) : null;

  const embedUrl = (() => {
    const url = exercise.videoUrl || "";
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  })();

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "0.5px solid #e5e5e5", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "16px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: 0 }}>{exercise.name}</h2>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#0369a1", backgroundColor: "#e0f2fe", padding: "2px 8px", borderRadius: 20 }}>Top Set + Back Off</span>
              {exercise.isSwapped && <span style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", backgroundColor: "#f5f3ff", padding: "2px 8px", borderRadius: 20 }}>Your swap</span>}
            </div>
          </div>
          <button onClick={onSwap} style={{ flexShrink: 0, backgroundColor: "#f7f5f2", border: "1px solid #e5e5e5", borderRadius: 10, padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "#555", cursor: "pointer" }}>🔄 Swap</button>
        </div>
        {exercise.description && <p style={{ fontSize: 13, color: "#666", margin: "0 0 8px", lineHeight: 1.5 }}>{exercise.description}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div onClick={onViewHistory} style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f" }}>📊 View full history</span>
          </div>
          <Link to={`/exercise/${exercise.exerciseId}`} style={{ fontSize: 12, fontWeight: 700, color: "#888", textDecoration: "none" }}>
            📖 Exercise guide
          </Link>
        </div>
      </div>

      {exercise.coachingNotes && (
        <div style={{ backgroundColor: "#eaf5ef", padding: "10px 16px" }}>
          <p style={{ fontSize: 12, color: "#1a4a35", lineHeight: 1.6, margin: 0 }}>{exercise.coachingNotes}</p>
        </div>
      )}

      {embedUrl && (
        <div style={{ padding: "12px 16px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Exercise Demo</p>
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}>
            <iframe src={embedUrl} title={exercise.name} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
          </div>
        </div>
      )}

      {/* TOP SET section */}
      <div style={{ backgroundColor: "#e0f2fe", padding: "10px 16px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Top Set</p>
          <span style={{ fontSize: 11, color: "#0369a1", fontWeight: 600 }}>
            {exercise.topSet?.repsMin}-{exercise.topSet?.repsMax} reps · Target RPE {exercise.topSet?.rpe}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 36px", gap: 6, padding: "4px 0 10px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#0369a1", textAlign: "center", textTransform: "uppercase" }}>Reps</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#0369a1", textAlign: "center", textTransform: "uppercase" }}>Weight</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#0369a1", textAlign: "center", textTransform: "uppercase" }}>Actual RPE</div>
          <div />
          {topSetLogs.map((s, i) => (
            <>
              <div key={`reps-${i}`} onClick={() => openSheet(`${exercise.exerciseId}_top`, i, "reps")} style={{ backgroundColor: s.reps ? "#bae6fd" : "#fff", border: s.reps ? "0.5px solid #0369a1" : "0.5px solid #bae6fd", borderRadius: 8, padding: "10px 4px", textAlign: "center", fontSize: 14, fontWeight: 700, color: s.reps ? "#0c4a6e" : "#93c5fd", cursor: "pointer" }}>
                {s.reps || "—"}
              </div>
              <div key={`weight-${i}`} onClick={() => openSheet(`${exercise.exerciseId}_top`, i, "weight")} style={{ backgroundColor: s.weight ? "#bae6fd" : "#fff", border: s.weight ? "0.5px solid #0369a1" : "0.5px solid #bae6fd", borderRadius: 8, padding: "10px 4px", textAlign: "center", fontSize: 14, fontWeight: 700, color: s.weight ? "#0c4a6e" : "#93c5fd", cursor: "pointer" }}>
                {s.weight || "—"}
              </div>
              <div key={`rpe-${i}`} onClick={() => openSheet(`${exercise.exerciseId}_top`, i, "rpe")} style={{ backgroundColor: s.rpe ? "#bae6fd" : "#fff", border: s.rpe ? "0.5px solid #0369a1" : "0.5px solid #bae6fd", borderRadius: 8, padding: "10px 4px", textAlign: "center", fontSize: 14, fontWeight: 700, color: s.rpe ? "#0c4a6e" : "#93c5fd", cursor: "pointer" }}>
                {s.rpe || "—"}
              </div>
              <div key={`done-${i}`} onClick={() => toggleSetDone(`${exercise.exerciseId}_top`, i)} style={{ width: 32, height: 32, borderRadius: "50%", border: s.done ? "none" : "1.5px solid #93c5fd", backgroundColor: s.done ? "#0369a1" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", margin: "0 auto" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke={s.done ? "#fff" : "#93c5fd"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </>
          ))}
        </div>
      </div>

      {/* Divider with percentage hint */}
      <div style={{ backgroundColor: "#0369a1", padding: "6px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>
          {suggestedBackOff
            ? `Back off at ${pct}% of top set = ${suggestedBackOff}kg suggested`
            : `Back off sets at ${pct}% of your top set`}
        </span>
      </div>

      {/* BACK OFF section */}
      <div style={{ backgroundColor: "#f0f9ff", padding: "10px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Back Off Sets</p>
          <span style={{ fontSize: 11, color: "#0369a1", fontWeight: 600 }}>
            {exercise.backOff?.sets || 3} sets · {exercise.backOff?.repsMin}-{exercise.backOff?.repsMax} reps
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 36px", gap: 6, padding: "4px 0 6px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#0369a1", textTransform: "uppercase" }}>#</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#0369a1", textAlign: "center", textTransform: "uppercase" }}>Reps</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#0369a1", textAlign: "center", textTransform: "uppercase" }}>Weight</div>
          <div />
          {backOffLogs.map((s, i) => (
            <>
              <span key={`num-${i}`} style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd", alignSelf: "center" }}>{i + 1}</span>
              <div key={`reps-${i}`} onClick={() => openSheet(`${exercise.exerciseId}_backoff`, i, "reps")} style={{ backgroundColor: s.reps ? "#bae6fd" : "#fff", border: s.reps ? "0.5px solid #0369a1" : "0.5px solid #bae6fd", borderRadius: 8, padding: "10px 4px", textAlign: "center", fontSize: 14, fontWeight: 700, color: s.reps ? "#0c4a6e" : "#93c5fd", cursor: "pointer" }}>
                {s.reps || "—"}
              </div>
              <div key={`weight-${i}`} onClick={() => openSheet(`${exercise.exerciseId}_backoff`, i, "weight", suggestedBackOff)} style={{ backgroundColor: s.weight ? "#bae6fd" : (suggestedBackOff ? "#fffbeb" : "#fff"), border: s.weight ? "0.5px solid #0369a1" : (suggestedBackOff ? "0.5px solid #f59e0b" : "0.5px solid #bae6fd"), borderRadius: 8, padding: "10px 4px", textAlign: "center", fontSize: 14, fontWeight: 700, color: s.weight ? "#0c4a6e" : (suggestedBackOff ? "#92400e" : "#93c5fd"), cursor: "pointer" }}>
                {s.weight || (suggestedBackOff ? `${suggestedBackOff}` : "—")}
              </div>
              <div key={`done-${i}`} onClick={() => toggleSetDone(`${exercise.exerciseId}_backoff`, i)} style={{ width: 32, height: 32, borderRadius: "50%", border: s.done ? "none" : "1.5px solid #93c5fd", backgroundColor: s.done ? "#0369a1" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", margin: "0 auto" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke={s.done ? "#fff" : "#93c5fd"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </>
          ))}
        </div>
        <button onClick={() => setRestTimer({ defaultSeconds: 180 })} style={{ background: "none", border: "none", color: "#0369a1", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "6px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
          ⏱ Rest timer
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Standard Exercise Card
// ----------------------------------------------------------------
function ExerciseCard({ exercise, exerciseLogs, isCardio, repRange, openSheet, toggleSetDone, addSet, updateCardioField, toggleCardioDone, onSwap, onViewHistory }) {
  const embedUrl = (() => {
    const url = exercise.videoUrl || "";
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  })();

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
      <div style={{ padding: "16px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {isCardio && <span style={{ fontSize: 18 }}>🏃</span>}
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: 0 }}>{exercise.name}</h2>
              {exercise.countPerSide && <span style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", backgroundColor: "#f5f3ff", padding: "2px 8px", borderRadius: 20 }}>per side</span>}
              {exercise.isSwapped && <span style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", backgroundColor: "#f5f3ff", padding: "2px 8px", borderRadius: 20 }}>Your swap</span>}
            </div>
          </div>
          <button onClick={onSwap} style={{ flexShrink: 0, backgroundColor: "#f7f5f2", border: "1px solid #e5e5e5", borderRadius: 10, padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "#555", cursor: "pointer" }}>🔄 Swap</button>
        </div>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 8px", lineHeight: 1.5 }}>{exercise.description}</p>
        {!isCardio && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div onClick={onViewHistory} style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f" }}>📊 View full history</span>
            </div>
            <Link to={`/exercise/${exercise.exerciseId}`} style={{ fontSize: 12, fontWeight: 700, color: "#888", textDecoration: "none" }}>
              📖 Exercise guide
            </Link>
          </div>
        )}
        {isCardio ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: "#0369a1", backgroundColor: "#e0f2fe", padding: "3px 10px", borderRadius: 20 }}>
            {exercise.defaultDuration || 30} min · {exercise.defaultEffort || "moderate"}
          </span>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "3px 10px", borderRadius: 20 }}>
            {exercise.sets || 3} sets · {repRange} reps
          </span>
        )}
      </div>

      {exercise.coachingNotes && (
        <div style={{ backgroundColor: "#eaf5ef", padding: "10px 16px" }}>
          <p style={{ fontSize: 12, color: "#1a4a35", lineHeight: 1.6, margin: 0 }}>{exercise.coachingNotes}</p>
        </div>
      )}

      {embedUrl && (
        <div style={{ padding: "12px 16px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Exercise Demo</p>
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}>
            <iframe src={embedUrl} title={exercise.name} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
          </div>
        </div>
      )}

      {isCardio ? (
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Log This Session</p>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Duration (minutes)</p>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 8 }}>
              {DURATION_QUICK.map(d => (
                <div key={d} onClick={() => updateCardioField(exercise.exerciseId, "duration", d)} style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 10, border: String(exerciseLogs.duration) === d ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: String(exerciseLogs.duration) === d ? "#eaf5ef" : "#f7f5f2", fontSize: 13, fontWeight: 700, color: String(exerciseLogs.duration) === d ? "#2d6a4f" : "#111", cursor: "pointer" }}>{d}</div>
              ))}
            </div>
            <input type="number" value={exerciseLogs.duration || ""} onChange={e => updateCardioField(exercise.exerciseId, "duration", e.target.value)} placeholder="Or type duration..." style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e5e5", fontSize: 15, fontWeight: 700, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Distance (optional)</p>
            <input type="text" value={exerciseLogs.distance || ""} onChange={e => updateCardioField(exercise.exerciseId, "distance", e.target.value)} placeholder="e.g. 3.2km" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e5e5", fontSize: 15, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#555", margin: "0 0 8px" }}>How did it feel?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {EFFORT_LEVELS.map(e => (
                <div key={e.id} onClick={() => updateCardioField(exercise.exerciseId, "effort", e.id)} style={{ padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${exerciseLogs.effort === e.id ? e.border : "#e5e5e5"}`, backgroundColor: exerciseLogs.effort === e.id ? e.bg : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div><p style={{ fontSize: 14, fontWeight: 700, color: exerciseLogs.effort === e.id ? e.color : "#111", margin: 0 }}>{e.label}</p><p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>{e.sub}</p></div>
                  {exerciseLogs.effort === e.id && <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" fill={e.color}/><path d="M5 9l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => toggleCardioDone(exercise.exerciseId)} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", backgroundColor: exerciseLogs.done ? "#2d6a4f" : "#f0f0f0", color: exerciseLogs.done ? "#fff" : "#888", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            {exerciseLogs.done ? "Session Complete ✓" : "Mark as Complete"}
          </button>
        </div>
      ) : (
        <div style={{ padding: "0 16px 8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 1fr 36px", gap: 6, padding: "10px 4px 6px", borderBottom: "0.5px solid #f0f0f0" }}>
            {["#", "Reps", "Weight", "Last", ""].map((h, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#aaa", textAlign: i === 0 ? "left" : "center" }}>{h}</span>
            ))}
          </div>
          {Array.isArray(exerciseLogs) && exerciseLogs.map((s, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 1fr 36px", gap: 6, padding: "8px 4px", borderBottom: "0.5px solid #f5f5f5", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#aaa" }}>{i + 1}</span>
              <div onClick={() => openSheet(exercise.exerciseId, i, "reps")} style={{ backgroundColor: s.reps ? "#eaf5ef" : "#f7f5f2", border: s.reps ? "0.5px solid #2d6a4f" : "0.5px solid #e5e5e5", borderRadius: 8, padding: "8px 4px", textAlign: "center", fontSize: 14, fontWeight: 700, color: s.reps ? "#1a4a35" : "#bbb", cursor: "pointer" }}>{s.reps || "—"}</div>
              <div onClick={() => openSheet(exercise.exerciseId, i, "weight")} style={{ backgroundColor: s.weight ? "#eaf5ef" : "#f7f5f2", border: s.weight ? "0.5px solid #2d6a4f" : "0.5px solid #e5e5e5", borderRadius: 8, padding: "8px 4px", textAlign: "center", fontSize: 14, fontWeight: 700, color: s.weight ? "#1a4a35" : "#bbb", cursor: "pointer" }}>{s.weight || "—"}</div>
              <div style={{ textAlign: "center", fontSize: 12, color: "#aaa" }}>—</div>
              <div onClick={() => toggleSetDone(exercise.exerciseId, i)} style={{ width: 32, height: 32, borderRadius: "50%", border: s.done ? "none" : "1.5px solid #e5e5e5", backgroundColor: s.done ? "#2d6a4f" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", margin: "0 auto" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke={s.done ? "#fff" : "#ccc"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          ))}
          <button onClick={() => addSet(exercise.exerciseId)} style={{ background: "none", border: "none", color: "#2d6a4f", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "8px 4px 4px" }}>+ Add set</button>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Swap Sheet
// ----------------------------------------------------------------
function SwapSheet({ exercise, userProfile, userPreferences, onSwap, onClose }) {
  const [swapAlternatives, setSwapAlternatives] = useState([]);
  const [browseSearch, setBrowseSearch] = useState("");
  const [browseResults, setBrowseResults] = useState([]);
  const [showBrowse, setShowBrowse] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingAlts, setLoadingAlts] = useState(true);

  const isPremium = userProfile?.subscription === "premium" || userProfile?.subscription === "hybrid" || userProfile?.subscription === "in-person" || userProfile?.tier === "admin";
  const isHybridOrInPerson = userProfile?.subscription === "hybrid" || userProfile?.subscription === "in-person" || userProfile?.tier === "admin";
  const currentPref = userPreferences[exercise.name];

  // Use workout-level swaps if set, otherwise fall back to exercise-level master swaps
  const swapSource = exercise.workoutSwapAlternatives?.length > 0
    ? exercise.workoutSwapAlternatives
    : exercise.swapAlternatives || [];

  useEffect(() => {
    async function loadAlts() {
      const alts = [];
      if (currentPref) {
        try {
          const q = query(collection(db, "exercises"), where("name", "==", exercise.originalName || exercise.name));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const d = snap.docs[0].data();
            alts.push({ id: snap.docs[0].id, name: exercise.originalName || exercise.name, isOriginal: true, description: d.description || "", videoUrl: d.videoUrl || "" });
          }
        } catch {}
      }
      for (const alt of swapSource) {
        if (alt.name === (currentPref?.name || exercise.name)) continue;
        try {
          const q = query(collection(db, "exercises"), where("name", "==", alt.name));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const d = snap.docs[0].data();
            alts.push({ id: snap.docs[0].id, name: alt.name, description: d.description || "", videoUrl: d.videoUrl || "" });
          } else {
            alts.push({ id: alt.id, name: alt.name, description: "", videoUrl: "" });
          }
        } catch { alts.push({ id: alt.id, name: alt.name, description: "", videoUrl: "" }); }
      }
      setSwapAlternatives(alts);
      setLoadingAlts(false);
    }
    loadAlts();
  }, [exercise]);

  const handleBrowseSearch = async (term) => {
    setBrowseSearch(term);
    if (term.trim().length < 2) { setBrowseResults([]); return; }
    setSearching(true);
    try {
      const snap = await getDocs(collection(db, "exercises"));
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.name.toLowerCase().includes(term.toLowerCase()) && e.name !== exercise.name && e.type !== "cardio");
      setBrowseResults(results.slice(0, 10));
    } catch {}
    setSearching(false);
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", paddingBottom: 40, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2, margin: "12px auto 0" }} />
        <div style={{ padding: "16px 20px 12px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Swap exercise</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>{currentPref?.name || exercise.name}</h2>
          {!isPremium && (
            <div style={{ backgroundColor: "#fef9c3", border: "1px solid #fcd34d", borderRadius: 10, padding: "10px 14px", marginTop: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#854d0e", margin: "0 0 2px" }}>🔒 Premium feature</p>
              <p style={{ fontSize: 12, color: "#92400e", margin: 0 }}>Upgrade to premium to swap exercises and save your preferences.</p>
            </div>
          )}
          {isPremium && <p style={{ fontSize: 13, color: "#888", margin: 0 }}>Your choice saves automatically and loads next time.</p>}
        </div>
        {isPremium && (
          <>
            {loadingAlts ? (
              <p style={{ textAlign: "center", color: "#888", fontSize: 13, padding: "20px 0" }}>Loading...</p>
            ) : swapAlternatives.length > 0 ? (
              <div style={{ padding: "0 20px 8px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
                  {isHybridOrInPerson ? "Recommended alternatives" : "Available swaps"}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {swapAlternatives.map(alt => (
                    <div key={alt.id} onClick={() => onSwap(alt)} style={{ backgroundColor: alt.isOriginal ? "#f0fdf4" : "#f7f5f2", border: `1px solid ${alt.isOriginal ? "#86efac" : "#e5e5e5"}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: 0 }}>{alt.name}</p>
                        {alt.isOriginal && <p style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, margin: "2px 0 0" }}>Reset to original</p>}
                        {alt.description && !alt.isOriginal && <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>{alt.description}</p>}
                      </div>
                      <span style={{ fontSize: 20, color: "#ccc" }}>&rsaquo;</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ textAlign: "center", color: "#aaa", fontSize: 13, padding: "12px 20px" }}>No swap alternatives set up for this exercise yet.</p>
            )}
            {isHybridOrInPerson && (
              <div style={{ padding: "12px 20px 0", borderTop: swapAlternatives.length > 0 ? "1px solid #f0f0f0" : "none", marginTop: 8 }}>
                {!showBrowse ? (
                  <button onClick={() => setShowBrowse(true)} style={{ width: "100%", backgroundColor: "#f7f5f2", border: "1px solid #e5e5e5", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, color: "#555", cursor: "pointer" }}>Browse full exercise library</button>
                ) : (
                  <>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Full library</p>
                    <input autoFocus placeholder="Search any exercise..." value={browseSearch} onChange={e => handleBrowseSearch(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #2d6a4f", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
                    {searching && <p style={{ fontSize: 12, color: "#888", textAlign: "center" }}>Searching...</p>}
                    {browseResults.map(ex => (
                      <div key={ex.id} onClick={() => onSwap({ id: ex.id, name: ex.name, description: ex.description || "", videoUrl: ex.videoUrl || "" })} style={{ backgroundColor: "#f7f5f2", borderRadius: 10, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div><p style={{ fontSize: 14, fontWeight: 700, color: "#111", margin: 0 }}>{ex.name}</p><p style={{ fontSize: 11, color: "#888", margin: "2px 0 0" }}>{ex.muscleGroup}</p></div>
                        <span style={{ fontSize: 20, color: "#ccc" }}>&rsaquo;</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}
        <div style={{ padding: "16px 20px 0" }}>
          <button onClick={onClose} style={{ width: "100%", backgroundColor: "#f0f0f0", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, color: "#555", cursor: "pointer" }}>{isPremium ? "Cancel" : "Close"}</button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// History Sheet
// ----------------------------------------------------------------
function HistorySheet({ exerciseName, history, onClose }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "75vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>{exerciseName}</h2>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px" }}>Combined from your solo training and classes</p>

        {history.length === 0 ? (
          <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "24px 0" }}>No history yet for this exercise.</p>
        ) : (
          <>
            <div style={{ backgroundColor: "#eaf5ef", borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Personal Best</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#1a3a2a", margin: 0 }}>{Math.max(...history.map(h => h.weight || 0))}kg</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((h, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "0.5px solid #f5f5f5" }}>
                  <div>
                    <p style={{ fontSize: 13, color: "#111", fontWeight: 600, margin: 0 }}>
                      {new Date(h.date).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" })}
                    </p>
                    <p style={{ fontSize: 11, color: "#aaa", margin: "2px 0 0" }}>
                      {h.source === "class" ? `Class · ${h.classTitle || ""}` : "Solo training"}
                    </p>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{h.weight}kg × {h.reps}</p>
                </div>
              ))}
            </div>
          </>
        )}
        <button onClick={onClose} style={{ width: "100%", background: "#f0f0f0", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, color: "#555", cursor: "pointer", marginTop: 16 }}>Close</button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Main Workout Component
// ----------------------------------------------------------------
export default function Workout() {
  const { programmeId, weekId, workoutId } = useParams();
  const navigate = useNavigate();
  const storageKey = `tfl_workout_${workoutId}`;
  localStorage.setItem(`tfl_workout_${workoutId}_programme`, programmeId);
  localStorage.setItem(`tfl_workout_${workoutId}_week`, weekId);

  const [workout, setWorkout] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(() => {
    try { return parseInt(localStorage.getItem(`${storageKey}_index`) || "0"); } catch { return 0; }
  });
  const [logs, setLogs] = useState(() => {
    try { const saved = localStorage.getItem(storageKey); return saved ? JSON.parse(saved) : {}; } catch { return {}; }
  });
  const [sheet, setSheet] = useState(null);
  const [swapSheet, setSwapSheet] = useState(null);
  const [restTimer, setRestTimer] = useState(null);
  const [progressionModal, setProgressionModal] = useState(null);
  const [nextWeight, setNextWeight] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userPreferences, setUserPreferences] = useState({});
  const [allWorkoutLogs, setAllWorkoutLogs] = useState([]);
  const [allClassLogs, setAllClassLogs] = useState([]);
  const [historyExercise, setHistoryExercise] = useState(null); // { id, name } or null

  const exerciseGroups = (() => {
    const groups = [];
    let i = 0;
    while (i < exercises.length) {
      const ex = exercises[i];
      const nextEx = exercises[i + 1];
      if (ex.supersetWith && nextEx && ex.supersetWith === nextEx.exerciseId) {
        groups.push({ type: "superset", exercises: [ex, nextEx] });
        i += 2;
      } else {
        groups.push({ type: "single", exercises: [ex] });
        i += 1;
      }
    }
    return groups;
  })();

  const logsRef = useRef(logs);
  useEffect(() => { logsRef.current = logs; try { localStorage.setItem(storageKey, JSON.stringify(logs)); } catch {} }, [logs, storageKey]);
  useEffect(() => { try { localStorage.setItem(`${storageKey}_index`, String(currentIndex)); } catch {} }, [currentIndex, storageKey]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged ? auth.onAuthStateChanged(async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) { const d = snap.data(); setUserProfile(d); setUserPreferences(d.exercisePreferences || {}); }

        const wlSnap = await getDocs(query(collection(db, "workoutLogs"), where("userId", "==", u.uid)));
        const wlData = wlSnap.docs
          .map(dd => ({ id: dd.id, ...dd.data(), completedAt: normalizeDate(dd.data().completedAt) }))
          .filter(l => l.completedAt);
        setAllWorkoutLogs(wlData);

        const clSnap = await getDocs(query(collection(db, "classLogs"), where("userId", "==", u.uid)));
        const clData = clSnap.docs
          .map(dd => ({ id: dd.id, ...dd.data(), completedAt: normalizeDate(dd.data().completedAt) }))
          .filter(l => l.completedAt);
        setAllClassLogs(clData);
      }
    }) : null;
    return () => { if (unsub) unsub(); };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const workoutSnap = await getDoc(doc(db, "workouts", workoutId));
      if (!workoutSnap.exists()) { setLoading(false); return; }
      const workoutData = { id: workoutSnap.id, ...workoutSnap.data() };
      setWorkout(workoutData);
      if (workoutData.exercises?.length > 0) {
        const snaps = await Promise.all(workoutData.exercises.map(e => getDoc(doc(db, "exercises", e.exerciseId))));
        const data = await Promise.all(snaps.map(async (s, i) => {
          const workoutEx = workoutData.exercises[i];
          const base = { ...workoutEx, ...s.data(), exerciseId: s.id };
          const pref = userPreferences[base.name];
          if (pref) {
            try {
              const q = query(collection(db, "exercises"), where("name", "==", pref.name));
              const prefSnap = await getDocs(q);
              if (!prefSnap.empty) {
                const prefData = prefSnap.docs[0].data();
                return { ...base, originalName: base.name, name: pref.name, isSwapped: true, description: prefData.description || base.description, coachingNotes: prefData.coachingNotes || base.coachingNotes, videoUrl: prefData.videoUrl || base.videoUrl, swapAlternatives: prefData.swapAlternatives || base.swapAlternatives || [], workoutSwapAlternatives: workoutEx.workoutSwapAlternatives || [] };
              }
            } catch {}
          }
          return { ...base, originalName: base.name, swapAlternatives: s.data()?.swapAlternatives || [], workoutSwapAlternatives: workoutEx.workoutSwapAlternatives || [] };
        }));
        setExercises(data);
        const existingLogs = logsRef.current;
        if (Object.keys(existingLogs).length === 0) {
          const initialLogs = {};
          data.forEach(ex => {
            if (ex.type === "cardio") {
              initialLogs[ex.exerciseId] = { duration: ex.defaultDuration || 30, distance: "", effort: ex.defaultEffort || "moderate", done: false };
            } else if (ex.topSetMode) {
              initialLogs[`${ex.exerciseId}_top`] = [{ reps: null, weight: null, rpe: null, done: false }];
              initialLogs[`${ex.exerciseId}_backoff`] = Array.from({ length: ex.backOff?.sets || 3 }, () => ({ reps: null, weight: null, done: false }));
            } else {
              initialLogs[ex.exerciseId] = Array.from({ length: ex.sets || 3 }, () => ({ reps: null, weight: null, done: false }));
            }
          });
          setLogs(initialLogs);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [workoutId, userPreferences]);

  const buildHistory = (exerciseId) => {
    const entries = [];

    allWorkoutLogs.forEach(log => {
      const sets = [
        ...(Array.isArray(log.logs?.[exerciseId]) ? log.logs[exerciseId] : []),
        ...(Array.isArray(log.logs?.[`${exerciseId}_top`]) ? log.logs[`${exerciseId}_top`] : []),
        ...(Array.isArray(log.logs?.[`${exerciseId}_backoff`]) ? log.logs[`${exerciseId}_backoff`] : []),
      ];
      const doneSets = sets.filter(s => s.done && s.weight && s.reps);
      if (doneSets.length > 0) {
        const best = doneSets.reduce((a, b) => (parseFloat(b.weight) > parseFloat(a.weight) ? b : a));
        entries.push({ date: log.completedAt, weight: parseFloat(best.weight), reps: best.reps, source: "solo" });
      }
    });

    allClassLogs.forEach(log => {
      const l = log.logs?.[exerciseId];
      if (l?.weight && l?.reps) {
        entries.push({ date: log.completedAt, weight: parseFloat(l.weight) || l.weight, reps: l.reps, source: "class", classTitle: log.classTitle });
      }
    });

    return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // openSheet supports both standard exerciseId keys and top/backoff keys
  const openSheet = (logKey, setIndex, field, suggestedWeight) => setSheet({ logKey, setIndex, field, suggestedWeight });
  const closeSheet = () => setSheet(null);

  const saveValue = (value) => {
    if (!sheet) return;
    const { logKey, setIndex, field } = sheet;
    setLogs(prev => {
      const updated = Array.isArray(prev[logKey]) ? [...prev[logKey]] : [];
      if (!updated[setIndex]) updated[setIndex] = {};
      updated[setIndex] = { ...updated[setIndex], [field]: value };
      return { ...prev, [logKey]: updated };
    });
    closeSheet();
  };

  const toggleSetDone = (logKey, setIndex) => {
    setLogs(prev => {
      const updated = Array.isArray(prev[logKey]) ? [...prev[logKey]] : [];
      const s = updated[setIndex] || {};
      if (s.reps && s.weight) {
        const wasDone = s.done;
        updated[setIndex] = { ...s, done: !s.done };
        if (!wasDone) setTimeout(() => setRestTimer({ defaultSeconds: 120 }), 300);
        return { ...prev, [logKey]: updated };
      }
      return prev;
    });
  };

  const toggleCardioDone = (exerciseId) => {
    setLogs(prev => { const current = prev[exerciseId] || {}; return { ...prev, [exerciseId]: { ...current, done: !current.done } }; });
  };
  const updateCardioField = (exerciseId, field, value) => {
    setLogs(prev => { const current = prev[exerciseId] || {}; return { ...prev, [exerciseId]: { ...current, [field]: value } }; });
  };
  const addSet = (exerciseId) => {
    setLogs(prev => ({ ...prev, [exerciseId]: [...(prev[exerciseId] || []), { reps: null, weight: null, done: false }] }));
  };

  const handleSwap = async (exercise, newExercise) => {
    const user = auth.currentUser;
    const originalName = exercise.originalName || exercise.name;
    if (user) {
      const newPrefs = { ...userPreferences };
      if (newExercise.isOriginal) { delete newPrefs[originalName]; }
      else { newPrefs[originalName] = { id: newExercise.id, name: newExercise.name }; }
      setUserPreferences(newPrefs);
      try { await setDoc(doc(db, "users", user.uid), { exercisePreferences: newPrefs }, { merge: true }); } catch {}
    }
    setExercises(prev => prev.map(e => {
      if (e.exerciseId !== exercise.exerciseId) return e;
      return { ...e, name: newExercise.isOriginal ? originalName : newExercise.name, description: newExercise.description || "", videoUrl: newExercise.videoUrl || "", isSwapped: !newExercise.isOriginal };
    }));
    setSwapSheet(null);
  };

  const buildSummary = async (savedLogs) => {
    const user = auth.currentUser;
    let prevLogs = [];
    try { const prevSnap = await getDocs(query(collection(db, "workoutLogs"), where("userId", "==", user.uid))); prevLogs = prevSnap.docs.map(d => d.data()); } catch {}
    let totalVolume = 0;
    const exerciseSummaries = [], prs = [];
    exercises.forEach(ex => {
      if (ex.type === "cardio") {
        const exLogs = savedLogs[ex.exerciseId];
        if (exLogs) exerciseSummaries.push({ name: ex.name, type: "cardio", duration: exLogs.duration, distance: exLogs.distance, effort: exLogs.effort });
        return;
      }
      // Combine top set + back off for summary
      let allSets = [];
      if (ex.topSetMode) {
        allSets = [...(savedLogs[`${ex.exerciseId}_top`] || []), ...(savedLogs[`${ex.exerciseId}_backoff`] || [])];
      } else {
        allSets = savedLogs[ex.exerciseId] || [];
      }
      if (!Array.isArray(allSets)) return;
      const doneSets = allSets.filter(s => s.done && s.weight && s.reps);
      if (doneSets.length === 0) return;
      const multiplier = ex.countPerSide ? 2 : 1;
      const exVolume = doneSets.reduce((sum, s) => sum + ((parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0) * multiplier), 0);
      totalVolume += exVolume;
      const maxWeight = Math.max(...doneSets.map(s => parseFloat(s.weight) || 0));
      let prevBest = 0;
      prevLogs.forEach(log => {
        ["", "_top", "_backoff"].forEach(suffix => {
          const prevSets = log.logs?.[`${ex.exerciseId}${suffix}`];
          if (Array.isArray(prevSets)) prevSets.forEach(s => { if (s.done && parseFloat(s.weight) > prevBest) prevBest = parseFloat(s.weight); });
        });
      });
      const isPR = maxWeight > prevBest && prevBest > 0;
      const isFirstTime = prevBest === 0 && maxWeight > 0;
      if (isPR || isFirstTime) prs.push({ name: ex.name, weight: maxWeight, isPR, isFirstTime });
      exerciseSummaries.push({ name: ex.name, type: "strength", sets: doneSets.length, maxWeight, totalReps: doneSets.reduce((s, x) => s + (parseInt(x.reps) || 0), 0), volume: Math.round(exVolume), countPerSide: ex.countPerSide, isPR, isFirstTime });
    });
    return { workoutName: workout?.name || "Workout", exerciseSummaries, totalVolume: Math.round(totalVolume), prs, animal: getAnimalComparison(Math.round(totalVolume)), completedAt: new Date().toISOString() };
  };

  const finishWorkout = async () => {
    const user = auth.currentUser;
    if (!user || saving) return;
    setSaving(true);
    try {
      const now = new Date();
      const dayName = now.toLocaleDateString("en-IE", { weekday: "long", month: "long", day: "numeric" });
      const sessionLabel = `${workout?.name || "Workout"} — ${dayName}`;
      await addDoc(collection(db, "workoutLogs"), { userId: user.uid, workoutId, programmeId, weekId, logs, workoutName: workout?.name || "Workout", sessionLabel, completedAt: now.toISOString() });
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`${storageKey}_index`);
      const summary = await buildSummary(logs);
      setSummaryData(summary);
      setShowSummary(true);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  if (loading) return (<div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "80px" }}><PortalNav /><p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p></div>);
  if (!workout) return (<div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "80px" }}><PortalNav /><p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Workout not found.</p></div>);
  if (showSummary && summaryData) return <WorkoutSummary summary={summaryData} onDone={() => navigate("/dashboard")} />;

  const currentGroup = exerciseGroups[currentIndex];
  const isLast = currentIndex === exerciseGroups.length - 1;
  const isFirst = currentIndex === 0;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "80px", position: "relative" }}>
      {!sheet && !progressionModal && !swapSheet && !restTimer && !historyExercise && <PortalNav />}

      {Object.keys(logs).length > 0 && currentIndex > 0 && (
        <div style={{ backgroundColor: "#fef9c3", borderBottom: "1px solid #fde047", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#854d0e", fontWeight: 600 }}>↩ Resuming where you left off</span>
        </div>
      )}
      <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to={`/programme/${programmeId}/${weekId}`} style={{ fontSize: "13px", color: "#2d6a4f", fontWeight: 700, textDecoration: "none" }}>← Back</Link>
        <span style={{ fontSize: "13px", color: "#888", fontWeight: 500 }}>{workout.displayName || workout.name}</span>
      </div>

      <div style={{ height: "3px", backgroundColor: "#e5e5e5", margin: "0 16px" }}>
        <div style={{ height: "3px", backgroundColor: "#2d6a4f", borderRadius: "2px", width: `${((currentIndex + 1) / exerciseGroups.length) * 100}%`, transition: "width 0.3s ease" }} />
      </div>

      <div style={{ padding: "10px 16px 0", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#888" }}>
        {currentGroup?.type === "superset" ? `Superset ${currentIndex + 1} of ${exerciseGroups.length}` : `Exercise ${currentIndex + 1} of ${exerciseGroups.length}`}
      </div>

      {currentGroup && (
        <div style={{ margin: "8px 16px 0" }}>
          {currentGroup.type === "superset" ? (
            <div>
              <div style={{ backgroundColor: "#7c3aed", borderRadius: "12px 12px 0 0", padding: "8px 16px" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>⚡ Superset -- do A then B back to back, then rest</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {currentGroup.exercises.map((exercise, ei) => {
                  const isCardio = exercise.type === "cardio";
                  const exerciseLogs = logs[exercise.exerciseId] || (isCardio ? {} : []);
                  const repRange = `${exercise.repsMin || 8}-${exercise.repsMax || exercise.reps || 12}`;
                  return (
                    <div key={exercise.exerciseId} style={{ borderLeft: "3px solid #7c3aed" }}>
                      <div style={{ backgroundColor: "#faf5ff", padding: "6px 16px", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", backgroundColor: "#e9d5ff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>{ei === 0 ? "A" : "B"}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed" }}>Exercise {ei === 0 ? "A" : "B"}</span>
                      </div>
                      {exercise.topSetMode ? (
                        <TopSetCard exercise={exercise} logs={logs} openSheet={openSheet} toggleSetDone={toggleSetDone} setRestTimer={setRestTimer} onSwap={() => setSwapSheet(exercise)} onViewHistory={() => setHistoryExercise({ id: exercise.exerciseId, name: exercise.name })} />
                      ) : (
                        <ExerciseCard exercise={exercise} exerciseLogs={exerciseLogs} isCardio={isCardio} repRange={repRange} openSheet={(id, i, f) => openSheet(id, i, f)} toggleSetDone={toggleSetDone} addSet={addSet} updateCardioField={updateCardioField} toggleCardioDone={toggleCardioDone} onSwap={() => setSwapSheet(exercise)} onViewHistory={() => setHistoryExercise({ id: exercise.exerciseId, name: exercise.name })} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ backgroundColor: "#f3e8ff", borderRadius: "0 0 12px 12px", padding: "8px 16px", textAlign: "center" }}>
                <button onClick={() => setRestTimer({ defaultSeconds: 90 })} style={{ background: "none", border: "none", fontSize: 12, fontWeight: 700, color: "#7c3aed", cursor: "pointer" }}>⏱ Start rest timer</button>
              </div>
            </div>
          ) : (
            (() => {
              const exercise = currentGroup.exercises[0];
              const isCardio = exercise.type === "cardio";
              const exerciseLogs = logs[exercise.exerciseId] || (isCardio ? {} : []);
              const repRange = `${exercise.repsMin || 8}-${exercise.repsMax || exercise.reps || 12}`;
              if (exercise.topSetMode) {
                return <TopSetCard exercise={exercise} logs={logs} openSheet={openSheet} toggleSetDone={toggleSetDone} setRestTimer={setRestTimer} onSwap={() => setSwapSheet(exercise)} onViewHistory={() => setHistoryExercise({ id: exercise.exerciseId, name: exercise.name })} />;
              }
              return <ExerciseCard exercise={exercise} exerciseLogs={exerciseLogs} isCardio={isCardio} repRange={repRange} openSheet={(id, i, f) => openSheet(id, i, f)} toggleSetDone={toggleSetDone} addSet={addSet} updateCardioField={updateCardioField} toggleCardioDone={toggleCardioDone} onSwap={() => setSwapSheet(exercise)} onViewHistory={() => setHistoryExercise({ id: exercise.exerciseId, name: exercise.name })} />;
            })()
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", padding: "12px 16px" }}>
        {!isFirst && <button onClick={() => setCurrentIndex(i => i - 1)} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "0.5px solid #e5e5e5", backgroundColor: "#fff", fontSize: "15px", fontWeight: 700, cursor: "pointer", color: "#111" }}>← Previous</button>}
        {!isLast ? (
          <button onClick={() => setCurrentIndex(i => i + 1)} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "none", backgroundColor: "#2d6a4f", fontSize: "15px", fontWeight: 700, cursor: "pointer", color: "#fff" }}>Next →</button>
        ) : (
          <button onClick={() => setShowFinishConfirm(true)} disabled={saving} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "none", backgroundColor: saving ? "#aaa" : "#2d6a4f", fontSize: "15px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", color: "#fff" }}>
            {saving ? "Saving..." : "Finish Workout ✓"}
          </button>
        )}
      </div>

      {sheet && <LogSheet field={sheet.field} current={logs[sheet.logKey]?.[sheet.setIndex]?.[sheet.field]} suggestedWeight={sheet.suggestedWeight} onSave={saveValue} onClose={closeSheet} />}
      {swapSheet && <SwapSheet exercise={swapSheet} userProfile={userProfile} userPreferences={userPreferences} onSwap={(newEx) => handleSwap(swapSheet, newEx)} onClose={() => setSwapSheet(null)} />}
      {restTimer && <RestTimer defaultSeconds={restTimer.defaultSeconds} onDismiss={() => setRestTimer(null)} />}
      {progressionModal && <ProgressionModal exerciseName={progressionModal.exerciseName} currentWeight={progressionModal.currentWeight} repsMax={progressionModal.repsMax} targetSets={progressionModal.targetSets} nextWeight={nextWeight} setNextWeight={setNextWeight} onClose={() => setProgressionModal(null)} />}
      {historyExercise && <HistorySheet exerciseName={historyExercise.name} history={buildHistory(historyExercise.id)} onClose={() => setHistoryExercise(null)} />}

      {showFinishConfirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "24px 24px 0 0", width: "100%", padding: "28px 24px 48px" }}>
            <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2, margin: "0 auto 24px" }} />
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#111", margin: "0 0 8px", textAlign: "center" }}>Finish workout?</h2>
            <p style={{ fontSize: "14px", color: "#666", textAlign: "center", margin: "0 0 28px" }}>Your session will be saved and your progress logged.</p>
            <button onClick={() => { setShowFinishConfirm(false); finishWorkout(); }} style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "none", backgroundColor: "#2d6a4f", fontSize: "15px", fontWeight: 700, color: "#fff", cursor: "pointer", marginBottom: "10px" }}>
              Yes, finish session
            </button>
            <button onClick={() => setShowFinishConfirm(false)} style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "0.5px solid #e5e5e5", backgroundColor: "#fff", fontSize: "15px", fontWeight: 700, color: "#111", cursor: "pointer" }}>
              Keep going
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Workout Summary
// ----------------------------------------------------------------
function WorkoutSummary({ summary, onDone }) {
  const { workoutName, exerciseSummaries, totalVolume, prs, animal, completedAt } = summary;
  const shareText = `Just crushed ${workoutName} with Training for Life! 💪 Lifted ${totalVolume}kg -- that's the weight of ${animal.name} ${animal.emoji}${prs.length > 0 ? `. Hit ${prs.length} new PR${prs.length > 1 ? "s" : ""}!` : "."} #TrainingForLife #CapabilityCoaching`;
  const handleShare = async () => {
    if (navigator.share) { try { await navigator.share({ title: "Workout Complete!", text: shareText }); } catch {} }
    else { await navigator.clipboard.writeText(shareText); alert("Copied to clipboard!"); }
  };
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "48px 24px 36px", textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>🎉</div>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 8px" }}>Workout Complete</p>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 4px", lineHeight: 1.2 }}>{workoutName}</h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>{new Date(completedAt).toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "20px", marginBottom: "14px", textAlign: "center" }}>
          <p style={{ fontSize: "48px", margin: "0 0 8px" }}>{animal.emoji}</p>
          <p style={{ fontSize: "32px", fontWeight: 700, color: "#4ade80", margin: "0 0 4px", lineHeight: 1 }}>{totalVolume.toLocaleString()}kg</p>
          <p style={{ fontSize: "15px", color: "#9fe1cb", margin: 0 }}>You lifted the weight of <strong style={{ color: "#fff" }}>{animal.name}</strong> today</p>
        </div>
        {prs.length > 0 && (
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "14px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>🏆 New Personal Records</p>
            {prs.map((pr, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", backgroundColor: "#eaf5ef", borderRadius: "10px", marginBottom: 8 }}>
                <div><p style={{ fontSize: 14, fontWeight: 700, color: "#1a3a2a", margin: 0 }}>{pr.name}</p><p style={{ fontSize: 12, color: "#2d6a4f", margin: "2px 0 0" }}>{pr.isFirstTime ? "First time logged!" : "New personal best!"}</p></div>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{pr.weight}kg</p>
              </div>
            ))}
          </div>
        )}
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "14px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Session Breakdown</p>
          {exerciseSummaries.map((ex, i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: "0.5px solid #f5f5f5" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{ex.name}</p>
                  {ex.isPR && <span style={{ fontSize: 10, fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "1px 6px", borderRadius: 10 }}>PR</span>}
                </div>
                {ex.type === "cardio" ? <span style={{ fontSize: 13, fontWeight: 700, color: "#0369a1" }}>{ex.duration} min</span> : <span style={{ fontSize: 13, fontWeight: 700, color: "#2d6a4f" }}>{ex.maxWeight}kg</span>}
              </div>
              {ex.type === "strength" && <div style={{ display: "flex", gap: 12 }}><span style={{ fontSize: 12, color: "#888" }}>{ex.sets} sets · {ex.totalReps} reps</span><span style={{ fontSize: 12, color: "#aaa" }}>{ex.volume}kg volume</span></div>}
            </div>
          ))}
        </div>
        <button onClick={handleShare} style={{ width: "100%", backgroundColor: "#1a3a2a", color: "#fff", border: "none", borderRadius: "14px", padding: "16px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>📤 Share to Stories / Send to a Friend</button>
        <button onClick={onDone} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "14px", padding: "16px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>Go to Dashboard →</button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Progression Modal
// ----------------------------------------------------------------
function ProgressionModal({ exerciseName, currentWeight, nextWeight, setNextWeight, onClose, repsMax = 12, targetSets = 3 }) {
  const [rpe, setRpe] = useState(null);
  const dropReps = Math.round(repsMax * 0.65);
  const options = [
    { id: "easy", emoji: "💪", label: "I had more in the tank", color: "#16a34a", bg: "#f0fdf4", border: "#86efac", message: "Your body is more capable than that weight is challenging. Time to add weight.", showWeight: true },
    { id: "just_right", emoji: "🎯", label: "That felt just right", color: "#2d6a4f", bg: "#eaf5ef", border: "#6ee7b7", message: `Perfect. Drop to ${dropReps} reps with a slightly heavier weight and build back up to ${repsMax}.`, showWeight: true },
    { id: "hard", emoji: "🔥", label: "That was a real effort", color: "#b45309", bg: "#fffbeb", border: "#fcd34d", message: `Keep the same weight next session and aim for ${targetSets} sets of ${repsMax} again.`, showWeight: false },
  ];
  const selected = options.find(o => o.id === rpe);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
        <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
        {!rpe ? (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>Progress unlocked</p>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>{targetSets} sets of {repsMax} complete</h2>
              <p style={{ fontSize: 13, color: "#888", margin: 0 }}>How did {exerciseName} feel today?</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {options.map(o => (
                <div key={o.id} onClick={() => setRpe(o.id)} style={{ backgroundColor: o.bg, border: `1.5px solid ${o.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                  <span style={{ fontSize: 24 }}>{o.emoji}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: o.color }}>{o.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 32 }}>{selected.emoji}</span>
              <p style={{ fontSize: 15, color: "#444", lineHeight: 1.6, margin: "12px 0 0" }}>{selected.message}</p>
            </div>
            {selected.showWeight && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Choose your next weight</p>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 10 }}>
                  {WEIGHT_QUICK.map(w => (
                    <div key={w} onClick={() => setNextWeight(w)} style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 10, border: nextWeight === w ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: nextWeight === w ? "#eaf5ef" : "#f7f5f2", fontSize: 14, fontWeight: 700, color: nextWeight === w ? "#2d6a4f" : "#111", cursor: "pointer" }}>{w}</div>
                  ))}
                </div>
                <input type="text" placeholder="Or type a weight..." value={nextWeight} onChange={e => setNextWeight(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #2d6a4f", fontSize: 16, fontWeight: 700, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
              </div>
            )}
            <button onClick={onClose} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              {selected.showWeight && nextWeight ? `Next session: ${nextWeight} for ${dropReps} reps` : "Got it. Keep going."}
            </button>
            <button onClick={() => setRpe(null)} style={{ width: "100%", background: "none", border: "none", fontSize: 13, color: "#aaa", cursor: "pointer", marginTop: 10, padding: 6 }}>Go back</button>
          </>
        )}
      </div>
    </div>
  );
}