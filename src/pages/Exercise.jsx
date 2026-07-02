import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { extractYouTubeId, getYouTubeThumbnail } from "../lib/youtube";

// ─── Coaching cues parser ───────────────────────────────────────────────────
// Splits coachingNotes into individual cues. Handles newlines and sentence endings.
function parseCues(notes) {
  if (!notes) return [];
  return notes
    .split(/\n|(?<=\.)\s+/)
    .map(s => s.trim().replace(/\.$/, ""))
    .filter(Boolean);
}

// ─── History helpers ────────────────────────────────────────────────────────
// completedAt shows up as a JS Date, a Firestore Timestamp, or (from older
// logging flows) an ISO string depending on which screen wrote the log.
function toDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val instanceof Date) return val;
  if (val.seconds) return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatRelativeDate(date) {
  const now = new Date();
  const diffDays = Math.floor((now - date) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  return date.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatSet(s) {
  if (s.weight != null && s.weight > 0) {
    return `${s.weight}kg × ${s.reps ?? "-"}`;
  }
  return `${s.reps ?? "-"} reps`;
}

// Every training flow in the app (Start Workout, programmes, PT sessions,
// the capability programme, classes) logs sets a little differently at the
// storage level. This normalizes one raw set object from any of those
// shapes into { reps, weight, completed } with real numbers.
function normalizeSet(s) {
  const rawWeight = s.weight;
  const weight = rawWeight == null || rawWeight === "BW"
    ? null
    : (typeof rawWeight === "string" ? parseFloat(rawWeight) : rawWeight);
  const rawReps = s.reps;
  const reps = rawReps == null ? null : (typeof rawReps === "string" ? parseInt(rawReps, 10) : rawReps);
  const completed = "completed" in s ? s.completed : ("done" in s ? s.done : true);
  return {
    reps: Number.isNaN(reps) ? null : reps,
    weight: Number.isNaN(weight) ? null : weight,
    completed,
  };
}

// Pulls { exerciseId, sets, isPB }[] out of a workoutLogs/classLogs doc,
// regardless of which flow wrote it. Newer docs carry a unified `exercises`
// array (real exerciseId per entry); older docs from the coaching, programme,
// capability, and class flows use a `logs` object instead, keyed either by
// the real exerciseId directly (programme, class) or by a synthetic slot/index
// key (older PT sessions, older capability sessions) that can never be
// resolved to a specific exercise after the fact — those simply won't match
// any real exerciseId here, which is the correct behavior.
function extractExerciseEntries(data) {
  if (Array.isArray(data.exercises)) {
    return data.exercises
      .filter(e => e.exerciseId)
      .map(e => ({ exerciseId: e.exerciseId, sets: e.sets || [], isPB: !!e.personalBestThisSession }));
  }
  if (data.logs && typeof data.logs === "object") {
    const out = [];
    Object.entries(data.logs).forEach(([key, val]) => {
      const exerciseId = key.replace(/_top$|_backoff$/, "");
      const sets = Array.isArray(val) ? val : (val && typeof val === "object" ? [val] : []);
      if (sets.length > 0) out.push({ exerciseId, sets, isPB: false });
    });
    return out;
  }
  return [];
}

// Which training flow a log came from, for display as a badge on each
// history entry. Prefers the explicit `sourceType` written by newer logs;
// falls back to inferring from older signals for logs written before that
// field existed.
function classifySource(data, isClassLog) {
  if (isClassLog) return "class";
  if (data.sourceType) return data.sourceType;
  if (data.loggedByCoach) return "pt_session";
  if (data.sessionType === "weights" || data.sessionType === "run") return "capability";
  if (data.logType === "custom" || Array.isArray(data.exercises)) {
    return data.programmeId ? "programme" : "custom";
  }
  if (data.programmeId) return "programme";
  return "custom";
}

const SOURCE_META = {
  custom: { label: "Solo Workout", color: "#2d6a4f", bg: "#eaf5ef" },
  programme: { label: "Programme", color: "#0369a1", bg: "#e0f2fe" },
  pt_session: { label: "PT Session", color: "#7c3aed", bg: "#f5f3ff" },
  capability: { label: "Capability", color: "#b45309", bg: "#fffbeb" },
  class: { label: "Class", color: "#dc2626", bg: "#fef2f2" },
};

// ─── Small stroke-based line icons (no emoji) ──────────────────────────────
function DumbbellIcon({ size = 16, stroke = "#2d6a4f" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8v4M5 6.5v7M15 6.5v7M17 8v4M5 10h10" />
    </svg>
  );
}

function PulseIcon({ size = 16, stroke = "#0891b2" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10h3l2-5 3 10 2-7 1.5 2H18" />
    </svg>
  );
}

function HistoryIcon({ size = 16, stroke = "#2d6a4f" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 5.5V10l3 2" />
      <path d="M4.5 6.5A7 7 0 1110 17a7 7 0 01-6.2-3.8" />
      <path d="M4.5 9V6h3" />
    </svg>
  );
}

// ─── Weight history chart ───────────────────────────────────────────────────
// Simple hand-rolled SVG line chart, no charting library, matching the rest
// of the app's icon/graphic language. Plots the heaviest completed set per
// session so it reads as a clean progression line even on high-volume days.
function WeightHistoryChart({ sessions }) {
  const w = 320, h = 130;
  const padding = { top: 16, right: 10, bottom: 20, left: 4 };
  const weights = sessions.map((s) => s.topWeight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const coords = sessions.map((s, i) => ({
    x: padding.left + (sessions.length === 1 ? chartW / 2 : (i / (sessions.length - 1)) * chartW),
    y: padding.top + chartH - ((s.topWeight - minW) / range) * chartH,
    ...s,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const dateLabel = (d) => d.toLocaleDateString("en-IE", { day: "numeric", month: "short" });

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <line x1={padding.left} y1={padding.top + chartH} x2={w - padding.right} y2={padding.top + chartH} stroke="#e5e5e5" strokeWidth="1" />
      <path d={linePath} fill="none" stroke="#2d6a4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={i === coords.length - 1 ? 3.5 : 2.5}
          fill={i === coords.length - 1 ? "#2d6a4f" : "#fff"}
          stroke="#2d6a4f"
          strokeWidth="1.5"
        />
      ))}
      <text x={padding.left} y={12} fontSize="9" fill="#aaa">{maxW}kg</text>
      <text x={padding.left} y={h - padding.bottom + 12} fontSize="9" fill="#aaa">{minW}kg</text>
      <text x={padding.left} y={h - 5} fontSize="9" fill="#bbb">{dateLabel(coords[0].date)}</text>
      <text x={w - padding.right} y={h - 5} fontSize="9" fill="#bbb" textAnchor="end">{dateLabel(coords[coords.length - 1].date)}</text>
    </svg>
  );
}

// ─── Muscle group colours ───────────────────────────────────────────────────
const MUSCLE_COLORS = {
  Legs: { color: "#7c3aed", bg: "#f5f3ff" },
  Quads: { color: "#7c3aed", bg: "#f5f3ff" },
  Hamstrings: { color: "#7c3aed", bg: "#f5f3ff" },
  Glutes: { color: "#7c3aed", bg: "#f5f3ff" },
  Calves: { color: "#7c3aed", bg: "#f5f3ff" },
  Adductors: { color: "#7c3aed", bg: "#f5f3ff" },
  Back: { color: "#0369a1", bg: "#e0f2fe" },
  Chest: { color: "#0369a1", bg: "#e0f2fe" },
  Shoulders: { color: "#0369a1", bg: "#e0f2fe" },
  Arms: { color: "#92400e", bg: "#fef3c7" },
  Biceps: { color: "#92400e", bg: "#fef3c7" },
  Triceps: { color: "#92400e", bg: "#fef3c7" },
  Core: { color: "#166534", bg: "#dcfce7" },
  Abs: { color: "#166534", bg: "#dcfce7" },
  Obliques: { color: "#166534", bg: "#dcfce7" },
  "Full Body": { color: "#2d6a4f", bg: "#eaf5ef" },
  Cardio: { color: "#0891b2", bg: "#ecfeff" },
};
const defaultMuscleColor = { color: "#555", bg: "#f0f0f0" };

const EFFORT_LABELS = {
  easy: "Easy, conversational pace",
  moderate: "Moderate, slightly breathless",
  brisk: "Brisk, elevated heart rate",
  hard: "Hard, difficult to talk",
};

// ─── Main page ───────────────────────────────────────────────────────────────
export default function Exercise() {
  const { exerciseId } = useParams();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!exerciseId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const snap = await getDoc(doc(db, "exercises", exerciseId));
      if (snap.exists()) {
        setExercise({ id: snap.id, ...snap.data() });
      } else {
        setNotFound(true);
      }
      setLoading(false);
    })();
  }, [exerciseId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      if (!u) setHistoryLoading(false);
    });
    return () => unsub();
  }, []);

  // Exercise history — unified across every training flow: Start Workout /
  // My Workouts (custom), programme sessions, PT sessions logged by a coach,
  // the capability programme, and classes. See extractExerciseEntries and
  // classifySource above for how each flow's log shape gets normalized.
  useEffect(() => {
    if (!user || !exerciseId) return;
    (async () => {
      setHistoryLoading(true);
      try {
        const [wlSnap, clSnap] = await Promise.all([
          getDocs(query(collection(db, "workoutLogs"), where("userId", "==", user.uid))),
          getDocs(query(collection(db, "classLogs"), where("userId", "==", user.uid))),
        ]);

        const sessions = [];

        const processDoc = (data, isClassLog) => {
          const date = toDate(data.completedAt) || toDate(data.startedAt) || toDate(data.createdAt);
          if (!date) return;

          const entries = extractExerciseEntries(data).filter(e => e.exerciseId === exerciseId);
          if (entries.length === 0) return;

          const sets = entries
            .flatMap(e => e.sets.map(normalizeSet))
            .filter(s => s.completed !== false && (s.reps != null || s.weight != null));
          if (sets.length === 0) return;

          const weights = sets.map(s => s.weight).filter(w => w != null && w > 0);
          const sourceType = classifySource(data, isClassLog);

          sessions.push({
            date,
            sets,
            topWeight: weights.length > 0 ? Math.max(...weights) : null,
            workoutName: data.workoutName || data.sessionLabel || data.sessionName || data.classTitle || SOURCE_META[sourceType]?.label || "Session",
            isPB: entries.some(e => e.isPB),
            sourceType,
          });
        };

        wlSnap.docs.forEach(d => processDoc(d.data(), false));
        clSnap.docs.forEach(d => processDoc(d.data(), true));

        sessions.sort((a, b) => b.date - a.date);
        setHistory(sessions);
      } catch (e) {
        console.error("Failed to load exercise history:", e);
        setHistory([]);
      }
      setHistoryLoading(false);
    })();
  }, [user, exerciseId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #eaf5ef", borderTop: "3px solid #2d6a4f", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ marginBottom: 12 }}>
          <DumbbellIcon size={48} stroke="#ccc" />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Exercise not found</h1>
        <p style={{ fontSize: 14, color: "#888", margin: "0 0 24px" }}>This exercise may have been removed.</p>
        <button onClick={() => navigate(-1)} style={styles.backBtn}>Go back</button>
      </div>
    );
  }

  const muscles = exercise.muscleGroups?.length ? exercise.muscleGroups
    : exercise.muscleGroup ? [exercise.muscleGroup] : [];
  const isCardio = exercise.type === "cardio";
  const cues = parseCues(exercise.coachingNotes);
  const videoId = extractYouTubeId(exercise.videoUrl);
  const thumbnail = getYouTubeThumbnail(exercise.videoUrl);
  const chartSessions = [...history].filter((s) => s.topWeight != null).sort((a, b) => a.date - b.date);
  const hasHistory = !historyLoading && history.length > 0;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: 48 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "20px 20px 40px" }}>
        <button
          onClick={() => navigate(-1)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 16 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>

        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#fff", margin: "0 0 12px", lineHeight: 1.2 }}>
          {exercise.name}
        </h1>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {/* Type badge */}
          <span style={{ fontSize: 11, fontWeight: 700, color: isCardio ? "#0891b2" : "#2d6a4f", backgroundColor: isCardio ? "#ecfeff" : "#eaf5ef", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
            {isCardio ? <PulseIcon size={11} stroke="#0891b2" /> : <DumbbellIcon size={11} stroke="#2d6a4f" />}
            {isCardio ? "Cardio" : "Strength"}
          </span>
          {/* Muscle group badges */}
          {muscles.map(m => {
            const c = MUSCLE_COLORS[m] || defaultMuscleColor;
            return (
              <span key={m} style={{ fontSize: 11, fontWeight: 700, color: c.color, backgroundColor: c.bg, borderRadius: 20, padding: "3px 10px" }}>
                {m}
              </span>
            );
          })}
        </div>

        {/* Last-done / session-count summary — visible immediately, no scrolling needed */}
        {hasHistory && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 20, padding: "6px 12px", marginTop: 14 }}>
            <HistoryIcon size={13} stroke="#9fe1cb" />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#9fe1cb" }}>
              Last done {formatRelativeDate(history[0].date)} · {history.length} session{history.length === 1 ? "" : "s"} logged
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: "0 20px", marginTop: -20 }}>

        {/* ── Video ──────────────────────────────────────────────────────────── */}
        {videoId && (
          <div style={styles.card}>
            {videoOpen ? (
              <div style={{ position: "relative", paddingBottom: "56.25%", borderRadius: 12, overflow: "hidden" }}>
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                  title={exercise.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                />
              </div>
            ) : (
              <div
                onClick={() => setVideoOpen(true)}
                style={{ position: "relative", borderRadius: 12, overflow: "hidden", cursor: "pointer", aspectRatio: "16/9", backgroundColor: "#000" }}
              >
                {thumbnail && (
                  <img src={thumbnail} alt={exercise.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
                )}
                {/* Play button overlay */}
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <path d="M7 4l12 7-12 7V4z" fill="#1a3a2a"/>
                    </svg>
                  </div>
                </div>
                <div style={{ position: "absolute", bottom: 10, left: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "3px 8px" }}>
                    Watch demo
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Your history ─────────────────────────────────────────────────── */}
        {/* Placed right after the video, ahead of About/Training parameters, so
            past performance is the first thing a returning user sees. */}
        {hasHistory && (
          <div style={{ ...styles.card, borderLeft: "4px solid #2d6a4f" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <HistoryIcon size={17} stroke="#2d6a4f" />
              <p style={{ fontSize: 15, fontWeight: 800, color: "#111", margin: 0 }}>Your history</p>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#2d6a4f", backgroundColor: "#eaf5ef", borderRadius: 20, padding: "2px 9px", marginLeft: "auto" }}>
                {history.length}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "#aaa", margin: "2px 0 14px" }}>
              Every solo workout, programme session, PT session, capability session, and class, in one place.
            </p>

            {chartSessions.length >= 2 && (
              <div style={{ marginBottom: 14 }}>
                <WeightHistoryChart sessions={chartSessions} />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 340, overflowY: "auto" }}>
              {history.map((s, i) => {
                const meta = SOURCE_META[s.sourceType] || SOURCE_META.custom;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
                      paddingBottom: 12, borderBottom: i === history.length - 1 ? "none" : "0.5px solid #f0f0f0",
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: "0 0 3px", display: "flex", alignItems: "center", gap: 6 }}>
                        {formatRelativeDate(s.date)}
                        {s.isPB && (
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: "#b45309", backgroundColor: "#fffbeb", borderRadius: 20, padding: "2px 7px" }}>PB</span>
                        )}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 9.5, fontWeight: 800, color: meta.color, backgroundColor: meta.bg, borderRadius: 20, padding: "2px 7px", whiteSpace: "nowrap" }}>
                          {meta.label}
                        </span>
                        <p style={{ fontSize: 11.5, color: "#aaa", margin: 0 }}>{s.workoutName}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "flex-end" }}>
                      {s.sets.map((set, si) => (
                        <span
                          key={si}
                          style={{ fontSize: 11, fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", borderRadius: 8, padding: "3px 8px", whiteSpace: "nowrap" }}
                        >
                          {formatSet(set)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!historyLoading && user && history.length === 0 && (
          <div style={{ ...styles.card, backgroundColor: "#f7f5f2", border: "1px dashed #ddd" }}>
            <p style={styles.sectionLabel}>Your history</p>
            <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>
              No sessions logged yet. Do this exercise in any workout, programme, PT session, or class, and it'll show up here, timestamped, every time.
            </p>
          </div>
        )}

        {/* ── Description / Why ───────────────────────────────────────────── */}
        {exercise.description && (
          <div style={styles.card}>
            <p style={styles.sectionLabel}>About this exercise</p>
            <p style={{ fontSize: 15, color: "#333", margin: 0, lineHeight: 1.65 }}>
              {exercise.description}
            </p>
          </div>
        )}

        {/* ── Training parameters ─────────────────────────────────────────── */}
        <div style={styles.card}>
          <p style={styles.sectionLabel}>Training parameters</p>
          {isCardio ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={styles.stat}>
                <p style={styles.statNum}>{exercise.defaultDuration || 30}</p>
                <p style={styles.statLabel}>Minutes</p>
              </div>
              <div style={styles.stat}>
                <p style={{ ...styles.statNum, fontSize: 16 }}>
                  {EFFORT_LABELS[exercise.defaultEffort] || exercise.defaultEffort || "Moderate"}
                </p>
                <p style={styles.statLabel}>Effort</p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={styles.stat}>
                  <p style={styles.statNum}>{exercise.defaultSets || 3}</p>
                  <p style={styles.statLabel}>Sets</p>
                </div>
                <div style={styles.stat}>
                  <p style={styles.statNum}>{exercise.repsMin || 8}-{exercise.repsMax || 12}</p>
                  <p style={styles.statLabel}>Rep range</p>
                </div>
                <div style={styles.stat}>
                  <p style={styles.statNum}>{exercise.repsMax || 12}</p>
                  <p style={styles.statLabel}>Progress at</p>
                </div>
              </div>
              {exercise.countPerSide && (
                <div style={{ marginTop: 12, backgroundColor: "#f5f3ff", borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", margin: 0 }}>
                    Counted per side. Each side gets its own sets.
                  </p>
                </div>
              )}
              <div style={{ marginTop: 12, backgroundColor: "#eaf5ef", borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ fontSize: 12, color: "#2d6a4f", margin: 0, lineHeight: 1.5 }}>
                  <strong>When to progress:</strong> Complete all {exercise.defaultSets || 3} sets at {exercise.repsMax || 12} reps with good form. Increase weight by the smallest increment available next session.
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── Coaching cues ───────────────────────────────────────────────── */}
        {cues.length > 0 && (
          <div style={styles.card}>
            <p style={styles.sectionLabel}>Coaching cues</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {cues.map((cue, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#2d6a4f" }}>{i + 1}</span>
                  </div>
                  <p style={{ fontSize: 14, color: "#333", margin: 0, lineHeight: 1.55, paddingTop: 3 }}>{cue}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── No coaching content yet ─────────────────────────────────────── */}
        {!exercise.description && cues.length === 0 && (
          <div style={{ ...styles.card, backgroundColor: "#f7f5f2", border: "1px dashed #ddd" }}>
            <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", margin: 0 }}>
              No coaching notes added yet. Add them in the Exercise Library.
            </p>
          </div>
        )}

        {/* ── Muscle groups detail ─────────────────────────────────────────── */}
        {muscles.length > 0 && (
          <div style={styles.card}>
            <p style={styles.sectionLabel}>Muscles worked</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {muscles.map(m => {
                const c = MUSCLE_COLORS[m] || defaultMuscleColor;
                return (
                  <div key={m} style={{ backgroundColor: c.bg, borderRadius: 10, padding: "8px 14px" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: c.color, margin: 0 }}>{m}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────────────────────
const styles = {
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: "20px",
    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#888",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    margin: "0 0 14px",
  },
  stat: {
    backgroundColor: "#f7f5f2",
    borderRadius: 12,
    padding: "14px 12px",
    textAlign: "center",
  },
  statNum: {
    fontSize: 22,
    fontWeight: 700,
    color: "#111",
    margin: "0 0 2px",
  },
  statLabel: {
    fontSize: 11,
    color: "#888",
    fontWeight: 600,
    margin: 0,
  },
  backBtn: {
    backgroundColor: "#2d6a4f",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 24px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
};
