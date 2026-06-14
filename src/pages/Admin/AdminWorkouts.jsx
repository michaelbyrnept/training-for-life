import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";

const EFFORT_OPTIONS = ["easy", "moderate", "brisk", "hard"];

export default function AdminWorkouts() {
  const [workouts, setWorkouts] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [exerciseMap, setExerciseMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedWorkout, setExpandedWorkout] = useState(null);

  const emptyWorkout = { name: "", description: "", estimatedTime: 30, exercises: [] };
  const [form, setForm] = useState(emptyWorkout);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [workoutSnap, exerciseSnap] = await Promise.all([
      getDocs(collection(db, "workouts")),
      getDocs(collection(db, "exercises")),
    ]);
    setWorkouts(workoutSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    const exData = exerciseSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name));
    setExercises(exData);
    const map = {};
    exData.forEach(e => { map[e.id] = e; });
    setExerciseMap(map);
    setLoading(false);
  };

  const getWorkoutType = (workout) => {
    if (!workout.exercises?.length) return "strength";
    const types = workout.exercises.map(e => exerciseMap[e.exerciseId]?.type || e.type || "strength");
    const hasCardio = types.some(t => t === "cardio");
    const hasStrength = types.some(t => t === "strength");
    if (hasCardio && hasStrength) return "mixed";
    if (hasCardio) return "cardio";
    return "strength";
  };

  const addExerciseToWorkout = (exercise) => {
    const already = form.exercises.find((e) => e.exerciseId === exercise.id);
    if (already) return;
    const isCardio = exercise.type === "cardio";
    setForm({
      ...form,
      exercises: [
        ...form.exercises,
        isCardio ? {
          exerciseId: exercise.id,
          name: exercise.name,
          type: "cardio",
          duration: exercise.defaultDuration || 30,
          effort: exercise.defaultEffort || "moderate",
          order: form.exercises.length + 1,
        } : {
          exerciseId: exercise.id,
          name: exercise.name,
          type: "strength",
          sets: exercise.defaultSets || 3,
          reps: exercise.defaultReps || 10,
          repsMin: exercise.repsMin || 8,
          repsMax: exercise.repsMax || exercise.defaultReps || 12,
          order: form.exercises.length + 1,
        },
      ],
    });
    setSearch("");
  };

  const removeExercise = (exerciseId) => {
    setForm({ ...form, exercises: form.exercises.filter((e) => e.exerciseId !== exerciseId) });
  };

  const updateExerciseField = (exerciseId, field, value) => {
    setForm({
      ...form,
      exercises: form.exercises.map((e) =>
        e.exerciseId === exerciseId ? { ...e, [field]: value } : e
      ),
    });
  };

  const moveExercise = (index, direction) => {
    const updated = [...form.exercises];
    const swap = index + direction;
    if (swap < 0 || swap >= updated.length) return;
    [updated[index], updated[swap]] = [updated[swap], updated[index]];
    setForm({ ...form, exercises: updated.map((e, i) => ({ ...e, order: i + 1 })) });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return alert("Workout name is required.");
    if (form.exercises.length === 0) return alert("Add at least one exercise.");
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "workouts", editing), { ...form });
      } else {
        await addDoc(collection(db, "workouts"), { ...form, createdAt: new Date().toISOString() });
      }
      setForm(emptyWorkout);
      setEditing(null);
      setShowForm(false);
      await fetchAll();
    } catch (e) {
      alert("Error saving workout.");
      console.error(e);
    }
    setSaving(false);
  };

  const handleEdit = (workout) => {
    setForm({
      name: workout.name,
      description: workout.description || "",
      estimatedTime: workout.estimatedTime || 30,
      exercises: workout.exercises || [],
    });
    setEditing(workout.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDuplicate = async (workout) => {
    const copy = { ...workout, name: `${workout.name} (Copy)`, createdAt: new Date().toISOString() };
    delete copy.id;
    await addDoc(collection(db, "workouts"), copy);
    await fetchAll();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this workout?")) return;
    await deleteDoc(doc(db, "workouts", id));
    await fetchAll();
  };

  const filteredExercises = exercises.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) &&
      !form.exercises.find((fe) => fe.exerciseId === e.id)
  );

  const typeBadge = (type) => {
    if (type === "cardio") return { label: "🏃 Cardio", bg: "#e0f2fe", color: "#0369a1" };
    if (type === "mixed") return { label: "⚡ Mixed", bg: "#f3e8ff", color: "#7c3aed" };
    return { label: "🏋️ Strength", bg: "#eaf5ef", color: "#2d6a4f" };
  };

  const filteredWorkouts = workouts.filter(w => {
    if (filter === "all") return true;
    return getWorkoutType(w) === filter;
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "2rem" }}>

      <div style={{ padding: "1.5rem 1.25rem 1rem" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#2d6a4f", fontWeight: 600, textDecoration: "none" }}>← Admin</Link>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#111", margin: "8px 0 4px" }}>Workout Builder</h1>
        <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>{workouts.length} workouts</p>
      </div>

      {showForm && (
        <div style={{ margin: "0 1.25rem 1.5rem", backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", color: "#111" }}>
            {editing ? "Edit Workout" : "New Workout"}
          </h2>

          <label style={labelStyle}>Workout Name</label>
          <input style={inputStyle} placeholder="e.g. Capability A" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

          <label style={labelStyle}>Description</label>
          <input style={inputStyle} placeholder="e.g. Your first session of the week." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <label style={labelStyle}>Estimated Time (minutes)</label>
          <input style={inputStyle} type="number" value={form.estimatedTime} onChange={(e) => setForm({ ...form, estimatedTime: Number(e.target.value) })} />

          <label style={{ ...labelStyle, marginTop: "20px" }}>Add Exercises</label>
          <input style={inputStyle} placeholder="Search exercise library..." value={search} onChange={(e) => setSearch(e.target.value)} />

          {search.length > 0 && filteredExercises.length > 0 && (
            <div style={{ border: "1px solid #e5e5e5", borderRadius: "8px", marginTop: "4px", overflow: "hidden" }}>
              {filteredExercises.slice(0, 8).map((exercise) => {
                const isCardio = exercise.type === "cardio";
                return (
                  <div key={exercise.id} onClick={() => addExerciseToWorkout(exercise)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "0.5px solid #f0f0f0", fontSize: "14px", color: "#111", backgroundColor: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{exercise.name}</span>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {isCardio ? (
                        <span style={{ fontSize: "11px", backgroundColor: "#e0f2fe", color: "#0369a1", fontWeight: 700, padding: "2px 7px", borderRadius: "20px" }}>
                          🏃 {exercise.defaultDuration || 30}min
                        </span>
                      ) : (
                        <span style={{ fontSize: "11px", backgroundColor: "#eaf5ef", color: "#2d6a4f", fontWeight: 700, padding: "2px 7px", borderRadius: "20px" }}>
                          {exercise.repsMin || 8}-{exercise.repsMax || 12} reps
                        </span>
                      )}
                      <span style={{ fontSize: "12px", color: "#888" }}>{exercise.muscleGroup}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {form.exercises.length > 0 && (
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {form.exercises.length} exercise{form.exercises.length !== 1 ? "s" : ""} added
              </p>
              {form.exercises.map((ex, index) => {
                const isCardio = ex.type === "cardio" || exerciseMap[ex.exerciseId]?.type === "cardio";
                return (
                  <div key={ex.exerciseId} style={{ backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "14px" }}>{isCardio ? "🏃" : "🏋️"}</span>
                        <span style={{ fontWeight: 700, fontSize: "14px", color: "#111" }}>{ex.name}</span>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => moveExercise(index, -1)} style={iconBtnStyle}>↑</button>
                        <button onClick={() => moveExercise(index, 1)} style={iconBtnStyle}>↓</button>
                        <button onClick={() => removeExercise(ex.exerciseId)} style={{ ...iconBtnStyle, color: "#dc2626" }}>✕</button>
                      </div>
                    </div>

                    {isCardio ? (
                      <div style={{ display: "flex", gap: "10px" }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: "11px", color: "#888", fontWeight: 600 }}>Duration (min)</label>
                          <input type="number" value={ex.duration || 30} onChange={(e) => updateExerciseField(ex.exerciseId, "duration", Number(e.target.value))} style={{ ...inputStyle, marginTop: "4px" }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: "11px", color: "#888", fontWeight: 600 }}>Effort Level</label>
                          <select value={ex.effort || "moderate"} onChange={(e) => updateExerciseField(ex.exerciseId, "effort", e.target.value)} style={{ ...inputStyle, marginTop: "4px" }}>
                            {EFFORT_OPTIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: "11px", color: "#888", fontWeight: 600 }}>Sets</label>
                            <input type="number" value={ex.sets} onChange={(e) => updateExerciseField(ex.exerciseId, "sets", Number(e.target.value))} style={{ ...inputStyle, marginTop: "4px" }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: "11px", color: "#888", fontWeight: 600 }}>Min reps</label>
                            <input type="number" value={ex.repsMin || 8} onChange={(e) => updateExerciseField(ex.exerciseId, "repsMin", Number(e.target.value))} style={{ ...inputStyle, marginTop: "4px" }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: "11px", color: "#888", fontWeight: 600 }}>Max reps</label>
                            <input type="number" value={ex.repsMax || 12} onChange={(e) => updateExerciseField(ex.exerciseId, "repsMax", Number(e.target.value))} style={{ ...inputStyle, marginTop: "4px" }} />
                          </div>
                        </div>
                        <p style={{ fontSize: "11px", color: "#aaa", margin: "6px 0 0" }}>
                          Progression triggers at {ex.sets} sets of {ex.repsMax || 12} reps
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", fontWeight: 700, fontSize: "15px", cursor: "pointer" }}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Workout"}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); setForm(emptyWorkout); }} style={{ backgroundColor: "#f0f0f0", color: "#555", border: "none", borderRadius: "10px", padding: "12px 20px", fontWeight: 600, fontSize: "15px", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <div style={{ padding: "0 1.25rem 1rem" }}>
          <button onClick={() => { setForm(emptyWorkout); setEditing(null); setShowForm(true); }} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontWeight: 700, fontSize: "15px", cursor: "pointer", marginBottom: "10px" }}>
            + Create Workout
          </button>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: "0", background: "#e5e5e5", borderRadius: "10px", padding: "3px" }}>
            {["all", "strength", "cardio", "mixed"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ flex: 1, padding: "7px", borderRadius: "8px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer", backgroundColor: filter === f ? "#fff" : "transparent", color: filter === f ? "#2d6a4f" : "#888", textTransform: "capitalize" }}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>Loading...</p>
      ) : filteredWorkouts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <p style={{ fontSize: "32px", margin: "0 0 12px" }}>💪</p>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No workouts yet</p>
          <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>Create your first workout above to get started.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "0 1.25rem" }}>
          {filteredWorkouts.map((workout) => {
            const type = getWorkoutType(workout);
            const badge = typeBadge(type);
            const isExpanded = expandedWorkout === workout.id;
            return (
              <div key={workout.id} style={{ backgroundColor: "#fff", borderRadius: "12px", border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                        <p style={{ fontWeight: 700, fontSize: "15px", color: "#111", margin: 0 }}>{workout.name}</p>
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      </div>
                      <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
                        {workout.exercises?.length || 0} exercises · {workout.estimatedTime} min
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button onClick={() => setExpandedWorkout(isExpanded ? null : workout.id)} style={smallBtnStyle("#f3f4f6", "#555")}>
                        {isExpanded ? "Hide" : "Preview"}
                      </button>
                      <button onClick={() => handleEdit(workout)} style={smallBtnStyle("#eaf5ef", "#2d6a4f")}>Edit</button>
                      <button onClick={() => handleDuplicate(workout)} style={smallBtnStyle("#f3f4f6", "#555")}>Copy</button>
                      <button onClick={() => handleDelete(workout.id)} style={smallBtnStyle("#fef2f2", "#dc2626")}>Delete</button>
                    </div>
                  </div>
                </div>

                {/* Exercise preview */}
                {isExpanded && (
                  <div style={{ borderTop: "0.5px solid #f0f0f0", padding: "12px 16px", backgroundColor: "#fafafa" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Exercises</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {workout.exercises?.map((ex, i) => {
                        const exDetail = exerciseMap[ex.exerciseId];
                        const isCardio = ex.type === "cardio" || exDetail?.type === "cardio";
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", width: "16px" }}>{i + 1}</span>
                              <span style={{ fontSize: "13px", color: "#111", fontWeight: 600 }}>{ex.name}</span>
                            </div>
                            <span style={{ fontSize: "12px", color: "#888" }}>
                              {isCardio ? `${ex.duration || 30}min · ${ex.effort || "moderate"}` : `${ex.sets}×${ex.repsMin || 8}-${ex.repsMax || 12}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: "12px", fontWeight: 600, color: "#555", marginBottom: "6px", marginTop: "14px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", color: "#111", backgroundColor: "#fafafa", boxSizing: "border-box" };
const iconBtnStyle = { backgroundColor: "#e5e5e5", border: "none", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "12px", fontWeight: 700 };
const smallBtnStyle = (bg, color) => ({ backgroundColor: bg, color, border: "none", borderRadius: "8px", padding: "6px 10px", fontSize: "11px", fontWeight: 600, cursor: "pointer" });