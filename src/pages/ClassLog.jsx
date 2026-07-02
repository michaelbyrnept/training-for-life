import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc, addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import PortalNav from "../components/PortalNav";

const INTENSITY = [
  { id: "easy", label: "Easy", color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  { id: "good", label: "Good", color: "#2d6a4f", bg: "#eaf5ef", border: "#6ee7b7" },
  { id: "hard", label: "Hard", color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  { id: "max", label: "Max Effort", color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
];

function normalizeDate(val) {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (val.toDate) return val.toDate().toISOString();
  if (val.seconds) return new Date(val.seconds * 1000).toISOString();
  return null;
}

export default function ClassLog() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [cls, setCls] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState({}); // { exerciseId: { weight, reps, intensity, comment } }
  const [prevLogs, setPrevLogs] = useState({});
  const [currentBlock, setCurrentBlock] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [sheet, setSheet] = useState(null); // { exerciseId, field }
  const [sheetValue, setSheetValue] = useState("");
  const [allWorkoutLogs, setAllWorkoutLogs] = useState([]);
  const [allClassLogs, setAllClassLogs] = useState([]);
  const [historySheet, setHistorySheet] = useState(null); // exerciseId or null

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);

      const classSnap = await getDoc(doc(db, "classes", classId));
      if (!classSnap.exists()) { setLoading(false); return; }
      const classData = { id: classSnap.id, ...classSnap.data() };
      setCls(classData);

      // Load previous class logs
      const prevSnap = await getDocs(query(collection(db, "classLogs"), where("userId", "==", u.uid), where("classId", "==", classId)));
      if (!prevSnap.empty) {
        const sorted = prevSnap.docs.map(d => d.data()).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
        setPrevLogs(sorted[0]?.logs || {});
      }

      const wlSnap = await getDocs(query(collection(db, "workoutLogs"), where("userId", "==", u.uid)));
      const wlData = wlSnap.docs
        .map(d => ({ id: d.id, ...d.data(), completedAt: normalizeDate(d.data().completedAt) }))
        .filter(l => l.completedAt);
      setAllWorkoutLogs(wlData);

      const clSnap = await getDocs(query(collection(db, "classLogs"), where("userId", "==", u.uid)));
      const clData = clSnap.docs
        .map(d => ({ id: d.id, ...d.data(), completedAt: normalizeDate(d.data().completedAt) }))
        .filter(l => l.completedAt);
      setAllClassLogs(clData);

      setLoading(false);
    });
    return () => unsub();
  }, [classId, navigate]);

  const updateLog = (exerciseId, field, value) => {
    setLogs(prev => ({ ...prev, [exerciseId]: { ...(prev[exerciseId] || {}), [field]: value } }));
  };

  const openSheet = (exerciseId, field) => {
    setSheetValue(logs[exerciseId]?.[field] || "");
    setSheet({ exerciseId, field });
  };

  const saveSheet = () => {
    if (!sheet) return;
    updateLog(sheet.exerciseId, sheet.field, sheetValue);
    setSheet(null);
    setSheetValue("");
  };

  const buildHistory = (exerciseId) => {
    const entries = [];

    allWorkoutLogs.forEach(log => {
      const sets = [
        ...(Array.isArray(log.logs?.[exerciseId]) ? log.logs[exerciseId] : []),
        ...(Array.isArray(log.logs?.[`${exerciseId}_top`]) ? log.logs[`${exerciseId}_top`] : []),
        ...(Array.isArray(log.logs?.[`${exerciseId}_backoff`]) ? log.logs[`${exerciseId}_backoff`] : []),
      ];
      const doneSets = sets.filter(s => s.done && s.weight && s.reps);
      if (doneSets.length > 0) {
        const best = doneSets.reduce((a, b) => (parseFloat(b.weight) > parseFloat(a.weight) ? b : a));
        entries.push({ date: log.completedAt, weight: parseFloat(best.weight), reps: best.reps, source: "solo" });
      }
    });

    allClassLogs.forEach(log => {
      const l = log.logs?.[exerciseId];
      if (l?.weight && l?.reps) {
        entries.push({ date: log.completedAt, weight: parseFloat(l.weight) || l.weight, reps: l.reps, source: "class", classTitle: log.classTitle });
      }
    });

    return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Build a unified exercises[] array (real exerciseId per set) alongside
      // the existing `logs`, so this class shows up in the member's
      // per-exercise history page like every other training flow. Uses
      // `cls.blocks` directly (rather than the local `blocks` const declared
      // further down this component) so it's safe regardless of call order.
      const exercisesForHistory = Object.entries(logs)
        .filter(([, l]) => l.weight || l.reps)
        .map(([exerciseId, l]) => {
          const exName = (cls.blocks || []).flatMap(b => b.exercises || []).find(e => e.exerciseId === exerciseId)?.name || exerciseId;
          return {
            exerciseId,
            exerciseName: exName,
            sets: [{
              reps: l.reps != null ? (parseInt(l.reps, 10) || null) : null,
              weight: l.weight != null && l.weight !== "BW" ? (parseFloat(l.weight) || null) : null,
              completed: true,
            }],
          };
        });

      await addDoc(collection(db, "classLogs"), {
        userId: user.uid,
        classId,
        classTitle: cls.title,
        classType: cls.type,
        logs,
        exercises: exercisesForHistory,
        sourceType: "class",
        completedAt: new Date().toISOString(),
      });
      setDone(true);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
      <PortalNav />
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
    </div>
  );

  if (!cls) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
      <PortalNav />
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Class not found.</p>
    </div>
  );

  const blocks = cls.blocks || [];
  const block = blocks[currentBlock];
  const isFirst = currentBlock === 0;
  const isLast = currentBlock === blocks.length - 1;

  // Summary screen
  if (done) {
    const loggedExercises = Object.entries(logs).filter(([_, l]) => l.weight || l.reps);
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "120px" }}>
        <PortalNav />
        <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "32px 20px 48px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>💪</div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>Class Complete</p>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>{cls.title}</h1>
          <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>{new Date().toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />
        <div style={{ padding: "0 16px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Your Top Sets</p>
          {loggedExercises.length === 0 ? (
            <div style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "20px", textAlign: "center" }}>
              <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>Nothing logged -- that's okay, great work showing up!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              {loggedExercises.map(([exId, log]) => {
                const exName = blocks.flatMap(b => b.exercises || []).find(e => e.exerciseId === exId)?.name || exId;
                const intensity = INTENSITY.find(i => i.id === log.intensity);
                return (
                  <div key={exId} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: log.comment ? "6px" : 0 }}>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{exName}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {intensity && <span style={{ fontSize: "11px", fontWeight: 700, color: intensity.color, backgroundColor: intensity.bg, padding: "2px 8px", borderRadius: "10px" }}>{intensity.label}</span>}
                        <p style={{ fontSize: "16px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{log.weight ? `${log.weight}kg` : ""}{log.weight && log.reps ? " × " : ""}{log.reps || ""}</p>
                      </div>
                    </div>
                    {log.comment && <p style={{ fontSize: "12px", color: "#888", margin: 0, fontStyle: "italic" }}>{log.comment}</p>}
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={() => navigate("/training")} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "14px", padding: "16px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>
            Back to Training
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "120px" }}>
      {!sheet && !historySheet && <PortalNav />}

      <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/training" style={{ fontSize: "13px", color: "#2d6a4f", fontWeight: 700, textDecoration: "none" }}>← Training</Link>
        <span style={{ fontSize: "13px", color: "#888", fontWeight: 600 }}>{cls.title}</span>
      </div>

      {/* Block progress */}
      <div style={{ display: "flex", gap: "6px", padding: "0 16px 0", marginBottom: "8px" }}>
        {blocks.map((_, i) => (
          <div key={i} style={{ flex: 1, height: "4px", borderRadius: "2px", backgroundColor: i <= currentBlock ? "#2d6a4f" : "#e5e5e5", transition: "background 0.3s" }} />
        ))}
      </div>

      {block && (
        <div style={{ padding: "0 16px" }}>
          {/* Block header */}
          <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", borderRadius: "16px", padding: "16px 18px", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
                Block {currentBlock + 1} of {blocks.length}
              </p>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#4ade80" }}>⏱ {block.duration} min AMRAP</span>
            </div>
            {block.goal && (
              <p style={{ fontSize: "14px", color: "#fff", margin: 0, lineHeight: 1.5 }}>🎯 {block.goal}</p>
            )}
          </div>

          {/* Exercises */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
            {(block.exercises || []).map((ex, ei) => {
              const log = logs[ex.exerciseId] || {};
              const prev = prevLogs[ex.exerciseId];
              return (
                <div key={ex.exerciseId} style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f", width: 20 }}>{ei + 1}</span>
                    <p style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: 0, flex: 1 }}>{ex.name}</p>
                  </div>

                  {/* Previous */}
                  {prev?.weight && (
                    <div style={{ backgroundColor: "#f7f5f2", borderRadius: "8px", padding: "6px 10px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <p style={{ fontSize: "11px", color: "#888", margin: 0 }}>Last class:</p>
                      <p style={{ fontSize: "12px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{prev.weight}kg × {prev.reps}</p>
                      {prev.intensity && <p style={{ fontSize: "11px", color: "#888", margin: 0 }}>({INTENSITY.find(i => i.id === prev.intensity)?.label})</p>}
                    </div>
                  )}

                  <div onClick={() => setHistorySheet(ex.exerciseId)} style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginBottom: "10px", cursor: "pointer" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#2d6a4f" }}>📊 View full history</span>
                  </div>

                  {/* Top set inputs */}
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Top Set</p>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                    <div onClick={() => openSheet(ex.exerciseId, "weight")} style={{ flex: 1, backgroundColor: log.weight ? "#eaf5ef" : "#f7f5f2", border: `0.5px solid ${log.weight ? "#2d6a4f" : "#e5e5e5"}`, borderRadius: "10px", padding: "12px", textAlign: "center", cursor: "pointer" }}>
                      <p style={{ fontSize: "11px", color: "#888", margin: "0 0 2px" }}>Weight (kg)</p>
                      <p style={{ fontSize: "18px", fontWeight: 700, color: log.weight ? "#2d6a4f" : "#bbb", margin: 0 }}>{log.weight || "—"}</p>
                    </div>
                    <div onClick={() => openSheet(ex.exerciseId, "reps")} style={{ flex: 1, backgroundColor: log.reps ? "#eaf5ef" : "#f7f5f2", border: `0.5px solid ${log.reps ? "#2d6a4f" : "#e5e5e5"}`, borderRadius: "10px", padding: "12px", textAlign: "center", cursor: "pointer" }}>
                      <p style={{ fontSize: "11px", color: "#888", margin: "0 0 2px" }}>Reps</p>
                      <p style={{ fontSize: "18px", fontWeight: 700, color: log.reps ? "#2d6a4f" : "#bbb", margin: 0 }}>{log.reps || "—"}</p>
                    </div>
                  </div>

                  {/* Intensity */}
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Intensity</p>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                    {INTENSITY.map(opt => (
                      <div key={opt.id} onClick={() => updateLog(ex.exerciseId, "intensity", log.intensity === opt.id ? null : opt.id)}
                        style={{ flex: 1, padding: "8px 4px", borderRadius: "8px", border: `1.5px solid ${log.intensity === opt.id ? opt.border : "#e5e5e5"}`, backgroundColor: log.intensity === opt.id ? opt.bg : "#fff", textAlign: "center", cursor: "pointer" }}>
                        <p style={{ fontSize: "11px", fontWeight: 700, color: log.intensity === opt.id ? opt.color : "#aaa", margin: 0 }}>{opt.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Comment */}
                  <input
                    type="text"
                    placeholder="Add a comment... (optional)"
                    value={log.comment || ""}
                    onChange={e => updateLog(ex.exerciseId, "comment", e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "0.5px solid #e5e5e5", fontSize: "13px", color: "#111", backgroundColor: "#f7f5f2", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              );
            })}
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", gap: "10px" }}>
            {!isFirst && (
              <button onClick={() => setCurrentBlock(b => b - 1)} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "0.5px solid #e5e5e5", backgroundColor: "#fff", fontSize: "15px", fontWeight: 700, cursor: "pointer", color: "#111" }}>
                ← Previous
              </button>
            )}
            {!isLast ? (
              <button onClick={() => setCurrentBlock(b => b + 1)} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "none", backgroundColor: "#2d6a4f", fontSize: "15px", fontWeight: 700, cursor: "pointer", color: "#fff" }}>
                Next Block →
              </button>
            ) : (
              <button onClick={handleFinish} disabled={saving} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "none", backgroundColor: saving ? "#aaa" : "#2d6a4f", fontSize: "15px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", color: "#fff" }}>
                {saving ? "Saving..." : "Finish Class ✓"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input sheet */}
      {sheet && (
        <div onClick={e => { if (e.target === e.currentTarget) setSheet(null); }} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", paddingBottom: "32px" }}>
            <div style={{ width: "36px", height: "4px", backgroundColor: "#e5e5e5", borderRadius: "2px", margin: "12px auto 16px" }} />
            <div style={{ padding: "0 16px 12px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>
              {sheet.field === "weight" ? "Top weight (kg)" : "Reps"}
            </div>
            <div style={{ display: "flex", gap: "8px", padding: "0 16px 14px", overflowX: "auto" }}>
              {(sheet.field === "weight"
                ? ["BW", "20", "30", "40", "50", "60", "70", "80", "90", "100", "110", "120"]
                : ["1", "2", "3", "5", "6", "8", "10", "12", "15", "20"]
              ).map(v => (
                <div key={v} onClick={() => { updateLog(sheet.exerciseId, sheet.field, v); setSheet(null); }} style={{ flexShrink: 0, minWidth: "52px", padding: "10px 14px", borderRadius: "10px", border: "0.5px solid #e5e5e5", fontSize: "15px", fontWeight: 700, cursor: "pointer", backgroundColor: "#f7f5f2", color: "#111", textAlign: "center" }}>
                  {v}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px", padding: "0 16px" }}>
              <input autoFocus type={sheet.field === "reps" ? "number" : "text"} inputMode="decimal" placeholder={sheet.field === "weight" ? "e.g. 100" : "e.g. 3"} value={sheetValue} onChange={e => setSheetValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveSheet(); }} style={{ flex: 1, border: "1.5px solid #2d6a4f", borderRadius: "12px", padding: "14px 16px", fontSize: "18px", fontWeight: 700, color: "#111", outline: "none", textAlign: "center" }} />
              <button onClick={saveSheet} style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "14px 20px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* History sheet */}
      {historySheet && (
        <div onClick={e => { if (e.target === e.currentTarget) setHistorySheet(null); }} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "75vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>
              {block?.exercises?.find(e => e.exerciseId === historySheet)?.name || "Exercise History"}
            </h2>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px" }}>Combined from your solo training and classes</p>

            {(() => {
              const history = buildHistory(historySheet);
              if (history.length === 0) {
                return <p style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "24px 0" }}>No history yet for this exercise.</p>;
              }
              const pb = Math.max(...history.map(h => h.weight || 0));
              return (
                <>
                  <div style={{ backgroundColor: "#eaf5ef", borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Personal Best</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: "#1a3a2a", margin: 0 }}>{pb}kg</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {history.map((h, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "0.5px solid #f5f5f5" }}>
                        <div>
                          <p style={{ fontSize: 13, color: "#111", fontWeight: 600, margin: 0 }}>
                            {new Date(h.date).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" })}
                          </p>
                          <p style={{ fontSize: 11, color: "#aaa", margin: "2px 0 0" }}>
                            {h.source === "class" ? `Class · ${h.classTitle || ""}` : "Solo training"}
                          </p>
                        </div>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{h.weight}kg × {h.reps}</p>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            <button onClick={() => setHistorySheet(null)} style={{ width: "100%", background: "#f0f0f0", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, color: "#555", cursor: "pointer", marginTop: 16 }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
