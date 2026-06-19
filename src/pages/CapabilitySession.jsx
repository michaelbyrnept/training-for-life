import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, collection, addDoc, getDocs, query, where, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import PortalNav from "../components/PortalNav";

const REP_QUICK = ["1", "2", "3", "4", "5", "6", "8", "10", "12", "15", "20"];
const WEIGHT_QUICK = ["BW", "5", "10", "15", "20", "25", "30", "40", "50", "60", "70", "80", "100", "120", "140"];
const DURATION_QUICK = ["10", "15", "20", "25", "30", "35", "40", "45", "50", "55", "60"];

const RIR_OPTIONS = [
  { value: 0, label: "0", sub: "Absolute failure", color: "#dc2626", bg: "#fef2f2" },
  { value: 1, label: "1", sub: "1 rep left",       color: "#ea580c", bg: "#fff7ed" },
  { value: 2, label: "2", sub: "2 reps left",      color: "#b45309", bg: "#fffbeb" },
  { value: 3, label: "3", sub: "3 reps left",      color: "#16a34a", bg: "#f0fdf4" },
  { value: 4, label: "4+", sub: "Plenty left",     color: "#6b7280", bg: "#f9fafb" },
];

function getYouTubeEmbed(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
}

function getTopSetWeight(exercises, logs, currentExIdx) {
  const ex = exercises[currentExIdx];
  if (!ex?.pctOfTopSet) return null;
  for (let i = currentExIdx - 1; i >= 0; i--) {
    if (exercises[i].name === ex.name && exercises[i].label === "Top Set") {
      const topSets = logs[i] || [];
      const weights = topSets.map(s => parseFloat(s.weight)).filter(w => !isNaN(w) && w > 0);
      if (weights.length > 0) {
        return Math.round(Math.max(...weights) * (ex.pctOfTopSet / 100));
      }
    }
  }
  return null;
}

// ----------------------------------------------------------------
// Rest Timer
// ----------------------------------------------------------------
function RestTimer({ defaultSeconds = 120, onDismiss }) {
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            // Vibrate if supported
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
    setSeconds(s => Math.max(0, s + delta));
    if (!running) setRunning(true);
  };

  const restart = (secs) => {
    clearInterval(intervalRef.current);
    setSeconds(secs);
    setRunning(true);
  };

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const pct = seconds / defaultSeconds;
  const isDone = seconds === 0;

  // Circle SVG
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)",
      zIndex: 60, display: "flex", alignItems: "flex-end",
    }}>
      <div style={{
        backgroundColor: "#1a3a2a", borderRadius: "24px 24px 0 0",
        width: "100%", padding: "24px 24px 48px",
      }}>
        <div style={{ width: 36, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, margin: "0 auto 24px" }} />

        <p style={{ fontSize: 11, fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.12em", textAlign: "center", margin: "0 0 20px" }}>
          {isDone ? "Rest complete" : "Rest timer"}
        </p>

        {/* Circle timer */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ position: "relative", width: 140, height: 140 }}>
            <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle
                cx="70" cy="70" r={r} fill="none"
                stroke={isDone ? "#4ade80" : "#4ade80"}
                strokeWidth="8"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.5s ease" }}
              />
            </svg>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            }}>
              {isDone ? (
                <span style={{ fontSize: 36, fontWeight: 800, color: "#4ade80" }}>Go!</span>
              ) : (
                <>
                  <span style={{ fontSize: 38, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                    {mins}:{String(secs).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>remaining</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Adjust buttons */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
          {[-30, -10, +10, +30].map(delta => (
            <button
              key={delta}
              onClick={() => adjust(delta)}
              style={{
                backgroundColor: "rgba(255,255,255,0.1)", border: "none", borderRadius: 10,
                padding: "10px 14px", fontSize: 13, fontWeight: 700,
                color: delta < 0 ? "#fca5a5" : "#86efac", cursor: "pointer",
              }}
            >
              {delta > 0 ? `+${delta}s` : `${delta}s`}
            </button>
          ))}
        </div>

        {/* Quick preset buttons */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
          {[60, 90, 120, 180, 240].map(s => (
            <button
              key={s}
              onClick={() => restart(s)}
              style={{
                backgroundColor: seconds === s && running ? "#2d6a4f" : "rgba(255,255,255,0.08)",
                border: "none", borderRadius: 10, padding: "8px 12px",
                fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer",
              }}
            >
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setRunning(r => !r)}
            style={{
              flex: 1, backgroundColor: "rgba(255,255,255,0.12)", border: "none",
              borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 700,
              color: "#fff", cursor: "pointer",
            }}
          >
            {running ? "Pause" : "Resume"}
          </button>
          <button
            onClick={onDismiss}
            style={{
              flex: 2, backgroundColor: isDone ? "#4ade80" : "#2d6a4f", border: "none",
              borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 700,
              color: isDone ? "#1a3a2a" : "#fff", cursor: "pointer",
            }}
          >
            {isDone ? "Next set ✓" : "Skip rest"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CapabilitySession() {
  const { weekId, day } = useParams();
  const navigate = useNavigate();
  const storageKey = `tfl_cap_${weekId}_${day}`;

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [weekData, setWeekData] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(() => {
    try { return parseInt(sessionStorage.getItem(`${storageKey}_index`) || "0"); }
    catch { return 0; }
  });
  const [logs, setLogs] = useState(() => {
    try { const s = sessionStorage.getItem(storageKey); return s ? JSON.parse(s) : {}; }
    catch { return {}; }
  });
  const [sheet, setSheet] = useState(null);
  const [swapSheet, setSwapSheet] = useState(null);
  const [restTimer, setRestTimer] = useState(null); // { defaultSeconds }
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userPreferences, setUserPreferences] = useState({});
  const logsRef = useRef(logs);

  useEffect(() => {
    logsRef.current = logs;
    try { sessionStorage.setItem(storageKey, JSON.stringify(logs)); }
    catch {}
  }, [logs, storageKey]);

  useEffect(() => {
    try { sessionStorage.setItem(`${storageKey}_index`, String(currentIndex)); }
    catch {}
  }, [currentIndex, storageKey]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          const data = snap.data();
          setUserProfile(data);
          setUserPreferences(data.exercisePreferences || {});
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const weekRef = doc(db, "programmes", "capability-programme", "weeks", weekId);
        const weekSnap = await getDoc(weekRef);
        if (!weekSnap.exists()) { setLoading(false); return; }
        const wd = weekSnap.data();
        setWeekData(wd);
        const sess = wd.sessions?.[day];
        setSession(sess);

        if (sess?.type === "weights" && sess.exercises?.length > 0) {
          const enriched = await Promise.all(
            sess.exercises.map(async (ex) => {
              try {
                const preferred = userPreferences[ex.name];
                const lookupName = preferred ? preferred.name : ex.name;
                const q = query(collection(db, "exercises"), where("name", "==", lookupName));
                const snap = await getDocs(q);
                if (!snap.empty) {
                  const dbEx = snap.docs[0].data();
                  return {
                    ...ex,
                    originalName: ex.name,
                    name: preferred ? preferred.name : ex.name,
                    isSwapped: !!preferred,
                    description: dbEx.description || "",
                    coachingNotes: dbEx.coachingNotes || "",
                    videoUrl: dbEx.videoUrl || "",
                    swapAlternatives: dbEx.swapAlternatives || [],
                    dbExerciseId: snap.docs[0].id,
                  };
                }
              } catch {}
              return { ...ex, originalName: ex.name, swapAlternatives: [] };
            })
          );
          setExercises(enriched);

          const existing = logsRef.current;
          if (Object.keys(existing).length === 0) {
            const init = {};
            enriched.forEach((ex, i) => {
              init[i] = Array.from({ length: parseInt(ex.sets) || 3 }, () => ({ reps: null, weight: null, rir: null, done: false }));
            });
            setLogs(init);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (userPreferences !== null) load();
  }, [weekId, day, userPreferences]);

  // Get rest duration based on exercise category
  const getRestDuration = (ex) => {
    if (!ex) return 120;
    if (ex.category === "main") return 180; // 3 min for main lifts
    if (ex.category === "core" || ex.category === "arms") return 60; // 1 min for finishers
    return 90; // 90s for accessories
  };

  const openSwapSheet = async (exIdx) => {
    const ex = exercises[exIdx];
    if (!ex) return;
    const alternatives = [];
    if (ex.isSwapped) {
      try {
        const q = query(collection(db, "exercises"), where("name", "==", ex.originalName));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0].data();
          alternatives.push({ id: snap.docs[0].id, name: ex.originalName, isOriginal: true, description: d.description || "", videoUrl: d.videoUrl || "" });
        }
      } catch {}
    }
    if (ex.swapAlternatives?.length > 0) {
      for (const alt of ex.swapAlternatives) {
        if (alt.name === ex.name) continue;
        try {
          const q = query(collection(db, "exercises"), where("name", "==", alt.name));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const d = snap.docs[0].data();
            alternatives.push({ id: snap.docs[0].id, name: alt.name, description: d.description || "", videoUrl: d.videoUrl || "" });
          } else {
            alternatives.push({ id: alt.id, name: alt.name, description: "", videoUrl: "" });
          }
        } catch {
          alternatives.push({ id: alt.id, name: alt.name, description: "", videoUrl: "" });
        }
      }
    }
    const isHybridOrInPerson = userProfile?.subscription === "hybrid" || userProfile?.subscription === "in-person";
    setSwapSheet({ exIdx, originalName: ex.originalName, currentName: ex.name, alternatives, isHybridOrInPerson });
  };

  const handleSwap = async (exIdx, newExercise) => {
    const ex = exercises[exIdx];
    const originalName = ex.originalName;
    if (user) {
      const newPrefs = { ...userPreferences };
      if (newExercise.isOriginal) { delete newPrefs[originalName]; }
      else { newPrefs[originalName] = { id: newExercise.id, name: newExercise.name }; }
      setUserPreferences(newPrefs);
      try { await setDoc(doc(db, "users", user.uid), { exercisePreferences: newPrefs }, { merge: true }); }
      catch (e) { console.error(e); }
    }
    setExercises(prev => prev.map((e, i) => {
      if (i !== exIdx) return e;
      return { ...e, name: newExercise.isOriginal ? originalName : newExercise.name, description: newExercise.description || "", videoUrl: newExercise.videoUrl || "", isSwapped: !newExercise.isOriginal };
    }));
    setSwapSheet(null);
  };

  const openSheet = (exIdx, setIdx, field) => setSheet({ exIdx, setIdx, field });
  const closeSheet = () => setSheet(null);

  const saveValue = (value) => {
    if (!sheet) return;
    const { exIdx, setIdx, field } = sheet;
    setLogs(prev => {
      const updated = [...(prev[exIdx] || [])];
      updated[setIdx] = { ...updated[setIdx], [field]: value };
      return { ...prev, [exIdx]: updated };
    });
    closeSheet();
  };

  const setRir = (exIdx, setIdx, rir) => {
    setLogs(prev => {
      const updated = [...(prev[exIdx] || [])];
      updated[setIdx] = { ...updated[setIdx], rir };
      return { ...prev, [exIdx]: updated };
    });
  };

  const toggleSetDone = (exIdx, setIdx) => {
    setLogs(prev => {
      const updated = [...(prev[exIdx] || [])];
      const s = updated[setIdx];
      if (s.reps && s.weight) {
        const wasDone = s.done;
        updated[setIdx] = { ...s, done: !s.done };
        const newLogs = { ...prev, [exIdx]: updated };
        // Start rest timer when marking done (not when unmarking)
        if (!wasDone) {
          const ex = exercises[exIdx];
          setRestTimer({ defaultSeconds: getRestDuration(ex) });
        }
        return newLogs;
      }
      return prev;
    });
  };

  const addSet = (exIdx) => {
    setLogs(prev => ({
      ...prev,
      [exIdx]: [...(prev[exIdx] || []), { reps: null, weight: null, rir: null, done: false }],
    }));
  };

  const finishWorkout = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "workoutLogs"), {
        userId: user.uid,
        programmeId: "capability-programme",
        weekId,
        weekNum: weekData?.weekNum,
        day,
        sessionName: session?.name,
        sessionType: "weights",
        logs,
        completedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
      });
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(`${storageKey}_index`);
      setSaved(true);
      setTimeout(() => navigate("/programme/capability-programme"), 1500);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
      <PortalNav />
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
    </div>
  );

  if (!session) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
      <PortalNav />
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Session not found.</p>
    </div>
  );

  if (session.type === "run") {
    return <RunSession session={session} weekData={weekData} day={day} navigate={navigate} user={user} />;
  }

  if (saved) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <h2 style={{ color: "#1a3a2a", fontSize: 22, fontWeight: 700 }}>Session logged!</h2>
        <p style={{ color: "#888" }}>Redirecting...</p>
      </div>
    </div>
  );

  const exercise = exercises[currentIndex];
  const exerciseLogs = logs[currentIndex] || [];
  const isLast = currentIndex === exercises.length - 1;
  const isFirst = currentIndex === 0;
  const embedUrl = getYouTubeEmbed(exercise?.videoUrl);
  const suggestedBackOff = exercise ? getTopSetWeight(exercises, logs, currentIndex) : null;
  const hasSwaps = exercise?.swapAlternatives?.length > 0 || exercise?.isSwapped;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: 80, position: "relative" }}>
      {!sheet && !swapSheet && !restTimer && <PortalNav />}

      <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => navigate("/programme/capability-programme")} style={{ fontSize: 13, color: "#2d6a4f", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          &larr; Back
        </button>
        <span style={{ fontSize: 13, color: "#888", fontWeight: 500 }}>{session.name}</span>
      </div>

      <div style={{ height: 3, backgroundColor: "#e5e5e5", margin: "0 16px" }}>
        <div style={{ height: 3, backgroundColor: "#2d6a4f", borderRadius: 2, width: `${((currentIndex + 1) / exercises.length) * 100}%`, transition: "width 0.3s ease" }} />
      </div>

      <div style={{ padding: "10px 16px 0", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#888" }}>
        Exercise {currentIndex + 1} of {exercises.length}
      </div>

      {exercise && (
        <div style={{ margin: "8px 16px 0", backgroundColor: "#fff", borderRadius: 20, border: "0.5px solid #e5e5e5", overflow: "hidden" }}>

          <div style={{ padding: "16px 16px 12px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111", margin: 0 }}>{exercise.name}</h1>
                  {exercise.isSwapped && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", backgroundColor: "#f5f3ff", padding: "2px 8px", borderRadius: 20 }}>Your swap</span>
                  )}
                </div>
              </div>
              {hasSwaps && (
                <button onClick={() => openSwapSheet(currentIndex)} style={{ flexShrink: 0, backgroundColor: "#f7f5f2", border: "1px solid #e5e5e5", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#555", cursor: "pointer" }}>
                  🔄 Swap
                </button>
              )}
            </div>
            {exercise.description && (
              <p style={{ fontSize: 13, color: "#666", margin: "0 0 10px", lineHeight: 1.5 }}>{exercise.description}</p>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "3px 10px", borderRadius: 20 }}>
                {exercise.sets} sets &middot; {exercise.reps} reps
              </span>
              {exercise.rpe && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", backgroundColor: "#f5f3ff", padding: "3px 10px", borderRadius: 20 }}>RPE {exercise.rpe}</span>
              )}
              {exercise.pctOfTopSet && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#b45309", backgroundColor: "#fffbeb", padding: "3px 10px", borderRadius: 20 }}>{exercise.pctOfTopSet}% of top set</span>
              )}
              {exercise.label && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", backgroundColor: "#f3f4f6", padding: "3px 10px", borderRadius: 20 }}>{exercise.label}</span>
              )}
              {exercise.rest && (
                <span onClick={() => setRestTimer({ defaultSeconds: getRestDuration(exercise) })} style={{ fontSize: 12, fontWeight: 700, color: "#0369a1", backgroundColor: "#e0f2fe", padding: "3px 10px", borderRadius: 20, cursor: "pointer" }}>
                  ⏱ {exercise.rest}
                </span>
              )}
            </div>
          </div>

          {(exercise.coachingNotes || exercise.note) && (
            <div style={{ backgroundColor: "#eaf5ef", padding: "10px 16px" }}>
              <p style={{ fontSize: 12, color: "#1a4a35", lineHeight: 1.6, margin: 0 }}>{exercise.coachingNotes || exercise.note}</p>
            </div>
          )}

          {suggestedBackOff && (
            <div style={{ backgroundColor: "#fffbeb", borderLeft: "3px solid #f59e0b", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>⚡</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#92400e", margin: 0 }}>Suggested: {suggestedBackOff}kg</p>
                <p style={{ fontSize: 11, color: "#b45309", margin: "2px 0 0" }}>Based on your top set &middot; {exercise.pctOfTopSet}% &middot; tap weight to adjust</p>
              </div>
            </div>
          )}

          {embedUrl && (
            <div style={{ padding: "12px 16px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Exercise Demo</p>
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}>
                <iframe src={embedUrl} title={exercise.name} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
              </div>
            </div>
          )}

          {/* Set logging */}
          <div style={{ padding: "0 16px 8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 1fr 32px", gap: 6, padding: "10px 4px 6px", borderBottom: "0.5px solid #f0f0f0" }}>
              {["#", "Reps", "Weight", "RIR", ""].map((h, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#aaa", textAlign: i === 0 ? "left" : "center" }}>{h}</span>
              ))}
            </div>

            {Array.isArray(exerciseLogs) && exerciseLogs.map((s, i) => {
              const rirOpt = RIR_OPTIONS.find(r => r.value === s.rir);
              return (
                <div key={i}>
                  <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 1fr 32px", gap: 6, padding: "8px 4px 4px", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: s.done ? "#2d6a4f" : "#aaa" }}>{i + 1}</span>
                    <div onClick={() => openSheet(currentIndex, i, "reps")} style={{ backgroundColor: s.reps ? (s.done ? "#eaf5ef" : "#f0fdf4") : "#f7f5f2", border: s.reps ? "0.5px solid #2d6a4f" : "0.5px solid #e5e5e5", borderRadius: 8, padding: "8px 4px", textAlign: "center", fontSize: 14, fontWeight: 700, color: s.reps ? "#1a4a35" : "#bbb", cursor: "pointer" }}>
                      {s.reps || "—"}
                    </div>
                    <div onClick={() => openSheet(currentIndex, i, "weight")} style={{ backgroundColor: s.weight ? (s.done ? "#eaf5ef" : "#f0fdf4") : (suggestedBackOff ? "#fffbeb" : "#f7f5f2"), border: s.weight ? "0.5px solid #2d6a4f" : (suggestedBackOff ? "0.5px solid #f59e0b" : "0.5px solid #e5e5e5"), borderRadius: 8, padding: "8px 4px", textAlign: "center", fontSize: 14, fontWeight: 700, color: s.weight ? "#1a4a35" : (suggestedBackOff ? "#92400e" : "#bbb"), cursor: "pointer" }}>
                      {s.weight || (suggestedBackOff ? `${suggestedBackOff}` : "—")}
                    </div>
                    <div onClick={() => { const cur = s.rir ?? 4; setRir(currentIndex, i, cur <= 0 ? 4 : cur - 1); }} style={{ backgroundColor: rirOpt ? rirOpt.bg : "#f7f5f2", border: `0.5px solid ${rirOpt ? rirOpt.color + "44" : "#e5e5e5"}`, borderRadius: 8, padding: "8px 4px", textAlign: "center", fontSize: 13, fontWeight: 700, color: rirOpt ? rirOpt.color : "#bbb", cursor: "pointer" }}>
                      {s.rir !== null && s.rir !== undefined ? (s.rir >= 4 ? "4+" : String(s.rir)) : "—"}
                    </div>
                    <div onClick={() => toggleSetDone(currentIndex, i)} style={{ width: 32, height: 32, borderRadius: "50%", border: s.done ? "none" : "1.5px solid #e5e5e5", backgroundColor: s.done ? "#2d6a4f" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", margin: "0 auto" }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7l4 4 6-6" stroke={s.done ? "#fff" : "#ccc"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                  {s.rir !== null && s.rir !== undefined && (
                    <div style={{ padding: "0 4px 4px", display: "flex", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: 10, color: rirOpt?.color || "#888", fontStyle: "italic" }}>{rirOpt?.sub}</span>
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ display: "flex", gap: 6, padding: "8px 4px 4px", overflowX: "auto" }}>
              {RIR_OPTIONS.map(r => (
                <div key={r.value} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 20, backgroundColor: r.bg, border: `0.5px solid ${r.color}22` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: r.color }}>{r.label}</span>
                  <span style={{ fontSize: 10, color: r.color, opacity: 0.8 }}>{r.sub}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={() => addSet(currentIndex)} style={{ background: "none", border: "none", color: "#2d6a4f", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "8px 4px 4px" }}>
                + Add set
              </button>
              <button onClick={() => setRestTimer({ defaultSeconds: getRestDuration(exercise) })} style={{ background: "none", border: "none", color: "#888", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "8px 4px 4px", display: "flex", alignItems: "center", gap: 4 }}>
                ⏱ Rest timer
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, padding: "12px 16px" }}>
        {!isFirst && (
          <button onClick={() => setCurrentIndex(i => i - 1)} style={{ flex: 1, padding: 14, borderRadius: 12, border: "0.5px solid #e5e5e5", backgroundColor: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", color: "#111" }}>
            &larr; Previous
          </button>
        )}
        {!isLast ? (
          <button onClick={() => setCurrentIndex(i => i + 1)} style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", backgroundColor: "#2d6a4f", fontSize: 15, fontWeight: 700, cursor: "pointer", color: "#fff" }}>
            Next &rarr;
          </button>
        ) : (
          <button onClick={finishWorkout} disabled={saving} style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", backgroundColor: saving ? "#aaa" : "#2d6a4f", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", color: "#fff" }}>
            {saving ? "Saving..." : "Finish Session ✓"}
          </button>
        )}
      </div>

      {sheet && (
        <LogSheet
          field={sheet.field}
          current={logs[sheet.exIdx]?.[sheet.setIdx]?.[sheet.field]}
          suggestedWeight={sheet.field === "weight" && !logs[sheet.exIdx]?.[sheet.setIdx]?.weight ? getTopSetWeight(exercises, logs, sheet.exIdx) : null}
          onSave={saveValue}
          onClose={closeSheet}
        />
      )}

      {swapSheet && (
        <SwapSheet swapSheet={swapSheet} onSwap={(newEx) => handleSwap(swapSheet.exIdx, newEx)} onClose={() => setSwapSheet(null)} />
      )}

      {restTimer && (
        <RestTimer defaultSeconds={restTimer.defaultSeconds} onDismiss={() => setRestTimer(null)} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Swap Sheet
// ----------------------------------------------------------------
function SwapSheet({ swapSheet, onSwap, onClose }) {
  const { currentName, alternatives, isHybridOrInPerson } = swapSheet;
  const [browseSearch, setBrowseSearch] = useState("");
  const [browseResults, setBrowseResults] = useState([]);
  const [showBrowse, setShowBrowse] = useState(false);
  const [searching, setSearching] = useState(false);

  const handleBrowseSearch = async (term) => {
    setBrowseSearch(term);
    if (term.trim().length < 2) { setBrowseResults([]); return; }
    setSearching(true);
    try {
      const snap = await getDocs(collection(db, "exercises"));
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.name.toLowerCase().includes(term.toLowerCase()) && e.name !== currentName && e.type !== "cardio");
      setBrowseResults(results.slice(0, 10));
    } catch {}
    setSearching(false);
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", paddingBottom: 40, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2, margin: "12px auto 0" }} />
        <div style={{ padding: "16px 20px 12px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Swap exercise</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>{currentName}</h2>
          <p style={{ fontSize: 13, color: "#888", margin: 0 }}>Your choice saves and loads automatically next time.</p>
        </div>
        {alternatives.length > 0 && (
          <div style={{ padding: "0 20px 8px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
              {isHybridOrInPerson ? "Recommended alternatives" : "Available swaps"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alternatives.map(alt => (
                <div key={alt.id} onClick={() => onSwap(alt)} style={{ backgroundColor: alt.isOriginal ? "#f0fdf4" : "#f7f5f2", border: `1px solid ${alt.isOriginal ? "#86efac" : "#e5e5e5"}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: 0 }}>{alt.name}</p>
                    {alt.isOriginal && <p style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, margin: "2px 0 0" }}>Reset to original</p>}
                    {alt.description && !alt.isOriginal && <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>{alt.description}</p>}
                  </div>
                  <span style={{ fontSize: 20, color: "#ccc" }}>&rsaquo;</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {isHybridOrInPerson && (
          <div style={{ padding: "12px 20px 0", borderTop: alternatives.length > 0 ? "1px solid #f0f0f0" : "none", marginTop: alternatives.length > 0 ? 8 : 0 }}>
            {!showBrowse ? (
              <button onClick={() => setShowBrowse(true)} style={{ width: "100%", backgroundColor: "#f7f5f2", border: "1px solid #e5e5e5", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, color: "#555", cursor: "pointer" }}>
                Browse full exercise library
              </button>
            ) : (
              <>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Full library</p>
                <input autoFocus placeholder="Search any exercise..." value={browseSearch} onChange={e => handleBrowseSearch(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #2d6a4f", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
                {searching && <p style={{ fontSize: 12, color: "#888", textAlign: "center" }}>Searching...</p>}
                {browseResults.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {browseResults.map(ex => (
                      <div key={ex.id} onClick={() => onSwap({ id: ex.id, name: ex.name, description: ex.description || "", videoUrl: ex.videoUrl || "" })} style={{ backgroundColor: "#f7f5f2", borderRadius: 10, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "#111", margin: 0 }}>{ex.name}</p>
                          <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0" }}>{ex.muscleGroup}</p>
                        </div>
                        <span style={{ fontSize: 20, color: "#ccc" }}>&rsaquo;</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <div style={{ padding: "16px 20px 0" }}>
          <button onClick={onClose} style={{ width: "100%", backgroundColor: "#f0f0f0", border: "none", borderRadius: 12, padding: 14, fontSize: 14, fontWeight: 700, color: "#555", cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Run Session
// ----------------------------------------------------------------
function RunSession({ session, weekData, day, navigate, user }) {
  const [actualDuration, setActualDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "workoutLogs"), {
        userId: user.uid,
        programmeId: "capability-programme",
        weekId: weekData?.weekNum ? `week-${weekData.weekNum}` : "",
        weekNum: weekData?.weekNum,
        day,
        sessionName: session.label,
        sessionType: "run",
        runType: session.type,
        actualDuration: parseInt(actualDuration) || null,
        notes,
        completedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
      });
      setSaved(true);
      setTimeout(() => navigate("/programme/capability-programme"), 1500);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: 80 }}>
      <PortalNav />
      <div style={{ padding: "12px 16px 8px" }}>
        <button onClick={() => navigate("/programme/capability-programme")} style={{ fontSize: 13, color: "#2d6a4f", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0 }}>&larr; Back</button>
      </div>
      <div style={{ margin: "8px 16px 0", backgroundColor: "#fff", borderRadius: 20, border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
        <div style={{ padding: "16px 16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🏃</span>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111", margin: 0 }}>{session.label}</h1>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "3px 10px", borderRadius: 20 }}>
            Week {weekData?.weekNum} -- {weekData?.blockLabel}
          </span>
        </div>
        <div style={{ backgroundColor: "#eaf5ef", padding: "12px 16px" }}>
          <p style={{ fontSize: 14, color: "#1a4a35", lineHeight: 1.6, margin: 0 }}>{session.description}</p>
        </div>
        {session.type === "intervals" && session.intervals && (
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Session Breakdown</p>
            {[
              { label: "Warm Up", value: session.warmup },
              { label: "Intervals", value: `${session.intervals.reps} x ${session.intervals.distance} at ${session.intervals.pace}` },
              { label: "Recovery", value: session.intervals.rest },
              { label: "Cool Down", value: session.cooldown },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #f0f0f0", fontSize: 14 }}>
                <span style={{ color: "#888", fontWeight: 600 }}>{row.label}</span>
                <span style={{ color: "#111", fontWeight: 700 }}>{row.value}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Log Your Run</p>
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Duration (minutes)</p>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 8 }}>
              {DURATION_QUICK.map(d => (
                <div key={d} onClick={() => setActualDuration(d)} style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 10, border: actualDuration === d ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: actualDuration === d ? "#eaf5ef" : "#f7f5f2", fontSize: 13, fontWeight: 700, color: actualDuration === d ? "#2d6a4f" : "#111", cursor: "pointer" }}>
                  {d}
                </div>
              ))}
            </div>
            <input type="number" value={actualDuration} onChange={e => setActualDuration(e.target.value)} placeholder={session.duration ? `Target: ${session.duration} min` : "Enter duration..."} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e5e5", fontSize: 15, fontWeight: 700, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Notes (optional)</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did it feel? Pace, conditions..." rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e5e5", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
          </div>
          {saved ? (
            <div style={{ backgroundColor: "#eaf5ef", borderRadius: 12, padding: 14, textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#2d6a4f", margin: 0 }}>Run logged! Redirecting...</p>
            </div>
          ) : (
            <button onClick={handleSave} disabled={saving} style={{ width: "100%", backgroundColor: saving ? "#aaa" : "#2d6a4f", color: "#fff", border: "none", borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving..." : "Log Run Complete ✓"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Log Sheet
// ----------------------------------------------------------------
function LogSheet({ field, current, suggestedWeight, onSave, onClose }) {
  const isReps = field === "reps";
  const [value, setValue] = useState(current || (suggestedWeight ? String(suggestedWeight) : ""));
  const quick = isReps ? REP_QUICK : WEIGHT_QUICK;

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", paddingBottom: 32 }}>
        <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2, margin: "12px auto 8px" }} />
        <div style={{ padding: "4px 16px 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>
          {isReps ? "Log reps" : "Log weight"}
        </div>
        {!isReps && suggestedWeight && (
          <div style={{ padding: "4px 16px 10px" }}>
            <div onClick={() => onSave(String(suggestedWeight))} style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 20, padding: "6px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>⚡ Use suggested: {suggestedWeight}kg</span>
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, padding: "0 16px 14px", overflowX: "auto" }}>
          {quick.map(v => (
            <div key={v} onClick={() => onSave(v)} style={{ flexShrink: 0, minWidth: 52, padding: "10px 14px", borderRadius: 10, border: "0.5px solid #e5e5e5", fontSize: 15, fontWeight: 700, cursor: "pointer", backgroundColor: "#f7f5f2", color: "#111", textAlign: "center" }}>
              {v}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "0 16px" }}>
          <input autoFocus type={isReps ? "number" : "text"} inputMode="decimal" placeholder={isReps ? "e.g. 5" : suggestedWeight ? `${suggestedWeight}kg suggested` : "e.g. 100kg"} value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && value) onSave(value); }} style={{ flex: 1, border: "1.5px solid #2d6a4f", borderRadius: 12, padding: "14px 16px", fontSize: 18, fontWeight: 700, color: "#111", outline: "none", textAlign: "center" }} />
          <button onClick={() => { if (value) onSave(value); }} style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: 12, padding: "14px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Done</button>
        </div>
      </div>
    </div>
  );
}