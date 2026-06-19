import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, addDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import PortalNav from "../components/PortalNav";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

const GOALS = [
  { id: "fitness", label: "Improve my fitness", sub: "No specific race -- just get fitter", icon: "❤️", treatAs: "10k" },
  { id: "5k", label: "Improve my 5k time", sub: "Get faster over 5 kilometres", icon: "🏃", treatAs: "5k" },
  { id: "10k", label: "Run a 10k", sub: "Build up to 10 kilometres", icon: "🏅", treatAs: "10k" },
  { id: "half", label: "Run a half marathon", sub: "21.1km -- a serious achievement", icon: "🎽", treatAs: "half" },
  { id: "marathon", label: "Run a marathon", sub: "42.2km -- the ultimate goal", icon: "🏆", treatAs: "marathon" },
];

const DAYS_OPTIONS = [3, 4, 5, 6];

const STEPS = [
  { id: "goal", title: "What's your running goal?" },
  { id: "current5k", title: "What's your current 5k time?" },
  { id: "mileage", title: "How many km do you run per week currently?" },
  { id: "days", title: "How many days per week can you run?" },
  { id: "raceDate", title: "Do you have a target race date?" },
  { id: "injuries", title: "Any injuries or limitations?" },
  { id: "generating", title: "Generating your plan..." },
];

function formatTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export default function AIRunningPlan() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    goal: "",
    current5kMinutes: 30,
    current5kSeconds: 0,
    weeklyKm: 10,
    daysPerWeek: 3,
    hasRaceDate: false,
    raceDate: "",
    injuries: "",
  });
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) setUserData(snap.data());
    });
    return () => unsub();
  }, [navigate]);

  const isPremium = userData?.subscription === "premium" || userData?.subscription === "hybrid" || userData?.subscription === "in-person";

  const selectedGoal = GOALS.find(g => g.id === form.goal);
  const treatAs = selectedGoal?.treatAs || "10k";

  const current5kFormatted = `${form.current5kMinutes}:${String(form.current5kSeconds).padStart(2, "0")}`;

  const generatePlan = async () => {
    setGenerating(true);
    setError("");

    const raceInfo = form.hasRaceDate && form.raceDate
      ? `Target race date: ${new Date(form.raceDate).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}.`
      : "No specific race date -- build a 12 week base programme.";

    const goalLabel = selectedGoal?.label || "improve fitness";
    const treatAsLabel = treatAs === "5k" ? "5k" : treatAs === "10k" ? "10k" : treatAs === "half" ? "half marathon" : "marathon";

    const prompt = `You are an expert running coach with deep knowledge of the Daniels Running Formula, 80/20 training principles, and Hansons Method.

Create a personalised running programme for this athlete:

GOAL: ${goalLabel} (train as a ${treatAsLabel} programme)
CURRENT 5K TIME: ${current5kFormatted} min:sec
WEEKLY MILEAGE: ${form.weeklyKm}km per week currently
DAYS PER WEEK: ${form.daysPerWeek} days
${raceInfo}
INJURIES/LIMITATIONS: ${form.injuries || "None"}

TRAINING PRINCIPLES TO FOLLOW:
- 80% of runs at easy/conversational pace (zone 2, can hold a conversation)
- 20% quality work (intervals, tempo, race pace efforts)
- Never increase weekly mileage more than 10% per week
- Include a proper taper in the final 2 weeks
- Progress from base building → development → peak → taper
- Easy runs should feel genuinely easy -- most people run them too fast

Create a week by week programme. For each week provide:
- Week number and phase (Base/Development/Peak/Taper)
- Total weekly km
- Each session for the ${form.daysPerWeek} running days with:
  - Session type (Easy/Intervals/Tempo/Long Run)
  - Distance or duration
  - Pace guidance
  - Brief coaching note

Respond ONLY in this exact JSON format, no other text:
{
  "title": "Programme name",
  "weeks": [
    {
      "weekNumber": 1,
      "phase": "Base",
      "totalKm": 20,
      "sessions": [
        {
          "day": "Tuesday",
          "type": "Easy Run",
          "distance": "5km",
          "pace": "Conversational pace, zone 2",
          "note": "Keep it easy, you should be able to hold a full conversation"
        }
      ]
    }
  ],
  "coachingNotes": "2-3 sentences of overall coaching advice for this athlete"
}`;
try {
const generateRunningPlan = httpsCallable(functions, "generateRunningPlan");
      const result = await generateRunningPlan({ prompt });

      const text = result.data.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const jsonStart = clean.indexOf("{");
      const jsonEnd = clean.lastIndexOf("}");
      const jsonStr = clean.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr);
      setPlan(parsed);
      setStep(7);
    } catch (e) {
      console.error(e);
      setError("Something went wrong generating your plan. Please try again.");
    }
    setGenerating(false);
  };

  const savePlan = async () => {
    if (!user || !plan) return;
    setSaving(true);
    try {
      // Save plan to Firestore
      await setDoc(doc(db, "runningPlans", user.uid), {
        userId: user.uid,
        plan,
        goal: form.goal,
        treatAs,
        current5k: current5kFormatted,
        weeklyKm: form.weeklyKm,
        daysPerWeek: form.daysPerWeek,
        raceDate: form.raceDate || null,
        createdAt: new Date().toISOString(),
      });
      setSaved(true);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

 // Temporarily disabled while we finish the server-side rewrite
  if (true) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0d2b1f 0%, #1a3a2a 60%, #2d6a4f 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
        <PortalNav />
        <div style={{ maxWidth: "360px" }}>
          <div style={{ fontSize: "56px", marginBottom: "16px" }}>🛠️</div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 12px", lineHeight: 1.2 }}>AI Running Plan</h1>
          <p style={{ fontSize: "15px", color: "#9fe1cb", margin: "0 0 32px", lineHeight: 1.6 }}>
            We're making some improvements to this feature. Check back soon.
          </p>
          <Link to="/training" style={{ display: "block", backgroundColor: "#fff", color: "#1a3a2a", fontSize: "15px", fontWeight: 700, padding: "15px 28px", borderRadius: "14px", textDecoration: "none" }}>
            ← Back to Training
          </Link>
        </div>
      </div>
    );
  }

  // Locked for free users
  if (userData && !isPremium) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0d2b1f 0%, #1a3a2a 60%, #2d6a4f 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
        <PortalNav />
        <div style={{ maxWidth: "360px" }}>
          <div style={{ fontSize: "56px", marginBottom: "16px" }}>🤖</div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 12px" }}>Premium Feature</p>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 12px", lineHeight: 1.2 }}>AI Running Plan</h1>
          <p style={{ fontSize: "15px", color: "#9fe1cb", margin: "0 0 32px", lineHeight: 1.6 }}>
            Get a personalised running programme built around your goals, current fitness and race date. Powered by coaching science.
          </p>
          <Link to="/training" style={{ display: "block", backgroundColor: "#fff", color: "#1a3a2a", fontSize: "15px", fontWeight: 700, padding: "15px 28px", borderRadius: "14px", textDecoration: "none" }}>
            Upgrade to Premium →
          </Link>
        </div>
      </div>
    );
  }

  // Plan view
  if (plan && step === 7) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "120px" }}>
        <PortalNav />
        <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "20px 20px 40px" }}>
          <Link to="/training" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>← Training</Link>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "16px 0 4px" }}>{plan.title}</h1>
          <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>{plan.weeks?.length} weeks · {form.daysPerWeek} runs/week</p>
        </div>
        <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

        <div style={{ padding: "0 16px" }}>
          {/* Coaching notes */}
          {plan.coachingNotes && (
            <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "16px", marginBottom: "16px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Coach's Note</p>
              <p style={{ fontSize: "14px", color: "#fff", margin: 0, lineHeight: 1.6 }}>{plan.coachingNotes}</p>
            </div>
          )}

          {/* Save button */}
          {!saved ? (
            <button onClick={savePlan} disabled={saving} style={{ width: "100%", backgroundColor: saving ? "#aaa" : "#2d6a4f", color: "#fff", border: "none", borderRadius: "14px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "16px" }}>
              {saving ? "Saving..." : "Save Plan to My Training →"}
            </button>
          ) : (
            <div style={{ backgroundColor: "#eaf5ef", borderRadius: "14px", padding: "14px", marginBottom: "16px", textAlign: "center" }}>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>✓ Plan saved to your training</p>
            </div>
          )}

          {/* Weeks */}
          {plan.weeks?.map(week => (
            <div key={week.weekNumber} style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <div>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>Week {week.weekNumber}</p>
                  <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>{week.phase}</p>
                </div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "4px 10px", borderRadius: "20px" }}>{week.totalKm}km</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {week.sessions?.map((session, i) => {
                  const typeColor = session.type?.includes("Easy") ? "#2d6a4f" : session.type?.includes("Interval") ? "#dc2626" : session.type?.includes("Tempo") ? "#b45309" : "#0369a1";
                  const typeBg = session.type?.includes("Easy") ? "#eaf5ef" : session.type?.includes("Interval") ? "#fef2f2" : session.type?.includes("Tempo") ? "#fffbeb" : "#e0f2fe";
                  return (
                    <div key={i} style={{ backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                        <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: 0 }}>{session.day}</p>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: typeColor, backgroundColor: typeBg, padding: "2px 8px", borderRadius: "10px" }}>{session.type}</span>
                      </div>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{session.distance}</p>
                      <p style={{ fontSize: "12px", color: "#888", margin: "0 0 2px" }}>{session.pace}</p>
                      {session.note && <p style={{ fontSize: "11px", color: "#aaa", margin: 0, fontStyle: "italic" }}>{session.note}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button onClick={() => { setStep(0); setPlan(null); setSaved(false); }} style={{ width: "100%", background: "none", border: "1.5px solid #e5e5e5", borderRadius: "14px", padding: "14px", fontSize: "14px", fontWeight: 700, color: "#888", cursor: "pointer" }}>
            Generate a new plan
          </button>
        </div>
      </div>
    );
  }

  // Generating screen
  if (generating || step === 6) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0d2b1f 0%, #1a3a2a 60%, #2d6a4f 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "20px", animation: "spin 2s linear infinite" }}>🤖</div>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 12px" }}>Building your plan...</h2>
        <p style={{ fontSize: "14px", color: "#9fe1cb", margin: "0 0 8px", lineHeight: 1.6, maxWidth: "300px" }}>Analysing your fitness, goal and timeline. Applying coaching science.</p>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: 0 }}>This takes about 15 seconds</p>
        {error && (
          <div style={{ marginTop: "20px", backgroundColor: "rgba(220,38,38,0.2)", borderRadius: "12px", padding: "14px", maxWidth: "320px" }}>
            <p style={{ fontSize: "13px", color: "#f87171", margin: "0 0 10px" }}>{error}</p>
            <button onClick={() => { setStep(5); setError(""); }} style={{ backgroundColor: "#fff", color: "#1a3a2a", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Try again</button>
          </div>
        )}
      </div>
    );
  }

  // Intake form
  const progress = ((step + 1) / 6) * 100;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0d2b1f 0%, #1a3a2a 60%, #2d6a4f 100%)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/training" style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none" }}>← Training</Link>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontWeight: 600, margin: 0 }}>{step + 1} of 6</p>
      </div>

      <div style={{ margin: "14px 20px 0", height: "3px", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: "2px" }}>
        <div style={{ height: "3px", backgroundColor: "#4ade80", borderRadius: "2px", width: `${progress}%`, transition: "width 0.3s ease" }} />
      </div>

      <div style={{ flex: 1, padding: "32px 24px 40px", maxWidth: "520px", margin: "0 auto", width: "100%" }}>

        {/* Step 0 -- Goal */}
        {step === 0 && (
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 8px" }}>AI Running Plan</p>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 6px", lineHeight: 1.3 }}>What's your running goal?</h2>
            <p style={{ fontSize: "14px", color: "#9fe1cb", margin: "0 0 24px" }}>We'll build your plan around this.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {GOALS.map(g => (
                <div key={g.id} onClick={() => { setForm(f => ({ ...f, goal: g.id })); setTimeout(() => setStep(1), 200); }}
                  style={{ backgroundColor: form.goal === g.id ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)", borderRadius: "14px", border: `1.5px solid ${form.goal === g.id ? "#4ade80" : "rgba(255,255,255,0.1)"}`, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "24px" }}>{g.icon}</span>
                  <div>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: 0 }}>{g.label}</p>
                    <p style={{ fontSize: "12px", color: "#9fe1cb", margin: "2px 0 0" }}>{g.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1 -- Current 5k time */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 6px", lineHeight: 1.3 }}>What's your current 5k time?</h2>
            <p style={{ fontSize: "14px", color: "#9fe1cb", margin: "0 0 24px" }}>Be honest -- this helps us set the right paces. If you've never run a 5k, give your best estimate.</p>
            <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Minutes</p>
                <input type="number" value={form.current5kMinutes} onChange={e => setForm(f => ({ ...f, current5kMinutes: Number(e.target.value) }))} min="15" max="60" style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "1.5px solid rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.08)", fontSize: "28px", fontWeight: 700, color: "#fff", outline: "none", textAlign: "center", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", paddingTop: "28px", color: "#fff", fontSize: "24px", fontWeight: 700 }}>:</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Seconds</p>
                <input type="number" value={form.current5kSeconds} onChange={e => setForm(f => ({ ...f, current5kSeconds: Number(e.target.value) }))} min="0" max="59" style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "1.5px solid rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.08)", fontSize: "28px", fontWeight: 700, color: "#fff", outline: "none", textAlign: "center", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
              {[["20:00", 20, 0], ["25:00", 25, 0], ["30:00", 30, 0], ["35:00", 35, 0], ["40:00", 40, 0]].map(([label, mins, secs]) => (
                <div key={label} onClick={() => setForm(f => ({ ...f, current5kMinutes: mins, current5kSeconds: secs }))} style={{ padding: "8px 14px", borderRadius: "20px", border: `1.5px solid ${form.current5kMinutes === mins ? "#4ade80" : "rgba(255,255,255,0.2)"}`, backgroundColor: form.current5kMinutes === mins ? "rgba(74,222,128,0.15)" : "transparent", fontSize: "13px", fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                  {label}
                </div>
              ))}
            </div>
            <button onClick={() => setStep(2)} style={{ width: "100%", backgroundColor: "#fff", color: "#1a3a2a", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>Continue →</button>
          </div>
        )}

        {/* Step 2 -- Weekly mileage */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 6px", lineHeight: 1.3 }}>How many km do you run per week?</h2>
            <p style={{ fontSize: "14px", color: "#9fe1cb", margin: "0 0 24px" }}>Roughly -- we'll build from wherever you are.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {[
                { label: "Just starting out", sub: "0-5km per week", value: 5 },
                { label: "Occasional runner", sub: "5-15km per week", value: 10 },
                { label: "Regular runner", sub: "15-30km per week", value: 25 },
                { label: "Experienced runner", sub: "30-50km per week", value: 40 },
                { label: "High mileage", sub: "50km+ per week", value: 55 },
              ].map(opt => (
                <div key={opt.value} onClick={() => setForm(f => ({ ...f, weeklyKm: opt.value }))} style={{ backgroundColor: form.weeklyKm === opt.value ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)", borderRadius: "12px", border: `1.5px solid ${form.weeklyKm === opt.value ? "#4ade80" : "rgba(255,255,255,0.1)"}`, padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0 }}>{opt.label}</p>
                    <p style={{ fontSize: "12px", color: "#9fe1cb", margin: "2px 0 0" }}>{opt.sub}</p>
                  </div>
                  {form.weeklyKm === opt.value && <span style={{ color: "#4ade80", fontSize: "18px" }}>✓</span>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setStep(1)} style={{ padding: "14px 20px", borderRadius: "12px", border: "1.5px solid rgba(255,255,255,0.2)", backgroundColor: "transparent", fontSize: "15px", fontWeight: 700, cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>←</button>
              <button onClick={() => setStep(3)} style={{ flex: 1, backgroundColor: "#fff", color: "#1a3a2a", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3 -- Days per week */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 6px", lineHeight: 1.3 }}>How many days per week can you run?</h2>
            <p style={{ fontSize: "14px", color: "#9fe1cb", margin: "0 0 24px" }}>Be realistic -- consistency beats ambition.</p>
            <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
              {DAYS_OPTIONS.map(d => (
                <div key={d} onClick={() => setForm(f => ({ ...f, daysPerWeek: d }))} style={{ flex: 1, backgroundColor: form.daysPerWeek === d ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)", borderRadius: "14px", border: `1.5px solid ${form.daysPerWeek === d ? "#4ade80" : "rgba(255,255,255,0.1)"}`, padding: "20px 8px", cursor: "pointer", textAlign: "center" }}>
                  <p style={{ fontSize: "28px", fontWeight: 700, color: form.daysPerWeek === d ? "#4ade80" : "#fff", margin: 0, lineHeight: 1 }}>{d}</p>
                  <p style={{ fontSize: "11px", color: "#9fe1cb", margin: "4px 0 0" }}>days</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setStep(2)} style={{ padding: "14px 20px", borderRadius: "12px", border: "1.5px solid rgba(255,255,255,0.2)", backgroundColor: "transparent", fontSize: "15px", fontWeight: 700, cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>←</button>
              <button onClick={() => setStep(4)} style={{ flex: 1, backgroundColor: "#fff", color: "#1a3a2a", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 4 -- Race date */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 6px", lineHeight: 1.3 }}>Do you have a target race date?</h2>
            <p style={{ fontSize: "14px", color: "#9fe1cb", margin: "0 0 24px" }}>If yes we'll build your plan to peak on race day. If not we'll build a 12 week base plan.</p>
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <div onClick={() => setForm(f => ({ ...f, hasRaceDate: false }))} style={{ flex: 1, backgroundColor: !form.hasRaceDate ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)", borderRadius: "12px", border: `1.5px solid ${!form.hasRaceDate ? "#4ade80" : "rgba(255,255,255,0.1)"}`, padding: "14px", cursor: "pointer", textAlign: "center" }}>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0 }}>No specific race</p>
                <p style={{ fontSize: "12px", color: "#9fe1cb", margin: "2px 0 0" }}>12 week base plan</p>
              </div>
              <div onClick={() => setForm(f => ({ ...f, hasRaceDate: true }))} style={{ flex: 1, backgroundColor: form.hasRaceDate ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)", borderRadius: "12px", border: `1.5px solid ${form.hasRaceDate ? "#4ade80" : "rgba(255,255,255,0.1)"}`, padding: "14px", cursor: "pointer", textAlign: "center" }}>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0 }}>Yes, I have a race</p>
                <p style={{ fontSize: "12px", color: "#9fe1cb", margin: "2px 0 0" }}>Plan to peak on race day</p>
              </div>
            </div>
            {form.hasRaceDate && (
              <input type="date" value={form.raceDate} onChange={e => setForm(f => ({ ...f, raceDate: e.target.value }))} min={new Date().toISOString().split("T")[0]} style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", border: "1.5px solid rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.08)", fontSize: "16px", color: "#fff", outline: "none", boxSizing: "border-box", marginBottom: "16px" }} />
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setStep(3)} style={{ padding: "14px 20px", borderRadius: "12px", border: "1.5px solid rgba(255,255,255,0.2)", backgroundColor: "transparent", fontSize: "15px", fontWeight: 700, cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>←</button>
              <button onClick={() => setStep(5)} disabled={form.hasRaceDate && !form.raceDate} style={{ flex: 1, backgroundColor: form.hasRaceDate && !form.raceDate ? "rgba(255,255,255,0.15)" : "#fff", color: form.hasRaceDate && !form.raceDate ? "rgba(255,255,255,0.3)" : "#1a3a2a", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 5 -- Injuries */}
        {step === 5 && (
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 6px", lineHeight: 1.3 }}>Any injuries or limitations?</h2>
            <p style={{ fontSize: "14px", color: "#9fe1cb", margin: "0 0 24px" }}>We'll work around anything you have. Leave blank if all good.</p>
            <textarea value={form.injuries} onChange={e => setForm(f => ({ ...f, injuries: e.target.value }))} placeholder="e.g. Left knee niggle, shin splints history... or leave blank" rows={4} style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1.5px solid rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.08)", fontSize: "15px", color: "#fff", outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.6, fontFamily: "inherit", marginBottom: "24px" }} onFocus={e => e.target.style.borderColor = "#4ade80"} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.2)"} />
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setStep(4)} style={{ padding: "14px 20px", borderRadius: "12px", border: "1.5px solid rgba(255,255,255,0.2)", backgroundColor: "transparent", fontSize: "15px", fontWeight: 700, cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>←</button>
              <button onClick={() => { setStep(6); generatePlan(); }} style={{ flex: 1, backgroundColor: "#4ade80", color: "#1a3a2a", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>
                Generate My Plan 🤖
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}