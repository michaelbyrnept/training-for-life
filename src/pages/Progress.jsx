import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where, addDoc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import PortalNav from "../components/PortalNav";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
function normalizeDate(val) {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (val.toDate) return val.toDate().toISOString(); // Firestore Timestamp
  if (val.seconds) return new Date(val.seconds * 1000).toISOString(); // raw Timestamp-like object
  return null;
}
function MiniLineGraph({ data, color = "#2d6a4f", height = 60 }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const width = 280;
  const pad = 8;
  const coords = data.map((d, i) => ({
    x: pad + (i / (data.length - 1)) * (width - pad * 2),
    y: height - pad - ((d.value - min) / range) * (height - pad * 2),
    value: d.value,
    date: d.date,
  }));
  const pts = coords.map(c => `${c.x},${c.y}`).join(" ");
  const fillPts = `${coords[0].x},${height} ${pts} ${coords[coords.length - 1].x},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`grad_${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#grad_${color.replace("#", "")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r="3" fill={color} stroke="#fff" strokeWidth="1.5" />)}
    </svg>
  );
}

function StatCard({ icon, label, value, sub, color = "#2d6a4f" }) {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
      <div style={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>{label}</p>
        <p style={{ fontSize: "22px", fontWeight: 700, color, margin: 0, lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: "11px", color: "#aaa", margin: "3px 0 0" }}>{sub}</p>}
      </div>
    </div>
  );
}

// Badge definitions
const BADGES = [
  // Sessions -- free
  { id: "first_session", label: "First Step", desc: "Logged your first session", icon: "👟", tier: "free", check: (s) => s.totalSessions >= 1 },
  { id: "5_sessions", label: "Getting Going", desc: "Logged 5 sessions", icon: "🔥", tier: "free", check: (s) => s.totalSessions >= 5 },
  { id: "10_sessions", label: "Building Habits", desc: "Logged 10 sessions", icon: "💪", tier: "free", check: (s) => s.totalSessions >= 10 },
  // PRs -- free
  { id: "first_pr", label: "First PR", desc: "Set your first personal record", icon: "🏆", tier: "free", check: (s) => s.totalPRs >= 1 },
  { id: "5_prs", label: "PR Machine", desc: "Set 5 personal records", icon: "🎯", tier: "free", check: (s) => s.totalPRs >= 5 },
  // Streak -- free
  { id: "7_day_streak", label: "Week Warrior", desc: "Trained 7 days in a row", icon: "🗓️", tier: "free", check: (s) => s.longestStreak >= 7 },
  // Premium badges
  { id: "25_sessions", label: "Committed", desc: "Logged 25 sessions", icon: "⚡", tier: "premium", check: (s) => s.totalSessions >= 25 },
  { id: "50_sessions", label: "Dedicated", desc: "Logged 50 sessions", icon: "🌟", tier: "premium", check: (s) => s.totalSessions >= 50 },
  { id: "100_sessions", label: "Centurion", desc: "Logged 100 sessions", icon: "💯", tier: "premium", check: (s) => s.totalSessions >= 100 },
  { id: "10_prs", label: "Record Breaker", desc: "Set 10 personal records", icon: "📈", tier: "premium", check: (s) => s.totalPRs >= 10 },
  { id: "4_week_streak", label: "Consistent", desc: "4 week training streak", icon: "🔗", tier: "premium", check: (s) => s.longestStreak >= 28 },
  { id: "8_week_streak", label: "Unstoppable", desc: "8 week training streak", icon: "🚀", tier: "premium", check: (s) => s.longestStreak >= 56 },
  { id: "1000kg_session", label: "1 Tonne Session", desc: "Lifted 1,000kg in a single session", icon: "🏋️", tier: "premium", check: (s) => s.bestSessionVolume >= 1000 },
  { id: "score_improved", label: "Level Up", desc: "Improved your Capability Score", icon: "📊", tier: "premium", check: (s) => s.scoreImproved },
];

export default function Progress() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [exercises, setExercises] = useState({});
  const [workouts, setWorkouts] = useState({});
  const [capabilityScores, setCapabilityScores] = useState([]);
  const [weightLogs, setWeightLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);
      const userSnap = await getDoc(doc(db, "users", u.uid));
      let uData = {};
      if (userSnap.exists()) { uData = userSnap.data(); setUserData(uData); }

        const scoreSnap = await getDocs(query(collection(db, "assessmentResults"), where("email", "==", u.email)));
      const scores = scoreSnap.docs.map(d => d.data()).sort((a, b) => new Date(a.assessmentDate) - new Date(b.assessmentDate));
      setCapabilityScores(scores);

     const logsSnap = await getDocs(collection(db, "workoutLogs"));
      const myLogs = logsSnap.docs
        .map(d => ({ id: d.id, ...d.data(), completedAt: normalizeDate(d.data().completedAt) }))
        .filter(l => l.userId === u.uid && l.completedAt)
        .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
      setWorkoutLogs(myLogs);

      const exSnap = await getDocs(collection(db, "exercises"));
      const exMap = {};
      exSnap.docs.forEach(d => { exMap[d.id] = { id: d.id, ...d.data() }; });
      setExercises(exMap);

      const wkSnap = await getDocs(collection(db, "workouts"));
      const wkMap = {};
      wkSnap.docs.forEach(d => { wkMap[d.id] = { id: d.id, ...d.data() }; });
      setWorkouts(wkMap);

      const wlSnap = await getDocs(query(collection(db, "weightLogs"), where("userId", "==", u.uid)));
      const wlData = wlSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(a.date) - new Date(b.date));
      if (wlData.length === 0 && uData.weight && !uData.weightPrivate) {
        setWeightLogs([{ value: parseFloat(uData.weight), date: uData.createdAt?.split("T")[0] || new Date().toISOString().split("T")[0] }]);
      } else {
        setWeightLogs(wlData.map(l => ({ id: l.id, value: l.weight, date: l.date })));
      }
      setLoading(false);
    });
    return () => unsub();
  }, [navigate]);

  const logWeight = async () => {
    if (!newWeight || !user) return;
    setSavingWeight(true);
    const entry = { userId: user.uid, weight: parseFloat(newWeight), date: new Date().toISOString().split("T")[0], loggedAt: new Date().toISOString() };
    const ref = await addDoc(collection(db, "weightLogs"), entry);
    setWeightLogs(prev => [...prev, { id: ref.id, value: parseFloat(newWeight), date: entry.date }]);
    setNewWeight("");
    setShowWeightModal(false);
    setSavingWeight(false);
  };

  const getExerciseHistory = (exerciseId) => {
    const history = [];
    workoutLogs.forEach(log => {
      const sets = log.logs?.[exerciseId];
      if (sets && Array.isArray(sets)) {
        const doneSets = sets.filter(s => s.weight && s.reps);
        if (doneSets.length > 0) {
          const maxWeight = Math.max(...doneSets.map(s => parseFloat(s.weight) || 0));
          history.push({ date: log.completedAt?.split("T")[0], value: maxWeight, sets: doneSets.length });
        }
      }
    });
    return history.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const getLoggedExercises = () => {
    const exerciseIds = new Set();
    workoutLogs.forEach(log => {
      Object.keys(log.logs || {}).forEach(id => {
        const sets = log.logs[id];
        if (Array.isArray(sets) && sets.some(s => s.done && s.weight)) exerciseIds.add(id);
      });
    });
    return Array.from(exerciseIds).map(id => ({ id, name: exercises[id]?.name || id, history: getExerciseHistory(id) })).filter(e => e.history.length > 0);
  };

  const totalSessions = workoutLogs.length;
  const totalVolume = workoutLogs.reduce((total, log) => {
    Object.values(log.logs || {}).forEach(sets => {
      if (Array.isArray(sets)) sets.forEach(s => { if (s.weight && s.reps) total += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0); });
    });
    return total;
  }, 0);

  const longestStreak = (() => {
    if (workoutLogs.length === 0) return 0;
    const logDates = new Set(workoutLogs.map(l => l.completedAt?.split("T")[0]));
    const sorted = Array.from(logDates).sort();
    let best = 1, cur = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = (new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000;
      if (diff === 1) { cur++; best = Math.max(best, cur); } else cur = 1;
    }
    return best;
  })();

  const currentStreak = (() => {
    if (workoutLogs.length === 0) return 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let streak = 0;
    let checkDate = new Date(today);
    const logDates = new Set(workoutLogs.map(l => l.completedAt?.split("T")[0]));
    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split("T")[0];
      if (logDates.has(dateStr)) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
      else if (i === 0) { checkDate.setDate(checkDate.getDate() - 1); }
      else break;
    }
    return streak;
  })();

  const loggedExercises = getLoggedExercises();

  // PRs: count how many exercises have improved over time
  const totalPRs = loggedExercises.filter(ex => {
    if (ex.history.length < 2) return false;
    const first = ex.history[0].value;
    const best = Math.max(...ex.history.map(h => h.value));
    return best > first;
  }).length;

  const bestSessionVolume = workoutLogs.reduce((best, log) => {
    const vol = Object.values(log.logs || {}).reduce((t, sets) => {
      if (!Array.isArray(sets)) return t;
      return t + sets.reduce((s, x) => s + ((parseFloat(x.weight) || 0) * (parseInt(x.reps) || 0)), 0);
    }, 0);
    return Math.max(best, vol);
  }, 0);

  const scoreImproved = capabilityScores.length >= 2 && capabilityScores[capabilityScores.length - 1].capabilityScore > capabilityScores[0].capabilityScore;
  const capabilityScore = capabilityScores.length > 0 ? capabilityScores[capabilityScores.length - 1] : null;

  const pb = (() => {
    let best = { name: "", weight: 0 };
    loggedExercises.forEach(ex => {
      const max = Math.max(...ex.history.map(h => h.value));
      if (max > best.weight) best = { name: ex.name, weight: max };
    });
    return best;
  })();

  const stats = { totalSessions, totalPRs, longestStreak, bestSessionVolume, scoreImproved };

  const isPremium = userData?.subscription === "premium" || userData?.subscription === "hybrid" || userData?.subscription === "in-person";

  const filteredExercises = loggedExercises.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const standards = userData?.capabilityStandards;
  const standardsProgress = standards ? [
    { label: "Bench Press", target: standards.bench, unit: "kg", icon: "🏋️", current: (() => { const ex = loggedExercises.find(e => exercises[e.id]?.name?.toLowerCase().includes("bench")); return ex ? Math.max(...ex.history.map(h => h.value)) : 0; })() },
    { label: "Deadlift", target: standards.deadlift, unit: "kg", icon: "💪", current: (() => { const ex = loggedExercises.find(e => exercises[e.id]?.name?.toLowerCase().includes("deadlift")); return ex ? Math.max(...ex.history.map(h => h.value)) : 0; })() },
  ] : [];

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "100px" }}>
      <PortalNav />
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading your progress...</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "120px" }}>
      <PortalNav />

      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 36px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 16px" }}>Progress</p>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>
          {totalSessions === 0 ? "Your journey starts here" : `${totalSessions} sessions and counting`}
        </h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
          {totalVolume > 0 ? `${Math.round(totalVolume / 1000)}t total volume lifted` : "Complete your first workout to see progress"}
        </p>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      <div style={{ display: "flex", backgroundColor: "#fff", borderBottom: "0.5px solid #e5e5e5", margin: "0 0 16px", overflowX: "auto" }}>
        {["overview", "achievements", "strength", "body"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ flexShrink: 0, flex: 1, padding: "12px 8px", border: "none", backgroundColor: "transparent", fontSize: "13px", fontWeight: 700, color: activeTab === tab ? "#2d6a4f" : "#aaa", cursor: "pointer", borderBottom: activeTab === tab ? "2px solid #2d6a4f" : "2px solid transparent", textTransform: "capitalize" }}>
            {tab}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div style={{ padding: "0 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            <StatCard icon="🏋️" label="Sessions" value={totalSessions} sub="total completed" />
            <StatCard icon="🔥" label="Streak" value={`${currentStreak}d`} sub="current streak" color="#ef4444" />
            <StatCard icon="⚡" label="Volume" value={`${Math.round(totalVolume / 1000)}t`} sub="total lifted" color="#f59e0b" />
            <StatCard icon="🏆" label="Best lift" value={pb.weight > 0 ? `${pb.weight}kg` : "—"} sub={pb.name || "no lifts yet"} color="#7c3aed" />
          </div>

          {capabilityScore && (
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "16px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Capability Score</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div>
                  <span style={{ fontSize: "44px", fontWeight: 700, color: "#2d6a4f", lineHeight: 1 }}>{capabilityScore.capabilityScore}</span>
                  <span style={{ fontSize: "16px", color: "#aaa" }}> / 65</span>
                </div>
                <span style={{ backgroundColor: "#eaf5ef", color: "#2d6a4f", fontSize: "12px", fontWeight: 700, padding: "4px 12px", borderRadius: "20px" }}>{capabilityScore.category}</span>
              </div>
              <Link to="/capability-score" style={{ display: "block", textAlign: "center", backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: 700, color: "#2d6a4f", textDecoration: "none" }}>
                Retake Assessment →
              </Link>
            </div>
          )}

          {standardsProgress.length > 0 && (
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "16px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px" }}>Capability Targets</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {standardsProgress.map(s => {
                  const pct = s.target > 0 ? Math.min((s.current / s.target) * 100, 100) : 0;
                  const achieved = pct >= 100;
                  return (
                    <div key={s.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>{s.icon}</span>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#111" }}>{s.label}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {achieved && <span style={{ fontSize: "12px", color: "#2d6a4f", fontWeight: 700 }}>✓ Achieved!</span>}
                          <span style={{ fontSize: "12px", color: "#aaa" }}>{s.current > 0 ? `${s.current}kg` : "Not logged"} / {s.target}kg</span>
                        </div>
                      </div>
                      <div style={{ height: "6px", backgroundColor: "#f0f0f0", borderRadius: "3px" }}>
                        <div style={{ height: "6px", backgroundColor: achieved ? "#4ade80" : "#2d6a4f", borderRadius: "3px", width: `${pct}%`, transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {workoutLogs.length > 0 && (
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "16px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Recent Sessions</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[...workoutLogs].reverse().slice(0, 8).map(log => {
                  const workout = workouts[log.workoutId];
                  const setCount = Object.values(log.logs || {}).reduce((s, sets) => s + (Array.isArray(sets) ? sets.filter(x => x.done).length : 0), 0);
                  return (
                    <div key={log.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "0.5px solid #f5f5f5" }}>
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{workout?.name || "Workout"}</p>
                        <p style={{ fontSize: "11px", color: "#aaa", margin: "2px 0 0" }}>{new Date(log.completedAt).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" })}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "12px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{setCount} sets</p>
                        <p style={{ fontSize: "11px", color: "#aaa", margin: "2px 0 0" }}>{timeAgo(log.completedAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {totalSessions === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5" }}>
              <p style={{ fontSize: "40px", margin: "0 0 12px" }}>🏋️</p>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: "0 0 8px" }}>No sessions logged yet</p>
              <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>Complete your first workout and it'll show up here.</p>
              <Link to="/training" style={{ display: "inline-block", backgroundColor: "#2d6a4f", color: "#fff", borderRadius: "12px", padding: "12px 20px", fontSize: "14px", fontWeight: 700, textDecoration: "none" }}>Start Training →</Link>
            </div>
          )}
        </div>
      )}

      {/* ACHIEVEMENTS TAB */}
      {activeTab === "achievements" && (
        <div style={{ padding: "0 16px" }}>

          {/* Summary stats */}
          <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "16px", marginBottom: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              {[
                { label: "Sessions", value: totalSessions },
                { label: "PRs Set", value: totalPRs },
                { label: "Best Streak", value: `${longestStreak}d` },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "24px", fontWeight: 700, color: "#4ade80", margin: 0, lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: "10px", color: "#9fe1cb", margin: "4px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Free badges */}
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Badges</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {BADGES.filter(b => b.tier === "free").map(badge => {
              const earned = badge.check(stats);
              return (
                <div key={badge.id} style={{ backgroundColor: "#fff", borderRadius: "14px", border: `0.5px solid ${earned ? "#86efac" : "#e5e5e5"}`, padding: "14px", textAlign: "center", opacity: earned ? 1 : 0.5 }}>
                  <div style={{ fontSize: "32px", marginBottom: "6px", filter: earned ? "none" : "grayscale(1)" }}>{badge.icon}</div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: earned ? "#111" : "#aaa", margin: "0 0 2px" }}>{badge.label}</p>
                  <p style={{ fontSize: "11px", color: "#aaa", margin: 0 }}>{badge.desc}</p>
                  {earned && <div style={{ marginTop: "6px", fontSize: "10px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "2px 8px", borderRadius: "10px", display: "inline-block" }}>Earned</div>}
                </div>
              );
            })}
          </div>

          {/* Top PRs -- free shows 3, premium shows all */}
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Personal Records</p>
          {loggedExercises.length === 0 ? (
            <div style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "20px", textAlign: "center", marginBottom: "16px" }}>
              <p style={{ fontSize: "13px", color: "#aaa", margin: 0 }}>Log workouts with weights to see your PRs here</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              {loggedExercises
                .map(ex => ({ ...ex, pb: Math.max(...ex.history.map(h => h.value)) }))
                .sort((a, b) => b.pb - a.pb)
                .slice(0, isPremium ? undefined : 3)
                .map(ex => (
                  <div key={ex.id} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{ex.name}</p>
                      <p style={{ fontSize: "11px", color: "#aaa", margin: "2px 0 0" }}>{ex.history.length} sessions</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "20px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{ex.pb}kg</p>
                      {ex.history.length > 1 && (
                        <p style={{ fontSize: "11px", color: ex.pb > ex.history[0].value ? "#2d6a4f" : "#aaa", margin: "2px 0 0", fontWeight: 700 }}>
                          {ex.pb > ex.history[0].value ? `+${(ex.pb - ex.history[0].value).toFixed(1)}kg` : "—"}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Premium badges -- locked for free users */}
          <div style={{ backgroundColor: isPremium ? "#fff" : "#f7f5f2", borderRadius: "16px", border: `0.5px solid ${isPremium ? "#e5e5e5" : "#e5e5e5"}`, padding: "16px", marginBottom: "16px", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Premium Badges</p>
              {!isPremium && <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309", backgroundColor: "#fffbeb", padding: "3px 10px", borderRadius: "20px" }}>Premium</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", filter: isPremium ? "none" : "blur(3px)", pointerEvents: isPremium ? "auto" : "none" }}>
              {BADGES.filter(b => b.tier === "premium").map(badge => {
                const earned = isPremium && badge.check(stats);
                return (
                  <div key={badge.id} style={{ backgroundColor: isPremium ? "#fff" : "#f0f0f0", borderRadius: "12px", border: `0.5px solid ${earned ? "#86efac" : "#e5e5e5"}`, padding: "12px", textAlign: "center", opacity: earned ? 1 : 0.5 }}>
                    <div style={{ fontSize: "28px", marginBottom: "4px", filter: earned ? "none" : "grayscale(1)" }}>{badge.icon}</div>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: earned ? "#111" : "#aaa", margin: "0 0 2px" }}>{badge.label}</p>
                    <p style={{ fontSize: "10px", color: "#aaa", margin: 0 }}>{badge.desc}</p>
                    {earned && <div style={{ marginTop: "4px", fontSize: "10px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "2px 8px", borderRadius: "10px", display: "inline-block" }}>Earned</div>}
                  </div>
                );
              })}
            </div>
            {!isPremium && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(247,245,242,0.7)", borderRadius: "16px" }}>
                <p style={{ fontSize: "28px", margin: "0 0 8px" }}>🔒</p>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Unlock Premium Badges</p>
                <p style={{ fontSize: "12px", color: "#888", margin: "0 0 12px", textAlign: "center", padding: "0 20px" }}>8 more badges available with Premium</p>
                <Link to="/training" style={{ backgroundColor: "#2d6a4f", color: "#fff", fontSize: "13px", fontWeight: 700, padding: "10px 20px", borderRadius: "10px", textDecoration: "none" }}>
                  Upgrade to Premium →
                </Link>
              </div>
            )}
          </div>

          {/* Premium volume stats */}
          {isPremium ? (
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>All Time Stats</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Total volume lifted", value: `${Math.round(totalVolume / 1000)}t` },
                  { label: "Best session volume", value: `${Math.round(bestSessionVolume)}kg` },
                  { label: "Longest streak", value: `${longestStreak} days` },
                  { label: "Exercises tracked", value: loggedExercises.length },
                  { label: "Capability score change", value: capabilityScores.length >= 2 ? `${capabilityScores[capabilityScores.length - 1].capabilityScore - capabilityScores[0].capabilityScore > 0 ? "+" : ""}${capabilityScores[capabilityScores.length - 1].capabilityScore - capabilityScores[0].capabilityScore} pts` : "—" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "0.5px solid #f5f5f5" }}>
                    <span style={{ fontSize: "13px", color: "#888" }}>{item.label}</span>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#111" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", position: "relative", overflow: "hidden" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>All Time Stats</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", filter: "blur(4px)" }}>
                {["Total volume lifted", "Best session volume", "Longest streak", "Exercises tracked", "Capability score change"].map(label => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "0.5px solid #f5f5f5" }}>
                    <span style={{ fontSize: "13px", color: "#888" }}>{label}</span>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#111" }}>••••</span>
                  </div>
                ))}
              </div>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Premium unlocks full stats</p>
                <Link to="/training" style={{ backgroundColor: "#2d6a4f", color: "#fff", fontSize: "13px", fontWeight: 700, padding: "10px 20px", borderRadius: "10px", textDecoration: "none" }}>Upgrade →</Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STRENGTH TAB */}
      {activeTab === "strength" && (
        <div style={{ padding: "0 16px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
            {loggedExercises.length} exercises tracked
          </p>
          <div style={{ position: "relative", marginBottom: "14px" }}>
            <input type="text" placeholder="Search exercises..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setSelectedExercise(null); }} style={{ width: "100%", padding: "12px 14px 12px 38px", borderRadius: "12px", border: "0.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box", backgroundColor: "#fff" }} />
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", color: "#aaa" }}>🔍</span>
          </div>

          {loggedExercises.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5" }}>
              <p style={{ fontSize: "32px", margin: "0 0 12px" }}>💪</p>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: "0 0 8px" }}>No strength data yet</p>
              <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Log workouts with weights and they'll appear here.</p>
            </div>
          ) : selectedExercise ? (
            <div>
              <button onClick={() => setSelectedExercise(null)} style={{ background: "none", border: "none", fontSize: "13px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer", padding: "0 0 12px", display: "flex", alignItems: "center", gap: "4px" }}>← Back to all exercises</button>
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>{selectedExercise.name}</h2>
                <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>{selectedExercise.history.length} sessions logged</p>
                <div style={{ backgroundColor: "#eaf5ef", borderRadius: "12px", padding: "12px 14px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>Personal Best</p>
                    <p style={{ fontSize: "28px", fontWeight: 700, color: "#1a3a2a", margin: 0, lineHeight: 1 }}>{Math.max(...selectedExercise.history.map(h => h.value))}kg</p>
                  </div>
                  <span style={{ fontSize: "32px" }}>🏆</span>
                </div>
                {selectedExercise.history.length >= 2 && (
                  <div style={{ marginBottom: "16px" }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Max weight over time</p>
                    <MiniLineGraph data={selectedExercise.history} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                      <span style={{ fontSize: "10px", color: "#aaa" }}>{new Date(selectedExercise.history[0].date).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</span>
                      <span style={{ fontSize: "10px", color: "#aaa" }}>{new Date(selectedExercise.history[selectedExercise.history.length - 1].date).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</span>
                    </div>
                  </div>
                )}
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Session history</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[...selectedExercise.history].reverse().map((h, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "0.5px solid #f5f5f5" }}>
                      <span style={{ fontSize: "13px", color: "#888" }}>{new Date(h.date).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" })}</span>
                      <div style={{ display: "flex", gap: "12px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f" }}>{h.value}kg</span>
                        <span style={{ fontSize: "12px", color: "#aaa" }}>{h.sets} sets</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filteredExercises.map(ex => {
                const pb = Math.max(...ex.history.map(h => h.value));
                const latest = ex.history[ex.history.length - 1];
                const prev = ex.history.length > 1 ? ex.history[ex.history.length - 2] : null;
                const trend = prev ? latest.value - prev.value : 0;
                return (
                  <div key={ex.id} onClick={() => setSelectedExercise(ex)} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{ex.name}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {trend !== 0 && <span style={{ fontSize: "12px", fontWeight: 700, color: trend > 0 ? "#2d6a4f" : "#ef4444" }}>{trend > 0 ? "+" : ""}{trend}kg</span>}
                        <span style={{ fontSize: "12px", color: "#aaa" }}>→</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "16px" }}>
                      {[{ label: "Best", value: `${pb}kg` }, { label: "Last", value: `${latest.value}kg` }, { label: "Sessions", value: ex.history.length }].map(s => (
                        <div key={s.label}>
                          <p style={{ fontSize: "10px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>{s.label}</p>
                          <p style={{ fontSize: "16px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                    {ex.history.length >= 2 && <div style={{ marginTop: "10px" }}><MiniLineGraph data={ex.history} height={40} /></div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* BODY TAB */}
      {activeTab === "body" && (
        <div style={{ padding: "0 16px" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Body Weight</p>
              <button onClick={() => setShowWeightModal(true)} style={{ backgroundColor: "#eaf5ef", color: "#2d6a4f", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>+ Log weight</button>
            </div>
            {weightLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <p style={{ fontSize: "13px", color: "#aaa", margin: "0 0 10px" }}>No weight logged yet</p>
                <button onClick={() => setShowWeightModal(true)} style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Log your first weight</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: "16px", marginBottom: "14px" }}>
                  <div>
                    <p style={{ fontSize: "10px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>Current</p>
                    <p style={{ fontSize: "24px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{weightLogs[weightLogs.length - 1].value}kg</p>
                  </div>
                  {userData?.goalWeight && !userData?.noGoalWeight && (
                    <div>
                      <p style={{ fontSize: "10px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>Goal</p>
                      <p style={{ fontSize: "24px", fontWeight: 700, color: "#111", margin: 0 }}>{userData.goalWeight}kg</p>
                    </div>
                  )}
                  {weightLogs.length > 1 && (
                    <div>
                      <p style={{ fontSize: "10px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>Change</p>
                      <p style={{ fontSize: "24px", fontWeight: 700, color: weightLogs[weightLogs.length - 1].value <= weightLogs[0].value ? "#2d6a4f" : "#ef4444", margin: 0 }}>
                        {(weightLogs[weightLogs.length - 1].value - weightLogs[0].value).toFixed(1)}kg
                      </p>
                    </div>
                  )}
                </div>
                {weightLogs.length >= 2 && (
                  <div style={{ marginBottom: "14px" }}>
                    <MiniLineGraph data={weightLogs} color="#3b82f6" />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                      <span style={{ fontSize: "10px", color: "#aaa" }}>{new Date(weightLogs[0].date).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</span>
                      <span style={{ fontSize: "10px", color: "#aaa" }}>{new Date(weightLogs[weightLogs.length - 1].date).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</span>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[...weightLogs].reverse().slice(0, 8).map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "0.5px solid #f5f5f5" }}>
                      <span style={{ fontSize: "13px", color: "#888" }}>{new Date(l.date).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" })}</span>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "#111" }}>{l.value}kg</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px" }}>Health Integrations</p>
            {[
              { icon: "🍏", name: "Apple Health", sub: "Steps, heart rate, VO2 max" },
              { icon: "🟠", name: "Strava", sub: "Runs, rides and activities" },
              { icon: "⌚", name: "Garmin", sub: "Training load and recovery" },
            ].map(item => (
              <div key={item.name} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderBottom: "0.5px solid #f5f5f5" }}>
                <span style={{ fontSize: "24px" }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{item.name}</p>
                  <p style={{ fontSize: "12px", color: "#aaa", margin: "2px 0 0" }}>{item.sub}</p>
                </div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", backgroundColor: "#f0f0f0", padding: "4px 10px", borderRadius: "20px" }}>Coming soon</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showWeightModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowWeightModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Log Weight</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>{new Date().toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" })}</p>
            <input type="number" placeholder={`e.g. ${userData?.weight || "80"}`} value={newWeight} onChange={e => setNewWeight(e.target.value)} autoFocus style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "1.5px solid #2d6a4f", fontSize: "24px", fontWeight: 700, outline: "none", textAlign: "center", boxSizing: "border-box", marginBottom: "12px" }} />
            <p style={{ textAlign: "center", fontSize: "12px", color: "#aaa", margin: "0 0 16px" }}>{userData?.units === "imperial" ? "lbs" : "kg"}</p>
            <button onClick={logWeight} disabled={!newWeight || savingWeight} style={{ width: "100%", backgroundColor: !newWeight || savingWeight ? "#e5e5e5" : "#2d6a4f", color: !newWeight || savingWeight ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>
              {savingWeight ? "Saving..." : "Save"}
            </button>
            <button onClick={() => setShowWeightModal(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}