import { useState, useEffect, useRef } from "react";
import { doc, getDoc, collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Link, useParams, useNavigate } from "react-router-dom";
import PortalNav from "../components/PortalNav";

const REP_QUICK = ["5", "6", "8", "10", "12", "15", "20"];
const WEIGHT_QUICK = ["BW", "5", "10", "15", "20", "25", "30", "40", "50", "60"];
const DURATION_QUICK = ["10", "15", "20", "25", "30", "35", "40", "45", "50", "60"];
const EFFORT_LEVELS = [
  { id: "easy", label: "Easy", sub: "Conversational pace", color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  { id: "moderate", label: "Moderate", sub: "Slightly breathless", color: "#2d6a4f", bg: "#eaf5ef", border: "#6ee7b7" },
  { id: "brisk", label: "Brisk", sub: "Elevated heart rate", color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  { id: "hard", label: "Hard", sub: "Difficult to talk", color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
];

// Animal weight comparisons in kg
const ANIMALS = [
  { name: "a chihuahua", weight: 3, emoji: "🐕" },
  { name: "a domestic cat", weight: 5, emoji: "🐱" },
  { name: "a cocker spaniel", weight: 12, emoji: "🐶" },
  { name: "a labrador", weight: 30, emoji: "🐕" },
  { name: "a giant panda", weight: 100, emoji: "🐼" },
  { name: "a male lion", weight: 190, emoji: "🦁" },
  { name: "a grizzly bear", weight: 360, emoji: "🐻" },
  { name: "a moose", weight: 500, emoji: "🫎" },
  { name: "a grand piano", weight: 600, emoji: "🎹" },
  { name: "a polar bear", weight: 700, emoji: "🐻‍❄️" },
  { name: "a dairy cow", weight: 750, emoji: "🐄" },
  { name: "a Mini Cooper", weight: 1100, emoji: "🚗" },
  { name: "a small elephant", weight: 2500, emoji: "🐘" },
  { name: "a hippo", weight: 3000, emoji: "🦛" },
  { name: "a T-Rex", weight: 8000, emoji: "🦖" },
];

function getAnimalComparison(kg) {
  let closest = ANIMALS[0];
  let diff = Math.abs(kg - ANIMALS[0].weight);
  for (const a of ANIMALS) {
    const d = Math.abs(kg - a.weight);
    if (d < diff) { diff = d; closest = a; }
  }
  return closest;
}

export default function Workout() {
  const { programmeId, weekId, workoutId } = useParams();
  const navigate = useNavigate();
  const storageKey = `tfl_workout_${workoutId}`;
  sessionStorage.setItem(`tfl_workout_${workoutId}_programme`, programmeId);
  sessionStorage.setItem(`tfl_workout_${workoutId}_week`, weekId);

  const [workout, setWorkout] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(() => {
    try { return parseInt(sessionStorage.getItem(`${storageKey}_index`) || "0"); }
    catch { return 0; }
  });
  const [logs, setLogs] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [sheet, setSheet] = useState(null);
  const [progressionModal, setProgressionModal] = useState(null);
  const [nextWeight, setNextWeight] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [saving, setSaving] = useState(false);
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
    const fetchData = async () => {
      const workoutSnap = await getDoc(doc(db, "workouts", workoutId));
      if (!workoutSnap.exists()) { setLoading(false); return; }
      const workoutData = { id: workoutSnap.id, ...workoutSnap.data() };
      setWorkout(workoutData);

      if (workoutData.exercises?.length > 0) {
        const snaps = await Promise.all(
          workoutData.exercises.map((e) => getDoc(doc(db, "exercises", e.exerciseId)))
        );
        const data = snaps.map((s, i) => ({
          ...workoutData.exercises[i],
          ...s.data(),
          exerciseId: s.id,
        }));
        setExercises(data);

        const existingLogs = logsRef.current;
        if (Object.keys(existingLogs).length === 0) {
          const initialLogs = {};
          data.forEach((ex) => {
            if (ex.type === "cardio") {
              initialLogs[ex.exerciseId] = { duration: ex.defaultDuration || 30, distance: "", effort: ex.defaultEffort || "moderate", done: false };
            } else {
              initialLogs[ex.exerciseId] = Array.from({ length: ex.sets || 3 }, () => ({ reps: null, weight: null, done: false }));
            }
          });
          setLogs(initialLogs);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [workoutId]);

  const openSheet = (exerciseId, setIndex, field) => setSheet({ exerciseId, setIndex, field });
  const closeSheet = () => setSheet(null);

  const saveValue = (value) => {
    if (!sheet) return;
    const { exerciseId, setIndex, field } = sheet;
    setLogs((prev) => {
      const updated = [...(prev[exerciseId] || [])];
      updated[setIndex] = { ...updated[setIndex], [field]: value };
      return { ...prev, [exerciseId]: updated };
    });
    closeSheet();
  };

  const checkProgression = (exerciseId, updatedLogs) => {
    const exercise = exercises.find(e => e.exerciseId === exerciseId);
    if (!exercise || exercise.type === "cardio") return;
    const sets = updatedLogs[exerciseId] || [];
    const targetSets = exercise.sets || 3;
    const maxReps = exercise.repsMax || exercise.reps || 12;
    const allDone = sets.length >= targetSets && sets.every(s => s.done);
    const allHitMax = sets.every(s => parseInt(s.reps) >= maxReps);
    if (allDone && allHitMax) {
      const currentWeight = sets[sets.length - 1]?.weight || "";
      setNextWeight(currentWeight);
      setProgressionModal({ exerciseId, exerciseName: exercise.name, currentWeight, repsMax: maxReps, targetSets });
    }
  };

  const toggleSetDone = (exerciseId, setIndex) => {
    setLogs((prev) => {
      const updated = [...(prev[exerciseId] || [])];
      const s = updated[setIndex];
      if (s.reps && s.weight) {
        updated[setIndex] = { ...s, done: !s.done };
        const newLogs = { ...prev, [exerciseId]: updated };
        setTimeout(() => checkProgression(exerciseId, newLogs), 100);
        return newLogs;
      }
      return prev;
    });
  };

  const toggleCardioDone = (exerciseId) => {
    setLogs((prev) => {
      const current = prev[exerciseId] || {};
      return { ...prev, [exerciseId]: { ...current, done: !current.done } };
    });
  };

  const updateCardioField = (exerciseId, field, value) => {
    setLogs((prev) => {
      const current = prev[exerciseId] || {};
      return { ...prev, [exerciseId]: { ...current, [field]: value } };
    });
  };

  const addSet = (exerciseId) => {
    setLogs((prev) => ({
      ...prev,
      [exerciseId]: [...(prev[exerciseId] || []), { reps: null, weight: null, done: false }],
    }));
  };

  const buildSummary = async (savedLogs) => {
    const user = auth.currentUser;

    // Get previous logs for PR detection
    let prevLogs = [];
    try {
      const prevSnap = await getDocs(query(collection(db, "workoutLogs"), where("userId", "==", user.uid)));
      prevLogs = prevSnap.docs.map(d => d.data());
    } catch (e) {}

    // Calculate volume and PRs
    let totalVolume = 0;
    const exerciseSummaries = [];
    const prs = [];

    exercises.forEach(ex => {
      const exLogs = savedLogs[ex.exerciseId];
      if (!exLogs) return;

      if (ex.type === "cardio") {
        exerciseSummaries.push({
          name: ex.name,
          type: "cardio",
          duration: exLogs.duration,
          distance: exLogs.distance,
          effort: exLogs.effort,
        });
        return;
      }

      if (!Array.isArray(exLogs)) return;
      const doneSets = exLogs.filter(s => s.done && s.weight && s.reps);
      if (doneSets.length === 0) return;

      const multiplier = ex.countPerSide ? 2 : 1;
      const exVolume = doneSets.reduce((sum, s) => {
        return sum + ((parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0) * multiplier);
      }, 0);
      totalVolume += exVolume;

      const maxWeight = Math.max(...doneSets.map(s => parseFloat(s.weight) || 0));

      // Check for PR
      let prevBest = 0;
      prevLogs.forEach(log => {
        const prevSets = log.logs?.[ex.exerciseId];
        if (Array.isArray(prevSets)) {
          prevSets.forEach(s => {
            if (s.done && parseFloat(s.weight) > prevBest) prevBest = parseFloat(s.weight);
          });
        }
      });
      const isPR = maxWeight > prevBest && prevBest > 0;
      const isFirstTime = prevBest === 0 && maxWeight > 0;

      if (isPR || isFirstTime) {
        prs.push({ name: ex.name, weight: maxWeight, isPR, isFirstTime });
      }

      exerciseSummaries.push({
        name: ex.name,
        type: "strength",
        sets: doneSets.length,
        maxWeight,
        totalReps: doneSets.reduce((s, x) => s + (parseInt(x.reps) || 0), 0),
        volume: Math.round(exVolume),
        countPerSide: ex.countPerSide,
        isPR,
        isFirstTime,
      });
    });

    const animal = getAnimalComparison(Math.round(totalVolume));

    return {
      workoutName: workout?.name || "Workout",
      exerciseSummaries,
      totalVolume: Math.round(totalVolume),
      prs,
      animal,
      completedAt: new Date().toISOString(),
    };
  };

  const finishWorkout = async () => {
    const user = auth.currentUser;
    if (!user || saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "workoutLogs"), {
        userId: user.uid,
        workoutId,
        programmeId,
        weekId,
        logs,
        completedAt: new Date().toISOString(),
      });
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(`${storageKey}_index`);
      const summary = await buildSummary(logs);
      setSummaryData(summary);
      setShowSummary(true);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "80px" }}>
      {!sheet && <PortalNav />}
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
    </div>
  );

  if (!workout) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "80px" }}>
      {!sheet && <PortalNav />}
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Workout not found.</p>
    </div>
  );

  if (showSummary && summaryData) {
    return <WorkoutSummary summary={summaryData} onDone={() => navigate("/dashboard")} />;
  }

  const exercise = exercises[currentIndex];
  const exerciseLogs = exercise ? (logs[exercise.exerciseId] || (exercise.type === "cardio" ? {} : [])) : [];
  const isLast = currentIndex === exercises.length - 1;
  const isFirst = currentIndex === 0;
  const isCardio = exercise?.type === "cardio";
  const repRange = exercise ? `${exercise.repsMin || 8}-${exercise.repsMax || exercise.reps || 12}` : "8-12";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "80px", position: "relative" }}>
      {!sheet && !progressionModal && <PortalNav />}

      <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to={`/programme/${programmeId}/${weekId}`} style={{ fontSize: "13px", color: "#2d6a4f", fontWeight: 700, textDecoration: "none" }}>← Back</Link>
        <span style={{ fontSize: "13px", color: "#888", fontWeight: 500 }}>{workout.name}</span>
      </div>

      <div style={{ height: "3px", backgroundColor: "#e5e5e5", margin: "0 16px" }}>
        <div style={{ height: "3px", backgroundColor: "#2d6a4f", borderRadius: "2px", width: `${((currentIndex + 1) / exercises.length) * 100}%`, transition: "width 0.3s ease" }} />
      </div>

      <div style={{ padding: "10px 16px 0", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#888" }}>
        Exercise {currentIndex + 1} of {exercises.length}
      </div>

      {exercise && (
        <div style={{ margin: "8px 16px 0", backgroundColor: "#fff", borderRadius: "20px", border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
          <div style={{ padding: "16px 16px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              {isCardio && <span style={{ fontSize: "18px" }}>🏃</span>}
              <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#111", margin: 0 }}>{exercise.name}</h1>
              {exercise.countPerSide && (
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#7c3aed", backgroundColor: "#f5f3ff", padding: "2px 8px", borderRadius: "20px" }}>per side</span>
              )}
            </div>
            <p style={{ fontSize: "13px", color: "#666", margin: "0 0 8px", lineHeight: 1.5 }}>{exercise.description}</p>
            {isCardio ? (
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#0369a1", backgroundColor: "#e0f2fe", padding: "3px 10px", borderRadius: "20px" }}>
                {exercise.defaultDuration || 30} min · {exercise.defaultEffort || "moderate"}
              </span>
            ) : (
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "3px 10px", borderRadius: "20px" }}>
                {exercise.sets || 3} sets · {repRange} reps
              </span>
            )}
          </div>

          {exercise.coachingNotes && (
            <div style={{ backgroundColor: "#eaf5ef", padding: "10px 16px" }}>
              <p style={{ fontSize: "12px", color: "#1a4a35", lineHeight: 1.6, margin: 0 }}>{exercise.coachingNotes}</p>
            </div>
          )}

          {exercise.videoUrl && (
            <div style={{ padding: "12px 16px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Exercise Demo</p>
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: "12px", overflow: "hidden", backgroundColor: "#000" }}>
                <iframe
                  src={(() => { const url = exercise.videoUrl || ""; const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/); return match ? `https://www.youtube.com/embed/${match[1]}` : url; })()}
                  title={exercise.name}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                />
              </div>
            </div>
          )}

          {isCardio ? (
            <div style={{ padding: "16px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Log This Session</p>
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Duration (minutes)</p>
                <div style={{ display: "flex", gap: "6px", overflowX: "auto", marginBottom: "8px", paddingBottom: "2px" }}>
                  {DURATION_QUICK.map(d => (
                    <div key={d} onClick={() => updateCardioField(exercise.exerciseId, "duration", d)} style={{ flexShrink: 0, padding: "7px 12px", borderRadius: "10px", border: String(exerciseLogs.duration) === d ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: String(exerciseLogs.duration) === d ? "#eaf5ef" : "#f7f5f2", fontSize: "13px", fontWeight: 700, color: String(exerciseLogs.duration) === d ? "#2d6a4f" : "#111", cursor: "pointer" }}>
                      {d}
                    </div>
                  ))}
                </div>
                <input type="number" value={exerciseLogs.duration || ""} onChange={e => updateCardioField(exercise.exerciseId, "duration", e.target.value)} placeholder="Or type duration..." style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", fontWeight: 700, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Distance (optional)</p>
                <input type="text" value={exerciseLogs.distance || ""} onChange={e => updateCardioField(exercise.exerciseId, "distance", e.target.value)} placeholder="e.g. 3.2km" style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box", textAlign: "center" }} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 8px" }}>How did it feel?</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {EFFORT_LEVELS.map(e => (
                    <div key={e.id} onClick={() => updateCardioField(exercise.exerciseId, "effort", e.id)} style={{ padding: "12px 14px", borderRadius: "12px", border: `1.5px solid ${exerciseLogs.effort === e.id ? e.border : "#e5e5e5"}`, backgroundColor: exerciseLogs.effort === e.id ? e.bg : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 700, color: exerciseLogs.effort === e.id ? e.color : "#111", margin: 0 }}>{e.label}</p>
                        <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>{e.sub}</p>
                      </div>
                      {exerciseLogs.effort === e.id && (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <circle cx="9" cy="9" r="8" fill={e.color}/>
                          <path d="M5 9l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => toggleCardioDone(exercise.exerciseId)} style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "none", backgroundColor: exerciseLogs.done ? "#2d6a4f" : "#f0f0f0", color: exerciseLogs.done ? "#fff" : "#888", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>
                {exerciseLogs.done ? "Session Complete ✓" : "Mark as Complete"}
              </button>
            </div>
          ) : (
            <div style={{ padding: "0 16px 8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 1fr 36px", gap: "6px", padding: "10px 4px 6px", borderBottom: "0.5px solid #f0f0f0" }}>
                {["#", "Reps", "Weight", "Last", ""].map((h, i) => (
                  <span key={i} style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#aaa", textAlign: i === 0 ? "left" : "center" }}>{h}</span>
                ))}
              </div>
              {Array.isArray(exerciseLogs) && exerciseLogs.map((s, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 1fr 36px", gap: "6px", padding: "8px 4px", borderBottom: "0.5px solid #f5f5f5", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#aaa" }}>{i + 1}</span>
                  <div onClick={() => openSheet(exercise.exerciseId, i, "reps")} style={{ backgroundColor: s.reps ? "#eaf5ef" : "#f7f5f2", border: s.reps ? "0.5px solid #2d6a4f" : "0.5px solid #e5e5e5", borderRadius: "8px", padding: "8px 4px", textAlign: "center", fontSize: "14px", fontWeight: 700, color: s.reps ? "#1a4a35" : "#bbb", cursor: "pointer" }}>
                    {s.reps || "—"}
                  </div>
                  <div onClick={() => openSheet(exercise.exerciseId, i, "weight")} style={{ backgroundColor: s.weight ? "#eaf5ef" : "#f7f5f2", border: s.weight ? "0.5px solid #2d6a4f" : "0.5px solid #e5e5e5", borderRadius: "8px", padding: "8px 4px", textAlign: "center", fontSize: "14px", fontWeight: 700, color: s.weight ? "#1a4a35" : "#bbb", cursor: "pointer" }}>
                    {s.weight || "—"}
                  </div>
                  <div style={{ textAlign: "center", fontSize: "12px", color: "#aaa" }}>—</div>
                  <div onClick={() => toggleSetDone(exercise.exerciseId, i)} style={{ width: "32px", height: "32px", borderRadius: "50%", border: s.done ? "none" : "1.5px solid #e5e5e5", backgroundColor: s.done ? "#2d6a4f" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", margin: "0 auto" }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7l4 4 6-6" stroke={s.done ? "#fff" : "#ccc"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              ))}
              <button onClick={() => addSet(exercise.exerciseId)} style={{ background: "none", border: "none", color: "#2d6a4f", fontSize: "13px", fontWeight: 700, cursor: "pointer", padding: "8px 4px 4px" }}>
                + Add set
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", padding: "12px 16px" }}>
        {!isFirst && (
          <button onClick={() => setCurrentIndex(i => i - 1)} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "0.5px solid #e5e5e5", backgroundColor: "#fff", fontSize: "15px", fontWeight: 700, cursor: "pointer", color: "#111" }}>
            ← Previous
          </button>
        )}
        {!isLast ? (
          <button onClick={() => setCurrentIndex(i => i + 1)} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "none", backgroundColor: "#2d6a4f", fontSize: "15px", fontWeight: 700, cursor: "pointer", color: "#fff" }}>
            Next →
          </button>
        ) : (
          <button onClick={finishWorkout} disabled={saving} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "none", backgroundColor: saving ? "#aaa" : "#2d6a4f", fontSize: "15px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", color: "#fff" }}>
            {saving ? "Saving..." : "Finish Workout ✓"}
          </button>
        )}
      </div>

      {sheet && (
        <LogSheet field={sheet.field} current={logs[sheet.exerciseId]?.[sheet.setIndex]?.[sheet.field]} onSave={saveValue} onClose={closeSheet} />
      )}

      {progressionModal && (
        <ProgressionModal
          exerciseName={progressionModal.exerciseName}
          currentWeight={progressionModal.currentWeight}
          repsMax={progressionModal.repsMax}
          targetSets={progressionModal.targetSets}
          nextWeight={nextWeight}
          setNextWeight={setNextWeight}
          onClose={() => setProgressionModal(null)}
        />
      )}
    </div>
  );
}

function WorkoutSummary({ summary, onDone }) {
  const { workoutName, exerciseSummaries, totalVolume, prs, animal, completedAt } = summary;

  const shareText = `Just crushed ${workoutName} with Training for Life! 💪 Lifted ${totalVolume}kg -- that's the weight of ${animal.name} ${animal.emoji}${prs.length > 0 ? `. Hit ${prs.length} new PR${prs.length > 1 ? "s" : ""}!` : "."} #TrainingForLife #CapabilityCoaching`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Workout Complete!", text: shareText });
      } catch (e) {}
    } else {
      await navigator.clipboard.writeText(shareText);
      alert("Copied to clipboard! Paste into your stories or messages.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "48px 24px 36px", textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>🎉</div>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 8px" }}>Workout Complete</p>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 4px", lineHeight: 1.2 }}>{workoutName}</h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
          {new Date(completedAt).toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div style={{ padding: "20px 16px 0" }}>

        {/* Animal comparison */}
        <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "20px", marginBottom: "14px", textAlign: "center" }}>
          <p style={{ fontSize: "48px", margin: "0 0 8px" }}>{animal.emoji}</p>
          <p style={{ fontSize: "32px", fontWeight: 700, color: "#4ade80", margin: "0 0 4px", lineHeight: 1 }}>{totalVolume.toLocaleString()}kg</p>
          <p style={{ fontSize: "15px", color: "#9fe1cb", margin: 0 }}>
            You lifted the weight of <strong style={{ color: "#fff" }}>{animal.name}</strong> today
          </p>
        </div>

        {/* PRs */}
        {prs.length > 0 && (
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "14px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>
              🏆 New Personal Records
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {prs.map((pr, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", backgroundColor: "#eaf5ef", borderRadius: "10px" }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a3a2a", margin: 0 }}>{pr.name}</p>
                    <p style={{ fontSize: "12px", color: "#2d6a4f", margin: "2px 0 0" }}>{pr.isFirstTime ? "First time logged!" : "New personal best!"}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "20px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{pr.weight}kg</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exercise breakdown */}
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "14px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Session Breakdown</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {exerciseSummaries.map((ex, i) => (
              <div key={i} style={{ padding: "10px 0", borderBottom: "0.5px solid #f5f5f5" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{ex.name}</p>
                    {ex.isPR && <span style={{ fontSize: "10px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "1px 6px", borderRadius: "10px" }}>PR</span>}
                    {ex.isFirstTime && <span style={{ fontSize: "10px", fontWeight: 700, color: "#7c3aed", backgroundColor: "#f5f3ff", padding: "1px 6px", borderRadius: "10px" }}>First!</span>}
                  </div>
                  {ex.type === "cardio" ? (
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0369a1" }}>{ex.duration} min</span>
                  ) : (
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f" }}>{ex.maxWeight}kg</span>
                  )}
                </div>
                {ex.type === "strength" && (
                  <div style={{ display: "flex", gap: "12px" }}>
                    <span style={{ fontSize: "12px", color: "#888" }}>{ex.sets} sets · {ex.totalReps} reps</span>
                    {ex.countPerSide && <span style={{ fontSize: "12px", color: "#7c3aed" }}>counted per side</span>}
                    <span style={{ fontSize: "12px", color: "#aaa" }}>{ex.volume}kg volume</span>
                  </div>
                )}
                {ex.type === "cardio" && ex.distance && (
                  <span style={{ fontSize: "12px", color: "#888" }}>{ex.distance} · {ex.effort}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Share */}
        <button
          onClick={handleShare}
          style={{ width: "100%", backgroundColor: "#1a3a2a", color: "#fff", border: "none", borderRadius: "14px", padding: "16px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
        >
          📤 Share to Stories / Send to a Friend
        </button>

        <button
          onClick={onDone}
          style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "14px", padding: "16px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}
        >
          Go to Dashboard →
        </button>
      </div>
    </div>
  );
}

function ProgressionModal({ exerciseName, currentWeight, nextWeight, setNextWeight, onClose, repsMax = 12, targetSets = 3 }) {
  const [rpe, setRpe] = useState(null);
  const dropReps = Math.round(repsMax * 0.65);

  const options = [
    { id: "easy", emoji: "💪", label: "I had more in the tank", color: "#16a34a", bg: "#f0fdf4", border: "#86efac", message: `Your body is more capable than that weight is challenging. To keep building strength we need to push further. Time to add weight.`, showWeight: true, aggressive: true },
    { id: "just_right", emoji: "🎯", label: "That felt just right", color: "#2d6a4f", bg: "#eaf5ef", border: "#6ee7b7", message: `Perfect. You've earned a progression. Drop to ${dropReps} reps with a slightly heavier weight and build back up to ${repsMax}.`, showWeight: true, aggressive: false },
    { id: "hard", emoji: "🔥", label: "That was a real effort", color: "#b45309", bg: "#fffbeb", border: "#fcd34d", message: `That's exactly where you should be. Keep the same weight next session and aim for ${targetSets} sets of ${repsMax} again. You'll get there.`, showWeight: false, aggressive: false },
  ];

  const selected = options.find(o => o.id === rpe);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
        <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
        {!rpe ? (
          <>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>Progress unlocked</p>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>{targetSets} sets of {repsMax} complete</h2>
              <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>How did {exerciseName} feel today?</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {options.map(o => (
                <div key={o.id} onClick={() => setRpe(o.id)} style={{ backgroundColor: o.bg, border: `1.5px solid ${o.border}`, borderRadius: "14px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
                  <span style={{ fontSize: "24px" }}>{o.emoji}</span>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: o.color }}>{o.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <span style={{ fontSize: "32px" }}>{selected.emoji}</span>
              <p style={{ fontSize: "15px", color: "#444", lineHeight: 1.6, margin: "12px 0 0" }}>{selected.message}</p>
            </div>
            {selected.showWeight && (
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 8px" }}>{selected.aggressive ? "What weight will you use?" : "Choose your next weight"}</p>
                <div style={{ display: "flex", gap: "8px", overflowX: "auto", marginBottom: "10px", paddingBottom: "4px" }}>
                  {WEIGHT_QUICK.map(w => (
                    <div key={w} onClick={() => setNextWeight(w)} style={{ flexShrink: 0, padding: "8px 14px", borderRadius: "10px", border: nextWeight === w ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: nextWeight === w ? "#eaf5ef" : "#f7f5f2", fontSize: "14px", fontWeight: 700, color: nextWeight === w ? "#2d6a4f" : "#111", cursor: "pointer" }}>
                      {w}
                    </div>
                  ))}
                </div>
                <input type="text" placeholder="Or type a weight..." value={nextWeight} onChange={e => setNextWeight(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #2d6a4f", fontSize: "16px", fontWeight: 700, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
              </div>
            )}
            <button onClick={onClose} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>
              {selected.showWeight && nextWeight ? `Next session: ${nextWeight} for ${dropReps} reps` : "Got it. Keep going."}
            </button>
            <button onClick={() => setRpe(null)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "10px", padding: "6px" }}>Go back</button>
          </>
        )}
      </div>
    </div>
  );
}

function LogSheet({ field, current, onSave, onClose }) {
  const isReps = field === "reps";
  const [value, setValue] = useState(current || "");
  const quick = isReps ? REP_QUICK : WEIGHT_QUICK;

  const handleSave = () => {
    if (!value) return;
    onSave(value);
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", paddingBottom: "32px" }}>
        <div style={{ width: "36px", height: "4px", backgroundColor: "#e5e5e5", borderRadius: "2px", margin: "12px auto 8px" }} />
        <div style={{ padding: "4px 16px 12px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888" }}>
          {isReps ? "Log reps" : "Log weight"}
        </div>
        <div style={{ display: "flex", gap: "8px", padding: "0 16px 14px", overflowX: "auto" }}>
          {quick.map((v) => (
            <div key={v} onClick={() => onSave(v)} style={{ flexShrink: 0, minWidth: "52px", padding: "10px 14px", borderRadius: "10px", border: "0.5px solid #e5e5e5", fontSize: "15px", fontWeight: 700, cursor: "pointer", backgroundColor: "#f7f5f2", color: "#111", textAlign: "center" }}>
              {v}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "10px", padding: "0 16px" }}>
          <input autoFocus type={isReps ? "number" : "text"} inputMode="decimal" placeholder={isReps ? "e.g. 10" : "e.g. 20kg"} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }} style={{ flex: 1, border: "1.5px solid #2d6a4f", borderRadius: "12px", padding: "14px 16px", fontSize: "18px", fontWeight: 700, color: "#111", outline: "none", textAlign: "center" }} />
          <button onClick={handleSave} style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "14px 20px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>Done</button>
        </div>
      </div>
    </div>
  );
}