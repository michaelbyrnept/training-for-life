import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
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

  useEffect(() => {
    if (!exerciseId) { setNotFound(true); setLoading(false); return; }
    getDoc(doc(db, "exercises", exerciseId)).then(snap => {
      if (snap.exists()) {
        setExercise({ id: snap.id, ...snap.data() });
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [exerciseId]);

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
