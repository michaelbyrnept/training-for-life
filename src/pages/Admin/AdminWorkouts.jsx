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
  const [replaceSearch, setReplaceSearch] = useState({});
  const [swapPanelOpen, setSwapPanelOpen] = useState({});
  const [swapSearch, setSwapSearch] = useState({});
  const [selectMode, setSelectMode] = useState(false);
const [selectedIds, setSelectedIds] = useState([]);

 const emptyWorkout = {
  adminName: "",
  displayName: "",
  description: "",
  adminNotes: "",

  estimatedTime: 30,
  exercises: [],

  createdFromProgramme: "",
  createdFromWeek: null,
};
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
          supersetWith: null,
          workoutSwapAlternatives: [],
          topSetMode: false,
        } : {
         exerciseId: exercise.id,
          name: exercise.name,
          type: "strength",
          isTimed: false,
          holdDuration: 30,
          sets: exercise.defaultSets || 3,
          reps: exercise.defaultReps || 10,
          repsMin: exercise.repsMin || 8,
          repsMax: exercise.repsMax || exercise.defaultReps || 12,
          order: form.exercises.length + 1,
          supersetWith: null,
          workoutSwapAlternatives: [],
          topSetMode: false,
          topSet: { repsMin: 1, repsMax: 3, rpe: 8 },
          backOff: { sets: 3, repsMin: 3, repsMax: 5, pct: 80 },
        },
      ],
    });
    setSearch("");
  };

  const replaceExercise = (oldExerciseId, newExercise) => {
    const isCardio = newExercise.type === "cardio";
    const oldEx = form.exercises.find(e => e.exerciseId === oldExerciseId);
    const newEx = isCardio ? {
      exerciseId: newExercise.id, name: newExercise.name, type: "cardio",
      duration: newExercise.defaultDuration || 30, effort: newExercise.defaultEffort || "moderate",
      order: oldEx?.order || 1, supersetWith: null, workoutSwapAlternatives: [], topSetMode: false,
    } : {
      exerciseId: newExercise.id, name: newExercise.name, type: "strength",
      sets: newExercise.defaultSets || 3, reps: newExercise.defaultReps || 10,
      repsMin: newExercise.repsMin || 8, repsMax: newExercise.repsMax || newExercise.defaultReps || 12,
      order: oldEx?.order || 1, supersetWith: null, workoutSwapAlternatives: [], topSetMode: false,
      topSet: { repsMin: 1, repsMax: 3, rpe: 8 },
      backOff: { sets: 3, repsMin: 3, repsMax: 5, pct: 80 },
    };
    const updated = form.exercises.map(e => {
      if (e.exerciseId === oldExerciseId) return newEx;
      if (e.supersetWith === oldExerciseId) return { ...e, supersetWith: null };
      return e;
    });
    setForm({ ...form, exercises: updated });
    setReplaceSearch(prev => ({ ...prev, [oldExerciseId]: "" }));
  };

  const removeExercise = (exerciseId) => {
    const updated = form.exercises
      .filter((e) => e.exerciseId !== exerciseId)
      .map(e => e.supersetWith === exerciseId ? { ...e, supersetWith: null } : e);
    setForm({ ...form, exercises: updated });
  };

  const updateExerciseField = (exerciseId, field, value) => {
    setForm({
      ...form,
      exercises: form.exercises.map((e) =>
        e.exerciseId === exerciseId ? { ...e, [field]: value } : e
      ),
    });
  };
const addRepsToAll = (amount) => {
  setForm({
    ...form,
    exercises: form.exercises.map(e => {
      if (e.type === "cardio") return e;
      if (e.topSetMode) {
        return {
          ...e,
          topSet: { ...e.topSet, repsMin: (e.topSet?.repsMin || 1) + amount, repsMax: (e.topSet?.repsMax || 3) + amount },
          backOff: { ...e.backOff, repsMin: (e.backOff?.repsMin || 3) + amount, repsMax: (e.backOff?.repsMax || 5) + amount },
        };
      }
      return { ...e, repsMin: (e.repsMin || 8) + amount, repsMax: (e.repsMax || 12) + amount };
    }),
  });
};

const addSetToAll = () => {
  setForm({
    ...form,
    exercises: form.exercises.map(e => {
      if (e.type === "cardio") return e;
      if (e.topSetMode) return { ...e, backOff: { ...e.backOff, sets: (e.backOff?.sets || 3) + 1 } };
      return { ...e, sets: (e.sets || 3) + 1 };
    }),
  });
};
  const updateTopSetField = (exerciseId, field, value) => {
    setForm({
      ...form,
      exercises: form.exercises.map((e) =>
        e.exerciseId === exerciseId ? { ...e, topSet: { ...e.topSet, [field]: value } } : e
      ),
    });
  };

  const updateBackOffField = (exerciseId, field, value) => {
    setForm({
      ...form,
      exercises: form.exercises.map((e) =>
        e.exerciseId === exerciseId ? { ...e, backOff: { ...e.backOff, [field]: value } } : e
      ),
    });
  };

  const toggleTopSetMode = (exerciseId) => {
    setForm({
      ...form,
      exercises: form.exercises.map((e) => {
        if (e.exerciseId !== exerciseId) return e;
        const newMode = !e.topSetMode;
        return {
          ...e,
          topSetMode: newMode,
          topSet: e.topSet || { repsMin: 1, repsMax: 3, rpe: 8 },
          backOff: e.backOff || { sets: 3, repsMin: 3, repsMax: 5, pct: 80 },
        };
      }),
    });
  };
const toggleTimedMode = (exerciseId) => {
  setForm({
    ...form,
    exercises: form.exercises.map(e =>
      e.exerciseId === exerciseId ? { ...e, isTimed: !e.isTimed, holdDuration: e.holdDuration || 30 } : e
    ),
  });
};
  const toggleSuperset = (index) => {
    const updated = [...form.exercises];
    const ex = updated[index];
    const nextEx = updated[index + 1];
    if (!nextEx) return;
    if (ex.supersetWith === nextEx.exerciseId) {
      updated[index] = { ...ex, supersetWith: null };
    } else {
      updated[index] = { ...ex, supersetWith: nextEx.exerciseId };
    }
    setForm({ ...form, exercises: updated });
  };

  const moveExercise = (index, direction) => {
    const updated = [...form.exercises];
    const swap = index + direction;
    if (swap < 0 || swap >= updated.length) return;
    updated[index] = { ...updated[index], supersetWith: null };
    updated[swap] = { ...updated[swap], supersetWith: null };
    [updated[index], updated[swap]] = [updated[swap], updated[index]];
    setForm({ ...form, exercises: updated.map((e, i) => ({ ...e, order: i + 1 })) });
  };
const [expandedBatches, setExpandedBatches] = useState({});

const getBatchKey = (createdAt) => createdAt ? createdAt.slice(0, 16) : "no-date"; // groups by same minute

const groupIntoBatches = (list) => {
  const map = {};
  list.forEach(w => {
    const key = getBatchKey(w.createdAt);
    if (!map[key]) map[key] = [];
    map[key].push(w);
  });
  return Object.entries(map)
    .map(([key, items]) => ({ key, items }))
    .sort((a, b) => b.key.localeCompare(a.key));
};
  const addWorkoutSwap = (exerciseId, altExercise) => {
    const ex = form.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) return;
    const alts = ex.workoutSwapAlternatives || [];
    if (alts.find(a => a.id === altExercise.id)) return;
    if (altExercise.id === exerciseId) return;
    updateExerciseField(exerciseId, "workoutSwapAlternatives", [...alts, { id: altExercise.id, name: altExercise.name }]);
    setSwapSearch(prev => ({ ...prev, [exerciseId]: "" }));
  };

  const removeWorkoutSwap = (exerciseId, altId) => {
    const ex = form.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) return;
    updateExerciseField(exerciseId, "workoutSwapAlternatives", (ex.workoutSwapAlternatives || []).filter(a => a.id !== altId));
  };

  const handleSave = async () => {
    if (!form.adminName?.trim()) {
  return alert("Admin name is required.");
}
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
      setReplaceSearch({}); setSwapPanelOpen({}); setSwapSearch({});
      await fetchAll();
    } catch (e) {
      alert("Error saving workout.");
      console.error(e);
    }
    setSaving(false);
  };

 const handleEdit = (workout) => {
  setForm({
    adminName: workout.adminName || workout.name || "",
    displayName: workout.displayName || "",
    description: workout.description || "",
    adminNotes: workout.adminNotes || "",

    estimatedTime: workout.estimatedTime || 30,

    createdFromProgramme: workout.createdFromProgramme || "",
    createdFromWeek: workout.createdFromWeek || null,

    exercises: (workout.exercises || []).map(e => ({
      ...e,
      workoutSwapAlternatives: e.workoutSwapAlternatives || [],
      topSetMode: e.topSetMode || false,
      topSet: e.topSet || { repsMin: 1, repsMax: 3, rpe: 8 },
      backOff: e.backOff || { sets: 3, repsMin: 3, repsMax: 5, pct: 80 },
    })),
  });

  setEditing(workout.id);
  setShowForm(true);
  setReplaceSearch({});
  setSwapPanelOpen({});
  setSwapSearch({});

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

  const handleDuplicate = async (workout) => {
    const copy = { ...workout, adminName: `${workout.adminName || workout.name} (Copy)`, createdAt: new Date().toISOString() };
    delete copy.id;
    await addDoc(collection(db, "workouts"), copy);
    await fetchAll();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this workout?")) return;
    await deleteDoc(doc(db, "workouts", id));
    await fetchAll();
  };
const toggleSelect = (id) => {
  setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
};

const handleBulkDelete = async () => {
  if (selectedIds.length === 0) return;
  if (!window.confirm(`Delete ${selectedIds.length} workouts? This cannot be undone.`)) return;
  await Promise.all(selectedIds.map(id => deleteDoc(doc(db, "workouts", id))));
  setSelectedIds([]);
  setSelectMode(false);
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
 }).sort((a, b) => (a.adminName || a.name || "").localeCompare(b.adminName || b.name || ""));

  const groupExercises = (exList) => {
    const groups = [];
    let i = 0;
    while (i < exList.length) {
      const ex = exList[i];
      const nextEx = exList[i + 1];
      if (ex.supersetWith && nextEx && ex.supersetWith === nextEx.exerciseId) {
        groups.push({ type: "superset", exercises: [ex, nextEx] });
        i += 2;
      } else {
        groups.push({ type: "single", exercises: [ex] });
        i += 1;
      }
    }
    return groups;
  };

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

          <label style={labelStyle}>Admin Name</label>
<input
  style={inputStyle}
  placeholder="e.g. CAP-W1A"
  value={form.adminName || ""}
  onChange={(e) => setForm({ ...form, adminName: e.target.value })}
/>

<label style={labelStyle}>User Display Name</label>
<input
  style={inputStyle}
  placeholder="e.g. Workout A"
  value={form.displayName || ""}
  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
/>

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
                        <span style={{ fontSize: "11px", backgroundColor: "#e0f2fe", color: "#0369a1", fontWeight: 700, padding: "2px 7px", borderRadius: "20px" }}>🏃 {exercise.defaultDuration || 30}min</span>
                      ) : (
                        <span style={{ fontSize: "11px", backgroundColor: "#eaf5ef", color: "#2d6a4f", fontWeight: 700, padding: "2px 7px", borderRadius: "20px" }}>{exercise.repsMin || 8}-{exercise.repsMax || 12} reps</span>
                      )}
                      <span style={{ fontSize: "12px", color: "#888" }}>{exercise.muscleGroup}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {form.exercises.length > 0 && (
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {form.exercises.length} exercise{form.exercises.length !== 1 ? "s" : ""} added
                <div style={{ display: "flex", gap: "8px" }}>
  <button onClick={() => addRepsToAll(2)} style={{ flex: 1, backgroundColor: "#eaf5ef", color: "#2d6a4f", border: "none", borderRadius: "8px", padding: "8px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
    +2 Reps (all)
  </button>
  <button onClick={addSetToAll} style={{ flex: 1, backgroundColor: "#eaf5ef", color: "#2d6a4f", border: "none", borderRadius: "8px", padding: "8px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
    +1 Set (all)
  </button>
</div>
              </p>

              {form.exercises.map((ex, index) => {
                const isCardio = ex.type === "cardio" || exerciseMap[ex.exerciseId]?.type === "cardio";
                const nextEx = form.exercises[index + 1];
                const isInSuperset = nextEx && ex.supersetWith === nextEx.exerciseId;
                const isSecondInSuperset = index > 0 && form.exercises[index - 1]?.supersetWith === ex.exerciseId;
                const isLastExercise = index === form.exercises.length - 1;
                const currentReplaceSearch = replaceSearch[ex.exerciseId] || "";
                const isSwapOpen = swapPanelOpen[ex.exerciseId] || false;
                const currentSwapSearch = swapSearch[ex.exerciseId] || "";
                const workoutSwaps = ex.workoutSwapAlternatives || [];
                const masterSwaps = exerciseMap[ex.exerciseId]?.swapAlternatives || [];
                const isTopSet = ex.topSetMode === true;

                const replaceResults = currentReplaceSearch.length > 1
                  ? exercises.filter(e =>
                      e.name.toLowerCase().includes(currentReplaceSearch.toLowerCase()) &&
                      e.id !== ex.exerciseId &&
                      !form.exercises.find(fe => fe.exerciseId === e.id)
                    ).slice(0, 6)
                  : [];

                const swapResults = currentSwapSearch.length > 1
                  ? exercises.filter(e =>
                      e.name.toLowerCase().includes(currentSwapSearch.toLowerCase()) &&
                      e.id !== ex.exerciseId &&
                      !workoutSwaps.find(w => w.id === e.id) &&
                      e.type !== "cardio"
                    ).slice(0, 6)
                  : [];

                return (
                  <div key={ex.exerciseId}>
                    {isInSuperset && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 2px 12px" }}>
                        <div style={{ width: 3, height: 12, backgroundColor: "#7c3aed", borderRadius: 2 }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.06em" }}>Superset</span>
                      </div>
                    )}

                    <div style={{
                      backgroundColor: isInSuperset || isSecondInSuperset ? "#faf5ff" : "#f7f5f2",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      border: isInSuperset || isSecondInSuperset ? "1px solid #e9d5ff" : "1px solid transparent",
                      borderLeft: isInSuperset || isSecondInSuperset ? "3px solid #7c3aed" : isTopSet ? "3px solid #0369a1" : "3px solid transparent",
                    }}>

                      {/* Exercise name + controls */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1 }}>
                          <span style={{ fontSize: "14px" }}>{isCardio ? "🏃" : "🏋️"}</span>
                          {(isInSuperset || isSecondInSuperset) && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", backgroundColor: "#f3e8ff", padding: "2px 7px", borderRadius: 20 }}>
                              {isSecondInSuperset ? "B" : "A"}
                            </span>
                          )}
                          {isTopSet && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#0369a1", backgroundColor: "#e0f2fe", padding: "2px 7px", borderRadius: 20 }}>Top Set</span>
                          )}
                          <div style={{ flex: 1, position: "relative" }}>
                            <input
                              style={{ ...inputStyle, padding: "6px 10px", fontSize: 14, fontWeight: 700, backgroundColor: currentReplaceSearch ? "#fff" : "transparent", border: currentReplaceSearch ? "1px solid #2d6a4f" : "none", color: "#111" }}
                              value={currentReplaceSearch || ex.name}
                              onFocus={() => setReplaceSearch(prev => ({ ...prev, [ex.exerciseId]: "" }))}
                              onChange={e => setReplaceSearch(prev => ({ ...prev, [ex.exerciseId]: e.target.value }))}
                              placeholder="Search to replace..."
                            />
                            {replaceResults.length > 0 && (
                              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, zIndex: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                                {replaceResults.map(e => (
                                  <div key={e.id} onClick={() => replaceExercise(ex.exerciseId, e)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "0.5px solid #f0f0f0", fontSize: 13, color: "#111", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontWeight: 600 }}>{e.name}</span>
                                    <span style={{ fontSize: 11, color: "#888" }}>{e.muscleGroup}</span>
                                  </div>
                                ))}
                                <div onClick={() => setReplaceSearch(prev => ({ ...prev, [ex.exerciseId]: "" }))} style={{ padding: "8px 14px", cursor: "pointer", fontSize: 12, color: "#888", textAlign: "center" }}>Cancel</div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          <button onClick={() => moveExercise(index, -1)} style={iconBtnStyle}>↑</button>
                          <button onClick={() => moveExercise(index, 1)} style={iconBtnStyle}>↓</button>
                          <button onClick={() => removeExercise(ex.exerciseId)} style={{ ...iconBtnStyle, color: "#dc2626" }}>✕</button>
                        </div>
                      </div>

                      {/* Fields */}
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
                      ) : isTopSet ? (
                        // Top Set + Back Off layout
                        <div>
                          {/* Top Set section */}
                          <div style={{ backgroundColor: "#e0f2fe", borderRadius: "8px 8px 0 0", padding: "8px 12px 4px" }}>
                            <p style={{ fontSize: 10, fontWeight: 800, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Top Set</p>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: "10px", color: "#0369a1", fontWeight: 600 }}>Min reps</label>
                                <input type="number" value={ex.topSet?.repsMin ?? 1} onChange={e => updateTopSetField(ex.exerciseId, "repsMin", Number(e.target.value))} style={{ ...inputStyle, marginTop: "3px", padding: "7px 10px", fontSize: 13 }} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: "10px", color: "#0369a1", fontWeight: 600 }}>Max reps</label>
                                <input type="number" value={ex.topSet?.repsMax ?? 3} onChange={e => updateTopSetField(ex.exerciseId, "repsMax", Number(e.target.value))} style={{ ...inputStyle, marginTop: "3px", padding: "7px 10px", fontSize: 13 }} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: "10px", color: "#0369a1", fontWeight: 600 }}>Target RPE</label>
                                <input type="number" min="1" max="10" step="0.5" value={ex.topSet?.rpe ?? 8} onChange={e => updateTopSetField(ex.exerciseId, "rpe", Number(e.target.value))} style={{ ...inputStyle, marginTop: "3px", padding: "7px 10px", fontSize: 13 }} />
                              </div>
                            </div>
                          </div>

                          {/* Divider */}
                          <div style={{ backgroundColor: "#0369a1", height: 2 }} />

                          {/* Back Off section */}
                          <div style={{ backgroundColor: "#f0f9ff", borderRadius: "0 0 8px 8px", padding: "8px 12px 10px" }}>
                            <p style={{ fontSize: 10, fontWeight: 800, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Back Off Sets</p>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: "10px", color: "#0369a1", fontWeight: 600 }}>Sets</label>
                                <input type="number" value={ex.backOff?.sets ?? 3} onChange={e => updateBackOffField(ex.exerciseId, "sets", Number(e.target.value))} style={{ ...inputStyle, marginTop: "3px", padding: "7px 10px", fontSize: 13 }} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: "10px", color: "#0369a1", fontWeight: 600 }}>Min reps</label>
                                <input type="number" value={ex.backOff?.repsMin ?? 3} onChange={e => updateBackOffField(ex.exerciseId, "repsMin", Number(e.target.value))} style={{ ...inputStyle, marginTop: "3px", padding: "7px 10px", fontSize: 13 }} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: "10px", color: "#0369a1", fontWeight: 600 }}>Max reps</label>
                                <input type="number" value={ex.backOff?.repsMax ?? 5} onChange={e => updateBackOffField(ex.exerciseId, "repsMax", Number(e.target.value))} style={{ ...inputStyle, marginTop: "3px", padding: "7px 10px", fontSize: 13 }} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: "10px", color: "#0369a1", fontWeight: 600 }}>% of top</label>
                                <input type="number" min="50" max="100" value={ex.backOff?.pct ?? 80} onChange={e => updateBackOffField(ex.exerciseId, "pct", Number(e.target.value))} style={{ ...inputStyle, marginTop: "3px", padding: "7px 10px", fontSize: 13 }} />
                              </div>
                            </div>
                            <p style={{ fontSize: "11px", color: "#0369a1", opacity: 0.7, margin: "6px 0 0" }}>
                              Weight auto-suggested at {ex.backOff?.pct ?? 80}% of whatever they hit on the top set
                            </p>
                          </div>
                        </div>
                      ) : (
                        // Standard sets/reps
                        <>
                    
{ex.isTimed ? (
  <div style={{ display: "flex", gap: "10px" }}>
    <div style={{ flex: 1 }}>
      <label style={{ fontSize: "11px", color: "#888", fontWeight: 600 }}>Sets</label>
      <input type="number" value={ex.sets} onChange={(e) => updateExerciseField(ex.exerciseId, "sets", Number(e.target.value))} style={{ ...inputStyle, marginTop: "4px" }} />
    </div>
    <div style={{ flex: 1 }}>
      <label style={{ fontSize: "11px", color: "#888", fontWeight: 600 }}>Hold (seconds)</label>
      <input type="number" value={ex.holdDuration || 30} onChange={(e) => updateExerciseField(ex.exerciseId, "holdDuration", Number(e.target.value))} style={{ ...inputStyle, marginTop: "4px" }} />
    </div>
  </div>
) : (
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
)}
<p style={{ fontSize: "11px", color: "#aaa", margin: "6px 0 0" }}>
  {ex.isTimed ? `Progression triggers at ${ex.sets} sets of ${ex.holdDuration || 30}s` : `Progression triggers at ${ex.sets} sets of ${ex.repsMax || 12} reps`}
</p>
</>
)}

                      {/* Bottom toolbar -- Top Set toggle + Swap options */}
                      {!isCardio && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {/* Top Set toggle */}
                          <button
                            onClick={() => toggleTopSetMode(ex.exerciseId)}
                            style={{
                              backgroundColor: isTopSet ? "#0369a1" : "#e0f2fe",
                              color: isTopSet ? "#fff" : "#0369a1",
                              border: "none", borderRadius: 20,
                              padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            {isTopSet ? "✓ Top Set + Back Off -- tap to remove" : "＋ Top Set + Back Off"}
                          </button>

                          {/* Swap options toggle */}
                          <button
                            onClick={() => setSwapPanelOpen(prev => ({ ...prev, [ex.exerciseId]: !isSwapOpen }))}
                            style={{
                              backgroundColor: workoutSwaps.length > 0 ? "#7c3aed" : "#f3e8ff",
                              color: workoutSwaps.length > 0 ? "#fff" : "#7c3aed",
                              border: "none", borderRadius: 20,
                              padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            🔄 Swaps ({workoutSwaps.length}) {isSwapOpen ? "▲" : "▼"}
                          </button>
                        </div>
                      )}

                      {/* Swap panel */}
                      {isSwapOpen && !isCardio && (
                        <div style={{ marginTop: 10, backgroundColor: "#faf5ff", borderRadius: 8, padding: 12 }}>
                          {masterSwaps.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <p style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600, margin: "0 0 6px" }}>From master list -- tap to add:</p>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {masterSwaps.filter(m => !workoutSwaps.find(w => w.id === m.id)).map(m => (
                                  <button key={m.id} onClick={() => addWorkoutSwap(ex.exerciseId, m)} style={{ backgroundColor: "#fff", border: "1px solid #c4b5fd", borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "#7c3aed", cursor: "pointer" }}>
                                    + {m.name}
                                  </button>
                                ))}
                                {masterSwaps.every(m => workoutSwaps.find(w => w.id === m.id)) && (
                                  <span style={{ fontSize: 11, color: "#aaa" }}>All master swaps added</span>
                                )}
                              </div>
                            </div>
                          )}
                          {workoutSwaps.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                              {workoutSwaps.map(alt => (
                                <div key={alt.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 8, padding: "8px 10px", border: "1px solid #e9d5ff" }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{alt.name}</span>
                                  <button onClick={() => removeWorkoutSwap(ex.exerciseId, alt.id)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>✕</button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ position: "relative" }}>
                            <input style={{ ...inputStyle, fontSize: 13 }} placeholder="Search library to add swap..." value={currentSwapSearch} onChange={e => setSwapSearch(prev => ({ ...prev, [ex.exerciseId]: e.target.value }))} />
                            {swapResults.length > 0 && (
                              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, zIndex: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                                {swapResults.map(e => (
                                  <div key={e.id} onClick={() => addWorkoutSwap(ex.exerciseId, e)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "0.5px solid #f0f0f0", fontSize: 13, color: "#111", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontWeight: 600 }}>{e.name}</span>
                                    <span style={{ fontSize: 11, color: "#888" }}>{e.muscleGroup}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {workoutSwaps.length === 0 && masterSwaps.length === 0 && (
                            <p style={{ fontSize: 11, color: "#aaa", margin: "6px 0 0", fontStyle: "italic" }}>No swap options yet. Search above or add them in the exercise library first.</p>
                          )}
                        </div>
                      )}
                    </div>
<button
  onClick={() => toggleTimedMode(ex.exerciseId)}
  style={{
    backgroundColor: ex.isTimed ? "#0369a1" : "#e0f2fe",
    color: ex.isTimed ? "#fff" : "#0369a1",
    border: "none", borderRadius: 20,
    padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
  }}
>
  {ex.isTimed ? "✓ Timed Hold -- tap for reps" : "⏱ Make Timed"}
</button>
                    {/* Superset toggle -- never on last exercise */}
                    {!isLastExercise && !isSecondInSuperset && (
                      <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
                        <button
                          onClick={() => toggleSuperset(index)}
                          style={{
                            backgroundColor: isInSuperset ? "#7c3aed" : "#f3f4f6",
                            color: isInSuperset ? "#fff" : "#6b7280",
                            border: "none", borderRadius: 20,
                            padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                          }}
                        >
                          {isInSuperset ? "⚡ Supersetted -- tap to remove" : "+ Superset with next"}
                        </button>
                      </div>
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
          <div style={{ display: "flex", gap: "0", background: "#e5e5e5", borderRadius: "10px", padding: "3px" }}>
            {["all", "strength", "cardio", "mixed"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ flex: 1, padding: "7px", borderRadius: "8px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer", backgroundColor: filter === f ? "#fff" : "transparent", color: filter === f ? "#2d6a4f" : "#888", textTransform: "capitalize" }}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => { setSelectMode(!selectMode); setSelectedIds([]); }} style={{ width: "100%", backgroundColor: selectMode ? "#dc2626" : "#f0f0f0", color: selectMode ? "#fff" : "#555", border: "none", borderRadius: "12px", padding: "10px", fontWeight: 700, fontSize: "13px", cursor: "pointer", marginBottom: "10px" }}>
  {selectMode ? `Cancel (${selectedIds.length} selected)` : "Select Multiple"}
</button>
{selectMode && selectedIds.length > 0 && (
  <button onClick={handleBulkDelete} style={{ width: "100%", backgroundColor: "#dc2626", color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontWeight: 700, fontSize: "14px", cursor: "pointer", marginBottom: "10px" }}>
    Delete {selectedIds.length} Workouts
  </button>
)}
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
          {groupIntoBatches(filteredWorkouts).map((batch) => {
            if (batch.items.length > 1 && !expandedBatches[batch.key]) {
              return (
                <div key={batch.key} onClick={() => setExpandedBatches(prev => ({ ...prev, [batch.key]: true }))} style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px dashed #ccc", padding: "14px 16px", cursor: "pointer" }}>
                  <p style={{ fontWeight: 700, fontSize: "15px", color: "#111", margin: 0 }}>📁 {batch.items.length} workouts (created together)</p>
                  <p style={{ fontSize: "12px", color: "#888", margin: "4px 0 0" }}>Tap to view</p>
                </div>
              );
            }
            return batch.items.map((workout) => {
            const type = getWorkoutType(workout);
            const badge = typeBadge(type);
            const isExpanded = expandedWorkout === workout.id;
            const groups = groupExercises(workout.exercises || []);
            const supersetCount = groups.filter(g => g.type === "superset").length;
            const topSetCount = (workout.exercises || []).filter(e => e.topSetMode).length;
            return (
              <div key={workout.id} style={{ backgroundColor: "#fff", borderRadius: "12px", border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                        <p style={{ fontWeight: 700, fontSize: "15px", color: "#111", margin: 0 }}> {workout.adminName || workout.name || "Unnamed Workout"}</p>
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span>
                        {supersetCount > 0 && (
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#f3e8ff", color: "#7c3aed" }}>⚡ {supersetCount} superset{supersetCount > 1 ? "s" : ""}</span>
                        )}
                        {topSetCount > 0 && (
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#e0f2fe", color: "#0369a1" }}>🎯 {topSetCount} top set{topSetCount > 1 ? "s" : ""}</span>
                        )}
                      </div>
                      <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>{workout.exercises?.length || 0} exercises · {workout.estimatedTime} min</p>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {selectMode && (
  <input type="checkbox" checked={selectedIds.includes(workout.id)} onChange={() => toggleSelect(workout.id)} style={{ width: 20, height: 20, marginRight: 4 }} />
)}
                      <button onClick={() => setExpandedWorkout(isExpanded ? null : workout.id)} style={smallBtnStyle("#f3f4f6", "#555")}>{isExpanded ? "Hide" : "Preview"}</button>
                      <button onClick={() => handleEdit(workout)} style={smallBtnStyle("#eaf5ef", "#2d6a4f")}>Edit</button>
                      <button onClick={() => handleDuplicate(workout)} style={smallBtnStyle("#f3f4f6", "#555")}>Copy</button>
                      <button onClick={() => handleDelete(workout.id)} style={smallBtnStyle("#fef2f2", "#dc2626")}>Delete</button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "0.5px solid #f0f0f0", padding: "12px 16px", backgroundColor: "#fafafa" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Exercises</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {groups.map((group, gi) => {
                        if (group.type === "superset") {
                          return (
                            <div key={gi} style={{ backgroundColor: "#faf5ff", border: "1px solid #e9d5ff", borderLeft: "3px solid #7c3aed", borderRadius: 8, padding: "8px 12px" }}>
                              <p style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Superset</p>
                              {group.exercises.map((ex, ei) => {
                                const isCardio = ex.type === "cardio";
                                const swapCount = (ex.workoutSwapAlternatives || []).length;
                                return (
                                  <div key={ei} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ei === 0 ? 4 : 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", width: 14 }}>{ei === 0 ? "A" : "B"}</span>
                                      <span style={{ fontSize: "13px", color: "#111", fontWeight: 600 }}>{ex.name}</span>
                                      {ex.topSetMode && <span style={{ fontSize: 10, color: "#0369a1", backgroundColor: "#e0f2fe", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>Top Set</span>}
                                      {swapCount > 0 && <span style={{ fontSize: 10, color: "#7c3aed", backgroundColor: "#f3e8ff", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>🔄 {swapCount}</span>}
                                    </div>
                                    <span style={{ fontSize: "12px", color: "#888" }}>
                                      {isCardio ? `${ex.duration || 30}min` : ex.topSetMode ? `Top ${ex.topSet?.repsMin}-${ex.topSet?.repsMax} + ${ex.backOff?.sets}x${ex.backOff?.pct}%` : `${ex.sets}x${ex.repsMin || 8}-${ex.repsMax || 12}`}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        const ex = group.exercises[0];
                        const isCardio = ex.type === "cardio";
                        const swapCount = (ex.workoutSwapAlternatives || []).length;
                        return (
                          <div key={gi} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", width: "16px" }}>{gi + 1}</span>
                              <span style={{ fontSize: "13px", color: "#111", fontWeight: 600 }}>{ex.name}</span>
                              {ex.topSetMode && <span style={{ fontSize: 10, color: "#0369a1", backgroundColor: "#e0f2fe", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>Top Set</span>}
                              {swapCount > 0 && <span style={{ fontSize: 10, color: "#7c3aed", backgroundColor: "#f3e8ff", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>🔄 {swapCount}</span>}
                            </div>
                            <span style={{ fontSize: "12px", color: "#888" }}>
                              {isCardio ? `${ex.duration || 30}min · ${ex.effort || "moderate"}` : ex.topSetMode ? `Top ${ex.topSet?.repsMin}-${ex.topSet?.repsMax} @ RPE${ex.topSet?.rpe} + ${ex.backOff?.sets}x${ex.backOff?.pct}%` : `${ex.sets}x${ex.repsMin || 8}-${ex.repsMax || 12}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
            });
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