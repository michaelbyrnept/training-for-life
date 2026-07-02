import { useState, useEffect } from "react";
import {
  collection, doc, getDoc, addDoc, updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth, functions } from "../firebase";
import PortalNav from "../components/PortalNav";
import PremiumGate from "../components/PremiumGate";
import ExercisePicker from "../components/ExercisePicker";
import { useFeatures } from "../hooks/useFeatures";

// NOTE: this screen now only handles editing an existing saved workout's
// template (name, exercise list, target sets/reps/rest) via /my-workouts/:id/edit.
// The "create a new workout" flow lives in ActiveWorkout.jsx (Start Workout),
// which merges building and training into one screen. See
// "02 Projects/Product Vision/[C] Start Workout Flow Redesign.docx".

const DEFAULT_EXERCISE_CONFIG = { sets: 3, reps: "10", weight: "", restSeconds: 90, notes: "" };

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
                  onRemove={() => removeExercise(i)}
                  onMoveUp={() => moveExercise(i, -1)}
                  onMoveDown={() => moveExercise(i, 1)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Add exercise button */}
        <button
          onClick={() => setShowPicker(true)}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "14px",
            border: "2px dashed #2d6a4f",
            backgroundColor: exercises.length === 0 ? "#eaf5ef" : "transparent",
            color: "#2d6a4f",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 24,
          }}
        >
          + Add Exercise
        </button>

        {/* Error */}
        {error && (
          <div style={{ backgroundColor: "#fef2f2", border: "0.5px solid #fca5a5", borderRadius: "12px", padding: "12px 14px", marginBottom: 16 }}>
            <p style={{ color: "#dc2626", fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            backgroundColor: saving ? "#aaa" : "#2d6a4f",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            cursor: saving ? "default" : "pointer",
          }}
        >
          {saving ? "Saving..." : isEditing ? "Save Changes" : "Save Workout"}
        </button>

        {/* Free tier tip */}
        {!features.isPremium && !isEditing && (
          <p style={{ fontSize: 12, color: "#aaa", textAlign: "center", marginTop: 12 }}>
            Free plan: 1 saved workout. Upgrade for unlimited.
          </p>
        )}
      </div>

      {showPicker && (
        <ExercisePicker onSelect={addExercise} onClose={() => setShowPicker(false)} userId={user?.uid} />
      )}

      {showGate && (
        <PremiumGate reason="workout_limit" onClose={() => setShowGate(false)} />
      )}
    </div>
  );
}
