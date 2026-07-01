import { useState, useEffect, useRef } from "react";
import {
  doc, getDoc, getDocs, collection, addDoc, updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../../firebase";
import { useParams, useNavigate, Link } from "react-router-dom";

const REP_QUICK = ["1","2","3","4","5","6","8","10","12","15","20","25","30"];
const WEIGHT_QUICK = ["BW","2.5","5","7.5","10","12.5","15","17.5","20","25","30","35","40","45","50","55","60","70","80","100","120","140"];

function RestTimer({ defaultSeconds = 120, onDismiss }) {
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef(null);
  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) { clearInterval(intervalRef.current); setRunning(false); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); return 0; }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);
  const adjust = (delta) => { setSeconds(s => Math.max(0, s + delta)); if (!running) setRunning(true); };
  const restart = (secs) => { clearInterval(intervalRef.current); setSeconds(secs); setRunning(true); };
  const mins = Math.floor(seconds / 60), secs = seconds % 60;
  const isDone = seconds === 0;
  const r = 54, circ = 2 * Math.PI * r, dash = circ * (seconds / defaultSeconds);
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
      <div style={{ backgroundColor: "#1a3a2a", borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 24px 48px" }}>
        <div style={{ width: 36, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, margin: "0 auto 24px" }} />
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.12em", textAlign: "center", margin: "0 0 20px" }}>{isDone ? "Rest complete" : "Rest timer"}</p>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ position: "relative", width: 140, height: 140 }}>
            <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle cx="70" cy="70" r={r} fill="none" stroke="#4ade80" strokeWidth="8" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              {isDone ? <span style={{ fontSize: 36, fontWeight: 800, color: "#4ade80" }}>Go!</span> : (
                <><span style={{ fontSize: 38, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{mins}:{String(secs).padStart(2, "0")}</span><span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>remaining</span></>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          {[-30, -10, +10, +30].map(delta => (
            <button key={delta} onClick={() => adjust(delta)} style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, color: delta < 0 ? "#fca5a5" : "#86efac", cursor: "pointer" }}>
              {delta > 0 ? `+${delta}s` : `${delta}s`}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
          {[60, 90, 120, 180, 240].map(s => (
            <button key={s} onClick={() => restart(s)} style={{ backgroundColor: seconds === s && running ? "#2d6a4f" : "rgba(255,255,255,0.08)", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onDismiss} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)", border: "none", borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Dismiss</button>
          <button onClick={onDismiss} style={{ flex: 2, backgroundColor: isDone ? "#4ade80" : "#2d6a4f", border: "none", borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 700, color: isDone ? "#1a3a2a" : "#fff", cursor: "pointer" }}>{isDone ? "Next set 💪" : "Skip rest"}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCoachSession() {
  const { clientUid, programmeId, workoutId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [workout, setWorkout] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [restTimer, setRestTimer] = useState(null);

  // Tap-to-log sheet
  const [logSheet, setLogSheet] = useState(null); // { slotKey, setIndex, field }

  // Swap sheet
  const [swapSheet, setSwapSheet] = useState(null); // { exercise, index }
  const [swapSearch, setSwapSearch] = useState("");
  const [swapResults, setSwapResults] = useState([]);

  // Add exercise sheet
  const [addSheet, setAddSheet] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addResults, setAddResults] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const [clientSnap, workoutSnap] = await Promise.all([
      getDoc(doc(db, "users", clientUid)),
      getDoc(doc(db, "workouts", workoutId)),
    ]);

    if (clientSnap.exists()) setClient({ uid: clientUid, ...clientSnap.data() });

    if (!workoutSnap.exists()) { setLoading(false); return; }
    const workoutData = { id: workoutSnap.id, ...workoutSnap.data() };
    setWorkout(workoutData);

    const rawExercises = workoutData.exercises || [];
    const enriched = await Promise.all(rawExercises.map(async (ex, i) => {
      const exSnap = await getDoc(doc(db, "exercises", ex.exerciseId));
      const exData = exSnap.exists() ? exSnap.data() : {};
      return {
        ...ex,
        slotKey: `slot_${i}`,         // stable key — never changes even if exercise is swapped
        name: exData.name || ex.exerciseId,
        description: exData.description || "",
        muscleGroup: exData.muscleGroup || exData.muscles || "",
        originalExerciseId: ex.exerciseId,
        originalName: exData.name || ex.exerciseId,
        isExtra: false,
        swapType: null,
      };
    }));

    setExercises(enriched);

    const initialLogs = {};
    enriched.forEach(ex => {
      if (ex.type === "cardio") {
        initialLogs[ex.slotKey] = { duration: ex.defaultDuration || 30, distance: "", done: false };
      } else {
        initialLogs[ex.slotKey] = Array.from({ length: ex.sets || 3 }, () => ({
          reps: null, weight: null, done: false,
        }));
      }
    });
    setLogs(initialLogs);
    setLoading(false);
  }

  // ─── Exercise search ───────────────────────────────────────────────────────

  async function searchExercises(term, setResults) {
    if (term.trim().length < 2) { setResults([]); return; }
    const snap = await getDocs(collection(db, "exercises"));
    const results = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(e => e.name?.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 14);
    setResults(results);
  }

  // ─── Exercise actions ──────────────────────────────────────────────────────

  function addExercise(ex) {
    const slotKey = `slot_extra_${Date.now()}`;
    const newEx = {
      slotKey,
      exerciseId: ex.id,
      name: ex.name,
      description: ex.description || "",
      muscleGroup: ex.muscleGroup || ex.muscles || "",
      type: ex.type || "strength",
      sets: 3,
      repsMin: 8,
      repsMax: 12,
      originalExerciseId: ex.id,
      originalName: ex.name,
      isExtra: true,
      swapType: null,
    };
    setExercises(prev => [...prev, newEx]);
    setLogs(prev => ({
      ...prev,
      [slotKey]: Array.from({ length: 3 }, () => ({ reps: null, weight: null, done: false })),
    }));
    setAddSheet(false);
    setAddSearch("");
    setAddResults([]);
  }

  function removeExercise(slotKey) {
    setExercises(prev => prev.filter(e => e.slotKey !== slotKey));
    setLogs(prev => { const n = { ...prev }; delete n[slotKey]; return n; });
  }

  function doTempSwap(newEx) {
    const idx = swapSheet.index;
    // Only update exercise metadata — slotKey stays the same so log data is preserved
    setExercises(prev => prev.map((e, i) => i !== idx ? e : {
      ...e,
      exerciseId: newEx.id,
      name: newEx.name,
      description: newEx.description || "",
      muscleGroup: newEx.muscleGroup || newEx.muscles || "",
      swapType: "temp",
    }));
    closeSwapSheet();
  }

  async function doPermSwap(newEx) {
    const idx = swapSheet.index;
    const oldId = swapSheet.exercise.originalExerciseId;

    // Update the workout document
    const updatedExercises = (workout.exercises || []).map(e =>
      e.exerciseId === oldId ? { ...e, exerciseId: newEx.id } : e
    );
    await updateDoc(doc(db, "workouts", workoutId), { exercises: updatedExercises });
    setWorkout(prev => ({ ...prev, exercises: updatedExercises }));

    // Only update exercise metadata — slotKey stays the same so log data is preserved
    setExercises(prev => prev.map((e, i) => i !== idx ? e : {
      ...e,
      exerciseId: newEx.id,
      name: newEx.name,
      description: newEx.description || "",
      muscleGroup: newEx.muscleGroup || newEx.muscles || "",
      originalExerciseId: newEx.id,
      originalName: newEx.name,
      swapType: "perm",
    }));
    closeSwapSheet();
  }

  function closeSwapSheet() {
    setSwapSheet(null);
    setSwapSearch("");
    setSwapResults([]);
  }

  // ─── Set logging ───────────────────────────────────────────────────────────

  function saveLogValue(value) {
    if (!logSheet) return;
    const { slotKey, setIndex, field } = logSheet;
    setLogs(prev => {
      const sets = Array.isArray(prev[slotKey]) ? [...prev[slotKey]] : [];
      sets[setIndex] = { ...sets[setIndex], [field]: value };
      return { ...prev, [slotKey]: sets };
    });
    setLogSheet(null);
  }

  function toggleDone(slotKey, setIndex) {
    setLogs(prev => {
      const sets = [...(prev[slotKey] || [])];
      const wasDone = sets[setIndex]?.done;
      sets[setIndex] = { ...sets[setIndex], done: !wasDone };
      if (!wasDone) setTimeout(() => setRestTimer({ defaultSeconds: 120 }), 300);
      return { ...prev, [slotKey]: sets };
    });
  }

  function addSet(slotKey) {
    setLogs(prev => ({
      ...prev,
      [slotKey]: [...(prev[slotKey] || []), { reps: null, weight: null, done: false }],
    }));
  }

  // ─── Finish session ────────────────────────────────────────────────────────

  async function finishSession() {
    if (saving) return;
    setSaving(true);
    try {
      // Write workoutLog for the client
      await addDoc(collection(db, "workoutLogs"), {
        userId: clientUid,
        workoutId,
        programmeId,
        logs,
        completedAt: new Date().toISOString(),
        loggedByCoach: true,
      });

      // Write exerciseMetricLogs for PB detection
      const writes = exercises
        .filter(ex => ex.type !== "cardio")
        .map(ex => {
          const sets = (logs[ex.slotKey] || []).filter(s => s.done && s.weight && parseFloat(s.weight) > 0);
          if (!sets.length) return null;
          const bestSet = sets.reduce((a, b) =>
            parseFloat(b.weight) > parseFloat(a.weight) ? b : a
          );
          return addDoc(collection(db, "exerciseMetricLogs"), {
            clientId: clientUid,
            exerciseName: ex.originalName || ex.name,
            metricType: "weight",
            value: parseFloat(bestSet.weight),
            reps: bestSet.reps,
            loggedAt: serverTimestamp(),
            workoutId,
            loggedByCoach: true,
          });
        })
        .filter(Boolean);

      await Promise.all(writes);
      setDone(true);
    } catch (e) {
      console.error("Error saving session:", e);
      alert("Something went wrong saving the session. Check the console.");
    }
    setSaving(false);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const clientName = client
    ? (client.nickname || client.firstName || client.email?.split("@")[0] || "Client")
    : "Client";

  // ─── Done screen ───────────────────────────────────────────────────────────

  if (done) {
    return (
      <div style={{
        minHeight: "100vh", backgroundColor: "#f7f5f2",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "32px 20px",
      }}>
        <p style={{ fontSize: "56px", margin: "0 0 16px" }}>✅</p>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#1a3a2a", margin: "0 0 8px", textAlign: "center" }}>
          Session complete
        </h2>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 40px", textAlign: "center" }}>
          Logged for {clientName}. Milestones will be detected automatically.
        </p>
        <button
          onClick={() => navigate(`/admin/clients/${clientUid}`)}
          style={{
            backgroundColor: "#2d6a4f", color: "#fff", border: "none",
            borderRadius: "14px", padding: "14px 32px", fontSize: "15px",
            fontWeight: 700, cursor: "pointer",
          }}
        >
          Back to {clientName}
        </button>
      </div>
    );
  }

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#888", fontSize: "14px" }}>Loading session...</p>
      </div>
    );
  }

  // ─── Main UI ────────────────────────────────────────────────────────────────

  const extraCount = exercises.filter(e => e.isExtra).length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "100px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "16px 16px 20px" }}>
        <Link
          to={`/admin/clients/${clientUid}`}
          style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}
        >
          ← {clientName}
        </Link>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "8px 0 2px" }}>
          Coach Session
        </h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
          {clientName} · {workout?.displayName || workout?.name || "Workout"}
        </p>
        <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", backgroundColor: "rgba(255,255,255,0.1)", color: "#9fe1cb", padding: "4px 10px", borderRadius: "10px", fontWeight: 600 }}>
            {exercises.filter(e => !e.isExtra).length} exercises
          </span>
          {extraCount > 0 && (
            <span style={{ fontSize: "11px", backgroundColor: "rgba(159,225,203,0.2)", color: "#9fe1cb", padding: "4px 10px", borderRadius: "10px", fontWeight: 600 }}>
              +{extraCount} added
            </span>
          )}
        </div>
      </div>

      {/* EXERCISE LIST */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {exercises.map((ex, idx) => {
          const isCardio = ex.type === "cardio";
          const sets = isCardio ? [] : (logs[ex.slotKey] || []);
          const doneCount = sets.filter(s => s.done).length;

          return (
            <div
              key={ex.slotKey}
              style={{
                backgroundColor: "#fff",
                borderRadius: "16px",
                border: ex.isExtra
                  ? "1.5px dashed #2d6a4f"
                  : ex.swapType === "perm"
                    ? "1.5px solid #0369a1"
                    : ex.swapType === "temp"
                      ? "1.5px solid #7c3aed"
                      : "0.5px solid #e5e5e5",
                overflow: "hidden",
              }}
            >
              {/* Exercise header */}
              <div style={{ padding: "14px 16px 10px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "2px" }}>
                      <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: 0 }}>
                        {ex.name}
                      </h3>
                      {ex.isExtra && (
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "2px 7px", borderRadius: "10px" }}>
                          Added
                        </span>
                      )}
                      {ex.swapType === "temp" && (
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#7c3aed", backgroundColor: "#f5f3ff", padding: "2px 7px", borderRadius: "10px" }}>
                          Temp swap
                        </span>
                      )}
                      {ex.swapType === "perm" && (
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#0369a1", backgroundColor: "#e0f2fe", padding: "2px 7px", borderRadius: "10px" }}>
                          Programme updated
                        </span>
                      )}
                    </div>
                    {ex.muscleGroup && (
                      <p style={{ fontSize: "12px", color: "#aaa", margin: 0 }}>{ex.muscleGroup}</p>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    <button
                      onClick={() => { setSwapSheet({ exercise: ex, index: idx }); setSwapSearch(""); setSwapResults([]); }}
                      style={{
                        padding: "6px 10px", borderRadius: "8px",
                        border: "0.5px solid #e5e5e5", backgroundColor: "#f7f5f2",
                        fontSize: "11px", fontWeight: 700, color: "#555", cursor: "pointer",
                      }}
                    >
                      🔄 Swap
                    </button>
                    <button
                      onClick={() => removeExercise(ex.slotKey)}
                      style={{
                        padding: "6px 10px", borderRadius: "8px",
                        border: "0.5px solid #fca5a5", backgroundColor: "#fef2f2",
                        fontSize: "11px", fontWeight: 700, color: "#dc2626", cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {!isCardio && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "3px 10px", borderRadius: "20px" }}>
                      {ex.repsMin || 8}-{ex.repsMax || 12} reps
                    </span>
                    {sets.length > 0 && (
                      <span style={{ fontSize: "12px", color: doneCount === sets.length ? "#2d6a4f" : "#aaa", fontWeight: 600 }}>
                        {doneCount}/{sets.length} sets done
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Strength set table */}
              {!isCardio && (
                <div style={{ padding: "0 16px 14px" }}>
                  <div style={{
                    display: "grid", gridTemplateColumns: "26px 1fr 1fr 34px",
                    gap: "6px", padding: "4px 4px 6px",
                    borderBottom: "0.5px solid #f0f0f0", marginBottom: "4px",
                  }}>
                    {["#", "Reps", "Weight", ""].map((h, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
                          letterSpacing: "0.07em", color: "#bbb",
                          textAlign: i === 0 ? "left" : "center",
                        }}
                      >
                        {h}
                      </span>
                    ))}
                  </div>

                  {sets.map((s, si) => (
                    <div
                      key={si}
                      style={{
                        display: "grid", gridTemplateColumns: "26px 1fr 1fr 34px",
                        gap: "6px", padding: "4px 4px", alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#ccc" }}>{si + 1}</span>

                      <div
                        onClick={() => setLogSheet({ slotKey: ex.slotKey, setIndex: si, field: "reps" })}
                        style={{
                          backgroundColor: s.reps ? "#eaf5ef" : "#f7f5f2",
                          border: `0.5px solid ${s.reps ? "#2d6a4f" : "#e5e5e5"}`,
                          borderRadius: "8px", padding: "9px 4px",
                          textAlign: "center", fontSize: "15px", fontWeight: 700,
                          color: s.reps ? "#1a4a35" : "#ccc", cursor: "pointer",
                        }}
                      >
                        {s.reps || "—"}
                      </div>

                      <div
                        onClick={() => setLogSheet({ slotKey: ex.slotKey, setIndex: si, field: "weight" })}
                        style={{
                          backgroundColor: s.weight ? "#eaf5ef" : "#f7f5f2",
                          border: `0.5px solid ${s.weight ? "#2d6a4f" : "#e5e5e5"}`,
                          borderRadius: "8px", padding: "9px 4px",
                          textAlign: "center", fontSize: "15px", fontWeight: 700,
                          color: s.weight ? "#1a4a35" : "#ccc", cursor: "pointer",
                        }}
                      >
                        {s.weight ? (s.weight === "BW" ? "BW" : `${s.weight}kg`) : "—"}
                      </div>

                      <div
                        onClick={() => toggleDone(ex.slotKey, si)}
                        style={{
                          width: 32, height: 32, borderRadius: "50%",
                          border: s.done ? "none" : "1.5px solid #e5e5e5",
                          backgroundColor: s.done ? "#2d6a4f" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", margin: "0 auto",
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 7l4 4 6-6" stroke={s.done ? "#fff" : "#ddd"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => addSet(ex.slotKey)}
                    style={{
                      background: "none", border: "none", color: "#2d6a4f",
                      fontSize: "13px", fontWeight: 700, cursor: "pointer",
                      padding: "6px 4px 0", display: "flex", alignItems: "center", gap: "4px",
                    }}
                  >
                    + Add Set
                  </button>
                </div>
              )}

              {/* Cardio logging */}
              {isCardio && (
                <div style={{ padding: "0 16px 16px" }}>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#888", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                        Duration (min)
                      </label>
                      <input
                        type="number"
                        value={logs[ex.slotKey]?.duration || ""}
                        onChange={e => setLogs(prev => ({
                          ...prev,
                          [ex.slotKey]: { ...prev[ex.slotKey], duration: e.target.value },
                        }))}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: "10px",
                          border: "1.5px solid #e5e5e5", fontSize: "16px", fontWeight: 700,
                          outline: "none", boxSizing: "border-box", textAlign: "center",
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#888", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                        Distance
                      </label>
                      <input
                        type="text"
                        value={logs[ex.slotKey]?.distance || ""}
                        onChange={e => setLogs(prev => ({
                          ...prev,
                          [ex.slotKey]: { ...prev[ex.slotKey], distance: e.target.value },
                        }))}
                        placeholder="e.g. 3km"
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: "10px",
                          border: "1.5px solid #e5e5e5", fontSize: "14px",
                          outline: "none", boxSizing: "border-box", textAlign: "center",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* ADD EXERCISE */}
        <button
          onClick={() => { setAddSheet(true); setAddSearch(""); setAddResults([]); }}
          style={{
            width: "100%", padding: "14px", borderRadius: "14px",
            border: "1.5px dashed #2d6a4f", backgroundColor: "#fff",
            color: "#2d6a4f", fontSize: "14px", fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          }}
        >
          + Add Exercise
        </button>
      </div>

      {/* FINISH BUTTON */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "12px 16px 24px", backgroundColor: "#f7f5f2",
        borderTop: "0.5px solid #e5e5e5",
      }}>
        <button
          onClick={finishSession}
          disabled={saving}
          style={{
            width: "100%", padding: "15px", borderRadius: "14px", border: "none",
            backgroundColor: saving ? "#aaa" : "#1a3a2a",
            color: "#fff", fontSize: "16px", fontWeight: 700,
            cursor: saving ? "default" : "pointer",
          }}
        >
          {saving ? "Saving..." : `Finish Session for ${clientName}`}
        </button>
      </div>

      {restTimer && <RestTimer defaultSeconds={restTimer.defaultSeconds} onDismiss={() => setRestTimer(null)} />}

      {/* ─── LOG VALUE SHEET ────────────────────────────────────────────────── */}
      {logSheet && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setLogSheet(null); }}
          style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.35)",
            zIndex: 50, display: "flex", alignItems: "flex-end",
          }}
        >
          <div style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", paddingBottom: "32px" }}>
            <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2, margin: "12px auto 8px" }} />
            <p style={{
              fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "#888", padding: "2px 16px 10px",
            }}>
              Set {(logSheet.setIndex + 1)} · {logSheet.field === "reps" ? "Reps" : "Weight (kg)"}
            </p>

            {/* Quick pick */}
            <div style={{ display: "flex", gap: "8px", padding: "0 16px 14px", overflowX: "auto" }}>
              {(logSheet.field === "reps" ? REP_QUICK : WEIGHT_QUICK).map(v => (
                <div
                  key={v}
                  onClick={() => saveLogValue(v)}
                  style={{
                    flexShrink: 0, minWidth: 46, padding: "10px 8px", borderRadius: "10px",
                    border: "0.5px solid #e5e5e5", fontSize: "14px", fontWeight: 700,
                    cursor: "pointer", backgroundColor: "#f7f5f2", color: "#111", textAlign: "center",
                  }}
                >
                  {v}
                </div>
              ))}
            </div>

            {/* Free input */}
            <div style={{ display: "flex", gap: "10px", padding: "0 16px" }}>
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                placeholder={logSheet.field === "reps" ? "e.g. 10" : "e.g. 80"}
                onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) saveLogValue(e.target.value.trim()); }}
                style={{
                  flex: 1, border: "1.5px solid #2d6a4f", borderRadius: "12px",
                  padding: "14px 16px", fontSize: "18px", fontWeight: 700,
                  color: "#111", outline: "none", textAlign: "center",
                }}
              />
              <button
                onClick={e => {
                  const val = e.currentTarget.previousSibling.value.trim();
                  if (val) saveLogValue(val);
                }}
                style={{
                  backgroundColor: "#2d6a4f", color: "#fff", border: "none",
                  borderRadius: "12px", padding: "14px 20px",
                  fontSize: "15px", fontWeight: 700, cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SWAP SHEET ─────────────────────────────────────────────────────── */}
      {swapSheet && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeSwapSheet(); }}
          style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)",
            zIndex: 50, display: "flex", alignItems: "flex-end",
          }}
        >
          <div style={{
            backgroundColor: "#fff", borderRadius: "20px 20px 0 0",
            width: "100%", padding: "20px 20px 40px",
            maxHeight: "85vh", overflowY: "auto",
          }}>
            <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>
              Swap Exercise
            </h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>
              Currently: {swapSheet.exercise.name}
            </p>

            <input
              autoFocus
              type="text"
              placeholder="Search exercises..."
              value={swapSearch}
              onChange={e => { setSwapSearch(e.target.value); searchExercises(e.target.value, setSwapResults); }}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: "12px",
                border: "1.5px solid #2d6a4f", fontSize: "14px",
                outline: "none", boxSizing: "border-box", marginBottom: "14px",
              }}
            />

            {swapResults.map(ex => (
              <div
                key={ex.id}
                style={{
                  backgroundColor: "#f7f5f2", borderRadius: "14px",
                  padding: "14px 16px", border: "0.5px solid #e5e5e5", marginBottom: "8px",
                }}
              >
                <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{ex.name}</p>
                {(ex.muscleGroup || ex.muscles) && (
                  <p style={{ fontSize: "12px", color: "#888", margin: "0 0 10px" }}>
                    {ex.muscleGroup || ex.muscles}
                  </p>
                )}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => doTempSwap(ex)}
                    style={{
                      flex: 1, padding: "10px", borderRadius: "10px",
                      border: "1.5px solid #7c3aed", backgroundColor: "#f5f3ff",
                      color: "#7c3aed", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    This session only
                  </button>
                  <button
                    onClick={() => doPermSwap(ex)}
                    style={{
                      flex: 1, padding: "10px", borderRadius: "10px",
                      border: "1.5px solid #0369a1", backgroundColor: "#e0f2fe",
                      color: "#0369a1", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    Update programme
                  </button>
                </div>
              </div>
            ))}

            {swapSearch.length >= 2 && swapResults.length === 0 && (
              <p style={{ textAlign: "center", color: "#aaa", fontSize: "13px" }}>No exercises found</p>
            )}

            <button
              onClick={closeSwapSheet}
              style={{
                width: "100%", background: "none", border: "none",
                fontSize: "13px", color: "#aaa", cursor: "pointer",
                marginTop: "12px", padding: "6px",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ─── ADD EXERCISE SHEET ─────────────────────────────────────────────── */}
      {addSheet && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setAddSheet(false); setAddSearch(""); setAddResults([]); } }}
          style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)",
            zIndex: 50, display: "flex", alignItems: "flex-end",
          }}
        >
          <div style={{
            backgroundColor: "#fff", borderRadius: "20px 20px 0 0",
            width: "100%", padding: "20px 20px 40px",
            maxHeight: "85vh", overflowY: "auto",
          }}>
            <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>
              Add Exercise
            </h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>
              Added to this session only
            </p>

            <input
              autoFocus
              type="text"
              placeholder="Search exercises..."
              value={addSearch}
              onChange={e => { setAddSearch(e.target.value); searchExercises(e.target.value, setAddResults); }}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: "12px",
                border: "1.5px solid #2d6a4f", fontSize: "14px",
                outline: "none", boxSizing: "border-box", marginBottom: "14px",
              }}
            />

            {addResults.map(ex => (
              <div
                key={ex.id}
                onClick={() => addExercise(ex)}
                style={{
                  backgroundColor: "#f7f5f2", borderRadius: "12px",
                  padding: "14px 16px", border: "0.5px solid #e5e5e5",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "space-between", marginBottom: "8px",
                }}
              >
                <div>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{ex.name}</p>
                  {(ex.muscleGroup || ex.muscles) && (
                    <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>
                      {ex.muscleGroup || ex.muscles}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: "20px", color: "#2d6a4f", fontWeight: 700 }}>+</span>
              </div>
            ))}

            {addSearch.length >= 2 && addResults.length === 0 && (
              <p style={{ textAlign: "center", color: "#aaa", fontSize: "13px" }}>No exercises found</p>
            )}

            <button
              onClick={() => { setAddSheet(false); setAddSearch(""); setAddResults([]); }}
              style={{
                width: "100%", background: "none", border: "none",
                fontSize: "13px", color: "#aaa", cursor: "pointer",
                marginTop: "12px", padding: "6px",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
