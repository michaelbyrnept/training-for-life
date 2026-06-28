import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, auth } from "../firebase";

const PREMIUM_PRICE_ID = "price_1Tn3fsPojX8gToKVeUfENsCZ";

const PREMIUM_FEATURES = [
  { icon: "🏋️", label: "Custom workout builder", sub: "Build and save your own workouts" },
  { icon: "📋", label: "Custom training programmes", sub: "Design multi-week plans and follow them week by week" },
  { icon: "🔗", label: "Strava sync", sub: "Activities auto-count toward your 6/week target" },
  { icon: "🏆", label: "Personal bests tracking", sub: "Beat your records, see your progress over time" },
  { icon: "📊", label: "Unlimited training history", sub: "Every session logged, forever" },
];

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
  const [showPremium, setShowPremium] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

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
      setShowPremium(true);
    } catch (e) {
      console.error(e);
    }
    setStarting(false);
  }

  async function handleUpgrade() {
    setCheckingOut(true);
    try {
      const fns = getFunctions(undefined, "us-central1");
      const createCheckoutSession = httpsCallable(fns, "createCheckoutSession");
      const origin = window.location.origin;
      const { data } = await createCheckoutSession({
        type: "subscription",
        priceId: PREMIUM_PRICE_ID,
        successUrl: `${origin}/subscription/success`,
        cancelUrl: `${origin}/dashboard`,
      });
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      console.error(e);
      setCheckingOut(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9fe1cb", fontSize: "15px" }}>Loading...</p>
      </div>
    );
  }

  // No recommended programme set yet -- skip straight to premium upsell
  if (!programme && !loading) {
    if (showPremium) {
      return <PremiumUpsell onUpgrade={handleUpgrade} onSkip={() => navigate("/dashboard")} checkingOut={checkingOut} />;
    }
    navigate("/dashboard");
    return null;
  }

  if (showPremium) {
    return <PremiumUpsell onUpgrade={handleUpgrade} onSkip={() => navigate("/dashboard")} checkingOut={checkingOut} />;
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
          onClick={() => setShowPremium(true)}
          style={{ background: "none", border: "none", color: "#9fe1cb", fontSize: "14px", cursor: "pointer", padding: "10px" }}>
          Explore the app first
        </button>
      </div>
    </div>
  );
}

// ─── Premium Upsell Screen (inserted between programme and dashboard) ──────────

function PremiumUpsell({ onUpgrade, onSkip, checkingOut }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "52px 24px 32px", textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>
          One last thing
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 8px", lineHeight: 1.2 }}>
          Unlock the full app
        </h1>
        <p style={{ fontSize: 15, color: "#9fe1cb", margin: 0, lineHeight: 1.6 }}>
          Your free programme is set up. Premium gives you tools to train completely on your own terms.
        </p>
      </div>

      <div style={{ padding: "24px 16px", flex: 1 }}>
        {/* Features */}
        <div style={{ backgroundColor: "#fff", borderRadius: 20, padding: "20px", marginBottom: 20, border: "0.5px solid #e5e5e5" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {PREMIUM_FEATURES.map((f) => (
              <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {f.icon}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{f.label}</p>
                  <p style={{ fontSize: 13, color: "#888", margin: 0 }}>{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Price callout */}
        <div style={{ backgroundColor: "#1a3a2a", borderRadius: 16, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 13, color: "#9fe1cb", margin: "0 0 2px", fontWeight: 600 }}>Premium</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>€19.99 <span style={{ fontSize: 13, fontWeight: 500, color: "#9fe1cb" }}>/ 4 weeks</span></p>
          </div>
          <p style={{ fontSize: 12, color: "#9fe1cb", margin: 0, textAlign: "right", lineHeight: 1.5 }}>Cancel<br />anytime</p>
        </div>

        {/* CTAs */}
        <button
          onClick={onUpgrade}
          disabled={checkingOut}
          style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: 14, padding: "17px", fontSize: 16, fontWeight: 700, cursor: checkingOut ? "not-allowed" : "pointer", opacity: checkingOut ? 0.7 : 1, marginBottom: 12 }}
        >
          {checkingOut ? "Opening checkout..." : "Upgrade to Premium"}
        </button>
        <button
          onClick={onSkip}
          style={{ width: "100%", background: "none", border: "none", color: "#aaa", fontSize: 14, cursor: "pointer", padding: "10px" }}
        >
          No thanks, start for free
        </button>
      </div>
    </div>
  );
}

