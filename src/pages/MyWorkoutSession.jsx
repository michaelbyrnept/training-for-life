import { useState, useEffect, useRef } from "react";
import { doc, getDoc, getDocs, collection, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db, auth } from "../firebase";
import PortalNav from "../components/PortalNav";

// ─── Rest Timer ───────────────────────────────────────────────────────────────

function RestTimer({ seconds: defaultSeconds, onDismiss }) {
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
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
    setSeconds((s) => Math.max(0, s + delta));
    if (!running) setRunning(true);
  };

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isDone = seconds === 0;
  const r = 54, circ = 2 * Math.PI * r;
  const dash = isDone ? 0 : circ * (seconds / defaultSeconds);

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
      <div style={{ backgroundColor: "#1a3a2a", borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 24px calc(48px + env(safe-area-inset-bottom))" }}>
        <div style={{ width: 36, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, margin: "0 auto 24px" }} />
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.12em", textAlign: "center", margin: "0 0 20px" }}>
          {isDone ? "Rest complete" : "Rest timer"}
        </p>

        {/* Circular timer */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ position: "relative", width: 140, height: 140 }}>
            <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle cx="70" cy="70" r={r} fill="none" stroke={isDone ? "#4ade80" : "#9fe1cb"} strokeWidth="8" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: 34, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-1px" }}>
                {isDone ? "GO" : `${mins}:${String(secs).padStart(2, "0")}`}
              </p>
            </div>
          </div>
        </div>

        {/* Adjust buttons */}
        {!isDone && (
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
            {[-30, -15, +15, +30].map((d) => (
              <button
                key={d}
                onClick={() => adjust(d)}
                style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "none", color: "#fff", borderRadius: "10px", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {d > 0 ? `+${d}s` : `${d}s`}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onDismiss}
          style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "none", backgroundColor: isDone ? "#4ade80" : "rgba(255,255,255,0.15)", color: isDone ? "#1a3a2a" : "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
        >
          {isDone ? "Start next set" : "Skip rest"}
        </button>
      </div>
    </div>
  );
}

// ─── Completion screen ────────────────────────────────────────────────────────

function CompletionScreen({ workout, durationSeconds, setsCompleted, navigate }) {
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", paddingBottom: "calc(100px + env(safe-area-inset-bottom))" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🏆</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1a3a2a", margin: "0 0 8px", textAlign: "center" }}>Workout Complete</h1>
      <p style={{ fontSize: 15, color: "#888", textAlign: "center", margin: "0 0 32px" }}>{workout?.name || "Custom workout"}</p>

      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "16px 24px", textAlign: "center", border: "0.5px solid #e5e5e5" }}>
          <p style={{ fontSize: 26, fontWeight: 800, color: "#2d6a4f", margin: 0 }}>
            {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
          </p>
          <p style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 0" }}>Duration</p>
        </div>
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "16px 24px", textAlign: "center", border: "0.5px solid #e5e5e5" }}>
          <p style={{ fontSize: 26, fontWeight: 800, color: "#2d6a4f", margin: 0 }}>{setsCompleted}</p>
          <p style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 0" }}>Sets done</p>
        </div>
      </div>

      <button
        onClick={() => navigate("/my-workouts")}
        style={{ width: "100%", maxWidth: 340, padding: "16px", borderRadius: "14px", border: "none", backgroundColor: "#2d6a4f", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}
      >
        Back to My Workouts
      </button>
      <button
        onClick={() => navigate("/dashboard")}
        style={{ width: "100%", maxWidth: 340, padding: "14px", borderRadius: "14px", border: "none", backgroundColor: "transparent", color: "#888", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
      >
        Go to Dashboard
      </button>
    </div>
  );
}

// ─── Main Session Component ───────────────────────────────────────────────────

export default function MyWorkoutSession() {
  const { workoutId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [workout, setWorkout] = useState(null);
  const [exerciseDetails, setExerciseDetails] = useState({});
  const [loading, setLoading] = useState(true);

  // Sets log: { [exerciseIndex]: [{ reps, weight, completed }] }
  const [setsLog, setSetsLog] = useState({});
  const [restTimer, setRestTimer] = useState(null); // { seconds }
  const [startTime] = useState(() => new Date());
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);

      const snap = await getDoc(doc(db, "users", u.uid, "workouts", workoutId));
      if (!snap.exists()) { navigate("/my-workouts"); return; }

      const workoutData = { id: snap.id, ...snap.data() };
      setWorkout(workoutData);

      // Initialise sets log with one empty set per exercise (pre-filled with workout defaults)
      const initialLog = {};
      (workoutData.exercises || []).forEach((ex, i) => {
        const sets = ex.sets || 3;
        initialLog[i] = Array.from({ length: sets }, () => ({
          reps: "",
          weight: ex.weight || "",
          completed: false,
        }));
      });
      setSetsLog(initialLog);

      // Fetch exercise details for coaching cues (non-blocking)
      const ids = (workoutData.exercises || []).map((e) => e.exerciseId).filter(Boolean);
      const details = {};
      await Promise.all(
        ids.map(async (id) => {
          const exSnap = await getDoc(doc(db, "exercises", id));
          if (exSnap.exists()) details[id] = exSnap.data();
        })
      );
      setExerciseDetails(details);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const toggleSet = (exIdx, setIdx) => {
    setSetsLog((prev) => {
      const updated = { ...prev };
      const sets = [...(updated[exIdx] || [])];
      const wasCompleted = sets[setIdx]?.completed;
      sets[setIdx] = { ...sets[setIdx], completed: !wasCompleted };
      updated[exIdx] = sets;

      // Start rest timer when completing a set
      if (!wasCompleted) {
        const restSeconds = workout?.exercises?.[exIdx]?.restSeconds || 90;
        setRestTimer({ seconds: restSeconds });
      }

      return updated;
    });
  };

  const updateSetValue = (exIdx, setIdx, field, value) => {
    setSetsLog((prev) => {
      const updated = { ...prev };
      const sets = [...(updated[exIdx] || [])];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      updated[exIdx] = sets;
      return updated;
    });
  };

  const addSet = (exIdx) => {
    setSetsLog((prev) => {
      const updated = { ...prev };
      const lastSet = (updated[exIdx] || []).at(-1) || {};
      updated[exIdx] = [...(updated[exIdx] || []), { reps: lastSet.reps || "", weight: lastSet.weight || "", completed: false }];
      return updated;
    });
  };

  const handleFinish = async () => {
    setSaving(true);
    const endTime = new Date();
    const dur = Math.floor((endTime - startTime) / 1000);
    setDurationSeconds(dur);

    // Build log exercises
    const logExercises = (workout.exercises || []).map((ex, i) => ({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      order: i,
      sets: (setsLog[i] || []).map((s) => ({
        reps: parseInt(s.reps) || null,
        weight: parseFloat(s.weight) || null,
        completed: s.completed,
      })),
      personalBestThisSession: false,
    }));

    const setsCompleted = Object.values(setsLog).flat().filter((s) => s.completed).length;

    try {
      // Save workout log
      await addDoc(collection(db, "workoutLogs"), {
        userId: user.uid,
        workoutId: workout.id,
        workoutName: workout.name,
        logType: "custom",
        startedAt: startTime,
        completedAt: endTime,
        durationSeconds: dur,
        exercises: logExercises,
        healthSnapshot: { restingHeartRate: null, hrv: null, sleepHours: null, source: null },
        createdAt: serverTimestamp(),
      });

      // Update lastUsedAt on the workout
      await updateDoc(doc(db, "users", user.uid, "workouts", workout.id), {
        lastUsedAt: serverTimestamp(),
      });

      setFinished(true);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  const totalSets = Object.values(setsLog).flat().length;
  const completedSets = Object.values(setsLog).flat().filter((s) => s.completed).length;
  const progress = totalSets > 0 ? completedSets / totalSets : 0;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
        <PortalNav />
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0", color: "#aaa" }}>Loading workout...</div>
      </div>
    );
  }

  if (finished) {
    return (
      <>
        <PortalNav />
        <CompletionScreen
          workout={workout}
          durationSeconds={durationSeconds}
          setsCompleted={completedSets}
          navigate={navigate}
        />
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "180px" }}>
      <PortalNav />

      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button
            onClick={() => navigate("/my-workouts")}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}
          >
            ←
          </button>
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
            Workout
          </p>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
          {workout?.name || "Workout"}
        </h1>
        <p style={{ fontSize: 13, color: "#9fe1cb", margin: "0 0 16px" }}>
          {completedSets} of {totalSets} sets complete
        </p>

        {/* Progress bar */}
        <div style={{ height: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2 }}>
          <div style={{ height: 4, backgroundColor: "#4ade80", borderRadius: 2, width: `${progress * 100}%`, transition: "width 0.3s ease" }} />
        </div>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      <div style={{ padding: "0 16px" }}>
        {(workout?.exercises || []).map((ex, exIdx) => {
          const sets = setsLog[exIdx] || [];
          const allComplete = sets.length > 0 && sets.every((s) => s.completed);
          const detail = exerciseDetails[ex.exerciseId];

          return (
            <div key={exIdx} style={{ marginBottom: 16 }}>
              {/* Exercise header */}
              <div
                style={{
                  backgroundColor: allComplete ? "#eaf5ef" : "#fff",
                  borderRadius: "16px",
                  border: `0.5px solid ${allComplete ? "#86efac" : "#e5e5e5"}`,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "14px 16px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        backgroundColor: allComplete ? "#2d6a4f" : "#f0f0f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {allComplete ? (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2.5 7l3.5 3.5 5.5-7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <span style={{ fontSize: 16 }}>💪</span>
                      )}
                    </div>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{ex.exerciseName}</p>
                      <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                        {ex.sets} sets × {ex.reps} reps
                        {ex.weight && ex.weight !== "" ? ` • ${ex.weight}kg` : ""}
                        {ex.restSeconds ? ` • ${ex.restSeconds}s rest` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Coach cue from exercise library */}
                  {detail?.coachingNotes && (
                    <div style={{ marginTop: 10, backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "8px 12px" }}>
                      <p style={{ fontSize: 12, color: "#555", margin: 0, fontStyle: "italic" }}>
                        "{detail.coachingNotes.split(/\n|\. /)[0].replace(/\.$/, "")}"
                      </p>
                    </div>
                  )}
                  {/* Exercise guide link */}
                  {ex.exerciseId && (
                    <Link
                      to={`/exercise/${ex.exerciseId}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, fontWeight: 700, color: "#888", textDecoration: "none" }}
                    >
                      📖 Exercise guide
                    </Link>
                  )}
                </div>

                {/* Set rows */}
                <div style={{ borderTop: "0.5px solid #f0f0f0" }}>
                  {/* Column headers */}
                  <div style={{ display: "flex", padding: "8px 16px", gap: 8 }}>
                    <span style={{ width: 32, fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Set</span>
                    <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Reps</span>
                    <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>kg</span>
                    <span style={{ width: 44, fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Done</span>
                  </div>

                  {sets.map((s, setIdx) => (
                    <div
                      key={setIdx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "8px 16px",
                        gap: 8,
                        backgroundColor: s.completed ? "#eaf5ef" : "transparent",
                        borderTop: "0.5px solid #f7f5f2",
                      }}
                    >
                      {/* Set number */}
                      <span style={{ width: 32, fontSize: 13, fontWeight: 700, color: "#aaa", textAlign: "center" }}>
                        {setIdx + 1}
                      </span>

                      {/* Reps input */}
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder={ex.reps}
                        value={s.reps}
                        onChange={(e) => updateSetValue(exIdx, setIdx, "reps", e.target.value)}
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: "8px",
                          border: "1.5px solid #e5e5e5",
                          fontSize: 15,
                          fontWeight: 700,
                          textAlign: "center",
                          backgroundColor: s.completed ? "rgba(255,255,255,0.7)" : "#f7f5f2",
                          outline: "none",
                          color: "#111",
                        }}
                      />

                      {/* Weight input */}
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder={ex.weight || "0"}
                        value={s.weight}
                        onChange={(e) => updateSetValue(exIdx, setIdx, "weight", e.target.value)}
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: "8px",
                          border: "1.5px solid #e5e5e5",
                          fontSize: 15,
                          fontWeight: 700,
                          textAlign: "center",
                          backgroundColor: s.completed ? "rgba(255,255,255,0.7)" : "#f7f5f2",
                          outline: "none",
                          color: "#111",
                        }}
                      />

                      {/* Complete toggle */}
                      <button
                        onClick={() => toggleSet(exIdx, setIdx)}
                        style={{
                          width: 44,
                          height: 36,
                          borderRadius: "10px",
                          border: "none",
                          backgroundColor: s.completed ? "#2d6a4f" : "#f0f0f0",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {s.completed ? (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2.5 7l3.5 3.5 5.5-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <div style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid #ccc" }} />
                        )}
                      </button>
                    </div>
                  ))}

                  {/* Add set button */}
                  <button
                    onClick={() => addSet(exIdx)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "none",
                      background: "none",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#2d6a4f",
                      cursor: "pointer",
                      borderTop: "0.5px solid #f0f0f0",
                    }}
                  >
                    + Add Set
                  </button>
                </div>

                {/* Notes */}
                {ex.notes && (
                  <div style={{ borderTop: "0.5px solid #f0f0f0", padding: "10px 16px" }}>
                    <p style={{ fontSize: 12, color: "#888", margin: 0, fontStyle: "italic" }}>Note: {ex.notes}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Finish button */}
        <button
          onClick={handleFinish}
          disabled={saving}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            backgroundColor: saving ? "#aaa" : completedSets > 0 ? "#2d6a4f" : "#e5e5e5",
            color: completedSets > 0 || saving ? "#fff" : "#aaa",
            fontSize: 16,
            fontWeight: 700,
            cursor: saving || completedSets === 0 ? "default" : "pointer",
            marginTop: 8,
          }}
        >
          {saving ? "Saving..." : completedSets === 0 ? "Complete sets to finish" : `Finish Workout (${completedSets}/${totalSets} sets)`}
        </button>
      </div>

      {/* Rest timer overlay */}
      {restTimer && (
        <RestTimer
          seconds={restTimer.seconds}
          onDismiss={() => setRestTimer(null)}
        />
      )}
    </div>
  );
}
