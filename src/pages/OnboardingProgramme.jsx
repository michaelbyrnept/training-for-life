import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";

const GOAL_COPY = {
  strength:     { headline: "Your strength programme is ready", sub: "Built around progressive overload to make you noticeably stronger over the next 8 weeks." },
  fitness:      { headline: "Your fitness programme is ready", sub: "3 sessions a week designed to improve your endurance, conditioning, and overall capability." },
  independence: { headline: "Your movement programme is ready", sub: "Functional strength and mobility work to keep you moving well for life." },
  confidence:   { headline: "Your training programme is ready", sub: "A structured plan that builds real physical capability and the confidence that comes with it." },
};

const DEFAULT_COPY = {
  headline: "Your programme is ready",
  sub: "A structured 3-day training programme to build strength and capability.",
};

const PROGRAMME_HIGHLIGHTS = [
  { icon: "📅", label: "3 sessions per week", sub: "Monday, Wednesday, Friday or any 3 days that suit you" },
  { icon: "🏋️", label: "Free weights and machines", sub: "The best of both -- swap exercises if you need to" },
  { icon: "📈", label: "Progressive overload built in", sub: "Each week builds on the last so you keep making gains" },
  { icon: "🆓", label: "100% free", sub: "No subscription needed to get started" },
];

export default function OnboardingProgramme() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [programme, setProgramme] = useState(null);
  const [userGoal, setUserGoal] = useState("");
  const [starting, setStarting] = useState(false);
  const [uid, setUid] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate("/login"); return; }
      setUid(user.uid);
      try {
        // Load user goal
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) setUserGoal(userSnap.data().goal || "");

        // Load the onboarding-recommended programme
        const progSnap = await getDocs(
          query(collection(db, "programmes"), where("onboardingRecommended", "==", true))
        );
        if (!progSnap.empty) {
          setProgramme({ id: progSnap.docs[0].id, ...progSnap.docs[0].data() });
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const copy = GOAL_COPY[userGoal] || DEFAULT_COPY;

  async function startProgramme() {
    if (!uid || !programme) return;
    setStarting(true);
    try {
      await updateDoc(doc(db, "users", uid), { programmeId: programme.id });
      navigate(`/programme/${programme.id}`);
    } catch (e) {
      console.error(e);
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9fe1cb", fontSize: "15px" }}>Loading...</p>
      </div>
    );
  }

  // No recommended programme set yet -- go straight to dashboard
  if (!programme) {
    navigate("/dashboard");
    return null;
  }

  const weekCount = programme.weeks?.length || 0;
  const workoutCount = programme.weeks?.reduce((sum, w) => sum + (w.workouts?.length || 0), 0) || 0;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", display: "flex", flexDirection: "column", padding: "0 0 40px" }}>

      {/* TOP SECTION */}
      <div style={{ padding: "56px 24px 32px", textAlign: "center" }}>
        <div style={{ fontSize: "52px", marginBottom: "16px" }}>🏋️</div>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 10px" }}>
          Training for Life
        </p>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 10px", lineHeight: 1.2 }}>
          {copy.headline}
        </h1>
        <p style={{ fontSize: "15px", color: "#9fe1cb", margin: 0, lineHeight: 1.6, maxWidth: "320px", marginLeft: "auto", marginRight: "auto" }}>
          {copy.sub}
        </p>
      </div>

      {/* PROGRAMME CARD */}
      <div style={{ margin: "0 16px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "20px", padding: "20px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
          <div>
            <p style={{ fontSize: "17px", fontWeight: 700, color: "#fff", margin: "0 0 3px" }}>{programme.name}</p>
            {programme.description && (
              <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0, lineHeight: 1.5 }}>{programme.description}</p>
            )}
          </div>
          {programme.tag && (
            <div style={{ backgroundColor: "#9fe1cb", color: "#1a3a2a", fontSize: "10px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px", flexShrink: 0, marginLeft: "10px" }}>
              {programme.tag}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {[
            weekCount > 0 && `${weekCount} ${weekCount === 1 ? "week" : "weeks"}`,
            workoutCount > 0 && `${workoutCount} ${workoutCount === 1 ? "session" : "sessions"}`,
            programme.level,
          ].filter(Boolean).map(stat => (
            <div key={stat} style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "8px", padding: "5px 10px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", margin: 0 }}>{stat}</p>
            </div>
          ))}
        </div>
      </div>

      {/* HIGHLIGHTS */}
      <div style={{ margin: "0 16px 24px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {PROGRAMME_HIGHLIGHTS.map(h => (
          <div key={h.label} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: 40, height: 40, borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
              {h.icon}
            </div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0 }}>{h.label}</p>
              <p style={{ fontSize: "12px", color: "#9fe1cb", margin: "1px 0 0" }}>{h.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <button
          onClick={startProgramme}
          disabled={starting}
          style={{ width: "100%", backgroundColor: "#fff", color: "#1a3a2a", border: "none", borderRadius: "14px", padding: "18px", fontSize: "16px", fontWeight: 700, cursor: starting ? "not-allowed" : "pointer", opacity: starting ? 0.8 : 1 }}>
          {starting ? "Setting up..." : "Start Programme"}
        </button>
        <button
          onClick={() => navigate("/dashboard")}
          style={{ background: "none", border: "none", color: "#9fe1cb", fontSize: "14px", cursor: "pointer", padding: "10px" }}>
          Explore the app first
        </button>
      </div>
    </div>
  );
}
