import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";

const MUSCLE_GROUPS = ["Legs", "Chest", "Back", "Shoulders", "Arms", "Core", "Full Body", "Cardio"];

const empty = {
  name: "",
  description: "",
  type: "strength",
  muscleGroup: "Legs",
  defaultSets: 3,
  defaultReps: 10,
  repsMin: 8,
  repsMax: 12,
  defaultDuration: 30,
  defaultEffort: "moderate",
  coachingNotes: "",
  videoUrl: "",
  countPerSide: false,
};

export default function AdminExercises() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchExercises(); }, []);

  const fetchExercises = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "exercises"));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => a.name.localeCompare(b.name));
    setExercises(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return alert("Exercise name is required.");
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "exercises", editing), { ...form });
      } else {
        await addDoc(collection(db, "exercises"), { ...form, createdAt: new Date().toISOString() });
      }
      setForm(empty);
      setEditing(null);
      setShowForm(false);
      await fetchExercises();
    } catch (e) {
      alert("Error saving exercise.");
      console.error(e);
    }
    setSaving(false);
  };

  const handleEdit = (exercise) => {
    setForm({
      name: exercise.name || "",
      description: exercise.description || "",
      type: exercise.type || "strength",
      muscleGroup: exercise.muscleGroup || "Legs",
      defaultSets: exercise.defaultSets || 3,
      defaultReps: exercise.defaultReps || 10,
      repsMin: exercise.repsMin || 8,
      repsMax: exercise.repsMax || 12,
      defaultDuration: exercise.defaultDuration || 30,
      defaultEffort: exercise.defaultEffort || "moderate",
      coachingNotes: exercise.coachingNotes || "",
      videoUrl: exercise.videoUrl || "",
      countPerSide: exercise.countPerSide || false,
    });
    setEditing(exercise.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this exercise?")) return;
    await deleteDoc(doc(db, "exercises", id));
    await fetchExercises();
  };

  const filtered = search.trim()
    ? exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : exercises;

  const grouped = MUSCLE_GROUPS.reduce((acc, group) => {
    const items = filtered.filter((e) => e.muscleGroup === group);
    if (items.length > 0) acc[group] = items;
    return acc;
  }, {});

  const isCardio = form.type === "cardio";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "2rem" }}>

      <div style={{ padding: "1.5rem 1.25rem 1rem" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#2d6a4f", fontWeight: 600, textDecoration: "none" }}>← Admin</Link>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#111", margin: "8px 0 4px" }}>Exercise Library</h1>
        <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>{exercises.length} exercises</p>
      </div>

      {showForm && (
        <div style={{ margin: "0 1.25rem 1.5rem", backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", color: "#111" }}>
            {editing ? "Edit Exercise" : "New Exercise"}
          </h2>

          {/* Exercise type */}
          <label style={labelStyle}>Exercise Type</label>
          <div style={{ display: "flex", gap: "10px", marginBottom: "4px" }}>
            {[
              { val: "strength", icon: "🏋️", label: "Strength", sub: "Sets & reps" },
              { val: "cardio", icon: "🏃", label: "Cardio", sub: "Duration & effort" },
            ].map(opt => (
              <div key={opt.val} onClick={() => setForm({ ...form, type: opt.val })} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: `2px solid ${form.type === opt.val ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: form.type === opt.val ? "#eaf5ef" : "#fff", cursor: "pointer", textAlign: "center" }}>
                <p style={{ fontSize: "18px", margin: "0 0 3px" }}>{opt.icon}</p>
                <p style={{ fontWeight: 700, fontSize: "13px", color: form.type === opt.val ? "#2d6a4f" : "#111", margin: 0 }}>{opt.label}</p>
                <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>{opt.sub}</p>
              </div>
            ))}
          </div>

          <label style={labelStyle}>Exercise Name</label>
          <input style={inputStyle} placeholder={isCardio ? "e.g. Easy Walk" : "e.g. Goblet Squat"} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

          <label style={labelStyle}>Description</label>
          <input style={inputStyle} placeholder={isCardio ? "e.g. A steady comfortable walk." : "e.g. Build lower body strength and stability."} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <label style={labelStyle}>Category</label>
          <select style={inputStyle} value={form.muscleGroup} onChange={(e) => setForm({ ...form, muscleGroup: e.target.value })}>
            {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>

          {isCardio ? (
            <>
              <label style={labelStyle}>Default Duration (minutes)</label>
              <input style={inputStyle} type="number" value={form.defaultDuration} onChange={(e) => setForm({ ...form, defaultDuration: Number(e.target.value) })} />
              <label style={labelStyle}>Default Effort Level</label>
              <select style={inputStyle} value={form.defaultEffort} onChange={(e) => setForm({ ...form, defaultEffort: e.target.value })}>
                <option value="easy">Easy -- conversational pace</option>
                <option value="moderate">Moderate -- slightly breathless</option>
                <option value="brisk">Brisk -- elevated heart rate</option>
                <option value="hard">Hard -- difficult to talk</option>
              </select>
            </>
          ) : (
            <>
              <label style={labelStyle}>Default Sets</label>
              <input style={inputStyle} type="number" value={form.defaultSets} onChange={(e) => setForm({ ...form, defaultSets: Number(e.target.value) })} />

              <label style={labelStyle}>Rep Range</label>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "11px", color: "#888", margin: "0 0 4px", fontWeight: 600 }}>Min reps</p>
                  <input style={inputStyle} type="number" value={form.repsMin} onChange={(e) => setForm({ ...form, repsMin: Number(e.target.value) })} />
                </div>
                <div style={{ paddingTop: "16px", color: "#aaa", fontWeight: 700 }}>—</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "11px", color: "#888", margin: "0 0 4px", fontWeight: 600 }}>Max reps</p>
                  <input style={inputStyle} type="number" value={form.repsMax} onChange={(e) => setForm({ ...form, repsMax: Number(e.target.value) })} />
                </div>
              </div>
              <p style={{ fontSize: "11px", color: "#aaa", margin: "6px 0 14px" }}>
                Progression modal triggers when user completes all sets at {form.repsMax || 12} reps.
              </p>

              {/* Count per side toggle */}
              <div style={{ backgroundColor: "#f7f5f2", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>Count weight per side</p>
                  <p style={{ fontSize: "12px", color: "#888", margin: "3px 0 0" }}>
                    For unilateral exercises (e.g. bicep curls, single leg press). Doubles the volume in all calculations.
                  </p>
                </div>
                <div
                  onClick={() => setForm(f => ({ ...f, countPerSide: !f.countPerSide }))}
                  style={{ width: 44, height: 26, borderRadius: "13px", backgroundColor: form.countPerSide ? "#2d6a4f" : "#e5e5e5", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0, marginLeft: 16 }}
                >
                  <div style={{ position: "absolute", top: 3, left: form.countPerSide ? 21 : 3, width: 20, height: 20, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s" }} />
                </div>
              </div>
              {form.countPerSide && (
                <p style={{ fontSize: "11px", color: "#7c3aed", fontWeight: 700, margin: "6px 0 0", padding: "6px 10px", backgroundColor: "#f5f3ff", borderRadius: "8px" }}>
                  10kg × 10 reps = 200kg volume (counted as 2 sides)
                </p>
              )}
            </>
          )}

          <label style={labelStyle}>Coaching Notes</label>
          <textarea style={{ ...inputStyle, height: "100px", resize: "vertical" }} placeholder={isCardio ? "e.g. Keep a pace where you can hold a conversation." : "e.g. Keep chest tall, drive through heels."} value={form.coachingNotes} onChange={(e) => setForm({ ...form, coachingNotes: e.target.value })} />

          <label style={labelStyle}>Video URL (optional)</label>
          <input style={inputStyle} placeholder="https://youtube.com/..." value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />

          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", fontWeight: 700, fontSize: "15px", cursor: "pointer" }}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Exercise"}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); setForm(empty); }} style={{ backgroundColor: "#f0f0f0", color: "#555", border: "none", borderRadius: "10px", padding: "12px 20px", fontWeight: 600, fontSize: "15px", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <div style={{ padding: "0 1.25rem 1rem", display: "flex", flexDirection: "column", gap: "10px" }}>
          <button onClick={() => { setForm(empty); setEditing(null); setShowForm(true); }} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontWeight: 700, fontSize: "15px", cursor: "pointer" }}>
            + Add Exercise
          </button>
          <input style={{ ...inputStyle, backgroundColor: "#fff" }} placeholder="Search exercises..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>No exercises found.</p>
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <div key={group} style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#888", padding: "0 1.25rem", marginBottom: "8px" }}>
              {group} ({items.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "0 1.25rem" }}>
              {items.map((exercise) => (
                <div key={exercise.id} style={{ backgroundColor: "#fff", borderRadius: "12px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: "15px", color: "#111", margin: 0 }}>{exercise.name}</p>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px", flexWrap: "wrap" }}>
                      {exercise.type === "cardio" ? (
                        <>
                          <span style={{ fontSize: "10px", backgroundColor: "#e0f2fe", color: "#0369a1", fontWeight: 700, padding: "2px 8px", borderRadius: "20px" }}>🏃 Cardio</span>
                          <span style={{ fontSize: "10px", backgroundColor: "#f3f4f6", color: "#666", fontWeight: 700, padding: "2px 8px", borderRadius: "20px" }}>{exercise.defaultDuration || 30} min</span>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: "10px", color: "#888" }}>{exercise.defaultSets || 3} sets</span>
                          <span style={{ fontSize: "10px", backgroundColor: "#eaf5ef", color: "#2d6a4f", fontWeight: 700, padding: "2px 8px", borderRadius: "20px" }}>
                            {exercise.repsMin || 8}-{exercise.repsMax || exercise.defaultReps || 12} reps
                          </span>
                          {exercise.countPerSide && (
                            <span style={{ fontSize: "10px", backgroundColor: "#f5f3ff", color: "#7c3aed", fontWeight: 700, padding: "2px 8px", borderRadius: "20px" }}>per side</span>
                          )}
                        </>
                      )}
                      {exercise.videoUrl && <span style={{ fontSize: "10px", backgroundColor: "#e0f2fe", color: "#0369a1", fontWeight: 700, padding: "2px 8px", borderRadius: "20px" }}>Video</span>}
                      {exercise.coachingNotes && <span style={{ fontSize: "10px", backgroundColor: "#f3f4f6", color: "#666", fontWeight: 700, padding: "2px 8px", borderRadius: "20px" }}>Notes</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => handleEdit(exercise)} style={smallBtnStyle("#eaf5ef", "#2d6a4f")}>Edit</button>
                    <button onClick={() => handleDelete(exercise.id)} style={smallBtnStyle("#fef2f2", "#dc2626")}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: "12px", fontWeight: 600, color: "#555", marginBottom: "6px", marginTop: "14px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", color: "#111", backgroundColor: "#fafafa", boxSizing: "border-box" };
const smallBtnStyle = (bg, color) => ({ backgroundColor: bg, color, border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer" });