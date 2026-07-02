import { useState, useEffect, useRef } from "react";
import {
  doc, getDoc, getDocs, collection, addDoc, updateDoc, arrayUnion,
  serverTimestamp, query, where, orderBy, limit,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { db, auth, functions } from "../firebase";
import PortalNav from "../components/PortalNav";
import PremiumGate from "../components/PremiumGate";
import ExercisePicker from "../components/ExercisePicker";
import { useFeatures } from "../hooks/useFeatures";
import { extractYouTubeId, getYouTubeThumbnail } from "../lib/youtube";
import {
  SPLITS, getSlotsForSplit, buildSessionForSplit, workoutExerciseFromLibrary,
  getSwapAlternatives, getNextSuggestions, getPattern, preferVideo,
} from "../lib/workoutRecommendations";

// Small stroke-based line icons, matching the icon language established on
// the Start Workout split picker (brand green, thin rounded strokes, no emoji).
function DumbbellIcon({ size = 16, stroke = "#999" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8v4M5 6.5v7M15 6.5v7M17 8v4M5 10h10" />
    </svg>
  );
}

function BookIcon({ size = 14, stroke = "#888" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 5.5c-1.2-1-3-1.5-6-1.5v10.5c3 0 4.8.5 6 1.5 1.2-1 3-1.5 6-1.5V4c-3 0-4.8.5-6 1.5z" />
      <path d="M10 5.5v10.5" />
    </svg>
  );
}

function SwapIcon({ size = 14, stroke = "#555" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h11M12 4l3 3-3 3" />
      <path d="M16 13H5M8 10l-3 3 3 3" />
    </svg>
  );
}

function DuplicateIcon({ size = 14, stroke = "#555" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="7" width="9" height="9" rx="1.5" />
      <path d="M4 13V5.5A1.5 1.5 0 015.5 4H13" />
    </svg>
  );
}

function TrophyIcon({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="#2d6a4f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 8h14v7a7 7 0 01-14 0V8z" />
      <path d="M13 10H8a4 4 0 004 4M27 10h5a4 4 0 01-4 4" />
      <path d="M20 22v5M15 32h10M16 27h8l1 5H15l1-5z" />
    </svg>
  );
}

/**
 * ActiveWorkout — the unified "Start Workout" screen.
 *
 * Replaces the old Create Workout -> Save -> find it -> Start round trip.
 * There is no separate build mode: exercises are already live for logging
 * the moment they're added, whether they were suggested by the recommendation
 * engine (fresh session from a split) or added manually (Build My Own, or
 * resuming a saved workout).
 *
 * Routes:
 *   /my-workouts/new            fresh session, optional ?split=upper etc
 *   /my-workouts/:workoutId     resume a saved workout (optionally inside a
 *                                programme via ?programmeId&week&day)
 */

// ─── Rest Timer ───────────────────────────────────────────────────────────────

function RestTimer({ seconds: defaultSeconds, onDismiss }) {
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const adjust = (delta) => {
    setSeconds((s) => Math.max(0, s + delta));
    if (!running) setRunning(true);
  };

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isDone = seconds === 0;
  const r = 54, circ = 2 * Math.PI * r;
  const dash = isDone ? 0 : circ * (seconds / defaultSeconds);

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", zIndex: 160, display: "flex", alignItems: "flex-end" }}>
      <div style={{ backgroundColor: "#1a3a2a", borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 24px calc(48px + env(safe-area-inset-bottom))" }}>
        <div style={{ width: 36, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, margin: "0 auto 24px" }} />
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.12em", textAlign: "center", margin: "0 0 20px" }}>
          {isDone ? "Rest complete" : "Rest timer"}
        </p>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ position: "relative", width: 140, height: 140 }}>
            <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle cx="70" cy="70" r={r} fill="none" stroke={isDone ? "#4ade80" : "#9fe1cb"} strokeWidth="8" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: 34, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-1px" }}>
                {isDone ? "GO" : `${mins}:${String(secs).padStart(2, "0")}`}
              </p>
            </div>
          </div>
        </div>
        {!isDone && (
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
            {[-30, -15, +15, +30].map((d) => (
              <button
                key={d}
                onClick={() => adjust(d)}
                style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "none", color: "#fff", borderRadius: "10px", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {d > 0 ? `+${d}s` : `${d}s`}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onDismiss}
          style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "none", backgroundColor: isDone ? "#4ade80" : "rgba(255,255,255,0.15)", color: isDone ? "#1a3a2a" : "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
        >
          {isDone ? "Start next set" : "Skip rest"}
        </button>
      </div>
    </div>
  );
}

// ─── Exercise card (live logging + management actions) ──────────────────────

function ExerciseTrainingCard({
  entry, exIdx, total, libraryDetail, allComplete,
  onToggleSet, onUpdateSet, onAddSet, onSwap, onDuplicate, onRemove, onMoveUp, onMoveDown,
  actionsOpen, onToggleActions,
}) {
  const [videoOpen, setVideoOpen] = useState(false);
  const videoId = extractYouTubeId(libraryDetail?.videoUrl);
  const thumbnail = getYouTubeThumbnail(libraryDetail?.videoUrl);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => onToggleActions(true),
    onSwipedRight: () => onToggleActions(false),
    trackMouse: true,
  });

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        {...swipeHandlers}
        style={{
          backgroundColor: allComplete ? "#eaf5ef" : "#fff",
          borderRadius: "16px",
          border: `0.5px solid ${allComplete ? "#86efac" : "#e5e5e5"}`,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Drag handle (desktop drag; on touch, use the ••• actions menu below) */}
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(exIdx))}
              style={{ cursor: "grab", color: "#ccc", fontSize: 16, padding: "4px 2px", flexShrink: 0, letterSpacing: "-2px" }}
              title="Drag to reorder"
            >
              ⠿
            </div>
            <div
              style={{
                width: 36, height: 36, borderRadius: "10px", backgroundColor: allComplete ? "#2d6a4f" : "#f0f0f0",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              {allComplete ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7l3.5 3.5 5.5-7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <DumbbellIcon size={16} stroke="#999" />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.exerciseName}
              </p>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                {entry.slotLabel ? `${entry.slotLabel} · ` : ""}{entry.sets} sets × {entry.reps} reps
                {entry.restSeconds ? ` · ${entry.restSeconds}s rest` : ""}
              </p>
            </div>
            <button
              onClick={() => onToggleActions(!actionsOpen)}
              style={{ background: "none", border: "none", fontSize: 20, color: "#bbb", cursor: "pointer", padding: "4px 6px", flexShrink: 0 }}
            >
              ⋯
            </button>
          </div>

          {/* Video demo — inline, no need to leave the workout to see the movement */}
          {videoId && (
            <div style={{ marginTop: 10 }}>
              {videoOpen ? (
                <div style={{ position: "relative", paddingBottom: "56.25%", borderRadius: 10, overflow: "hidden" }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                    title={entry.exerciseName}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                  />
                </div>
              ) : (
                <div
                  onClick={() => setVideoOpen(true)}
                  style={{ position: "relative", borderRadius: 10, overflow: "hidden", cursor: "pointer", aspectRatio: "16/9", backgroundColor: "#000" }}
                >
                  {thumbnail && (
                    <img src={thumbnail} alt={entry.exerciseName} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
                  )}
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                      <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                        <path d="M7 4l12 7-12 7V4z" fill="#1a3a2a" />
                      </svg>
                    </div>
                  </div>
                  <div style={{ position: "absolute", bottom: 8, left: 10 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "3px 7px" }}>
                      Watch demo
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {libraryDetail?.coachingNotes && (
            <div style={{ marginTop: 10, backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "8px 12px" }}>
              <p style={{ fontSize: 12, color: "#555", margin: 0, fontStyle: "italic" }}>
                "{libraryDetail.coachingNotes.split(/\n|\. /)[0].replace(/\.$/, "")}"
              </p>
            </div>
          )}
          {entry.exerciseId && (
            <Link
              to={`/exercise/${entry.exerciseId}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 12, fontWeight: 700, color: "#888", textDecoration: "none" }}
            >
              <BookIcon size={13} stroke="#888" />
              Full exercise guide
            </Link>
          )}
        </div>

        {/* Action row (swipe left or tap ⋯) */}
        {actionsOpen && (
          <div style={{ display: "flex", borderTop: "0.5px solid #f0f0f0", backgroundColor: "#faf9f7" }}>
            <button onClick={onSwap} style={actionBtnStyle}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <SwapIcon size={13} stroke="#555" /> Swap
              </span>
            </button>
            <button onClick={onDuplicate} style={actionBtnStyle}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <DuplicateIcon size={13} stroke="#555" /> Duplicate
              </span>
            </button>
            <button onClick={onMoveUp} disabled={exIdx === 0} style={{ ...actionBtnStyle, opacity: exIdx === 0 ? 0.35 : 1 }}>▲ Up</button>
            <button onClick={onMoveDown} disabled={exIdx === total - 1} style={{ ...actionBtnStyle, opacity: exIdx === total - 1 ? 0.35 : 1 }}>▼ Down</button>
            <button onClick={onRemove} style={{ ...actionBtnStyle, color: "#dc2626" }}>✕ Remove</button>
          </div>
        )}

        {/* Set rows */}
        <div style={{ borderTop: "0.5px solid #f0f0f0" }}>
          <div style={{ display: "flex", padding: "8px 16px", gap: 8 }}>
            <span style={{ width: 32, fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Set</span>
            <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Reps</span>
            <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>kg</span>
            <span style={{ width: 44, fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Done</span>
          </div>

          {entry.log.map((s, setIdx) => (
            <div
              key={setIdx}
              style={{
                display: "flex", alignItems: "center", padding: "8px 16px", gap: 8,
                backgroundColor: s.completed ? "#eaf5ef" : "transparent", borderTop: "0.5px solid #f7f5f2",
              }}
            >
              <span style={{ width: 32, fontSize: 13, fontWeight: 700, color: "#aaa", textAlign: "center" }}>{setIdx + 1}</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder={entry.reps}
                value={s.reps}
                onChange={(e) => onUpdateSet(setIdx, "reps", e.target.value)}
                style={{
                  flex: 1, padding: "8px", borderRadius: "8px", border: "1.5px solid #e5e5e5", fontSize: 15, fontWeight: 700,
                  textAlign: "center", backgroundColor: s.completed ? "rgba(255,255,255,0.7)" : "#f7f5f2", outline: "none", color: "#111",
                }}
              />
              <input
                type="number"
                inputMode="decimal"
                placeholder={entry.weight || "0"}
                value={s.weight}
                onChange={(e) => onUpdateSet(setIdx, "weight", e.target.value)}
                style={{
                  flex: 1, padding: "8px", borderRadius: "8px", border: "1.5px solid #e5e5e5", fontSize: 15, fontWeight: 700,
                  textAlign: "center", backgroundColor: s.completed ? "rgba(255,255,255,0.7)" : "#f7f5f2", outline: "none", color: "#111",
                }}
              />
              <button
                onClick={() => onToggleSet(setIdx)}
                style={{
                  width: 44, height: 36, borderRadius: "10px", border: "none",
                  backgroundColor: s.completed ? "#2d6a4f" : "#f0f0f0", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                {s.completed ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7l3.5 3.5 5.5-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <div style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid #ccc" }} />
                )}
              </button>
            </div>
          ))}

          <button
            onClick={onAddSet}
            style={{ width: "100%", padding: "10px", border: "none", background: "none", fontSize: 13, fontWeight: 600, color: "#2d6a4f", cursor: "pointer", borderTop: "0.5px solid #f0f0f0" }}
          >
            + Add Set
          </button>
        </div>
      </div>
    </div>
  );
}

const actionBtnStyle = {
  flex: 1, padding: "12px 4px", border: "none", background: "none", fontSize: 12, fontWeight: 700, color: "#555", cursor: "pointer",
};

// ─── Smart "what's next" suggestion ──────────────────────────────────────────

function NextSuggestion({ suggestions, onAdd, onDismiss }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div style={{ backgroundColor: "#eaf5ef", border: "1px solid #bfe3d0", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "#1a3a2a", margin: 0 }}>
          Most people pair this with...
        </p>
        <button onClick={onDismiss} style={{ background: "none", border: "none", color: "#7fae95", fontSize: 16, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {suggestions.map((ex) => (
          <button
            key={ex.id}
            onClick={() => onAdd(ex)}
            style={{
              padding: "8px 12px", borderRadius: 20, border: "none", backgroundColor: "#fff", color: "#2d6a4f",
              fontWeight: 700, fontSize: 12.5, cursor: "pointer",
            }}
          >
            + {ex.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Completion screen ────────────────────────────────────────────────────────

function CompletionScreen({
  title, durationSeconds, setsCompleted, navigate, programmeId,
  offerSave, saveName, setSaveName, onSave, saving, saved,
}) {
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", paddingBottom: "calc(100px + env(safe-area-inset-bottom))" }}>
      <div style={{ marginBottom: 16 }}><TrophyIcon size={64} /></div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1a3a2a", margin: "0 0 8px", textAlign: "center" }}>Workout Complete</h1>
      <p style={{ fontSize: 15, color: "#888", textAlign: "center", margin: "0 0 32px" }}>{title || "Workout"}</p>

      <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "16px 24px", textAlign: "center", border: "0.5px solid #e5e5e5" }}>
          <p style={{ fontSize: 26, fontWeight: 800, color: "#2d6a4f", margin: 0 }}>
            {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 0" }}>Duration</p>
        </div>
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "16px 24px", textAlign: "center", border: "0.5px solid #e5e5e5" }}>
          <p style={{ fontSize: 26, fontWeight: 800, color: "#2d6a4f", margin: 0 }}>{setsCompleted}</p>
          <p style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 0" }}>Sets done</p>
        </div>
      </div>

      {offerSave && !saved && (
        <div style={{ width: "100%", maxWidth: 340, backgroundColor: "#fff", borderRadius: 16, border: "0.5px solid #e5e5e5", padding: 16, marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: "0 0 10px" }}>Save this as a workout you can repeat?</p>
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e5e5", fontSize: 14, backgroundColor: "#f7f5f2", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
          />
          <button
            onClick={onSave}
            disabled={saving}
            style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", backgroundColor: saving ? "#aaa" : "#2d6a4f", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            {saving ? "Saving..." : "Save Workout"}
          </button>
        </div>
      )}
      {saved && (
        <div style={{ width: "100%", maxWidth: 340, backgroundColor: "#eaf5ef", borderRadius: 14, padding: "12px 16px", marginBottom: 20, textAlign: "center" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#2d6a4f", margin: 0 }}>Saved — you can repeat this from My Workouts.</p>
        </div>
      )}

      {programmeId && (
        <button
          onClick={() => navigate(`/my-programmes/${programmeId}`)}
          style={{ width: "100%", maxWidth: 340, padding: "16px", borderRadius: "14px", border: "none", backgroundColor: "#2d6a4f", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}
        >
          Back to Programme
        </button>
      )}
      <button
        onClick={() => navigate("/my-workouts")}
        style={{ width: "100%", maxWidth: 340, padding: "16px", borderRadius: "14px", border: "none", backgroundColor: programmeId ? "transparent" : "#2d6a4f", color: programmeId ? "#888" : "#fff", fontSize: programmeId ? 14 : 16, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}
      >
        Back to My Workouts
      </button>
      <button
        onClick={() => navigate("/dashboard")}
        style={{ width: "100%", maxWidth: 340, padding: "14px", borderRadius: "14px", border: "none", backgroundColor: "transparent", color: "#aaa", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
      >
        Go to Dashboard
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function seedLog(entry) {
  const sets = entry.sets || 3;
  return Array.from({ length: sets }, () => ({ reps: "", weight: entry.weight || "", completed: false }));
}

export default function ActiveWorkout() {
  const { workoutId } = useParams();
  const navigate = useNavigate();
  const features = useFeatures();
  const [searchParams] = useSearchParams();
  const splitId = searchParams.get("split");
  const programmeId = searchParams.get("programmeId");
  const programmeWeek = parseInt(searchParams.get("week")) || null;
  const programmeDay = searchParams.get("day") || null;
  const isResuming = Boolean(workoutId);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [exercises, setExercises] = useState([]); // { exerciseId, exerciseName, sets, reps, weight, restSeconds, notes, slotLabel, log }
  const [libraryExercises, setLibraryExercises] = useState([]);
  const [libraryById, setLibraryById] = useState({});

  const [showPicker, setShowPicker] = useState(false);
  const [pickerContext, setPickerContext] = useState(null); // { mode: "add" | "swap", swapIndex, slotLabel, exercises }
  const [actionsOpenIndex, setActionsOpenIndex] = useState(null);
  const [restTimer, setRestTimer] = useState(null);
  const [suggestion, setSuggestion] = useState(null); // { afterIndex, options }
  const [dismissedSuggestionFor, setDismissedSuggestionFor] = useState([]);

  const [startTime] = useState(() => new Date());
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const [showGate, setShowGate] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [savedWorkout, setSavedWorkout] = useState(false);

  const splitMeta = SPLITS.find((s) => s.id === splitId);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);

      // Exercise library (needed for recommendations, swap, suggestions, coaching notes)
      const librarySnap = await getDocs(collection(db, "exercises"));
      const library = librarySnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.isActive !== false);
      setLibraryExercises(library);
      setLibraryById(Object.fromEntries(library.map((e) => [e.id, e])));

      if (isResuming) {
        const snap = await getDoc(doc(db, "users", u.uid, "workouts", workoutId));
        if (!snap.exists()) { navigate("/my-workouts"); return; }
        const data = snap.data();
        setTitle(data.name || "Workout");
        setExercises((data.exercises || []).map((e) => ({ ...e, log: seedLog(e) })));
        setLoading(false);
        return;
      }

      // Fresh session: recent exercise ids for variety, then build via recommendation engine
      let recentIds = [];
      try {
        const logsSnap = await getDocs(
          query(collection(db, "workoutLogs"), where("userId", "==", u.uid), orderBy("completedAt", "desc"), limit(2))
        );
        recentIds = logsSnap.docs.flatMap((d) => (d.data().exercises || []).map((e) => e.exerciseId)).filter(Boolean);
      } catch {
        // Missing index or no logs yet, fine, just skip variety weighting.
      }

      if (!splitId) {
        // Build My Own: skip the empty "add your first exercise" screen and
        // drop straight into the picker so they're logging within one tap.
        setTitle("New Workout");
        setExercises([]);
        setSaveName("My Workout");
        setLoading(false);
        setPickerContext({ mode: "add" });
        setShowPicker(true);
        return;
      }

      const built = buildSessionForSplit(splitId, library, recentIds);
      setTitle(splitMeta ? splitMeta.label : "New Workout");
      setExercises(built.map((e) => ({ ...e, log: seedLog(e) })));
      setSaveName(splitMeta ? splitMeta.label : "My Workout");
      setLoading(false);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Exercise management ──
  const addExercise = (ex, slotLabel) => {
    setExercises((prev) => [...prev, { ...workoutExerciseFromLibrary(ex, slotLabel ? { slotLabel } : {}), log: seedLog(ex) }]);
    setShowPicker(false);
  };

  const removeExercise = (index) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
    setActionsOpenIndex(null);
  };

  const duplicateExercise = (index) => {
    setExercises((prev) => {
      const copy = { ...prev[index], log: seedLog(prev[index]) };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setActionsOpenIndex(null);
  };

  const moveExercise = (index, direction) => {
    setExercises((prev) => {
      const next = [...prev];
      const swapIdx = index + direction;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      return next;
    });
  };

  const handleDrop = (targetIndex, e) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (Number.isNaN(sourceIndex) || sourceIndex === targetIndex) return;
    setExercises((prev) => {
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const openSwap = (index) => {
    const alternatives = getSwapAlternatives(exercises[index], exercises, libraryExercises);
    setPickerContext({ mode: "swap", swapIndex: index, slotLabel: exercises[index].slotLabel, alternatives });
    setShowPicker(true);
    setActionsOpenIndex(null);
  };

  const openAdd = () => {
    // Recommend for whichever slot in the split sequence isn't filled yet
    let recommended = null;
    if (splitId && !isResuming) {
      const slots = getSlotsForSplit(splitId);
      const filledLabels = exercises.map((e) => e.slotLabel).filter(Boolean);
      const nextSlot = slots.find((s) => !filledLabels.includes(s.label));
      if (nextSlot) {
        const usedIds = exercises.map((e) => e.exerciseId);
        const candidates = libraryExercises.filter((e) => nextSlot.patterns.includes(getPattern(e)) && !usedIds.includes(e.id));
        recommended = { label: nextSlot.label, exercises: preferVideo(candidates).slice(0, 6), slotLabel: nextSlot.label };
      }
    }
    setPickerContext({ mode: "add", slotLabel: recommended?.slotLabel, recommended });
    setShowPicker(true);
  };

  const handlePickerSelect = (ex) => {
    if (pickerContext?.mode === "swap") {
      setExercises((prev) => prev.map((e, i) =>
        i === pickerContext.swapIndex
          ? { ...workoutExerciseFromLibrary(ex, { slotLabel: e.slotLabel }), log: seedLog(ex) }
          : e
      ));
      setShowPicker(false);
      return;
    }
    addExercise(ex, pickerContext?.slotLabel);
  };

  // ── Set logging ──
  const toggleSet = (exIdx, setIdx) => {
    setExercises((prev) => {
      const next = [...prev];
      const entry = { ...next[exIdx] };
      const log = [...entry.log];
      const wasCompleted = log[setIdx]?.completed;
      log[setIdx] = { ...log[setIdx], completed: !wasCompleted };
      entry.log = log;
      next[exIdx] = entry;

      if (!wasCompleted) {
        setRestTimer({ seconds: entry.restSeconds || 90 });
        const allDone = log.every((s) => s.completed);
        if (allDone && !dismissedSuggestionFor.includes(exIdx)) {
          const libEx = libraryById[entry.exerciseId];
          const usedIds = next.map((e) => e.exerciseId);
          const options = getNextSuggestions(libEx, libraryExercises, usedIds);
          if (options.length > 0) setSuggestion({ afterIndex: exIdx, options });
        }
      }
      return next;
    });
  };

  const updateSetValue = (exIdx, setIdx, field, value) => {
    setExercises((prev) => {
      const next = [...prev];
      const entry = { ...next[exIdx] };
      const log = [...entry.log];
      log[setIdx] = { ...log[setIdx], [field]: value };
      entry.log = log;
      next[exIdx] = entry;
      return next;
    });
  };

  const addSet = (exIdx) => {
    setExercises((prev) => {
      const next = [...prev];
      const entry = { ...next[exIdx] };
      const last = entry.log.at(-1) || {};
      entry.log = [...entry.log, { reps: last.reps || "", weight: last.weight || "", completed: false }];
      next[exIdx] = entry;
      return next;
    });
  };

  const addSuggested = (ex) => {
    addExercise(ex);
    setSuggestion(null);
  };

  // ── Finish ──
  const handleFinish = async () => {
    setSaving(true);
    if (!isResuming && !saveName) setSaveName(title);
    const endTime = new Date();
    const dur = Math.floor((endTime - startTime) / 1000);
    setDurationSeconds(dur);

    const logExercises = exercises.map((e, i) => ({
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      order: i,
      sets: e.log.map((s) => ({ reps: parseInt(s.reps) || null, weight: parseFloat(s.weight) || null, completed: s.completed })),
      personalBestThisSession: false,
    }));

    try {
      const logRef = await addDoc(collection(db, "workoutLogs"), {
        userId: user.uid,
        workoutId: workoutId || null,
        workoutName: title,
        logType: "custom",
        startedAt: startTime,
        completedAt: endTime,
        durationSeconds: dur,
        exercises: logExercises,
        ...(programmeId ? { programmeId, programmeWeek, programmeDay } : {}),
        healthSnapshot: { restingHeartRate: null, hrv: null, sleepHours: null, source: null },
        createdAt: serverTimestamp(),
      });

      if (isResuming) {
        await updateDoc(doc(db, "users", user.uid, "workouts", workoutId), { lastUsedAt: serverTimestamp() });
      }

      if (programmeId && programmeWeek && programmeDay) {
        await updateDoc(doc(db, "users", user.uid, "userProgrammes", programmeId), {
          completedSessions: arrayUnion({ week: programmeWeek, day: programmeDay, logId: logRef.id, completedAt: endTime.toISOString() }),
        });
      }

      setFinished(true);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const handleSaveAsRepeatable = async () => {
    if (!saveName.trim()) return;
    setSavingWorkout(true);
    try {
      const check = httpsCallable(functions, "checkWorkoutSaveEntitlement");
      const result = await check();
      if (!result.data.allowed) {
        setShowGate(true);
        setSavingWorkout(false);
        return;
      }
      await addDoc(collection(db, "users", user.uid, "workouts"), {
        name: saveName.trim(),
        exercises: exercises.map((e, i) => ({
          exerciseId: e.exerciseId, exerciseName: e.exerciseName, order: i,
          sets: e.sets, reps: e.reps, weight: e.weight, restSeconds: e.restSeconds, notes: e.notes,
        })),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSavedWorkout(true);
    } catch (e) {
      console.error(e);
    }
    setSavingWorkout(false);
  };

  const totalSets = exercises.flatMap((e) => e.log).length;
  const completedSets = exercises.flatMap((e) => e.log).filter((s) => s.completed).length;
  const progress = totalSets > 0 ? completedSets / totalSets : 0;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
        <PortalNav />
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0", color: "#aaa" }}>Loading...</div>
      </div>
    );
  }

  if (finished) {
    return (
      <>
        <PortalNav />
        <CompletionScreen
          title={title}
          durationSeconds={durationSeconds}
          setsCompleted={completedSets}
          navigate={navigate}
          programmeId={programmeId}
          offerSave={!isResuming}
          saveName={saveName}
          setSaveName={setSaveName}
          onSave={handleSaveAsRepeatable}
          saving={savingWorkout}
          saved={savedWorkout}
        />
        {showGate && <PremiumGate reason="workout_limit" onClose={() => setShowGate(false)} />}
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "180px" }}>
      <PortalNav />

      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button
            onClick={() => navigate("/my-workouts")}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}
          >
            ←
          </button>
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
            {isResuming ? "Workout" : "Start Workout"}
          </p>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={50}
          style={{
            width: "100%", fontSize: 24, fontWeight: 700, color: "#fff", background: "transparent",
            border: "none", outline: "none", padding: 0, letterSpacing: "-0.3px", boxSizing: "border-box", marginBottom: 8,
          }}
        />
        <p style={{ fontSize: 13, color: "#9fe1cb", margin: "0 0 12px" }}>
          {completedSets} of {totalSets} sets complete
        </p>
        <div style={{ height: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2 }}>
          <div style={{ height: 4, backgroundColor: "#4ade80", borderRadius: 2, width: `${progress * 100}%`, transition: "width 0.3s ease" }} />
        </div>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      <div style={{ padding: "0 16px" }}>
        {exercises.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 16px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <DumbbellIcon size={40} stroke="#2d6a4f" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 6px" }}>Build as you go</p>
            <p style={{ fontSize: 13, color: "#888", margin: 0 }}>Add your first exercise below, the workout grows as you train.</p>
          </div>
        )}

        {exercises.map((entry, exIdx) => {
          const allComplete = entry.log.length > 0 && entry.log.every((s) => s.completed);
          return (
            <div
              key={`${entry.exerciseId}-${exIdx}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(exIdx, e)}
            >
              <ExerciseTrainingCard
                entry={entry}
                exIdx={exIdx}
                total={exercises.length}
                libraryDetail={libraryById[entry.exerciseId]}
                allComplete={allComplete}
                onToggleSet={(setIdx) => toggleSet(exIdx, setIdx)}
                onUpdateSet={(setIdx, field, value) => updateSetValue(exIdx, setIdx, field, value)}
                onAddSet={() => addSet(exIdx)}
                onSwap={() => openSwap(exIdx)}
                onDuplicate={() => duplicateExercise(exIdx)}
                onRemove={() => removeExercise(exIdx)}
                onMoveUp={() => moveExercise(exIdx, -1)}
                onMoveDown={() => moveExercise(exIdx, 1)}
                actionsOpen={actionsOpenIndex === exIdx}
                onToggleActions={(open) => setActionsOpenIndex(open ? exIdx : null)}
              />
              {suggestion?.afterIndex === exIdx && (
                <NextSuggestion
                  suggestions={suggestion.options}
                  onAdd={addSuggested}
                  onDismiss={() => { setDismissedSuggestionFor((prev) => [...prev, exIdx]); setSuggestion(null); }}
                />
              )}
            </div>
          );
        })}

        <button
          onClick={openAdd}
          style={{
            width: "100%", padding: "14px", borderRadius: "14px", border: exercises.length === 0 ? "2px dashed #2d6a4f" : "none",
            backgroundColor: exercises.length === 0 ? "#eaf5ef" : "#2d6a4f", color: exercises.length === 0 ? "#2d6a4f" : "#fff",
            fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 16,
          }}
        >
          + Add Exercise
        </button>

        <button
          onClick={handleFinish}
          disabled={saving || totalSets === 0}
          style={{
            width: "100%", padding: "16px", borderRadius: "14px", border: "none",
            backgroundColor: saving ? "#aaa" : completedSets > 0 ? "#1a3a2a" : "#e5e5e5",
            color: completedSets > 0 || saving ? "#fff" : "#aaa", fontSize: 16, fontWeight: 700,
            cursor: saving || completedSets === 0 ? "default" : "pointer",
          }}
        >
          {saving ? "Saving..." : completedSets === 0 ? "Complete sets to finish" : `Finish Workout (${completedSets}/${totalSets} sets)`}
        </button>

        {!features.isPremium && !isResuming && (
          <p style={{ fontSize: 12, color: "#aaa", textAlign: "center", marginTop: 12 }}>
            Free plan: 1 saved workout. You can still train today, saving to repeat later needs Premium.
          </p>
        )}
      </div>

      {showPicker && (
        <ExercisePicker
          onSelect={handlePickerSelect}
          onClose={() => setShowPicker(false)}
          userId={user?.uid}
          title={pickerContext?.mode === "swap" ? "Swap Exercise" : "Add Exercise"}
          recommended={
            pickerContext?.mode === "swap"
              ? { label: pickerContext.slotLabel, exercises: (pickerContext.alternatives || []).slice(0, 6) }
              : pickerContext?.recommended
          }
        />
      )}

      {restTimer && <RestTimer seconds={restTimer.seconds} onDismiss={() => setRestTimer(null)} />}
    </div>
  );
}
