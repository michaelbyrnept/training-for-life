import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Link } from "react-router-dom";

export default function Consultation() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    age: "",
    helpWith: "",
    limiting: "",
    capable: "",
    pain: "",
    other: "",
  });

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const steps = [
    {
      id: "intro",
      type: "intro",
    },
    {
      id: "fullName",
      label: "What's your name?",
      sub: "Let's start with the basics.",
      type: "text",
      placeholder: "Your full name",
      required: true,
    },
    {
      id: "email",
      label: "What's your email address?",
      sub: "I'll use this to confirm your consultation.",
      type: "email",
      placeholder: "your@email.com",
      required: true,
    },
    {
      id: "phone",
      label: "What's your phone number?",
      sub: "In case I need to reach you quickly.",
      type: "tel",
      placeholder: "e.g. 087 123 4567",
      required: true,
    },
    {
      id: "age",
      label: "How old are you?",
      sub: "This helps me tailor everything to you.",
      type: "number",
      placeholder: "e.g. 52",
      required: true,
    },
    {
      id: "helpWith",
      label: "What would you most like help improving physically?",
      sub: "Be as honest as you like -- there are no wrong answers.",
      type: "textarea",
      placeholder: "e.g. I want to get stronger, have more energy, feel less stiff...",
      required: true,
    },
    {
      id: "limiting",
      label: "What currently feels most limiting in your body or daily life?",
      sub: "This helps me understand where you're starting from.",
      type: "textarea",
      placeholder: "e.g. My back gives me trouble, I get out of breath easily, I feel weak...",
      required: true,
    },
    {
      id: "capable",
      label: "What would you love to feel physically capable of again?",
      sub: "Think about activities, moments, or feelings -- not just fitness goals.",
      type: "textarea",
      placeholder: "e.g. Playing with my grandkids, going hiking, carrying my shopping without pain...",
      required: true,
    },
    {
      id: "pain",
      label: "Do you currently experience any pain, injuries, or physical limitations?",
      sub: "Be specific -- this helps me make sure your programme is safe and appropriate.",
      type: "textarea",
      placeholder: "e.g. Bad left knee, lower back pain, recovering from a hip replacement...",
      required: true,
    },
    {
      id: "other",
      label: "Is there anything else you'd like me to know?",
      sub: "Goals, lifestyle, schedule, concerns -- anything that feels relevant.",
      type: "textarea",
      placeholder: "Anything at all...",
      required: false,
    },
  ];

  const currentStep = steps[step];
  const isIntro = currentStep?.type === "intro";
  const isLast = step === steps.length - 1;
  const progress = ((step) / (steps.length - 1)) * 100;

  const canContinue = () => {
    if (isIntro) return true;
    if (!currentStep?.required) return true;
    return form[currentStep.id]?.trim().length > 0;
  };

  const handleNext = () => {
    if (!canContinue()) return;
    if (isLast) {
      handleSubmit();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await addDoc(collection(db, "consultations"), {
        ...form,
        submittedAt: new Date().toISOString(),
        status: "new",
      });
      setSubmitted(true);
    } catch (e) {
      console.error(e);
      alert("Something went wrong. Please try again.");
    }
    setSaving(false);
  };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0d2b1f 0%, #1a3a2a 50%, #2d6a4f 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontSize: "64px", marginBottom: "20px" }}>🙌</div>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 12px" }}>Application received</p>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: "0 0 16px", lineHeight: 1.2 }}>
          Thank you for taking the first step
        </h1>
        <p style={{ fontSize: "15px", color: "#9fe1cb", margin: "0 0 32px", lineHeight: 1.6, maxWidth: "360px" }}>
          I'll personally review your application and be in touch within 24-48 hours to discuss the next best steps for you.
        </p>
        <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px 20px", marginBottom: "32px", maxWidth: "360px", width: "100%" }}>
          <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0, lineHeight: 1.6 }}>
            In the meantime, feel free to explore the free training app and take the Capability Assessment if you haven't already.
          </p>
        </div>
        <Link to="/capability-score" style={{ display: "block", backgroundColor: "#fff", color: "#1a3a2a", fontSize: "15px", fontWeight: 700, padding: "15px 28px", borderRadius: "14px", textDecoration: "none", marginBottom: "12px", width: "100%", maxWidth: "360px", boxSizing: "border-box", textAlign: "center" }}>
          Take the Capability Assessment →
        </Link>
        <Link to="/" style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0d2b1f 0%, #1a3a2a 60%, #2d6a4f 100%)", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none" }}>
          Training for Life
        </Link>
        {!isIntro && (
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontWeight: 600, margin: 0 }}>
            {step} of {steps.length - 1}
          </p>
        )}
      </div>

      {/* Progress bar */}
      {!isIntro && (
        <div style={{ margin: "14px 20px 0", height: "3px", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: "2px" }}>
          <div style={{ height: "3px", backgroundColor: "#4ade80", borderRadius: "2px", width: `${progress}%`, transition: "width 0.3s ease" }} />
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 24px 40px", maxWidth: "520px", margin: "0 auto", width: "100%" }}>

        {isIntro ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "56px", marginBottom: "20px" }}>💪</div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 12px" }}>
              Training for Life
            </p>
            <h1 style={{ fontSize: "30px", fontWeight: 700, color: "#fff", margin: "0 0 16px", lineHeight: 1.2 }}>
              Capability Consultation
            </h1>
            <p style={{ fontSize: "15px", color: "#9fe1cb", margin: "0 0 12px", lineHeight: 1.6 }}>
              A calm, structured first step toward rebuilding confidence in your body, movement, and long-term physical capability.
            </p>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", margin: "0 0 36px", lineHeight: 1.6 }}>
              Takes about 3 minutes. I'll personally read every word.
            </p>
            <button onClick={handleNext} style={{ width: "100%", backgroundColor: "#fff", color: "#1a3a2a", border: "none", borderRadius: "14px", padding: "16px", fontSize: "16px", fontWeight: 700, cursor: "pointer" }}>
              Let's get started →
            </button>
          </div>
        ) : (
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 8px", lineHeight: 1.3 }}>
              {currentStep.label}
            </h2>
            {currentStep.sub && (
              <p style={{ fontSize: "14px", color: "#9fe1cb", margin: "0 0 24px", lineHeight: 1.5 }}>
                {currentStep.sub}
              </p>
            )}

            {currentStep.type === "textarea" ? (
              <textarea
                value={form[currentStep.id]}
                onChange={e => update(currentStep.id, e.target.value)}
                placeholder={currentStep.placeholder}
                autoFocus
                rows={4}
                style={{ width: "100%", padding: "16px", borderRadius: "14px", border: "1.5px solid rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.08)", fontSize: "15px", color: "#fff", outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.6, fontFamily: "inherit" }}
                onFocus={e => e.target.style.borderColor = "#4ade80"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.2)"}
              />
            ) : (
              <input
                type={currentStep.type}
                value={form[currentStep.id]}
                onChange={e => update(currentStep.id, e.target.value)}
                placeholder={currentStep.placeholder}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter" && currentStep.type !== "textarea") handleNext(); }}
                style={{ width: "100%", padding: "16px", borderRadius: "14px", border: "1.5px solid rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.08)", fontSize: "16px", color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                onFocus={e => e.target.style.borderColor = "#4ade80"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.2)"}
              />
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              {step > 1 && (
                <button onClick={() => setStep(s => s - 1)} style={{ padding: "14px 20px", borderRadius: "12px", border: "1.5px solid rgba(255,255,255,0.2)", backgroundColor: "transparent", fontSize: "15px", fontWeight: 700, cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>
                  ←
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!canContinue() || saving}
                style={{ flex: 1, backgroundColor: canContinue() && !saving ? "#fff" : "rgba(255,255,255,0.15)", color: canContinue() && !saving ? "#1a3a2a" : "rgba(255,255,255,0.3)", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: canContinue() && !saving ? "pointer" : "not-allowed", transition: "all 0.2s ease" }}
              >
                {saving ? "Submitting..." : isLast ? "Submit Application →" : "Continue →"}
              </button>
            </div>

            {!currentStep.required && (
              <button onClick={handleNext} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "rgba(255,255,255,0.3)", cursor: "pointer", marginTop: "12px", padding: "6px" }}>
                Skip this question
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
