import { useState, useEffect } from "react";
import {
  doc, getDoc, getDocs, addDoc, updateDoc, collection, serverTimestamp, Timestamp
} from "firebase/firestore";
import { db } from "../../firebase";
import { useParams, useNavigate, Link } from "react-router-dom";

const REP_QUICK = ["1","2","3","4","5","6","8","10","12","15","20","25","30"];
const WEIGHT_QUICK = ["BW","2.5","5","7.5","10","12.5","15","17.5","20","25","30","35","40","45","50","55","60","70","80","100","120","140"];

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function AdminGroupCoachSession() {
  const { groupId, workoutId } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [workout, setWorkout] = useState(null);
  const [exercises, setExercises] = useState([]);
  // logs[memberUid][exerciseId] = array of { reps, weight, done }
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [finalCredits, setFinalCredits] = useState(0);
  const [activeMember, setActiveMember] = useState(null);

  // Log sheet
  const [logSheet, setLogSheet] = useState(null); // { memberUid, exerciseId, setIndex, field }

  // Add exercise
  const [addSheet, setAddSheet] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addResults, setAddResults] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const [groupSnap, workoutSnap] = await Promise.all([
      getDoc(doc(db, "groups", groupId)),
      getDoc(doc(db, "workouts", workoutId)),
    ]);

    if (!groupSnap.exists()) { navigate("/admin/groups"); return; }
    const groupData = { id: groupSnap.id, ...groupSnap.data() };
    setGroup(groupData);

    // Load members
    const memberIds = groupData.memberIds || [];
    const memberDocs = await Promise.all(memberIds.map(uid => getDoc(doc(db, "users", uid))));
    const memberList = memberDocs.filter(d => d.exists()).map(d => ({ uid: d.id, ...d.data() }));
    setMembers(memberList);
    if (memberList.length > 0) setActiveMember(memberList[0].uid);

    if (!workoutSnap.exists()) { setLoading(false); return; }
    const workoutData = { id: workoutSnap.id, ...workoutSnap.data() };
    setWorkout(workoutData);

    const rawExercises = workoutData.exercises || [];
    const enriched = await Promise.all(rawExercises.map(async (ex) => {
      const exSnap = await getDoc(doc(db, "exercises", ex.exerciseId));
      const exData = exSnap.exists() ? exSnap.data() : {};
      return {
        ...ex,
        name: exData.name || ex.exerciseId,
        muscleGroup: exData.muscleGroup || "",
        isExtra: false,
      };
    }));
    setExercises(enriched);

    // Initialize logs per member per exercise
    const initialLogs = {};
    memberIds.forEach(uid => {
      initialLogs[uid] = {};
      enriched.forEach(ex => {
        if (ex.type === "cardio") {
          initialLogs[uid][ex.exerciseId] = { duration: ex.defaultDuration || 30, distance: "", done: false };
        } else {
          initialLogs[uid][ex.exerciseId] = Array.from({ length: ex.sets || 3 }, () => ({
            reps: null, weight: null, done: false,
          }));
        }
      });
    });
    setLogs(initialLogs);
    setLoading(false);
  }

  async function searchExercises(term) {
    if (term.trim().length < 2) { setAddResults([]); return; }
    const snap = await getDocs(collection(db, "exercises"));
    const results = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(e => e.name?.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 14);
    setAddResults(results);
  }

  function addExercise(ex) {
    const newEx = {
      exerciseId: ex.id,
      name: ex.name,
      sets: 3,
      reps: 10,
      type: "strength",
      muscleGroup: ex.muscleGroup || "",
      isExtra: true,
    };
    setExercises(prev => [...prev, newEx]);
    setLogs(prev => {
      const updated = { ...prev };
      members.forEach(m => {
        updated[m.uid] = {
          ...updated[m.uid],
          [ex.id]: Array.from({ length: 3 }, () => ({ reps: null, weight: null, done: false })),
        };
      });
      return updated;
    });
    setAddSheet(false);
    setAddSearch("");
    setAddResults([]);
  }

  function updateLog(memberUid, exerciseId, setIndex, field, value) {
    setLogs(prev => {
      const memberLogs = { ...prev[memberUid] };
      const setArr = [...(memberLogs[exerciseId] || [])];
      setArr[setIndex] = { ...setArr[setIndex], [field]: value };
      memberLogs[exerciseId] = setArr;
      return { ...prev, [memberUid]: memberLogs };
    });
  }

  function openLogSheet(memberUid, exerciseId, setIndex, field) {
    setLogSheet({ memberUid, exerciseId, setIndex, field });
  }

  function applyLogSheet(value) {
    if (!logSheet) return;
    updateLog(logSheet.memberUid, logSheet.exerciseId, logSheet.setIndex, logSheet.field, value);
    setLogSheet(null);
  }

  function toggleSetDone(memberUid, exerciseId, setIndex) {
    setLogs(prev => {
      const memberLogs = { ...prev[memberUid] };
      const setArr = [...(memberLogs[exerciseId] || [])];
      setArr[setIndex] = { ...setArr[setIndex], done: !setArr[setIndex].done };
      memberLogs[exerciseId] = setArr;
      return { ...prev, [memberUid]: memberLogs };
    });
  }

  async function finishSession() {
    setSaving(true);
    try {
      const now = new Date();

      // Deduct 1 credit from group
      const newCredits = Math.max(0, (group.credits || 0) - 1);
      setFinalCredits(newCredits);
      await updateDoc(doc(db, "groups", groupId), { credits: newCredits });

      // Log session + exercise history for each member
      await Promise.all(members.map(async (member) => {
        const memberLog = logs[member.uid] || {};

        // Create session record for this member
        await addDoc(collection(db, "sessions"), {
          clientId: member.uid,
          groupId,
          groupName: group.name,
          isGroupSession: true,
          workoutId: workout?.id || null,
          workoutName: workout?.name || "Group Session",
          status: "completed",
          date: Timestamp.fromDate(now),
          durationMins: 60,
          type: "In Person",
          completedAt: serverTimestamp(),
        });

        // Log exercises to client's history
        await Promise.all(exercises.map(async (ex) => {
          const exLog = memberLog[ex.exerciseId];
          if (!exLog) return;

          if (ex.type === "cardio") {
            if (!exLog.done) return;
            await addDoc(collection(db, "exerciseLogs"), {
              clientId: member.uid,
              exerciseId: ex.exerciseId,
              exerciseName: ex.name,
              type: "cardio",
              duration: exLog.duration,
              distance: exLog.distance || null,
              loggedAt: serverTimestamp(),
              workoutId: workout?.id || null,
              groupId,
              isGroupSession: true,
            });
          } else {
            const completedSets = (Array.isArray(exLog) ? exLog : []).filter(s => s.done || s.weight || s.reps);
            if (completedSets.length === 0) return;
            await addDoc(collection(db, "exerciseLogs"), {
              clientId: member.uid,
              exerciseId: ex.exerciseId,
              exerciseName: ex.name,
              type: "strength",
              sets: completedSets.map(s => ({ reps: s.reps, weight: s.weight })),
              loggedAt: serverTimestamp(),
              workoutId: workout?.id || null,
              groupId,
              isGroupSession: true,
            });
          }
        }));
      }));

      setDone(true);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#888" }}>Loading session...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
        <p style={{ fontSize: "56px", margin: "0 0 16px" }}>💪</p>
        <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#111", margin: "0 0 8px" }}>Session Complete</h2>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 4px" }}>Logged for {members.length} members</p>
        <p style={{ fontSize: "13px", color: "#2d6a4f", fontWeight: 700, margin: "0 0 32px" }}>1 group credit used — {finalCredits} remaining</p>
        <button
          onClick={() => navigate(`/admin/groups/${groupId}`)}
          style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "14px", padding: "14px 32px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}
        >
          Back to Group
        </button>
      </div>
    );
  }

  const activeM = members.find(m => m.uid === activeMember);
  const activeName = activeM ? (activeM.nickname || activeM.firstName || activeM.email?.split("@")[0]) : "";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "100px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 16px" }}>
        <Link to={`/admin/groups/${groupId}`} style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>{group?.name}</Link>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "8px 0 4px" }}>{workout?.name || "Group Session"}</h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>{members.length} members</p>
      </div>

      {/* MEMBER TABS */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "0 16px 16px", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          {members.map(m => {
            const name = m.nickname || m.firstName || m.email?.split("@")[0] || "?";
            const isActive = m.uid === activeMember;
            const memberLog = logs[m.uid] || {};
            const totalSets = exercises.reduce((acc, ex) => {
              const exLog = memberLog[ex.exerciseId];
              if (!Array.isArray(exLog)) return acc;
              return acc + exLog.length;
            }, 0);
            const doneSets = exercises.reduce((acc, ex) => {
              const exLog = memberLog[ex.exerciseId];
              if (!Array.isArray(exLog)) return acc;
              return acc + exLog.filter(s => s.done).length;
            }, 0);
            const pct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;

            return (
              <button
                key={m.uid}
                onClick={() => setActiveMember(m.uid)}
                style={{ flexShrink: 0, padding: "8px 14px", borderRadius: "12px", border: "none", backgroundColor: isActive ? "#fff" : "rgba(255,255,255,0.12)", color: isActive ? "#1a3a2a" : "#9fe1cb", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}
              >
                <span>{name}</span>
                <span style={{ fontSize: "10px", opacity: 0.7 }}>{pct}%</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* EXERCISES FOR ACTIVE MEMBER */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {exercises.map(ex => {
          const memberLog = logs[activeMember] || {};
          const exLog = memberLog[ex.exerciseId] || [];

          return (
            <div key={ex.exerciseId} style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
              <div style={{ padding: "14px 16px 10px" }}>
                <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{ex.name}</p>
                {ex.muscleGroup && <p style={{ fontSize: "11px", color: "#aaa", margin: 0, textTransform: "capitalize" }}>{ex.muscleGroup}</p>}
              </div>

              {ex.type === "cardio" ? (
                <div style={{ padding: "0 16px 14px", display: "flex", gap: "10px", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#888", margin: "0 0 4px" }}>DURATION (min)</p>
                    <input
                      type="number"
                      value={exLog.duration || ""}
                      onChange={e => setLogs(prev => ({ ...prev, [activeMember]: { ...prev[activeMember], [ex.exerciseId]: { ...exLog, duration: e.target.value } } }))}
                      style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid #e5e5e5", fontSize: "16px", fontWeight: 700, textAlign: "center", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#888", margin: "0 0 4px" }}>DISTANCE (km)</p>
                    <input
                      type="number"
                      value={exLog.distance || ""}
                      onChange={e => setLogs(prev => ({ ...prev, [activeMember]: { ...prev[activeMember], [ex.exerciseId]: { ...exLog, distance: e.target.value } } }))}
                      style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid #e5e5e5", fontSize: "16px", fontWeight: 700, textAlign: "center", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <button
                    onClick={() => setLogs(prev => ({ ...prev, [activeMember]: { ...prev[activeMember], [ex.exerciseId]: { ...exLog, done: !exLog.done } } }))}
                    style={{ width: 44, height: 44, borderRadius: "50%", border: "none", backgroundColor: exLog.done ? "#2d6a4f" : "#f0f0f0", cursor: "pointer", fontSize: "18px", flexShrink: 0 }}
                  >
                    {exLog.done ? "✓" : "○"}
                  </button>
                </div>
              ) : (
                <div style={{ padding: "0 16px 14px" }}>
                  {/* Set headers */}
                  <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr 40px", gap: "6px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#aaa", textAlign: "center" }}>SET</span>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#aaa", textAlign: "center" }}>WEIGHT</span>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#aaa", textAlign: "center" }}>REPS</span>
                    <span></span>
                  </div>
                  {(Array.isArray(exLog) ? exLog : []).map((setData, si) => (
                    <div key={si} style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr 40px", gap: "6px", marginBottom: "6px", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#aaa", textAlign: "center" }}>{si + 1}</span>
                      <button
                        onClick={() => openLogSheet(activeMember, ex.exerciseId, si, "weight")}
                        style={{ padding: "10px 6px", borderRadius: "8px", border: `1.5px solid ${setData.weight ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: setData.weight ? "#eaf5ef" : "#f7f5f2", fontSize: "14px", fontWeight: 700, color: setData.weight ? "#2d6a4f" : "#aaa", cursor: "pointer", textAlign: "center" }}
                      >
                        {setData.weight ?? "—"}
                      </button>
                      <button
                        onClick={() => openLogSheet(activeMember, ex.exerciseId, si, "reps")}
                        style={{ padding: "10px 6px", borderRadius: "8px", border: `1.5px solid ${setData.reps ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: setData.reps ? "#eaf5ef" : "#f7f5f2", fontSize: "14px", fontWeight: 700, color: setData.reps ? "#2d6a4f" : "#aaa", cursor: "pointer", textAlign: "center" }}
                      >
                        {setData.reps ?? "—"}
                      </button>
                      <button
                        onClick={() => toggleSetDone(activeMember, ex.exerciseId, si)}
                        style={{ width: 40, height: 40, borderRadius: "50%", border: "none", backgroundColor: setData.done ? "#2d6a4f" : "#f0f0f0", cursor: "pointer", fontSize: "16px" }}
                      >
                        {setData.done ? "✓" : "○"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* ADD EXERCISE */}
        <button
          onClick={() => setAddSheet(true)}
          style={{ backgroundColor: "#fff", border: "1.5px dashed #e5e5e5", borderRadius: "14px", padding: "14px", fontSize: "14px", fontWeight: 700, color: "#888", cursor: "pointer", width: "100%" }}
        >
          + Add Exercise
        </button>
      </div>

      {/* FINISH BUTTON */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", padding: "16px 20px 32px", borderTop: "0.5px solid #e5e5e5" }}>
        <button
          onClick={finishSession}
          disabled={saving}
          style={{ width: "100%", backgroundColor: saving ? "#e5e5e5" : "#2d6a4f", color: saving ? "#aaa" : "#fff", border: "none", borderRadius: "14px", padding: "16px", fontSize: "16px", fontWeight: 700, cursor: saving ? "default" : "pointer" }}
        >
          {saving ? "Saving..." : "Finish Session"}
        </button>
      </div>

      {/* LOG SHEET */}
      {logSheet && (
        <div onClick={e => { if (e.target === e.currentTarget) setLogSheet(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <p style={{ fontSize: "14px", fontWeight: 700, color: "#888", textAlign: "center", margin: "0 0 16px", textTransform: "uppercase" }}>
              {logSheet.field === "weight" ? "Weight (kg / BW)" : "Reps"}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginBottom: "16px" }}>
              {(logSheet.field === "weight" ? WEIGHT_QUICK : REP_QUICK).map(v => (
                <button
                  key={v}
                  onClick={() => applyLogSheet(v)}
                  style={{ padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", backgroundColor: "#f7f5f2", fontSize: "15px", fontWeight: 700, color: "#111", cursor: "pointer" }}
                >
                  {v}
                </button>
              ))}
            </div>
            <button onClick={() => setLogSheet(null)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ADD EXERCISE SHEET */}
      {addSheet && (
        <div onClick={e => { if (e.target === e.currentTarget) { setAddSheet(false); setAddSearch(""); setAddResults([]); }}} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 14px" }}>Add Exercise</h2>
            <input
              autoFocus
              value={addSearch}
              onChange={e => { setAddSearch(e.target.value); searchExercises(e.target.value); }}
              placeholder="Search exercises..."
              style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box", marginBottom: "12px" }}
            />
            <div style={{ overflowY: "auto", flex: 1 }}>
              {addResults.map(ex => (
                <div
                  key={ex.id}
                  onClick={() => addExercise(ex)}
                  style={{ padding: "12px", borderRadius: "10px", cursor: "pointer", marginBottom: "4px" }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f7f5f2"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{ex.name}</p>
                  {ex.muscleGroup && <p style={{ fontSize: "11px", color: "#aaa", margin: 0 }}>{ex.muscleGroup}</p>}
                </div>
              ))}
            </div>
            <button onClick={() => { setAddSheet(false); setAddSearch(""); setAddResults([]); }} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "12px", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
