import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import PortalNav from "../components/PortalNav";

function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

const QUESTIONS = [
  { id: "training", label: "How did training feel this week?", type: "slider", min: 1, max: 10, lowLabel: "Terrible", highLabel: "Amazing" },
  { id: "energy", label: "How were your energy levels overall?", type: "slider", min: 1, max: 10, lowLabel: "Exhausted", highLabel: "Energised" },
  { id: "sleep", label: "How was your sleep quality?", type: "slider", min: 1, max: 10, lowLabel: "Poor", highLabel: "Excellent" },
  { id: "stress", label: "How were your stress levels?", type: "slider", min: 1, max: 10, lowLabel: "Very Stressed", highLabel: "Very Calm" },
  { id: "pain", label: "Any pain, niggles or injuries to flag?", type: "text", placeholder: "e.g. Left knee a bit sore after Tuesday's session... or None" },
  { id: "win", label: "What was your biggest win this week?", type: "text", placeholder: "e.g. Hit a new PB on deadlift, stayed consistent all week..." },
  { id: "struggle", label: "What did you struggle with?", type: "text", placeholder: "e.g. Missed Friday's session, nutrition was off..." },
  { id: "other", label: "Anything else you want me to know?", type: "text", placeholder: "Anything at all -- life stuff, questions, how you're feeling...", required: false },
];

function SliderQuestion({ question, value, onChange }) {
  const pct = ((value - question.min) / (question.max - question.min)) * 100;
  const getColor = (v) => {
    if (v <= 3) return "#dc2626";
    if (v <= 5) return "#b45309";
    if (v <= 7) return "#2d6a4f";
    return "#16a34a";
  };

  return (
    <div style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "14px", padding: "18px" }}>
      <p style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: "0 0 16px", lineHeight: 1.4 }}>{question.label}</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
        <span style={{ fontSize: "48px", fontWeight: 700, color: getColor(value), lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: "20px", color: "rgba(255,255,255,0.4)", marginLeft: "4px" }}>/10</span>
      </div>
      <input
        type="range"
        min={question.min}
        max={question.max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: getColor(value) }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{question.lowLabel}</span>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{question.highLabel}</span>
      </div>
    </div>
  );
}

export default function CheckIn() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ training: 7, energy: 7, sleep: 7, stress: 7, pain: "", win: "", struggle: "", other: "" });
  const [previousCheckIns, setPreviousCheckIns] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);
      const snap = await getDocs(query(collection(db, "checkIns"), where("userId", "==", u.uid)));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      setPreviousCheckIns(data);

      // Mark replies as read
      data.filter(c => c.coachReply && !c.replyRead).forEach(async c => {
        await updateDoc(doc(db, "checkIns", c.id), { replyRead: true });
      });
    });
    return () => unsub();
  }, [navigate]);

  const currentQ = QUESTIONS[step];
  const isSlider = currentQ?.type === "slider";
  const isLast = step === QUESTIONS.length - 1;
  const canContinue = isSlider || (answers[currentQ?.id]?.trim().length > 0) || currentQ?.required === false;

  const handleNext = () => {
    if (isLast) {
      handleSubmit();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await addDoc(collection(db, "checkIns"), {
        userId: user.uid,
        answers,
        submittedAt: new Date().toISOString(),
        weekOf: getWeekMonday(),
        coachReply: null,
        replyAt: null,
        replyRead: false,
      });
      setSubmitted(true);
    } catch (e) {
      console.error(e);
      alert("Something went wrong. Please try again.");
    }
    setSaving(false);
  };

  const getWeekMonday = () => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    return monday.toISOString().split("T")[0];
  };

  // View previous check-in
  if (viewing) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0d2b1f 0%, #1a3a2a 60%, #2d6a4f 100%)", paddingBottom: "120px" }}>
        <PortalNav />
        <div style={{ padding: "16px 20px" }}>
          <button onClick={() => setViewing(null)} style={{ background: "none", border: "none", fontSize: "13px", fontWeight: 700, color: "#9fe1cb", cursor: "pointer", padding: 0, marginBottom: "16px" }}>← Back</button>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>
            Week of {new Date(viewing.weekOf + "T12:00:00").toLocaleDateString("en-IE", { day: "numeric", month: "long" })}
          </p>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 20px" }}>
            {viewing.coachInitiated ? "Message from Michael" : "Your Check-in"}
          </h1>

          {/* Sliders summary — only shown for client-submitted check-ins */}
          {!viewing.coachInitiated && <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px", marginBottom: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {["training", "energy", "sleep", "stress"].map(key => {
                const q = QUESTIONS.find(q => q.id === key);
                const val = viewing.answers[key];
                const color = val <= 3 ? "#dc2626" : val <= 5 ? "#b45309" : val <= 7 ? "#4ade80" : "#4ade80";
                return (
                  <div key={key} style={{ textAlign: "center" }}>
                    <p style={{ fontSize: "28px", fontWeight: 700, color, margin: 0, lineHeight: 1 }}>{val}</p>
                    <p style={{ fontSize: "11px", color: "#9fe1cb", margin: "3px 0 0", textTransform: "capitalize" }}>{key}</p>
                  </div>
                );
              })}
            </div>
          </div>}

          {/* Text answers — only for client-submitted check-ins */}
          {!viewing.coachInitiated && ["pain", "win", "struggle", "other"].map(key => {
            const q = QUESTIONS.find(q => q.id === key);
            const val = viewing.answers[key];
            if (!val) return null;
            return (
              <div key={key} style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "12px", padding: "14px 16px", marginBottom: "8px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>{q.label}</p>
                <p style={{ fontSize: "14px", color: "#fff", margin: 0, lineHeight: 1.5 }}>{val}</p>
              </div>
            );
          })}

          {/* Coach reply */}
          {viewing.coachReply && !viewing.coachVideoUrl && (
            <div style={{ backgroundColor: "#2d6a4f", borderRadius: "14px", padding: "16px", marginTop: "16px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>💬 Reply from Michael</p>
              <p style={{ fontSize: "15px", color: "#fff", margin: "0 0 8px", lineHeight: 1.6 }}>{viewing.coachReply}</p>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", margin: 0 }}>
                {viewing.replyAt ? new Date(viewing.replyAt).toLocaleDateString("en-IE", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : ""}
              </p>
            </div>
          )}

          {viewing.coachVideoUrl && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ backgroundColor: "#2d6a4f", borderRadius: "14px", padding: "14px 16px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "22px" }}>🎥</span>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0 }}>Video response from Michael</p>
                  <p style={{ fontSize: "12px", color: "#9fe1cb", margin: "2px 0 0" }}>
                    {viewing.replyAt ? new Date(viewing.replyAt).toLocaleDateString("en-IE", { day: "numeric", month: "long" }) : ""}
                  </p>
                </div>
              </div>
              <div style={{ borderRadius: "14px", overflow: "hidden", backgroundColor: "#000", aspectRatio: "16/9" }}>
                <iframe
                  src={`https://www.youtube.com/embed/${getYouTubeId(viewing.coachVideoUrl)}?autoplay=1`}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ display: "block" }}
                />
              </div>
              {viewing.coachReply && (
                <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px 14px", marginTop: "10px" }}>
                  <p style={{ fontSize: "14px", color: "#fff", margin: 0, lineHeight: 1.6 }}>{viewing.coachReply}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Success screen
  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0d2b1f 0%, #1a3a2a 60%, #2d6a4f 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontSize: "64px", marginBottom: "20px" }}>✅</div>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 12px" }}>Check-in submitted</p>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 12px", lineHeight: 1.2 }}>Thanks for checking in</h1>
        <p style={{ fontSize: "15px", color: "#9fe1cb", margin: "0 0 32px", lineHeight: 1.6, maxWidth: "320px" }}>
          I'll review your check-in and get back to you with feedback. You'll see my reply right here in the app.
        </p>
        <button onClick={() => navigate("/dashboard")} style={{ backgroundColor: "#fff", color: "#1a3a2a", border: "none", borderRadius: "14px", padding: "15px 28px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Previous check-ins list (shown when step is -1)
  if (step === -1) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0d2b1f 0%, #1a3a2a 60%, #2d6a4f 100%)", paddingBottom: "120px" }}>
        <PortalNav />
        <div style={{ padding: "20px" }}>
          <button onClick={() => setStep(0)} style={{ background: "none", border: "none", fontSize: "13px", fontWeight: 700, color: "#9fe1cb", cursor: "pointer", padding: 0, marginBottom: "16px" }}>← Back</button>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 20px" }}>Previous Check-ins</h1>
          {previousCheckIns.length === 0 ? (
            <p style={{ fontSize: "14px", color: "#9fe1cb", textAlign: "center", padding: "40px 0" }}>No previous check-ins yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {previousCheckIns.map(c => (
                <div key={c.id} onClick={() => setViewing(c)} style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: c.coachInitiated ? 0 : "8px" }}>
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0 }}>
                        {c.coachInitiated ? "Message from Michael" : `Week of ${new Date(c.weekOf + "T12:00:00").toLocaleDateString("en-IE", { day: "numeric", month: "long" })}`}
                      </p>
                      {c.coachInitiated && (
                        <p style={{ fontSize: "11px", color: "#9fe1cb", margin: "2px 0 0" }}>
                          {new Date(c.replyAt).toLocaleDateString("en-IE", { day: "numeric", month: "long" })}
                        </p>
                      )}
                    </div>
                    {!c.coachInitiated && c.coachReply && (
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#4ade80", backgroundColor: "rgba(74,222,128,0.15)", padding: "3px 8px", borderRadius: "10px" }}>Reply received</span>
                    )}
                    {c.coachInitiated && (
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", backgroundColor: "rgba(159,225,203,0.15)", padding: "3px 8px", borderRadius: "10px" }}>
                        {c.coachVideoUrl ? "Video" : "Note"}
                      </span>
                    )}
                  </div>
                  {!c.coachInitiated && (
                    <div style={{ display: "flex", gap: "12px" }}>
                      {["training", "energy", "sleep", "stress"].map(key => (
                        <div key={key} style={{ textAlign: "center" }}>
                          <p style={{ fontSize: "16px", fontWeight: 700, color: "#4ade80", margin: 0 }}>{c.answers[key]}</p>
                          <p style={{ fontSize: "10px", color: "#9fe1cb", margin: "2px 0 0", textTransform: "capitalize" }}>{key}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Check-in form
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0d2b1f 0%, #1a3a2a 60%, #2d6a4f 100%)", display: "flex", flexDirection: "column" }}>
      <PortalNav />

      {/* Header */}
      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Weekly Check-in</p>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontWeight: 600, margin: 0 }}>{step + 1} of {QUESTIONS.length}</p>
      </div>

      {/* Progress */}
      <div style={{ margin: "12px 20px 0", height: "3px", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: "2px" }}>
        <div style={{ height: "3px", backgroundColor: "#4ade80", borderRadius: "2px", width: `${((step + 1) / QUESTIONS.length) * 100}%`, transition: "width 0.3s ease" }} />
      </div>

      {/* Question */}
      <div style={{ flex: 1, padding: "24px 20px 40px", maxWidth: "520px", margin: "0 auto", width: "100%" }}>
        {isSlider ? (
          <SliderQuestion
            question={currentQ}
            value={answers[currentQ.id]}
            onChange={val => setAnswers(prev => ({ ...prev, [currentQ.id]: val }))}
          />
        ) : (
          <div style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "14px", padding: "18px" }}>
            <p style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: "0 0 14px", lineHeight: 1.4 }}>{currentQ.label}</p>
            <textarea
              value={answers[currentQ.id]}
              onChange={e => setAnswers(prev => ({ ...prev, [currentQ.id]: e.target.value }))}
              placeholder={currentQ.placeholder}
              autoFocus
              rows={4}
              style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1.5px solid rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.06)", fontSize: "15px", color: "#fff", outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.6, fontFamily: "inherit" }}
              onFocus={e => e.target.style.borderColor = "#4ade80"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.2)"}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ padding: "14px 20px", borderRadius: "12px", border: "1.5px solid rgba(255,255,255,0.2)", backgroundColor: "transparent", fontSize: "15px", fontWeight: 700, cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>←</button>
          )}
          <button
            onClick={handleNext}
            disabled={!canContinue || saving}
            style={{ flex: 1, backgroundColor: canContinue && !saving ? "#fff" : "rgba(255,255,255,0.15)", color: canContinue && !saving ? "#1a3a2a" : "rgba(255,255,255,0.3)", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: canContinue && !saving ? "pointer" : "not-allowed", transition: "all 0.2s ease" }}
          >
            {saving ? "Submitting..." : isLast ? "Submit Check-in →" : "Continue →"}
          </button>
        </div>

        {currentQ.required === false && (
          <button onClick={handleNext} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "rgba(255,255,255,0.3)", cursor: "pointer", marginTop: "10px", padding: "6px" }}>
            Skip this question
          </button>
        )}

        {/* Previous check-ins link */}
        {step === 0 && previousCheckIns.length > 0 && (
          <button onClick={() => setStep(-1)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "rgba(255,255,255,0.4)", cursor: "pointer", marginTop: "16px", padding: "6px" }}>
            View previous check-ins →
          </button>
        )}
      </div>
    </div>
  );
}