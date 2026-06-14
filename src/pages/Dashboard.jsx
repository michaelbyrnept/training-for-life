import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import PortalNav from "../components/PortalNav";

const WEEKLY_TARGETS = { strength: 3, cardio: 2, mobility: 1 };
const TOTAL_TARGET = 6;

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [userData, setUserData] = useState(null);
  const [capabilityScore, setCapabilityScore] = useState(null);
  const [category, setCategory] = useState("");
  const [assessmentDate, setAssessmentDate] = useState("");
  const [strengthScore, setStrengthScore] = useState(0);
  const [mobilityScore, setMobilityScore] = useState(0);
  const [energyScore, setEnergyScore] = useState(0);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [consistencyScore, setConsistencyScore] = useState(0);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Today's Plan
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [todayProgramme, setTodayProgramme] = useState(null);

  // Weekly stats
  const [weeklyDone, setWeeklyDone] = useState({ strength: 0, cardio: 0, mobility: 0 });
  const [weeklyLogs, setWeeklyLogs] = useState([]);
  const [streakWeeks, setStreakWeeks] = useState(0);

  const resumeKey = Object.keys(sessionStorage).find(
    k => k.startsWith("tfl_workout_") &&
    !k.endsWith("_index") &&
    !k.endsWith("_programme") &&
    !k.endsWith("_week")
  );
  const resumeWorkoutId = resumeKey?.replace("tfl_workout_", "");
  const resumeProgrammeId = resumeWorkoutId ? sessionStorage.getItem(`tfl_workout_${resumeWorkoutId}_programme`) : null;
  const resumeWeekId = resumeWorkoutId ? sessionStorage.getItem(`tfl_workout_${resumeWorkoutId}_week`) : null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate("/login"); return; }

      // Load user data
      const userSnap = await getDoc(doc(db, "users", user.uid));
      let uData = {};
      if (userSnap.exists()) {
        uData = userSnap.data();
        setUserData(uData);
        setFirstName(uData.nickname || uData.firstName || "");
      }

      // Load capability score
      const resultsQuery = query(collection(db, "assessmentResults"), where("email", "==", user.email));
      const resultsSnapshot = await getDocs(resultsQuery);
      if (!resultsSnapshot.empty) {
        const d = resultsSnapshot.docs[0].data();
        setCapabilityScore(d.capabilityScore);
        setCategory(d.category);
        setAssessmentDate(d.assessmentDate);
        setStrengthScore(d.strengthScore || 0);
        setMobilityScore(d.mobilityScore || 0);
        setEnergyScore(d.energyScore || 0);
        setConfidenceScore(d.confidenceScore || 0);
        setConsistencyScore(d.consistencyScore || 0);
      }

      // Load this week's workout logs
      const { monday, sunday } = getWeekRange();
      const logsSnap = await getDocs(collection(db, "workoutLogs"));
      const allMyLogs = logsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(l => l.userId === user.uid);

      const thisWeekLogs = allMyLogs.filter(l => {
        const d = new Date(l.completedAt);
        return d >= monday && d <= sunday;
      });

      setWeeklyLogs(thisWeekLogs);

      const strengthDone = uData.strengthProgrammeId
        ? thisWeekLogs.filter(l => l.programmeId === uData.strengthProgrammeId).length
        : 0;
      const cardioDone = uData.cardioProgrammeId
        ? thisWeekLogs.filter(l => l.programmeId === uData.cardioProgrammeId).length
        : 0;

      setWeeklyDone({ strength: strengthDone, cardio: cardioDone, mobility: 0 });

      // Calculate streak (weeks where total done >= TOTAL_TARGET)
      // Group all logs by week
      const weekMap = {};
      allMyLogs.forEach(l => {
        const d = new Date(l.completedAt);
        const mon = new Date(d);
        mon.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
        mon.setHours(0, 0, 0, 0);
        const key = mon.toISOString();
        weekMap[key] = (weekMap[key] || 0) + 1;
      });
      const sortedWeeks = Object.entries(weekMap).sort((a, b) => new Date(b[0]) - new Date(a[0]));
      let streak = 0;
      for (const [, count] of sortedWeeks) {
        if (count >= TOTAL_TARGET) streak++;
        else break;
      }
      setStreakWeeks(streak);

      // Build Today's Plan
      await buildTodaysPlan(uData, thisWeekLogs, strengthDone, cardioDone);

      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const buildTodaysPlan = async (uData, thisWeekLogs, strengthDone, cardioDone) => {
    // Decide what type of session is needed most today
    const needsStrength = strengthDone < WEEKLY_TARGETS.strength;
    const needsCardio = cardioDone < WEEKLY_TARGETS.cardio;

    const programmeId = needsStrength && uData.strengthProgrammeId
      ? uData.strengthProgrammeId
      : needsCardio && uData.cardioProgrammeId
      ? uData.cardioProgrammeId
      : uData.strengthProgrammeId || uData.cardioProgrammeId;

    if (!programmeId) return;

    try {
      const progSnap = await getDoc(doc(db, "programmes", programmeId));
      if (!progSnap.exists()) return;
      const programme = { id: progSnap.id, ...progSnap.data() };
      setTodayProgramme(programme);

      // Find next workout not yet done this week
      const doneWorkoutIds = thisWeekLogs
        .filter(l => l.programmeId === programmeId)
        .map(l => l.workoutId);

      // Get all workouts from all weeks of the programme
      const allWorkouts = (programme.weeks || []).flatMap(w => w.workouts || []);
      const nextWorkout = allWorkouts.find(w => !doneWorkoutIds.includes(w.workoutId)) || allWorkouts[0];

      if (nextWorkout) {
        // Load workout details
        const workoutSnap = await getDoc(doc(db, "workouts", nextWorkout.workoutId));
        if (workoutSnap.exists()) {
          const workoutData = { id: workoutSnap.id, ...workoutSnap.data() };
          // Find which week this workout belongs to
          const weekObj = (programme.weeks || []).find(w =>
            (w.workouts || []).some(wk => wk.workoutId === nextWorkout.workoutId)
          );
          setTodayWorkout({ ...workoutData, weekId: weekObj?.id || programme.weeks?.[0]?.id });
        }
      }
    } catch (e) {
      console.error("Error building today's plan:", e);
    }
  };

  const ringPct = capabilityScore ? (capabilityScore / 65) : 0;
  const circumference = 2 * Math.PI * 28;
  const dashOffset = circumference - (ringPct * circumference);

  const breakdown = [
    { label: "Strength", value: strengthScore, max: 10 },
    { label: "Mobility", value: mobilityScore, max: 10 },
    { label: "Energy", value: energyScore, max: 10 },
    { label: "Confidence", value: confidenceScore, max: 10 },
    { label: "Consistency", value: consistencyScore, max: 10 },
  ];

  const scoreHistory = [28, 32, 35, 38, capabilityScore || 0];
  const scoreLabels = ["Jan", "Feb", "Mar", "Apr", "Now"];

  const totalDone = weeklyDone.strength + weeklyDone.cardio + weeklyDone.mobility;
  const strengthRemaining = Math.max(0, WEEKLY_TARGETS.strength - weeklyDone.strength);
  const cardioRemaining = Math.max(0, WEEKLY_TARGETS.cardio - weeklyDone.cardio);
  const weekComplete = totalDone >= TOTAL_TARGET;

  // Build weekly session list for display
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date();
  const todayDay = today.getDay();
  const todayLabel = days[todayDay === 0 ? 6 : todayDay - 1];

  const sessionList = weeklyLogs.slice(0, 6).map(l => ({
    label: l.workoutId || "Session",
    day: new Date(l.completedAt).toLocaleDateString("en-IE", { weekday: "short" }),
    done: true,
    today: false,
  }));

  // Add remaining sessions needed
  const remaining = TOTAL_TARGET - sessionList.length;
  for (let i = 0; i < remaining; i++) {
    sessionList.push({
      label: i === 0 && strengthRemaining > 0 ? "Strength session" : i === 0 ? "Cardio session" : "Session",
      day: i === 0 ? "Today" : "",
      done: false,
      today: i === 0,
    });
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px", position: "relative" }}>
      <PortalNav />

      {/* HEADER */}
      <div style={{
        background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)",
        padding: "16px 20px 36px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
            Training for Life
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2a5 5 0 015 5c0 3 1.5 4 2 5H2c.5-1 2-2 2-5a5 5 0 015-5z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M7.5 15a1.5 1.5 0 003 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <Link to="/profile" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="6" r="3" stroke="#fff" strokeWidth="1.5"/>
                <path d="M3 15c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: "0 0 3px" }}>Welcome back,</p>
            <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 4px", lineHeight: 1.2 }}>
              {firstName || "..."}
            </h1>
            <p style={{ fontSize: "12px", color: "#9fe1cb", margin: 0, fontStyle: "italic" }}>Build Strength For Life</p>
          </div>

          <div onClick={() => setShowScoreModal(true)} style={{ position: "relative", width: 72, height: 72, cursor: "pointer", flexShrink: 0 }}>
            <svg style={{ width: 72, height: 72, transform: "rotate(-90deg)", display: "block" }} viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5"/>
              <circle cx="32" cy="32" r="28" fill="none" stroke="#4ade80" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 1s ease" }}/>
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <span style={{ fontSize: "17px", fontWeight: 700, color: "#fff", lineHeight: 1 }}>{capabilityScore ?? "—"}</span>
              <span style={{ fontSize: "9px", color: "#9fe1cb", fontWeight: 600, letterSpacing: "0.04em" }}>/ 65</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      {/* TODAY'S PLAN */}
      <div style={{ padding: "0 16px", marginTop: 4 }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>
          Today's Plan
        </p>

        {weekComplete ? (
          <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "28px" }}>🎉</span>
            <div>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: 0 }}>Week complete!</p>
              <p style={{ fontSize: "12px", color: "#9fe1cb", margin: "3px 0 0" }}>You've hit all {TOTAL_TARGET} sessions. Rest up.</p>
            </div>
          </div>
        ) : todayWorkout && todayProgramme ? (
          <Link
            to={`/programme/${todayProgramme.id}/${todayWorkout.weekId}/${todayWorkout.id}`}
            style={{ textDecoration: "none", display: "block" }}
          >
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 3px" }}>
                  {strengthRemaining > 0 ? "Strength" : "Cardio"} · {todayProgramme.name}
                </p>
                <p style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {todayWorkout.name}
                </p>
                <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
                  {todayWorkout.exercises?.length || 0} exercises
                  {todayWorkout.estimatedTime ? ` · ${todayWorkout.estimatedTime} min` : ""}
                </p>
              </div>
              <div style={{ backgroundColor: "#2d6a4f", color: "#fff", borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap", marginLeft: "12px" }}>
                Start
              </div>
            </div>
          </Link>
        ) : userData && !userData.strengthProgrammeId && !userData.cardioProgrammeId ? (
          <Link to="/training" style={{ textDecoration: "none", display: "block" }}>
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1.5px dashed #e5e5e5", padding: "16px", textAlign: "center" }}>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>No programme selected</p>
              <p style={{ fontSize: "13px", color: "#888", margin: "0 0 10px" }}>Choose your strength and cardio programmes to get started.</p>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f" }}>Go to Training →</span>
            </div>
          </Link>
        ) : (
          <Link to="/training" style={{ textDecoration: "none", display: "block" }}>
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>Loading your plan...</p>
                <p style={{ fontSize: "12px", color: "#888", margin: "3px 0 0" }}>Tap to go to Training</p>
              </div>
              <div style={{ backgroundColor: "#2d6a4f", color: "#fff", borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: 700 }}>
                Training →
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* CAPABILITY SCORE CARD */}
      <div style={{ padding: "16px 16px 0" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>
          Capability Score
        </p>
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <span style={{ fontSize: "48px", fontWeight: 700, color: "#2d6a4f", lineHeight: 1 }}>{capabilityScore ?? "—"}</span>
                <span style={{ fontSize: "16px", color: "#aaa" }}>/ 65</span>
              </div>
              <span style={{ backgroundColor: "#eaf5ef", color: "#2d6a4f", fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", display: "inline-block", marginTop: "6px" }}>
                {category || "Not assessed"}
              </span>
            </div>
            <button onClick={() => setShowScoreModal(true)} style={{ background: "none", border: "none", fontSize: "12px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer", padding: 0 }}>
              View history →
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {breakdown.map(item => (
              <div key={item.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#555" }}>{item.label}</span>
                  <span style={{ fontSize: "12px", color: "#aaa" }}>{item.value}/{item.max}</span>
                </div>
                <div style={{ height: "3px", backgroundColor: "#f0f0f0", borderRadius: "2px" }}>
                  <div style={{ height: "3px", backgroundColor: "#2d6a4f", borderRadius: "2px", width: `${(item.value / item.max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: "11px", color: "#aaa", margin: "12px 0 0" }}>
            Last assessed: {assessmentDate ? new Date(assessmentDate).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }) : "Not yet assessed"}
          </p>
        </div>
      </div>

      {/* WEEKLY CHALLENGE */}
      <div style={{ padding: "16px 16px 0" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>
          This Week
        </p>
        <div style={{ background: "#1a3a2a", borderRadius: "20px", padding: "18px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>
                {streakWeeks > 0 ? "Weekly Streak" : "This Week"}
              </p>
              <p style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 2px", lineHeight: 1 }}>
                {streakWeeks > 0 ? `🔥 ${streakWeeks} ${streakWeeks === 1 ? "week" : "weeks"}` : `${totalDone} / ${TOTAL_TARGET}`}
              </p>
              <p style={{ fontSize: "11px", color: "#9fe1cb", margin: 0 }}>
                {weekComplete
                  ? "Perfect week. Well done."
                  : strengthRemaining > 0
                  ? `${strengthRemaining} more strength session${strengthRemaining > 1 ? "s" : ""} needed`
                  : cardioRemaining > 0
                  ? `${cardioRemaining} more cardio session${cardioRemaining > 1 ? "s" : ""} needed`
                  : `${TOTAL_TARGET - totalDone} sessions to go`}
              </p>
            </div>

            {/* Ring indicator */}
            <div style={{ position: "relative", width: 72, height: 72 }}>
              <svg style={{ width: 72, height: 72, transform: "rotate(-90deg)", display: "block" }} viewBox="0 0 80 80">
                {/* Strength ring */}
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6"/>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#4ade80" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray="213"
                  strokeDashoffset={213 - (213 * Math.min(weeklyDone.strength / WEEKLY_TARGETS.strength, 1))}/>
                {/* Cardio ring */}
                <circle cx="40" cy="40" r="25" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6"/>
                <circle cx="40" cy="40" r="25" fill="none" stroke="#34d399" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray="157"
                  strokeDashoffset={157 - (157 * Math.min(weeklyDone.cardio / WEEKLY_TARGETS.cardio, 1))}/>
                {/* Mobility ring */}
                <circle cx="40" cy="40" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6"/>
                <circle cx="40" cy="40" r="16" fill="none" stroke="#6ee7b7" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray="100"
                  strokeDashoffset={100 - (100 * Math.min(weeklyDone.mobility / WEEKLY_TARGETS.mobility, 1))}/>
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", lineHeight: 1 }}>{totalDone}/{TOTAL_TARGET}</div>
                  <div style={{ fontSize: "8px", color: "#9fe1cb", fontWeight: 600 }}>done</div>
                </div>
              </div>
            </div>
          </div>

          {/* Session breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { icon: "🏋️", label: "Strength", done: weeklyDone.strength, target: WEEKLY_TARGETS.strength },
              { icon: "🏃", label: "Cardio", done: weeklyDone.cardio, target: WEEKLY_TARGETS.cardio },
              { icon: "🧘", label: "Mobility", done: weeklyDone.mobility, target: WEEKLY_TARGETS.mobility, comingSoon: true },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px" }}>{item.icon}</span>
                  <span style={{ fontSize: "13px", color: item.done >= item.target ? "#c5e8d8" : "rgba(255,255,255,0.7)", fontWeight: item.done >= item.target ? 700 : 400 }}>
                    {item.label} {item.comingSoon ? "(coming soon)" : ""}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "5px" }}>
                  {Array.from({ length: item.target }).map((_, i) => (
                    <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: i < item.done ? "#4ade80" : "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {i < item.done && (
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                          <path d="M1.5 4.5l2 2 4-4" stroke="#1a3a2a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Link to="/training" style={{ display: "block", textAlign: "center", marginTop: "14px", fontSize: "12px", fontWeight: 700, color: "#9fe1cb", textDecoration: "none" }}>
            Manage my programmes →
          </Link>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ padding: "16px 16px 0", display: "flex", gap: "10px" }}>
        <Link to="/capability-score" style={{ flex: 1, backgroundColor: "#fff", border: "0.5px solid #e5e5e5", borderRadius: "12px", padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: 700, color: "#2d6a4f", textDecoration: "none" }}>
          Retake Assessment
        </Link>
        <Link to="/training" style={{ flex: 1, backgroundColor: "#2d6a4f", borderRadius: "12px", padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: 700, color: "#fff", textDecoration: "none" }}>
          View Training
        </Link>
      </div>

      {/* SCORE HISTORY MODAL */}
      {showScoreModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowScoreModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Capability Score</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>Reassessed every 30 days</p>

            <div style={{ background: "#f7f5f2", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
              <svg viewBox="0 0 300 120" width="100%" style={{ display: "block", overflow: "visible" }}>
                {(() => {
                  const vals = scoreHistory;
                  const minV = Math.min(...vals);
                  const maxV = Math.max(...vals);
                  const range = maxV - minV || 1;
                  const coords = vals.map((v, i) => ({
                    x: 16 + (i / (vals.length - 1)) * 268,
                    y: 100 - ((v - minV) / range) * 80,
                    v
                  }));
                  const pts = coords.map(c => `${c.x},${c.y}`).join(" ");
                  const fillPts = `${coords[0].x},110 ${pts} ${coords[coords.length-1].x},110`;
                  return (
                    <>
                      <defs>
                        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2d6a4f" stopOpacity="0.2"/>
                          <stop offset="100%" stopColor="#2d6a4f" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <polygon points={fillPts} fill="url(#grad)"/>
                      <polyline points={pts} fill="none" stroke="#2d6a4f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      {coords.map((c, i) => (
                        <g key={i}>
                          <circle cx={c.x} cy={c.y} r="4" fill="#2d6a4f" stroke="#fff" strokeWidth="2"/>
                          <text x={c.x} y={c.y - 10} textAnchor="middle" fontSize="10" fill="#2d6a4f" fontWeight="700">{c.v}</text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0 0" }}>
                {scoreLabels.map(l => (
                  <span key={l} style={{ fontSize: "10px", color: "#aaa", fontWeight: 600, flex: 1, textAlign: "center" }}>{l}</span>
                ))}
              </div>
            </div>

            <Link to="/capability-score" onClick={() => setShowScoreModal(false)} style={{ display: "block", textAlign: "center", background: "#2d6a4f", color: "#fff", borderRadius: "12px", padding: "13px", fontSize: "14px", fontWeight: 700, textDecoration: "none" }}>
              Retake Assessment
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}