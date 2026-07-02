import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import PortalNav from "../components/PortalNav";
import { useFeatures } from "../hooks/useFeatures";

const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";
const WEEKLY_TARGETS = { strength: 3, cardio: 2 };
const TOTAL_TARGET = 5;

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

function normalizeDate(val) {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (val.toDate) return val.toDate().toISOString();
  if (val.seconds) return new Date(val.seconds * 1000).toISOString();
  return null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { isPremium, tier } = useFeatures();
  const [firstName, setFirstName] = useState("");
  const [userData, setUserData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [capabilityScore, setCapabilityScore] = useState(null);
  const [allScores, setAllScores] = useState([]);
  const [category, setCategory] = useState("");
  const [assessmentDate, setAssessmentDate] = useState("");
  const [strengthScore, setStrengthScore] = useState(0);
  const [energyScore, setEnergyScore] = useState(0);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [consistencyScore, setConsistencyScore] = useState(0);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [checkIn, setCheckIn] = useState(null); // this week's check-in
  const [unreadReply, setUnreadReply] = useState(null); // unread coach reply
  const [loading, setLoading] = useState(true);

  const [todayWorkout, setTodayWorkout] = useState(null);
  const [todayProgramme, setTodayProgramme] = useState(null);
  const [weeklyDone, setWeeklyDone] = useState({ strength: 0, cardio: 0 });
  const [totalLogCount, setTotalLogCount] = useState(null); // null = still loading
  const [nudgeDismissed, setNudgeDismissed] = useState(() => !!sessionStorage.getItem("tfl_nudge_dismissed"));
  const [weeklyLogs, setWeeklyLogs] = useState([]);
  const [lastLog, setLastLog] = useState(null); // most recent log across all time
  const [streakWeeks, setStreakWeeks] = useState(0);
  const [walletBalance, setWalletBalance] = useState(null);
  const [nextSession, setNextSession] = useState(null);
  const [nextClass, setNextClass] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // PWA install prompt
  useEffect(() => {
    if (localStorage.getItem("tfl_install_dismissed")) return;
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setShowInstallBanner(false);
    setInstallPrompt(null);
  };

  const dismissInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem("tfl_install_dismissed", "1");
  };

  const resumeKey = Object.keys(localStorage).find(
    k => k.startsWith("tfl_workout_") &&
    !k.endsWith("_index") &&
    !k.endsWith("_programme") &&
    !k.endsWith("_week")
  );
  const resumeWorkoutId = resumeKey?.replace("tfl_workout_", "");
  const resumeProgrammeId = resumeWorkoutId ? localStorage.getItem(`tfl_workout_${resumeWorkoutId}_programme`) : null;
  const resumeWeekId = resumeWorkoutId ? localStorage.getItem(`tfl_workout_${resumeWorkoutId}_week`) : null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate("/login"); return; }
      setIsAdmin(user.uid === ADMIN_UID);

      const userSnap = await getDoc(doc(db, "users", user.uid));
      let uData = {};
      if (userSnap.exists()) {
        uData = userSnap.data();
        setUserData(uData);
        setFirstName(uData.nickname || uData.firstName || "");
      }

      // Load ALL capability scores for this user (for history)
      const resultsQuery = query(collection(db, "assessmentResults"), where("email", "==", user.email));
      const resultsSnapshot = await getDocs(resultsQuery);
      if (!resultsSnapshot.empty) {
        const scores = resultsSnapshot.docs
          .map(d => d.data())
          .sort((a, b) => new Date(a.assessmentDate) - new Date(b.assessmentDate));
        setAllScores(scores);
        // Most recent score
        const latest = scores[scores.length - 1];
        setCapabilityScore(latest.capabilityScore);
        setCategory(latest.category);
        setAssessmentDate(latest.assessmentDate);
        setStrengthScore(latest.strengthScore || 0);
        setEnergyScore(latest.energyScore || 0);
        setConfidenceScore(latest.confidenceScore || 0);
        setConsistencyScore(latest.consistencyScore || 0);
      }

      const { monday, sunday } = getWeekRange();
      // Single-field where avoids needing a composite Firestore index (a
      // where + orderBy on different fields requires one, and threw an
      // uncaught FirebaseError for every user until this was split out).
      // Sort and cap at 100 client-side instead.
      const logsSnap = await getDocs(query(collection(db, "workoutLogs"), where("userId", "==", user.uid)));
      const allMyLogs = logsSnap.docs
        .map(d => ({ id: d.id, ...d.data(), completedAt: normalizeDate(d.data().completedAt) }))
        .filter(l => l.completedAt)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, 100);

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

      setTotalLogCount(allMyLogs.length);
      setLastLog(allMyLogs[0] || null); // allMyLogs is ordered by completedAt desc
      setWeeklyDone({ strength: strengthDone, cardio: cardioDone });

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

      await buildTodaysPlan(uData, thisWeekLogs, strengthDone, cardioDone);

      // Load check-ins for in-person/hybrid users
      if (uData.subscription === "in-person" || uData.subscription === "hybrid" || uData.subscription === "online") {
        const checkInSnap = await getDocs(query(collection(db, "checkIns"), where("userId", "==", user.uid)));
        const allCheckIns = checkInSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        const now = new Date();
        const day = now.getDay();
        const mon = new Date(now);
        mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        const weekMonday = mon.toISOString().split("T")[0];
        const thisWeekCheckIn = allCheckIns.find(c => c.weekOf === weekMonday && !c.coachInitiated);
        setCheckIn(thisWeekCheckIn || null);
        const unread = allCheckIns.find(c => c.coachReply && !c.replyRead);
        setUnreadReply(unread || null);
      }

      // Load wallet balance + next session for in-person/hybrid clients
      if (uData.subscription === "in-person" || uData.subscription === "hybrid") {
        const [txSnap, sessSnap] = await Promise.all([
          getDocs(query(collection(db, "walletTransactions"), where("clientId", "==", user.uid))),
          getDocs(query(collection(db, "sessions"), where("clientId", "==", user.uid))),
        ]);
        const balance = txSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
        setWalletBalance(balance);
        const now = new Date();
        const upcoming = sessSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => {
            const sd = s.date?.toDate ? s.date.toDate() : new Date(s.date);
            return s.status === "scheduled" && sd >= now;
          })
          .sort((a, b) => {
            const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
            const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date);
            return da - db2;
          });
        setNextSession(upcoming[0] || null);
      }

      // Load next upcoming class — filter by end time so finished classes disappear
      const now = new Date();
      const classSnap = await getDocs(collection(db, "classes"));
      const upcomingClasses = classSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => {
          if (c.published === false || !c.date || !c.time) return false;
          const start = new Date(`${c.date}T${c.time}:00`);
          const end = new Date(start.getTime() + (c.duration || 0) * 60000);
          return end > now;
        })
        .sort((a, b) => new Date(`${a.date}T${a.time}:00`) - new Date(`${b.date}T${b.time}:00`));
      setNextClass(upcomingClasses[0] || null);

      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const buildTodaysPlan = async (uData, thisWeekLogs, strengthDone, cardioDone) => {
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

      const doneWorkoutIds = thisWeekLogs
        .filter(l => l.programmeId === programmeId)
        .map(l => l.workoutId);

      // week.workouts is an array of plain ID strings
      const allWorkoutIds = (programme.weeks || []).flatMap(w => w.workouts || []).filter(Boolean);
      const nextWorkoutId = allWorkoutIds.find(id => !doneWorkoutIds.includes(id)) || allWorkoutIds[0];

      if (nextWorkoutId) {
        const workoutSnap = await getDoc(doc(db, "workouts", nextWorkoutId));
        if (workoutSnap.exists()) {
          const workoutData = { id: workoutSnap.id, ...workoutSnap.data() };
          const weekObj = (programme.weeks || []).find(w =>
            (w.workouts || []).includes(nextWorkoutId)
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
    { label: "Energy", value: energyScore, max: 10 },
    { label: "Confidence", value: confidenceScore, max: 10 },
    { label: "Consistency", value: consistencyScore, max: 10 },
  ];

  const totalDone = weeklyDone.strength + weeklyDone.cardio;
  const strengthRemaining = Math.max(0, WEEKLY_TARGETS.strength - weeklyDone.strength);
  const cardioRemaining = Math.max(0, WEEKLY_TARGETS.cardio - weeklyDone.cardio);
  const weekComplete = totalDone >= TOTAL_TARGET;

  const sessionList = weeklyLogs.slice(0, 6).map(l => ({
    label: l.workoutId || "Session",
    day: new Date(l.completedAt).toLocaleDateString("en-IE", { weekday: "short" }),
    done: true,
    today: false,
  }));
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

      {/* PWA INSTALL BANNER */}
      {showInstallBanner && (
        <div style={{ padding: "10px 16px 0", position: "relative", zIndex: 10 }}>
          <div style={{ background: "#1a3a2a", borderRadius: "14px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: 40, height: 40, borderRadius: "10px", background: "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
              📲
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>Add to your home screen</p>
              <p style={{ fontSize: "12px", color: "#9fe1cb", margin: 0 }}>One tap away, like any app</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button onClick={dismissInstall} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "8px", padding: "7px 10px", fontSize: "12px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontWeight: 600 }}>
                Not now
              </button>
              <button onClick={handleInstall} style={{ background: "#9fe1cb", border: "none", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", color: "#1a3a2a", cursor: "pointer", fontWeight: 700 }}>
                Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 36px", position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>Training for Life</p>
          <div style={{ display: "flex", gap: "10px" }}>
            {isAdmin && (
              <Link to="/admin" style={{ height: 36, borderRadius: "20px", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", padding: "0 12px", fontSize: "13px", fontWeight: 700, color: "#9fe1cb", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Admin
              </Link>
            )}
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
            <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 4px", lineHeight: 1.2 }}>{firstName || "..."}</h1>
            {streakWeeks > 0 && (
              <p style={{ fontSize: "12px", color: "#9fe1cb", margin: 0 }}>{streakWeeks} week streak 🔥 Keep it going</p>
            )}
          </div>

          <div onClick={() => capabilityScore && setShowScoreModal(true)} style={{ position: "relative", width: 72, height: 72, cursor: capabilityScore ? "pointer" : "default", flexShrink: 0 }}>
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

      {/* UNREAD REPLY NOTIFICATION */}
      {unreadReply && (
        <div style={{ padding: "0 16px", marginBottom: "12px" }}>
          <Link to="/check-in" style={{ textDecoration: "none", display: "block" }}>
            <div style={{ background: "linear-gradient(135deg, #2d6a4f 0%, #16a34a 100%)", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
                {unreadReply?.coachVideoUrl ? "🎥" : "💬"}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>
                  {unreadReply?.coachVideoUrl ? "Michael sent you a video response" : "Michael replied to your check-in"}
                </p>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", margin: 0 }}>
                  {unreadReply?.coachVideoUrl ? "Tap to watch your personalised feedback" : "Tap to read your feedback"}
                </p>
              </div>
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#4ade80", flexShrink: 0 }} />
            </div>
          </Link>
        </div>
      )}

      {/* CHECK-IN CARD */}
      {(userData?.subscription === "in-person" || userData?.subscription === "hybrid" || userData?.subscription === "online") && (
        <div style={{ padding: "0 16px", marginBottom: "12px" }}>
          {!unreadReply && (checkIn ? (
            <Link to="/check-in" style={{ textDecoration: "none", display: "block" }}>
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #86efac", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>✅</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#2d6a4f", margin: "0 0 2px" }}>Check-in submitted</p>
                  <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>Waiting for your review</p>
                </div>
              </div>
            </Link>
          ) : (() => {
            const now = new Date();
            const day = now.getDay();
            const isCheckInWindow = day === 5 || day === 6 || day === 0; // Fri, Sat, Sun
            if (!isCheckInWindow) return null;
            return (
              <Link to="/check-in" style={{ textDecoration: "none", display: "block" }}>
                <div style={{ background: "linear-gradient(135deg, #1a3a2a 0%, #2d6a4f 100%)", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>📋</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>Your weekly check-in is ready</p>
                    <p style={{ fontSize: "12px", color: "#9fe1cb", margin: 0 }}>Takes 2 minutes -- tap to complete</p>
                  </div>
                  <div style={{ backgroundColor: "#4ade80", color: "#1a3a2a", fontSize: "12px", fontWeight: 700, padding: "6px 12px", borderRadius: "8px", flexShrink: 0 }}>Start →</div>
                </div>
              </Link>
            );
          })())}
          <Link to="/check-in" style={{ display: "block", textAlign: "center", marginTop: "8px", fontSize: "12px", fontWeight: 700, color: "#2d6a4f", textDecoration: "none" }}>
            View check-in history →
          </Link>
        </div>
      )}

      {/* PREMIUM TRIAL BANNER -- shown when on an app-granted trial (no Stripe sub) */}
      {userData?.subscriptionStatus === "trialing" && !userData?.stripeSubscriptionId && userData?.trialEndsAt && (() => {
        const endsAt = userData.trialEndsAt?.toDate ? userData.trialEndsAt.toDate() : new Date(userData.trialEndsAt);
        const daysLeft = Math.max(0, Math.ceil((endsAt - new Date()) / 86400000));
        const urgent = daysLeft <= 3;
        return (
          <div style={{ padding: "0 16px", marginBottom: "12px" }}>
            <Link to="/bundles" style={{ textDecoration: "none", display: "block" }}>
              <div style={{ background: urgent ? "linear-gradient(135deg, #b45309 0%, #92400e 100%)" : "linear-gradient(135deg, #1a3a2a 0%, #2d6a4f 100%)", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
                  {urgent ? "⏰" : "⭐"}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>
                    {daysLeft === 0 ? "Your Premium trial ends today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial`}
                  </p>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", margin: 0 }}>
                    Subscribe now to keep Premium access
                  </p>
                </div>
                <div style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff", fontSize: "12px", fontWeight: 700, padding: "6px 12px", borderRadius: "8px", flexShrink: 0, whiteSpace: "nowrap" }}>
                  €19.99 →
                </div>
              </div>
            </Link>
          </div>
        );
      })()}

      {/* BOOK SESSIONS / ONLINE COACHING CTAs -- shown to users who aren't already on an in-person/hybrid plan */}
      {walletBalance === null && (() => {
        // Resolve effective tier (check legacy subscription field as fallback)
        const sub = userData?.subscription ?? "";
        const effectiveTier = tier !== "free" ? tier
          : sub === "online" ? "online"
          : sub === "hybrid" ? "hybrid"
          : sub === "elite" ? "elite"
          : isPremium ? "premium"
          : "free";

        // At Elite, no upsell card needed
        if (effectiveTier === "elite") return null;

        const upsell = {
          free:    { emoji: "💻", title: "Upgrade your membership",      sub: "Premium app, online coaching, hybrid and more" },
          premium: { emoji: "💻", title: "Take your training further",    sub: "Online and hybrid coaching from €149/month" },
          premium_annual: { emoji: "💻", title: "Take your training further", sub: "Online and hybrid coaching from €149/month" },
          online:  { emoji: "🏋️", title: "Level up to Hybrid coaching",  sub: "Add optional in-person sessions for €249/month" },
          hybrid:  { emoji: "🏆", title: "Go Elite",                     sub: "Daily check-ins, fully managed results for €999/month" },
        }[effectiveTier] ?? { emoji: "💻", title: "Upgrade your membership", sub: "Premium app, online coaching, hybrid and more" };

        return (
          <div style={{ padding: "0 16px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link to="/bundles?tab=inperson" style={{ textDecoration: "none", display: "block" }}>
              <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
                  🏋️
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>Book sessions with Michael</p>
                  <p style={{ fontSize: "12px", color: "#9fe1cb", margin: 0 }}>1:1 in-person training in South Dublin</p>
                </div>
                <div style={{ fontSize: "18px", color: "#9fe1cb", flexShrink: 0 }}>→</div>
              </div>
            </Link>
            <Link to="/bundles" style={{ textDecoration: "none", display: "block" }}>
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "14px", border: "1.5px solid #e5e5e5" }}>
                <div style={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
                  {upsell.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a3a2a", margin: "0 0 2px" }}>{upsell.title}</p>
                  <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>{upsell.sub}</p>
                </div>
                <div style={{ fontSize: "18px", color: "#2d6a4f", flexShrink: 0 }}>→</div>
              </div>
            </Link>
          </div>
        );
      })()}

      {/* SESSION CREDITS + NEXT SESSION */}
      {walletBalance !== null && (
        <div style={{ padding: "0 16px", marginBottom: "12px" }}>
          <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              {/* Credit balance */}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Session Credits</p>
                <p style={{ fontSize: "32px", fontWeight: 700, color: walletBalance <= 2 ? "#f87171" : "#fff", lineHeight: 1, margin: "0 0 4px" }}>
                  {walletBalance}
                </p>
                <p style={{ fontSize: "12px", color: walletBalance <= 2 ? "#f87171" : "#9fe1cb", margin: 0 }}>
                  {walletBalance === 0 ? "No credits remaining" : walletBalance === 1 ? "1 credit remaining" : `${walletBalance} credits remaining`}
                </p>
              </div>

              {/* Divider */}
              <div style={{ width: "1px", height: "60px", backgroundColor: "rgba(255,255,255,0.1)" }} />

              {/* Next session */}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Next Session</p>
                {nextSession ? (
                  <>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: "0 0 2px", lineHeight: 1.2 }}>
                      {(() => {
                        const d = nextSession.date?.toDate ? nextSession.date.toDate() : new Date(nextSession.date);
                        return d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
                      })()}
                    </p>
                    <p style={{ fontSize: "12px", color: "#9fe1cb", margin: 0 }}>
                      {(() => {
                        const d = nextSession.date?.toDate ? nextSession.date.toDate() : new Date(nextSession.date);
                        return d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
                      })()}
                      {" "}&middot;{" "}{nextSession.type}
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.3 }}>None booked yet</p>
                )}
              </div>
            </div>

            {/* Buy sessions CTA -- shown when credits are low */}
            {walletBalance <= 2 && (
              <Link
                to="/bundles?tab=inperson"
                style={{
                  display: "block",
                  marginTop: "14px",
                  padding: "12px",
                  background: walletBalance === 0 ? "#f87171" : "#2d6a4f",
                  borderRadius: "10px",
                  textAlign: "center",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                {walletBalance === 0 ? "Buy sessions to continue training →" : "Top up your sessions →"}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* NEXT CLASS CARD / DAY-OF BANNER */}
      {nextClass && (() => {
        const isToday = nextClass.date === new Date().toISOString().split("T")[0];
        const typeColors = {
          strength:     { icon: "🏋️", color: "#2d6a4f", bg: "#eaf5ef" },
          conditioning: { icon: "🔥", color: "#b45309", bg: "#fffbeb" },
          spin:         { icon: "🚴", color: "#0369a1", bg: "#e0f2fe" },
        };
        const t = typeColors[nextClass.type] || typeColors.strength;
        const dateLabel = isToday ? `Today · ${nextClass.time}` : new Date(nextClass.date + "T12:00:00").toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" }) + ` · ${nextClass.time}`;
        const inner = (
          <div style={{ padding: "0 16px", marginBottom: "12px" }}>
            {isToday ? (
              <div style={{ background: `linear-gradient(135deg, ${t.color} 0%, #1a3a2a 100%)`, borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>{t.icon}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>{nextClass.title}</p>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", margin: 0 }}>Today · {nextClass.time} · {nextClass.duration} min</p>
                </div>
                <div style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff", fontSize: "12px", fontWeight: 700, padding: "6px 12px", borderRadius: "8px", flexShrink: 0 }}>Go →</div>
              </div>
            ) : (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: t.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>{t.icon}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>Next Class</p>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{nextClass.title}</p>
                  <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>{dateLabel} · {nextClass.duration} min</p>
                </div>
                <Link to="/classes" style={{ backgroundColor: "#eaf5ef", color: "#2d6a4f", fontSize: "12px", fontWeight: 700, padding: "6px 12px", borderRadius: "8px", textDecoration: "none", flexShrink: 0 }}>All →</Link>
              </div>
            )}
          </div>
        );
        return nextClass.type === "strength" && isToday
          ? <Link key="next-class" to={`/class/${nextClass.id}`} style={{ textDecoration: "none", display: "block" }}>{inner}</Link>
          : <Link key="next-class" to="/classes" style={{ textDecoration: "none", display: "block" }}>{inner}</Link>;
      })()}

      {/* TODAY'S PLAN */}
      <div style={{ padding: "0 16px", marginTop: 4 }}>
        <p style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>Today's Plan</p>

        {weekComplete ? (
          <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "28px" }}>🎉</span>
            <div>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: 0 }}>Week complete!</p>
              <p style={{ fontSize: "12px", color: "#9fe1cb", margin: "3px 0 0" }}>You've hit all {TOTAL_TARGET} sessions. Rest up.</p>
            </div>
          </div>
        ) : todayWorkout && todayProgramme ? (
          <Link to={`/programme/${todayProgramme.id}/${todayWorkout.weekId}/${todayWorkout.id}`} style={{ textDecoration: "none", display: "block" }}>
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 3px" }}>
                  {strengthRemaining > 0 ? "Strength" : "Cardio"} · {todayProgramme.name}
                </p>
                <p style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{todayWorkout.displayName || todayWorkout.name}</p>
                <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
                  {todayWorkout.exercises?.length || 0} exercises{todayWorkout.estimatedTime ? ` · ${todayWorkout.estimatedTime} min` : ""}
                </p>
              </div>
              <div style={{ backgroundColor: "#2d6a4f", color: "#fff", borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap", marginLeft: "12px" }}>Start</div>
            </div>
          </Link>
        ) : userData && !userData.strengthProgrammeId && !userData.cardioProgrammeId ? (
          <Link to="/training" style={{ textDecoration: "none", display: "block" }}>
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1.5px dashed #e5e5e5", padding: "16px", textAlign: "center" }}>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Pick your first programme</p>
              <p style={{ fontSize: "13px", color: "#888", margin: "0 0 10px" }}>Your workouts will appear here once you choose a programme. Takes 30 seconds.</p>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f" }}>Choose a programme →</span>
            </div>
          </Link>
        ) : (
          <Link to="/training" style={{ textDecoration: "none", display: "block" }}>
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>Your plan is ready</p>
                <p style={{ fontSize: "12px", color: "#888", margin: "3px 0 0" }}>Tap to open Training</p>
              </div>
              <div style={{ backgroundColor: "#2d6a4f", color: "#fff", borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: 700 }}>Training →</div>
            </div>
          </Link>
        )}
      </div>

      {/* CAPABILITY SCORE CARD */}
      <div style={{ padding: "16px 16px 0" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>Capability Score</p>

        {!capabilityScore ? (
          /* NO SCORE YET -- big prompt */
          <Link to="/capability-score" style={{ textDecoration: "none", display: "block" }}>
            <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "24px 20px", textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎯</div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>2 minute assessment</p>
              <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 8px", lineHeight: 1.2 }}>Find out your Capability Score</h2>
              <p style={{ fontSize: "14px", color: "#9fe1cb", margin: "0 0 20px", lineHeight: 1.6 }}>
                Get your personalised strength and fitness standards based on your age, weight and goals.
              </p>
              <div style={{ backgroundColor: "#2d6a4f", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, color: "#fff" }}>
                Take the Assessment →
              </div>
            </div>
          </Link>
        ) : (
          /* HAS SCORE */
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "12px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontSize: "48px", fontWeight: 700, color: "#2d6a4f", lineHeight: 1 }}>{capabilityScore}</span>
                  <span style={{ fontSize: "16px", color: "#aaa" }}>/ 65</span>
                </div>
                <span style={{ backgroundColor: "#eaf5ef", color: "#2d6a4f", fontSize: "13px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", display: "inline-block", marginTop: "6px" }}>
                  {category}
                </span>
              </div>
              <button onClick={() => setShowScoreModal(true)} style={{ background: "none", border: "none", fontSize: "12px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer", padding: 0 }}>
                {allScores.length > 1 ? "View history →" : "Retake →"}
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

            <p style={{ fontSize: "13px", color: "#aaa", margin: "12px 0 0" }}>
              Last assessed: {new Date(assessmentDate).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        )}
      </div>

      {/* NEW USER — single action card */}
      {totalLogCount === 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", borderRadius: "20px", padding: "24px 20px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 6px" }}>Welcome to Training for Life</p>
            <p style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: "0 0 8px", lineHeight: 1.25 }}>
              Your training starts here, {firstName || "let's go"}.
            </p>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", margin: "0 0 20px", lineHeight: 1.5 }}>
              Pick a programme and log your first session. Everything else follows from that.
            </p>
            <Link to="/training" style={{ display: "block", textAlign: "center", backgroundColor: "#4ade80", color: "#1a3a2a", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, textDecoration: "none" }}>
              Pick your first programme →
            </Link>
          </div>
        </div>
      )}

      {/* LAPSED USER NUDGE — 3+ days since last workout */}
      {(() => {
        if (nudgeDismissed || totalLogCount === 0 || totalLogCount === null) return null;
        if (!lastLog?.completedAt) return null;
        const daysSince = Math.floor((Date.now() - new Date(lastLog.completedAt)) / 86400000);
        if (daysSince < 3) return null;
        return (
          <div style={{ padding: "0 16px 12px" }}>
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "22px", flexShrink: 0 }}>⏰</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>
                  {daysSince} days since your last session
                </p>
                <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>Ready to get back at it?</p>
              </div>
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                <button
                  onClick={() => { sessionStorage.setItem("tfl_nudge_dismissed", "1"); setNudgeDismissed(true); }}
                  style={{ background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "4px 8px", fontWeight: 600 }}
                >
                  Dismiss
                </button>
                <Link to="/training" style={{ backgroundColor: "#2d6a4f", color: "#fff", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, textDecoration: "none" }}>
                  Train →
                </Link>
              </div>
            </div>
          </div>
        );
      })()}

      {/* WEEKLY */}
      {totalLogCount !== 0 && (
      <div style={{ padding: "16px 16px 0" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>This Week</p>
        <div style={{ background: "#1a3a2a", borderRadius: "20px", padding: "18px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>
                {streakWeeks > 0 ? "Weekly Streak" : "This Week"}
              </p>
              <p style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 2px", lineHeight: 1 }}>
                {streakWeeks > 0 ? `🔥 ${streakWeeks} ${streakWeeks === 1 ? "week" : "weeks"}` : `${totalDone} / ${TOTAL_TARGET}`}
              </p>
              <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
                {weekComplete ? "Perfect week. Well done."
                  : strengthRemaining > 0 ? `${strengthRemaining} more strength session${strengthRemaining > 1 ? "s" : ""} needed`
                  : cardioRemaining > 0 ? `${cardioRemaining} more cardio session${cardioRemaining > 1 ? "s" : ""} needed`
                  : `${TOTAL_TARGET - totalDone} sessions to go`}
              </p>
            </div>

            <div style={{ position: "relative", width: 72, height: 72 }}>
              <svg style={{ width: 72, height: 72, transform: "rotate(-90deg)", display: "block" }} viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6"/>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#4ade80" strokeWidth="6" strokeLinecap="round" strokeDasharray="213" strokeDashoffset={213 - (213 * Math.min(weeklyDone.strength / WEEKLY_TARGETS.strength, 1))}/>
                <circle cx="40" cy="40" r="25" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6"/>
                <circle cx="40" cy="40" r="25" fill="none" stroke="#34d399" strokeWidth="6" strokeLinecap="round" strokeDasharray="157" strokeDashoffset={157 - (157 * Math.min(weeklyDone.cardio / WEEKLY_TARGETS.cardio, 1))}/>
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", lineHeight: 1 }}>{totalDone}/{TOTAL_TARGET}</div>
                  <div style={{ fontSize: "8px", color: "#9fe1cb", fontWeight: 600 }}>done</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { icon: "🏋️", label: "Strength", done: weeklyDone.strength, target: WEEKLY_TARGETS.strength },
              { icon: "🏃", label: "Cardio", done: weeklyDone.cardio, target: WEEKLY_TARGETS.cardio },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px" }}>{item.icon}</span>
                  <span style={{ fontSize: "13px", color: item.done >= item.target ? "#c5e8d8" : "rgba(255,255,255,0.7)", fontWeight: item.done >= item.target ? 700 : 400 }}>
                    {item.label}
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
      )}

      {/* QUICK ACTIONS */}
      <div style={{ padding: "16px 16px 0", display: "flex", gap: "10px" }}>
        <Link to="/capability-score" style={{ flex: 1, backgroundColor: "#fff", border: "0.5px solid #e5e5e5", borderRadius: "12px", padding: "12px", textAlign: "center", fontSize: "13px", fontWeight: 700, color: "#2d6a4f", textDecoration: "none" }}>
          {capabilityScore ? "Retake Assessment" : "Take Assessment"}
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
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>
              {allScores.length > 1 ? `${allScores.length} assessments completed` : "Reassess every 30 days to track progress"}
            </p>

            {allScores.length > 1 ? (
              /* REAL HISTORY GRAPH */
              <div style={{ background: "#f7f5f2", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
                <svg viewBox="0 0 300 120" width="100%" style={{ display: "block", overflow: "visible" }}>
                  {(() => {
                    const vals = allScores.map(s => s.capabilityScore);
                    const minV = Math.min(...vals);
                    const maxV = Math.max(...vals);
                    const range = maxV - minV || 1;
                    const coords = vals.map((v, i) => ({
                      x: 16 + (i / (vals.length - 1)) * 268,
                      y: 100 - ((v - minV) / range) * 80,
                      v,
                      date: allScores[i].assessmentDate,
                    }));
                    const pts = coords.map(c => `${c.x},${c.y}`).join(" ");
                    const fillPts = `${coords[0].x},110 ${pts} ${coords[coords.length - 1].x},110`;
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
                  {allScores.map((s, i) => (
                    <span key={i} style={{ fontSize: "10px", color: "#aaa", fontWeight: 600, flex: 1, textAlign: "center" }}>
                      {new Date(s.assessmentDate).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              /* ONLY ONE SCORE -- show current + prompt to retest */
              <div style={{ background: "#f7f5f2", borderRadius: "12px", padding: "20px", marginBottom: "16px", textAlign: "center" }}>
                <p style={{ fontSize: "48px", fontWeight: 700, color: "#2d6a4f", margin: "0 0 4px", lineHeight: 1 }}>{capabilityScore}</p>
                <p style={{ fontSize: "14px", color: "#888", margin: "0 0 4px" }}>{category}</p>
                <p style={{ fontSize: "12px", color: "#aaa", margin: 0 }}>
                  Assessed {new Date(assessmentDate).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                <p style={{ fontSize: "12px", color: "#aaa", margin: "12px 0 0" }}>Retake in 30 days to see your progress graph</p>
              </div>
            )}

            <Link to="/capability-score" onClick={() => setShowScoreModal(false)} style={{ display: "block", textAlign: "center", background: "#2d6a4f", color: "#fff", borderRadius: "12px", padding: "13px", fontSize: "14px", fontWeight: 700, textDecoration: "none" }}>
              {capabilityScore ? "Retake Assessment" : "Take Assessment"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
