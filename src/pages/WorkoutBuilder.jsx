import { useState, useEffect } from "react";
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth, functions } from "../firebase";
import PortalNav from "../components/PortalNav";
import PremiumGate from "../components/PremiumGate";
import { useFeatures } from "../hooks/useFeatures";

async function requestExercise(userId, exerciseName) {
  try {
    await addDoc(collection(db, "exerciseRequests"), {
      exerciseName: exerciseName.trim(),
      userId,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.error("Exercise request failed:", e);
    return false;
  }
}

const MUSCLE_HIERARCHY = {
  Legs: ["Quads", "Hamstrings", "Calves", "Glutes", "Adductors"],
  Arms: ["Biceps", "Triceps"],
  Core: ["Abs", "Obliques"],
};
const TOP_LEVEL_GROUPS = ["All", "Back", "Chest", "Shoulders", "Legs", "Arms", "Core", "Full Body", "Cardio"];

const DEFAULT_EXERCISE_CONFIG = { sets: 3, reps: "10", weight: "", restSeconds: 90, notes: "" };

// Handles both old schema (muscleGroup: string) and new (muscleGroups: array)
function getExerciseMuscles(ex) {
  if (ex.muscleGroups?.length) return ex.muscleGroups;
  if (ex.muscleGroup) return [ex.muscleGroup];
  if (ex.category) return [ex.category];
  return [];
}

function hasVideo(ex) {
  return !!(ex.videoUrl?.trim() || ex.media?.demoUrl?.trim() || ex.media?.demoThumbnailUrl?.trim());
}

function ExercisePicker({ onSelect, onClose, userId }) {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [subFilter, setSubFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [videoOnly, setVideoOnly] = useState(true);
  const [requestSent, setRequestSent] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const handleSetFilter = (g) => {
    setFilter(g);
    setSubFilter(null);
  };

  useEffect(() => {
    getDocs(collection(db, "exercises")).then((snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((e) => e.isActive !== false)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setExercises(data);
      setLoading(false);
    });
  }, []);

  const filtered = exercises.filter((e) => {
    const muscles = getExerciseMuscles(e);
    let matchGroup;
    if (filter === "All") {
      matchGroup = true;
    } else if (subFilter) {
      matchGroup = muscles.includes(subFilter);
    } else {
      const children = MUSCLE_HIERARCHY[filter] || [];
      matchGroup = muscles.includes(filter) || children.some(c => muscles.includes(c));
    }
    const matchSearch = !search || (e.name || "").toLowerCase().includes(search.toLowerCase());
    const matchVideo = !videoOnly || hasVideo(e);
    return matchGroup && matchSearch && matchVideo;
  });

  const videoCount = exercises.filter(hasVideo).length;

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 150, display: "flex", alignItems: "flex-end" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: "#fff", borderRadius: "24px 24px 0 0", width: "100%", height: "85vh", display: "flex", flexDirection: "column" }}>
        {/* Handle */}
        <div style={{ padding: "16px 0 0", display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: 0 }}>Add Exercise</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#aaa", cursor: "pointer", padding: "0 0 0 8px" }}>
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "0 16px 12px", flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: "12px",
              border: "1.5px solid #e5e5e5",
              fontSize: 14,
              backgroundColor: "#f7f5f2",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Filter row 1: video toggle + top-level category pills */}
        <div style={{ overflowX: "auto", padding: "0 16px 8px", display: "flex", gap: 8, flexShrink: 0, scrollbarWidth: "none" }}>
          {/* Video-only toggle */}
          <button
            onClick={() => setVideoOnly((v) => !v)}
            style={{
              flexShrink: 0,
              padding: "7px 12px",
              borderRadius: "20px",
              border: videoOnly ? "none" : "1.5px solid #e5e5e5",
              backgroundColor: videoOnly ? "#2d6a4f" : "#fff",
              color: videoOnly ? "#fff" : "#aaa",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span style={{ fontSize: 11 }}>▶</span>
            {videoOnly ? `Videos (${videoCount})` : "Videos"}
          </button>

          {/* Divider */}
          <div style={{ width: 1, backgroundColor: "#e5e5e5", flexShrink: 0, margin: "4px 0" }} />

          {TOP_LEVEL_GROUPS.map((g) => {
            const hasSubs = !!MUSCLE_HIERARCHY[g];
            const isActive = filter === g;
            return (
              <button
                key={g}
                onClick={() => handleSetFilter(g)}
                style={{
                  flexShrink: 0,
                  padding: "7px 14px",
                  borderRadius: "20px",
                  border: "none",
                  backgroundColor: isActive ? "#1a3a2a" : "#f0f0f0",
                  color: isActive ? "#fff" : "#555",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {g}
                {hasSubs && <span style={{ fontSize: 9, opacity: isActive ? 0.8 : 0.5, marginTop: 1 }}>▾</span>}
              </button>
            );
          })}
        </div>

        {/* Filter row 2: sub-categories (only when Legs / Arms / Core is active) */}
        {MUSCLE_HIERARCHY[filter] && (
          <div style={{ overflowX: "auto", padding: "0 16px 12px", display: "flex", gap: 6, flexShrink: 0, scrollbarWidth: "none" }}>
            <button
              onClick={() => setSubFilter(null)}
              style={{
                flexShrink: 0,
                padding: "5px 12px",
                borderRadius: "16px",
                border: "none",
                backgroundColor: !subFilter ? "#2d6a4f" : "#f0f0f0",
                color: !subFilter ? "#fff" : "#888",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              All {filter}
            </button>
            {MUSCLE_HIERARCHY[filter].map((sub) => (
              <button
                key={sub}
                onClick={() => setSubFilter(sub)}
                style={{
                  flexShrink: 0,
                  padding: "5px 12px",
                  borderRadius: "16px",
                  border: "none",
                  backgroundColor: subFilter === sub ? "#2d6a4f" : "#f0f0f0",
                  color: subFilter === sub ? "#fff" : "#888",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {sub}
              </button>
            ))}
          </div>
        )}

        {/* Exercise list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px" }}>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ height: 64, backgroundColor: "#f7f5f2", borderRadius: "12px", opacity: 0.5 }} />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 16px" }}>
              <p style={{ color: "#aaa", fontSize: 14, margin: "0 0 6px" }}>No exercises found</p>
              {subFilter && (
                <p style={{ color: "#bbb", fontSize: 12, margin: "0 0 16px" }}>
                  None tagged "{subFilter}" yet. Tap "All {filter}" to see all.
                </p>
              )}
              {search.trim().length > 1 && !requestSent && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 13, color: "#888", margin: "0 0 10px" }}>
                    Can't find "{search.trim()}"?
                  </p>
                  <button
                    onClick={async () => {
                      setRequesting(true);
                      const ok = await requestExercise(userId, search.trim());
                      setRequesting(false);
                      if (ok) setRequestSent(true);
                    }}
                    disabled={requesting}
                    style={{
                      backgroundColor: "#1a3a2a",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 18px",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: requesting ? "not-allowed" : "pointer",
                      opacity: requesting ? 0.7 : 1,
                    }}
                  >
                    {requesting ? "Sending..." : `Request "${search.trim()}"`}
                  </button>
                </div>
              )}
              {requestSent && (
                <div style={{ marginTop: 12, backgroundColor: "#eaf5ef", borderRadius: 10, padding: "12px 16px" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#2d6a4f", margin: "0 0 2px" }}>Request sent!</p>
                  <p style={{ fontSize: 12, color: "#5a9e7a", margin: 0 }}>Michael will add it to the library soon.</p>
                </div>
              )}
            </div>
          )}

          {!loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => onSelect(ex)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: "14px",
                    border: "0.5px solid #e5e5e5",
                    backgroundColor: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: "12px",
                        backgroundColor: "#eaf5ef",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {hasVideo(ex) ? (
                        <img
                          src={
                            ex.media?.demoThumbnailUrl ||
                            (ex.videoUrl
                              ? `https://img.youtube.com/vi/${ex.videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([^&?/]+)/)?.[1]}/mqdefault.jpg`
                              : null)
                          }
                          alt={ex.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                        />
                      ) : null}
                      <span style={{ fontSize: 22, display: hasVideo(ex) ? "none" : "flex" }}>💪</span>
                    </div>
                    {/* Play badge for exercises with video */}
                    {hasVideo(ex) && (
                      <div style={{
                        position: "absolute",
                        bottom: -3,
                        right: -3,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        backgroundColor: "#2d6a4f",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid #fff",
                      }}>
                        <span style={{ fontSize: 7, color: "#fff", marginLeft: 1 }}>▶</span>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#111", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ex.name}
                    </p>
                    <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                      {getExerciseMuscles(ex).join(", ") || "Exercise"}
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M8 3v10M3 8h10" stroke="#2d6a4f" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExerciseCard({ exercise, index, total, onChange, onRemove, onMoveUp, onMoveDown }) {
  const [expanded, setExpanded] = useState(false);

  const REP_OPTIONS = ["5", "6", "8", "10", "12", "15", "20", "AMRAP", "5-8", "8-10", "8-12", "10-12", "12-15"];
  const REST_OPTIONS = [
    { label: "30s", value: 30 }, { label: "45s", value: 45 }, { label: "60s", value: 60 },
    { label: "90s", value: 90 }, { label: "2min", value: 120 }, { label: "3min", value: 180 },
  ];

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px" }}>
        {/* Reorder */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: 12, flexShrink: 0 }}>
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            style={{ background: "none", border: "none", padding: "2px 4px", cursor: index === 0 ? "default" : "pointer", opacity: index === 0 ? 0.2 : 0.6, fontSize: 12, color: "#555" }}
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            style={{ background: "none", border: "none", padding: "2px 4px", cursor: index === total - 1 ? "default" : "pointer", opacity: index === total - 1 ? 0.2 : 0.6, fontSize: 12, color: "#555" }}
          >
            ▼
          </button>
        </div>

        {/* Exercise info */}
        <div style={{ flex: 1, minWidth: 0 }} onClick={() => setExpanded((x) => !x)}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {exercise.exerciseName}
          </p>
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
            {exercise.sets} sets × {exercise.reps} reps
            {exercise.weight && exercise.weight !== "" ? ` • ${exercise.weight}kg` : ""}
          </p>
        </div>

        {/* Expand + remove */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8, flexShrink: 0 }}>
          <button
            onClick={() => setExpanded((x) => !x)}
            style={{
              background: "none", border: "none", padding: "6px", cursor: "pointer",
              color: expanded ? "#2d6a4f" : "#aaa", fontSize: 20, lineHeight: 1,
            }}
          >
            {expanded ? "−" : "+"}
          </button>
          <button
            onClick={onRemove}
            style={{
              background: "none", border: "none", padding: "6px 4px", cursor: "pointer",
              color: "#ccc", fontSize: 18, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div style={{ borderTop: "0.5px solid #f0f0f0", padding: "16px" }}>
          {/* Sets */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Sets</p>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => onChange({ ...exercise, sets: n })}
                  style={{
                    width: 40, height: 40, borderRadius: "10px", border: "none",
                    backgroundColor: exercise.sets === n ? "#2d6a4f" : "#f0f0f0",
                    color: exercise.sets === n ? "#fff" : "#555",
                    fontWeight: 700, fontSize: 15, cursor: "pointer",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Reps */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Reps</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {REP_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => onChange({ ...exercise, reps: r })}
                  style={{
                    padding: "8px 12px", borderRadius: "10px", border: "none",
                    backgroundColor: exercise.reps === r ? "#2d6a4f" : "#f0f0f0",
                    color: exercise.reps === r ? "#fff" : "#555",
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Or type custom reps..."
              value={REP_OPTIONS.includes(exercise.reps) ? "" : exercise.reps}
              onChange={(e) => onChange({ ...exercise, reps: e.target.value })}
              style={{ width: "100%", marginTop: 8, padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: 13, backgroundColor: "#f7f5f2", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Weight */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
              Starting Weight (optional)
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                placeholder="e.g. 60"
                value={exercise.weight}
                onChange={(e) => onChange({ ...exercise, weight: e.target.value })}
                style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: 14, backgroundColor: "#f7f5f2", outline: "none" }}
              />
              <span style={{ fontSize: 14, color: "#888", fontWeight: 600 }}>kg</span>
            </div>
          </div>

          {/* Rest */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Rest Between Sets</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {REST_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => onChange({ ...exercise, restSeconds: r.value })}
                  style={{
                    padding: "8px 12px", borderRadius: "10px", border: "none",
                    backgroundColor: exercise.restSeconds === r.value ? "#2d6a4f" : "#f0f0f0",
                    color: exercise.restSeconds === r.value ? "#fff" : "#555",
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Notes (optional)</p>
            <textarea
              placeholder="e.g. Focus on slow eccentric, neutral spine..."
              value={exercise.notes}
              onChange={(e) => onChange({ ...exercise, notes: e.target.value })}
              rows={2}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: 13, backgroundColor: "#f7f5f2", outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkoutBuilder() {
  const { workoutId } = useParams();
  const navigate = useNavigate();
  const features = useFeatures();
  const isEditing = Boolean(workoutId);

  const [user, setUser] = useState(null);
  const [workoutName, setWorkoutName] = useState("");
  const [exercises, setExercises] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);

      if (isEditing) {
        const snap = await getDoc(doc(db, "users", u.uid, "workouts", workoutId));
        if (snap.exists()) {
          const data = snap.data();
          setWorkoutName(data.name || "");
          setExercises(data.exercises || []);
        }
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const addExercise = (ex) => {
    setExercises((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        exerciseName: ex.name,
        ...DEFAULT_EXERCISE_CONFIG,
      },
    ]);
    setShowPicker(false);
  };

  const updateExercise = (index, updated) => {
    setExercises((prev) => prev.map((e, i) => (i === index ? updated : e)));
  };

  const removeExercise = (index) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const moveExercise = (index, direction) => {
    const newArr = [...exercises];
    const swapIdx = index + direction;
    if (swapIdx < 0 || swapIdx >= newArr.length) return;
    [newArr[index], newArr[swapIdx]] = [newArr[swapIdx], newArr[index]];
    setExercises(newArr);
  };

  const handleSave = async () => {
    if (!workoutName.trim()) { setError("Give your workout a name."); return; }
    if (exercises.length === 0) { setError("Add at least one exercise."); return; }
    setError("");
    setSaving(true);

    try {
      // Server-side entitlement check (only needed for new workouts)
      if (!isEditing) {
        const check = httpsCallable(functions, "checkWorkoutSaveEntitlement");
        const result = await check();
        if (!result.data.allowed) {
          setShowGate(true);
          setSaving(false);
          return;
        }
      }

      const payload = {
        name: workoutName.trim(),
        exercises: exercises.map((e, i) => ({ ...e, order: i })),
        updatedAt: serverTimestamp(),
      };

      if (isEditing) {
        await updateDoc(doc(db, "users", user.uid, "workouts", workoutId), payload);
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "users", user.uid, "workouts"), payload);
      }

      navigate("/my-workouts");
    } catch (e) {
      console.error(e);
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
        <PortalNav />
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0", color: "#aaa" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <PortalNav />

      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 36px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => navigate("/my-workouts")}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}
          >
            ←
          </button>
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
            {isEditing ? "Edit Workout" : "New Workout"}
          </p>
        </div>

        {/* Workout name input */}
        <input
          type="text"
          placeholder="Workout name..."
          value={workoutName}
          onChange={(e) => setWorkoutName(e.target.value)}
          maxLength={50}
          style={{
            width: "100%",
            fontSize: 24,
            fontWeight: 700,
            color: "#fff",
            background: "transparent",
            border: "none",
            outline: "none",
            padding: 0,
            letterSpacing: "-0.3px",
            boxSizing: "border-box",
          }}
        />
        <div style={{ height: 2, backgroundColor: "rgba(255,255,255,0.2)", marginTop: 8, borderRadius: 1 }} />
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "6px 0 0" }}>
          e.g. Upper Body, Leg Day, Hotel Gym
        </p>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      <div style={{ padding: "0 16px" }}>

        {/* Exercise list */}
        {exercises.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", margin: "0 0 10px" }}>
              Exercises ({exercises.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {exercises.map((ex, i) => (
                <ExerciseCard
                  key={`${ex.exerciseId}-${i}`}
                  exercise={ex}
                  index={i}
                  total={exercises.length}
                  onChange={(updated) => updateExercise(i, updated)}
                  onRemove={() =>