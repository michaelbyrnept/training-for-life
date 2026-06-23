import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, getDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";
import SeedCapabilityButton from "../../components/SeedCapabilityButton";

const LEVELS = ["Beginner", "Beginner-Intermediate", "Intermediate", "All levels"];

const emptyProgramme = {
  name: "",
  description: "",
  tag: "",
  level: "Beginner",
  free: true,
  repeating: false,
  weeks: [{ weekNumber: 1, title: "Week 1", workouts: [] }],
  published: false,
};

export default function AdminProgrammes() {
  const [programmes, setProgrammes] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProgramme);
  const [expandedWorkouts, setExpandedWorkouts] = useState({});
  const [workoutDetails, setWorkoutDetails] = useState({});

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [progSnap, workoutSnap] = await Promise.all([
      getDocs(collection(db, "programmes")),
      getDocs(collection(db, "workouts")),
    ]);
    setProgrammes(progSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    const wData = workoutSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setWorkouts(wData);
    const details = {};
    wData.forEach(w => { details[w.id] = w; });
    setWorkoutDetails(details);
    setLoading(false);
  };

  const addWeek = () => {
    const nextNum = form.weeks.length + 1;
    setForm({ ...form, weeks: [...form.weeks, { weekNumber: nextNum, title: `Week ${nextNum}`, workouts: [] }] });
  };

  const duplicateWeek = (index) => {
    const source = form.weeks[index];
    const newWeeks = [...form.weeks];
    const duplicate = { ...source, weekNumber: newWeeks.length + 1, title: `Week ${newWeeks.length + 1}` };
    newWeeks.push(duplicate);
    setForm({ ...form, weeks: newWeeks });
  };

  const duplicateWeekMultiple = async (index, count) => {
  const source = form.weeks[index];
  const newWeeks = [...form.weeks];

  for (let i = 0; i < count; i++) {
    const weekNumber = newWeeks.length + 1;
const duplicateWorkoutInWeek = async (weekIndex, workoutId) => {
  const snap = await getDoc(doc(db, "workouts", workoutId));
  if (!snap.exists()) return;
  const { ...data } = snap.data();

  const newWorkout = {
    ...data,
    adminName: `${data.adminName}-COPY`,
    displayName: `${data.displayName} (Copy)`,
    createdFromProgramme: editing || "",
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(collection(db, "workouts"), newWorkout);

  const newWeeks = [...form.weeks];
  const week = { ...newWeeks[weekIndex] };
  const idx = week.workouts.indexOf(workoutId);
  week.workouts = [...week.workouts.slice(0, idx + 1), ref.id, ...week.workouts.slice(idx + 1)];
  newWeeks[weekIndex] = week;
  setForm({ ...form, weeks: newWeeks });

  setWorkoutDetails(prev => ({ ...prev, [ref.id]: newWorkout }));
};
    const newWorkoutIds = await Promise.all(
      (source.workouts || []).map(async (wId, letterIdx) => {
        const snap = await getDoc(doc(db, "workouts", wId));
        if (!snap.exists()) return null;
        const { ...data } = snap.data();
        const letter = String.fromCharCode(65 + letterIdx); // A, B, C...
        const prefix = data.adminName?.split("-W")[0] || "WO";
        const newWorkout = {
          ...data,
          adminName: `${prefix}-W${weekNumber}${letter}`,
          createdFromProgramme: editing || "",
          createdFromWeek: weekNumber,
          createdAt: new Date().toISOString(),
        };
        const ref = await addDoc(collection(db, "workouts"), newWorkout);
        return ref.id;
      })
    );

    newWeeks.push({
      ...source,
      weekNumber,
      title: `Week ${weekNumber}`,
      workouts: newWorkoutIds.filter(Boolean),
    });
  }

  setForm({ ...form, weeks: newWeeks });
};

  const removeWeek = (index) => {
    if (form.weeks.length === 1) return alert("Programme must have at least one week.");
    const updated = form.weeks.filter((_, i) => i !== index);
    setForm({ ...form, weeks: updated.map((w, i) => ({ ...w, weekNumber: i + 1 })) });
  };
const insertWeek = async (index, copyFromIndex = null) => {
  const weekNumber = index + 2; // inserting after `index`

  let newWorkoutIds = [];
  if (copyFromIndex !== null) {
    const source = form.weeks[copyFromIndex];
    newWorkoutIds = (
      await Promise.all(
        (source.workouts || []).map(async (wId, letterIdx) => {
          const snap = await getDoc(doc(db, "workouts", wId));
          if (!snap.exists()) return null;
          const { ...data } = snap.data();
          const letter = String.fromCharCode(65 + letterIdx);
          const prefix = data.adminName?.split("-W")[0] || "WO";
          const newWorkout = {
            ...data,
            adminName: `${prefix}-W${weekNumber}${letter}`,
            createdFromProgramme: editing || "",
            createdFromWeek: weekNumber,
            createdAt: new Date().toISOString(),
          };
          const ref = await addDoc(collection(db, "workouts"), newWorkout);
          setWorkoutDetails(prev => ({ ...prev, [ref.id]: newWorkout }));
          return ref.id;
        })
      )
    ).filter(Boolean);
  }

  const newWeek = {
    title: `Week ${weekNumber}`,
    weekNumber,
    workouts: newWorkoutIds,
  };

  const updated = [...form.weeks];
  updated.splice(index + 1, 0, newWeek);
  setForm({ ...form, weeks: updated.map((w, i) => ({ ...w, weekNumber: i + 1 })) });
};
  const moveWeek = (index, direction) => {
    const updated = [...form.weeks];
    const swap = index + direction;
    if (swap < 0 || swap >= updated.length) return;
    [updated[index], updated[swap]] = [updated[swap], updated[index]];
    setForm({ ...form, weeks: updated.map((w, i) => ({ ...w, weekNumber: i + 1 })) });
  };

  const updateWeekTitle = (index, title) => {
    const updated = [...form.weeks];
    updated[index] = { ...updated[index], title };
    setForm({ ...form, weeks: updated });
  };

  const addWorkoutToWeek = (weekIndex, workoutId) => {
    if (!workoutId) return;
    const updated = [...form.weeks];
    if (updated[weekIndex].workouts.includes(workoutId)) return;
    updated[weekIndex] = { ...updated[weekIndex], workouts: [...updated[weekIndex].workouts, workoutId] };
    setForm({ ...form, weeks: updated });
  };

  const removeWorkoutFromWeek = (weekIndex, workoutId) => {
    const updated = [...form.weeks];
    updated[weekIndex] = { ...updated[weekIndex], workouts: updated[weekIndex].workouts.filter((w) => w !== workoutId) };
    setForm({ ...form, weeks: updated });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return alert("Programme name is required.");
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "programmes", editing), { ...form });
      } else {
        await addDoc(collection(db, "programmes"), { ...form, createdAt: new Date().toISOString() });
      }
      setForm(emptyProgramme);
      setEditing(null);
      setShowForm(false);
      await fetchAll();
    } catch (e) {
      alert("Error saving programme.");
      console.error(e);
    }
    setSaving(false);
  };

  const handleEdit = (programme) => {
    setForm({
      name: programme.name || "",
      description: programme.description || "",
      tag: programme.tag || "",
      level: programme.level || "Beginner",
      free: programme.free !== false,
      repeating: programme.repeating || false,
      weeks: programme.weeks || [],
      published: programme.published || false,
    });
    setEditing(programme.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDuplicate = async (programme) => {
    const copy = { ...programme, name: `${programme.name} (Copy)`, published: false, createdAt: new Date().toISOString() };
    delete copy.id;
    await addDoc(collection(db, "programmes"), copy);
    await fetchAll();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this programme?")) return;
    await deleteDoc(doc(db, "programmes", id));
    await fetchAll();
  };

  const togglePublished = async (programme) => {
    await updateDoc(doc(db, "programmes", programme.id), { published: !programme.published });
    await fetchAll();
  };

  const getWorkoutName = (id) =>
  workoutDetails[id]?.displayName || workoutDetails[id]?.name || "Unknown workout";

  const getProgrammeStats = (programme) => {
    const totalWorkouts = programme.weeks?.reduce((acc, w) => acc + (w.workouts?.length || 0), 0) || 0;
    const totalTime = programme.weeks?.reduce((acc, w) => {
      return acc + w.workouts?.reduce((a, wId) => a + (workoutDetails[wId]?.estimatedTime || 0), 0);
    }, 0) || 0;
    return { totalWorkouts, totalTime };
  };

  const toggleWorkoutExpand = (key) => {
    setExpandedWorkouts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "2rem" }}>

      <div style={{ padding: "1.5rem 1.25rem 1rem" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#2d6a4f", fontWeight: 600, textDecoration: "none" }}>← Admin</Link>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#111", margin: "8px 0 4px" }}>Programme Builder</h1>
        <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>{programmes.length} programmes</p>
      </div>

      {showForm && (
        <div style={{ margin: "0 1.25rem 1.5rem", backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", color: "#111" }}>
            {editing ? "Edit Programme" : "New Programme"}
          </h2>

          <label style={labelStyle}>Programme Name</label>
          <input style={inputStyle} placeholder="e.g. The Capability Foundation" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, height: "80px", resize: "vertical" }} placeholder="What will this programme do for the user?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <label style={labelStyle}>Tag (shown on card)</label>
          <input style={inputStyle} placeholder="e.g. Start Here" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />

          <label style={labelStyle}>Level</label>
          <select style={inputStyle} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>

          <label style={labelStyle}>Access</label>
          <div style={{ display: "flex", gap: "10px" }}>
            {[
              { val: true, icon: "🆓", label: "Free", sub: "All users" },
              { val: false, icon: "🔒", label: "Premium", sub: "Paid only" },
            ].map(opt => (
              <div key={String(opt.val)} onClick={() => setForm({ ...form, free: opt.val })} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: `2px solid ${form.free === opt.val ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: form.free === opt.val ? "#eaf5ef" : "#fff", cursor: "pointer", textAlign: "center" }}>
                <p style={{ fontSize: "18px", margin: "0 0 3px" }}>{opt.icon}</p>
                <p style={{ fontWeight: 700, fontSize: "13px", color: form.free === opt.val ? "#2d6a4f" : "#111", margin: 0 }}>{opt.label}</p>
                <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>{opt.sub}</p>
              </div>
            ))}
          </div>

          <label style={labelStyle}>Programme Type</label>
          <div style={{ display: "flex", gap: "10px" }}>
            {[
              { val: false, icon: "📅", label: "Structured", sub: "Fixed number of weeks" },
              { val: true, icon: "🔁", label: "Repeating", sub: "Loops forever" },
            ].map(opt => (
              <div key={String(opt.val)} onClick={() => setForm({ ...form, repeating: opt.val })} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: `2px solid ${form.repeating === opt.val ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: form.repeating === opt.val ? "#eaf5ef" : "#fff", cursor: "pointer", textAlign: "center" }}>
                <p style={{ fontSize: "18px", margin: "0 0 3px" }}>{opt.icon}</p>
                <p style={{ fontWeight: 700, fontSize: "13px", color: form.repeating === opt.val ? "#2d6a4f" : "#111", margin: 0 }}>{opt.label}</p>
                <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>{opt.sub}</p>
              </div>
            ))}
          </div>

          {form.repeating && (
            <div style={{ backgroundColor: "#eaf5ef", borderRadius: "10px", padding: "10px 14px", marginTop: "8px" }}>
              <p style={{ fontSize: "12px", color: "#2d6a4f", margin: 0, lineHeight: 1.5 }}>
                Repeating programmes use one week that loops forever. Users see "This Week" instead of "Week 1". Progress is driven by the weight progression system, not new content.
              </p>
            </div>
          )}

          {/* Weeks */}
          <div style={{ marginTop: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: 0 }}>
                {form.repeating ? "Week Template" : `Weeks (${form.weeks.length})`}
              </p>
              {!form.repeating && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={addWeek} style={{ backgroundColor: "#eaf5ef", color: "#2d6a4f", border: "none", borderRadius: "8px", padding: "6px 12px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                    + Add Week
                  </button>
                </div>
              )}
            </div>

            {form.weeks.map((week, weekIndex) => (
              <div key={weekIndex} style={{ backgroundColor: "#f7f5f2", borderRadius: "12px", padding: "14px", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  {!form.repeating && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <button onClick={() => moveWeek(weekIndex, -1)} style={iconBtnStyle}>↑</button>
                      <button onClick={() => moveWeek(weekIndex, 1)} style={iconBtnStyle}>↓</button>
                    </div>
                  )}
                  <input
                    style={{ ...inputStyle, fontWeight: 700, backgroundColor: "#fff", flex: 1 }}
                    value={week.title}
                    onChange={(e) => updateWeekTitle(weekIndex, e.target.value)}
                  />
                 {!form.repeating && (
  <>
    <select
      onChange={(e) => {
        const val = e.target.value;
        insertWeek(weekIndex, val === "blank" ? null : Number(val));
        e.target.value = "insert";
      }}
      defaultValue="insert"
      style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", border: "none", borderRadius: "8px", padding: "8px 6px", cursor: "pointer", flexShrink: 0 }}
    >
      <option value="insert" disabled>+ Insert After</option>
      <option value="blank">Blank week</option>
      {form.weeks.map((w, i) => (
        <option key={i} value={i}>Copy of {w.title}</option>
      ))}
    </select>
    <button onClick={() => removeWeek(weekIndex)} style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "none", borderRadius: "8px", padding: "8px 12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
      Remove
    </button>
  </>
)}
                </div>

                {/* Workouts in week */}
                {week.workouts.length > 0 && (
                  <div style={{ marginBottom: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {week.workouts.map((workoutId) => {
                      const expandKey = `${weekIndex}-${workoutId}`;
                      const wDetail = workoutDetails[workoutId];
                      return (
                        <div key={workoutId} style={{ backgroundColor: "#fff", borderRadius: "8px", overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <button onClick={() => toggleWorkoutExpand(expandKey)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#888", padding: 0 }}>
                                {expandedWorkouts[expandKey] ? "▾" : "▸"}
                              </button>
                              <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>{getWorkoutName(workoutId)}</span>
                              {wDetail && (
                                <span style={{ fontSize: "11px", color: "#888" }}>{wDetail.exercises?.length || 0} exercises · {wDetail.estimatedTime}min</span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
  <button onClick={() => duplicateWorkoutInWeek(weekIndex, workoutId)} style={{ backgroundColor: "transparent", border: "none", color: "#2d6a4f", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>⧉</button>
  <button onClick={() => removeWorkoutFromWeek(weekIndex, workoutId)} style={{ backgroundColor: "transparent", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "14px", fontWeight: 700 }}>✕</button>
</div>
                          </div>
                          {expandedWorkouts[expandKey] && wDetail?.exercises?.length > 0 && (
                            <div style={{ padding: "0 12px 10px 32px", display: "flex", flexDirection: "column", gap: "3px" }}>
                              {wDetail.exercises.map((ex, i) => (
                                <p key={i} style={{ fontSize: "12px", color: "#666", margin: 0 }}>
                                  {i + 1}. {ex.name} -- {ex.sets} sets · {ex.repsMin || 8}-{ex.repsMax || 12} reps
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <select style={{ ...inputStyle, backgroundColor: "#fff" }} value="" onChange={(e) => addWorkoutToWeek(weekIndex, e.target.value)}>
                  <option value="">+ Add workout to this week</option>
                  {workouts.filter((w) => !week.workouts.includes(w.id)).map((w) => (
                    <option key={w.id} value={w.id}>{getWorkoutName(w.id)} ({w.exercises?.length || 0} exercises)</option>
                  ))}
                </select>

                {/* Duplicate week controls */}
                {!form.repeating && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>Duplicate this week:</span>
                    {[1, 2, 3, 4, 5, 11].map(n => (
                      <button
                        key={n}
                        onClick={() => duplicateWeekMultiple(weekIndex, n)}
                        style={{ backgroundColor: "#eaf5ef", color: "#2d6a4f", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        x{n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Published toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px", padding: "12px 14px", backgroundColor: "#f7f5f2", borderRadius: "10px", cursor: "pointer" }} onClick={() => setForm({ ...form, published: !form.published })}>
            <div style={{ width: 44, height: 26, borderRadius: 13, background: form.published ? "#2d6a4f" : "#e5e5e5", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", width: 20, height: 20, borderRadius: "50%", background: "#fff", top: 3, left: form.published ? 21 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#111", margin: 0 }}>Published</p>
              <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>{form.published ? "Visible to users in the app" : "Hidden from users -- draft mode"}</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", fontWeight: 700, fontSize: "15px", cursor: "pointer" }}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Programme"}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); setForm(emptyProgramme); }} style={{ backgroundColor: "#f0f0f0", color: "#555", border: "none", borderRadius: "10px", padding: "12px 20px", fontWeight: 600, fontSize: "15px", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <div style={{ padding: "0 1.25rem 1rem" }}>
          <button onClick={() => { setForm(emptyProgramme); setEditing(null); setShowForm(true); }} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontWeight: 700, fontSize: "15px", cursor: "pointer" }}>
            + Create Programme
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>Loading...</p>
      ) : programmes.length === 0 ? (
        <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>No programmes yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "0 1.25rem" }}>
          {programmes.map((programme) => {
            const stats = getProgrammeStats(programme);
            return (
              <div key={programme.id} style={{ backgroundColor: "#fff", borderRadius: "12px", border: "0.5px solid #e5e5e5", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <p style={{ fontWeight: 700, fontSize: "15px", color: "#111", margin: 0 }}>{programme.name}</p>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "20px", backgroundColor: programme.published ? "#eaf5ef" : "#f5f5f5", color: programme.published ? "#2d6a4f" : "#888" }}>
                        {programme.published ? "Live" : "Draft"}
                      </span>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "20px", backgroundColor: programme.free ? "#e0f2fe" : "#fef9c3", color: programme.free ? "#0369a1" : "#854d0e" }}>
                        {programme.free ? "Free" : "Premium"}
                      </span>
                      {programme.repeating && (
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "20px", backgroundColor: "#f3f4f6", color: "#666" }}>
                          🔁 Repeating
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
                      {programme.weeks?.length || 0} {programme.repeating ? "week template" : "weeks"} · {stats.totalWorkouts} workouts · ~{stats.totalTime}min total
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
                  <button onClick={() => togglePublished(programme)} style={smallBtnStyle(programme.published ? "#fff8e1" : "#eaf5ef", programme.published ? "#b45309" : "#2d6a4f")}>
                    {programme.published ? "Unpublish" : "Publish"}
                  </button>
                  <button onClick={() => handleEdit(programme)} style={smallBtnStyle("#eaf5ef", "#2d6a4f")}>Edit</button>
                  <button onClick={() => handleDuplicate(programme)} style={smallBtnStyle("#f3f4f6", "#555")}>Duplicate</button>
                  <button onClick={() => handleDelete(programme.id)} style={smallBtnStyle("#fef2f2", "#dc2626")}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ padding: "1rem 1.25rem 0" }}>
        <SeedCapabilityButton />
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: "12px", fontWeight: 600, color: "#555", marginBottom: "6px", marginTop: "14px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", color: "#111", backgroundColor: "#fafafa", boxSizing: "border-box" };
const iconBtnStyle = { backgroundColor: "#e5e5e5", border: "none", borderRadius: "4px", padding: "2px 6px", cursor: "pointer", fontSize: "11px", fontWeight: 700 };
const smallBtnStyle = (bg, color) => ({ backgroundColor: bg, color, border: "none", borderRadius: "8px", padding: "6px 10px", fontSize: "11px", fontWeight: 600, cursor: "pointer" });