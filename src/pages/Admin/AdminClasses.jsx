import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";

const CLASS_TYPES = [
  { id: "strength", label: "Strength", icon: "🏋️", color: "#2d6a4f", bg: "#eaf5ef" },
  { id: "conditioning", label: "Conditioning", icon: "🔥", color: "#b45309", bg: "#fffbeb" },
  { id: "spin", label: "Spin", icon: "🚴", color: "#0369a1", bg: "#e0f2fe" },
];

const TIMES = ["06:00","06:30","07:00","07:30","07:35","08:00","08:30","09:00","09:30","10:00","10:30","11:00","12:00","13:00","13:15","17:00","17:30","18:00","18:30","19:00"];

const emptyBlock = () => ({ duration: 10, goal: "", exercises: [] });

const emptyForm = {
  type: "strength",
  date: new Date().toISOString().split("T")[0],
  time: "07:35",
  duration: 30,
  title: "",
  blocks: [emptyBlock()],
  published: false,
};

export default function AdminClasses() {
  const [classes, setClasses] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickerState, setPickerState] = useState(null); // { blockIndex, search }

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [classSnap, exSnap] = await Promise.all([
      getDocs(collection(db, "classes")),
      getDocs(collection(db, "exercises")),
    ]);
    setClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(a.date) - new Date(b.date)));
    setExercises(exSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.name).sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return alert("Please add a class title.");
    setSaving(true);
    try {
      const data = { ...form, updatedAt: new Date().toISOString() };
      if (editing) {
        await updateDoc(doc(db, "classes", editing), data);
      } else {
        await addDoc(collection(db, "classes"), { ...data, createdAt: new Date().toISOString() });
      }
      setForm(emptyForm);
      setEditing(null);
      setShowForm(false);
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert("Error saving class.");
    }
    setSaving(false);
  };

  const handleEdit = (cls) => {
    setForm({
      type: cls.type || "strength",
      date: cls.date || new Date().toISOString().split("T")[0],
      time: cls.time || "07:35",
      duration: cls.duration || 30,
      title: cls.title || "",
      blocks: cls.blocks || [emptyBlock()],
      published: cls.published === true,
    });
    setEditing(cls.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this class?")) return;
    await deleteDoc(doc(db, "classes", id));
    await fetchAll();
  };

  // Block helpers
  const updateBlock = (bi, field, value) => {
    setForm(f => {
      const blocks = [...f.blocks];
      blocks[bi] = { ...blocks[bi], [field]: value };
      return { ...f, blocks };
    });
  };

  const addBlock = () => setForm(f => ({ ...f, blocks: [...f.blocks, emptyBlock()] }));

  const removeBlock = (bi) => setForm(f => ({ ...f, blocks: f.blocks.filter((_, i) => i !== bi) }));

  const addExerciseToBlock = (bi, ex) => {
    setForm(f => {
      const blocks = [...f.blocks];
      if (blocks[bi].exercises.find(e => e.exerciseId === ex.id)) return f;
      blocks[bi] = { ...blocks[bi], exercises: [...blocks[bi].exercises, { exerciseId: ex.id, name: ex.name }] };
      return { ...f, blocks };
    });
    setPickerState(null);
  };

  const removeExerciseFromBlock = (bi, exerciseId) => {
    setForm(f => {
      const blocks = [...f.blocks];
      blocks[bi] = { ...blocks[bi], exercises: blocks[bi].exercises.filter(e => e.exerciseId !== exerciseId) };
      return { ...f, blocks };
    });
  };

  const grouped = classes.reduce((acc, cls) => {
    const key = cls.date || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(cls);
    return acc;
  }, {});

  const isStrengthForm = form.type === "strength";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "2rem" }}>
      <div style={{ padding: "1.5rem 1.25rem 1rem" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#2d6a4f", fontWeight: 600, textDecoration: "none" }}>← Admin</Link>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#111", margin: "8px 0 4px" }}>Class Timetable</h1>
        <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>{classes.length} classes scheduled</p>
      </div>

      {showForm && (
        <div style={{ margin: "0 1.25rem 1.5rem", backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 16px" }}>{editing ? "Edit Class" : "New Class"}</h2>

          {/* Class type */}
          <p style={labelStyle}>Class Type</p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
            {CLASS_TYPES.map(t => (
              <div key={t.id} onClick={() => setForm(f => ({ ...f, type: t.id, blocks: t.id === "strength" ? f.blocks : [emptyBlock()] }))}
                style={{ flex: 1, padding: "10px 8px", borderRadius: "12px", border: `2px solid ${form.type === t.id ? t.color : "#e5e5e5"}`, backgroundColor: form.type === t.id ? t.bg : "#fff", cursor: "pointer", textAlign: "center" }}>
                <p style={{ fontSize: "20px", margin: "0 0 3px" }}>{t.icon}</p>
                <p style={{ fontSize: "12px", fontWeight: 700, color: form.type === t.id ? t.color : "#111", margin: 0 }}>{t.label}</p>
              </div>
            ))}
          </div>

          <p style={labelStyle}>Class Title</p>
          <input style={inputStyle} placeholder="e.g. Monday Morning Strength" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />

          <p style={labelStyle}>Date</p>
          <input type="date" style={inputStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />

          <p style={labelStyle}>Time</p>
          <select style={inputStyle} value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}>
            {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <p style={labelStyle}>Duration (minutes)</p>
          <input style={inputStyle} type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))} />

          {/* AMRAP BLOCKS (strength only) */}
          {isStrengthForm && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: 0 }}>AMRAP Blocks</p>
                <button onClick={addBlock} style={{ backgroundColor: "#eaf5ef", color: "#2d6a4f", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>+ Add Block</button>
              </div>

              {form.blocks.map((block, bi) => (
                <div key={bi} style={{ backgroundColor: "#f7f5f2", borderRadius: "12px", padding: "14px", marginBottom: "10px", border: "0.5px solid #e5e5e5" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a3a2a", margin: 0 }}>Block {bi + 1}</p>
                    {form.blocks.length > 1 && (
                      <button onClick={() => removeBlock(bi)} style={{ background: "none", border: "none", color: "#dc2626", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Remove</button>
                    )}
                  </div>

                  {/* Duration */}
                  <p style={{ fontSize: "11px", fontWeight: 600, color: "#555", margin: "0 0 4px" }}>Duration (minutes)</p>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                    {[8, 10, 12, 15, 20].map(d => (
                      <div key={d} onClick={() => updateBlock(bi, "duration", d)} style={{ padding: "6px 12px", borderRadius: "8px", border: `1.5px solid ${block.duration === d ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: block.duration === d ? "#eaf5ef" : "#fff", fontSize: "13px", fontWeight: 700, color: block.duration === d ? "#2d6a4f" : "#111", cursor: "pointer" }}>
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Coaching goal */}
                  <p style={{ fontSize: "11px", fontWeight: 600, color: "#555", margin: "0 0 4px" }}>Coaching Goal</p>
                  <input
                    style={{ ...inputStyle, marginBottom: "10px" }}
                    placeholder="e.g. Build to a heavy triple by minute 8-9"
                    value={block.goal}
                    onChange={e => updateBlock(bi, "goal", e.target.value)}
                  />

                  {/* Exercises */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 600, color: "#555", margin: 0 }}>Exercises ({block.exercises.length})</p>
                    <button onClick={() => setPickerState({ blockIndex: bi, search: "" })} style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>+ Add</button>
                  </div>

                  {block.exercises.length === 0 && (
                    <p style={{ fontSize: "12px", color: "#aaa", textAlign: "center", padding: "8px" }}>No exercises added</p>
                  )}

                  {block.exercises.map((ex, ei) => (
                    <div key={ex.exerciseId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: "8px", padding: "8px 10px", marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f", width: 18 }}>{ei + 1}</span>
                        <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: 0 }}>{ex.name}</p>
                      </div>
                      <button onClick={() => removeExerciseFromBlock(bi, ex.exerciseId)} style={{ background: "none", border: "none", color: "#dc2626", fontSize: "12px", cursor: "pointer" }}>Remove</button>
                    </div>
                  ))}

                  {/* Exercise picker for this block */}
                  {pickerState?.blockIndex === bi && (
                    <div style={{ backgroundColor: "#fff", borderRadius: "10px", padding: "10px", marginTop: "6px" }}>
                      <input
                        type="text"
                        placeholder="Search exercises..."
                        value={pickerState.search}
                        onChange={e => setPickerState(p => ({ ...p, search: e.target.value }))}
                        autoFocus
                        style={{ ...inputStyle, margin: "0 0 8px" }}
                      />
                      <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {exercises
                          .filter(e => e.name.toLowerCase().includes(pickerState.search.toLowerCase()) && !block.exercises.find(be => be.exerciseId === e.id))
                          .slice(0, 20)
                          .map(ex => (
                            <div key={ex.id} onClick={() => addExerciseToBlock(bi, ex)} style={{ padding: "8px 10px", backgroundColor: "#f7f5f2", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <p style={{ fontSize: "13px", fontWeight: 600, color: "#111", margin: 0 }}>{ex.name}</p>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f" }}>+ Add</span>
                            </div>
                          ))}
                          {pickerState.search.trim() && !exercises.find(e => e.name.toLowerCase() === pickerState.search.toLowerCase()) && (
                            <div onClick={() => setPickerState(p => ({ ...p, creating: true }))} style={{ padding: "8px 10px", backgroundColor: "#eaf5ef", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px dashed #2d6a4f" }}>
                              <p style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>Create "{pickerState.search}"</p>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f" }}>+ New</span>
                            </div>
                          )}
                      </div>

                      {pickerState?.creating && (
                        <QuickCreateExercise
                          name={pickerState.search}
                          onCreated={(ex) => { addExerciseToBlock(bi, ex); setExercises(prev => [...prev, ex].sort((a, b) => a.name.localeCompare(b.name))); }}
                          onCancel={() => setPickerState(p => ({ ...p, creating: false }))}
                        />
                      )}
                      <button onClick={() => setPickerState(null)} style={{ width: "100%", background: "none", border: "none", fontSize: "12px", color: "#aaa", cursor: "pointer", marginTop: "6px" }}>Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Publish toggle */}
          <div onClick={() => setForm(f => ({ ...f, published: !f.published }))}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: "12px", backgroundColor: form.published ? "#eaf5ef" : "#f7f5f2", border: `1.5px solid ${form.published ? "#2d6a4f" : "#e5e5e5"}`, cursor: "pointer", marginTop: "16px" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 700, color: form.published ? "#2d6a4f" : "#111", margin: 0 }}>
                {form.published ? "Published -- visible to members" : "Draft -- not visible to members"}
              </p>
              <p style={{ fontSize: "12px", color: "#888", margin: "3px 0 0" }}>{form.published ? "Tap to unpublish" : "Tap to publish when ready"}</p>
            </div>
            <div style={{ width: 44, height: 26, borderRadius: "13px", backgroundColor: form.published ? "#2d6a4f" : "#e5e5e5", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 3, left: form.published ? 21 : 3, width: 20, height: 20, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "10px", padding: "13px", fontWeight: 700, fontSize: "15px", cursor: "pointer" }}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Save Class"}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm); }} style={{ backgroundColor: "#f0f0f0", color: "#555", border: "none", borderRadius: "10px", padding: "13px 20px", fontWeight: 600, fontSize: "15px", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <div style={{ padding: "0 1.25rem 1rem" }}>
          <button onClick={() => { setForm(emptyForm); setEditing(null); setShowForm(true); }} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontWeight: 700, fontSize: "15px", cursor: "pointer" }}>
            + Add Class
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>Loading...</p>
      ) : classes.length === 0 ? (
        <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>No classes yet.</p>
      ) : (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date} style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#888", padding: "0 1.25rem", marginBottom: "8px" }}>
              {new Date(date + "T12:00:00").toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "0 1.25rem" }}>
              {items.map(cls => {
                const typeInfo = CLASS_TYPES.find(t => t.id === cls.type) || CLASS_TYPES[0];
                const blockCount = cls.blocks?.length || 0;
                const exCount = cls.blocks?.reduce((s, b) => s + (b.exercises?.length || 0), 0) || 0;
                return (
                  <div key={cls.id} style={{ backgroundColor: "#fff", borderRadius: "12px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: typeInfo.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
                        {typeInfo.icon}
                      </div>
                      <div>
                        <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{cls.title}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                          <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
                            {cls.time} · {cls.duration} min
                            {blockCount > 0 && ` · ${blockCount} block${blockCount > 1 ? "s" : ""}`}
                            {exCount > 0 && ` · ${exCount} exercises`}
                          </p>
                          {!cls.published && <span style={{ fontSize: "10px", fontWeight: 700, color: "#888", backgroundColor: "#f0f0f0", padding: "2px 8px", borderRadius: "10px" }}>Draft</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => handleEdit(cls)} style={smallBtn("#eaf5ef", "#2d6a4f")}>Edit</button>
                      <button onClick={() => handleDelete(cls.id)} style={smallBtn("#fef2f2", "#dc2626")}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function QuickCreateExercise({ name, onCreated, onCancel }) {
  const [form, setForm] = useState({
    name: name || "",
    muscleGroup: "Legs",
    type: "strength",
    videoUrl: "",
    defaultSets: 3,
    repsMin: 8,
    repsMax: 12,
  });
  const [saving, setSaving] = useState(false);

  const MUSCLE_GROUPS = ["Legs", "Chest", "Back", "Shoulders", "Arms", "Core", "Full Body"];

  const handleCreate = async () => {
    if (!form.name.trim()) return alert("Exercise name required.");
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "exercises"), {
        ...form,
        coachingNotes: "",
        createdAt: new Date().toISOString(),
      });
      onCreated({ id: ref.id, ...form });
    } catch (e) {
      console.error(e);
      alert("Error creating exercise.");
    }
    setSaving(false);
  };

  return (
    <div style={{ backgroundColor: "#eaf5ef", borderRadius: "10px", padding: "12px", marginTop: "8px", border: "1px solid #86efac" }}>
      <p style={{ fontSize: "12px", fontWeight: 700, color: "#2d6a4f", margin: "0 0 10px" }}>Create New Exercise</p>
      <input
        style={{ ...inputStyle, marginBottom: "8px" }}
        placeholder="Exercise name"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        autoFocus
      />
      <select style={{ ...inputStyle, marginBottom: "8px" }} value={form.muscleGroup} onChange={e => setForm(f => ({ ...f, muscleGroup: e.target.value }))}>
        {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <input
        style={{ ...inputStyle, marginBottom: "10px" }}
        placeholder="Video URL (optional)"
        value={form.videoUrl}
        onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))}
      />
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={handleCreate} disabled={saving} style={{ flex: 1, backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "8px", padding: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Creating..." : "Create & Add"}
        </button>
        <button onClick={onCancel} style={{ backgroundColor: "#fff", color: "#555", border: "0.5px solid #e5e5e5", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: "12px", fontWeight: 600, color: "#555", marginBottom: "6px", marginTop: "14px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", color: "#111", backgroundColor: "#fafafa", boxSizing: "border-box" };
const smallBtn = (bg, color) => ({ backgroundColor: bg, color, border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer" });
