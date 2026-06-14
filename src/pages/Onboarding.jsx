import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const TOTAL_STEPS = 8;

const PAR_Q_QUESTIONS = [
  { id: "heart", question: "Has a doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?" },
  { id: "chest_active", question: "Do you feel pain in your chest when you do physical activity?" },
  { id: "chest_rest", question: "In the past month, have you had chest pain when you were not doing physical activity?" },
  { id: "balance", question: "Do you lose your balance because of dizziness or do you ever lose consciousness?" },
  { id: "bone_joint", question: "Do you have a bone or joint problem that could be made worse by a change in your physical activity?" },
  { id: "medication", question: "Is your doctor currently prescribing medication for your blood pressure or heart condition?" },
  { id: "other", question: "Do you know of any other reason why you should not do physical activity?" },
];

function ProgressBar({ step }) {
  return (
    <div style={{ height: "3px", backgroundColor: "#e5e5e5", margin: "0 24px" }}>
      <div style={{ height: "3px", backgroundColor: "#2d6a4f", borderRadius: "2px", width: `${(step / TOTAL_STEPS) * 100}%`, transition: "width 0.3s ease" }} />
    </div>
  );
}

function Screen({ children }) {
  return (
    <div style={{ padding: "40px 24px 32px", maxWidth: "480px", margin: "0 auto", width: "100%" }}>
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <p style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 10px" }}>
      {children}
    </p>
  );
}

function Title({ children }) {
  return (
    <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#111", lineHeight: 1.2, margin: "0 0 8px" }}>
      {children}
    </h1>
  );
}

function Subtitle({ children }) {
  return (
    <p style={{ fontSize: "14px", color: "#888", margin: "0 0 32px", lineHeight: 1.6 }}>
      {children}
    </p>
  );
}

function NextButton({ onClick, label = "Continue", disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", backgroundColor: disabled ? "#e5e5e5" : "#2d6a4f",
      color: disabled ? "#aaa" : "#fff", border: "none", borderRadius: "12px",
      padding: "15px", fontSize: "15px", fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer", marginTop: "24px",
    }}>
      {label}
    </button>
  );
}

function Input({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      {label && <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>{label}</p>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{
        width: "100%", padding: "14px 16px", borderRadius: "12px", border: "1.5px solid #e5e5e5",
        fontSize: "16px", color: "#111", backgroundColor: "#fff", outline: "none", boxSizing: "border-box",
      }}
        onFocus={e => e.target.style.borderColor = "#2d6a4f"}
        onBlur={e => e.target.style.borderColor = "#e5e5e5"}
      />
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [isInPerson, setIsInPerson] = useState(false);

  const [nickname, setNickname] = useState(auth.currentUser?.displayName || "");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [weightPrivate, setWeightPrivate] = useState(false);
  const [goalWeight, setGoalWeight] = useState("");
  const [noGoalWeight, setNoGoalWeight] = useState(false);
  const [units, setUnits] = useState("metric");
  const [goal, setGoal] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [parqAnswers, setParqAnswers] = useState({});
  const [parqCurrentQ, setParqCurrentQ] = useState(0);

  useEffect(() => {
    const checkTier = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists() && snap.data().subscription === "in-person") {
        setIsInPerson(true);
      }
    };
    checkTier();
  }, []);

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => s - 1);

  const getAge = () => {
    if (!dob) return 45;
    const today = new Date();
    const birth = new Date(dob);
    return today.getFullYear() - birth.getFullYear();
  };

  const getStandards = () => {
    const age = getAge();
    const w = parseFloat(weight) || 80;
    const gw = parseFloat(goalWeight) || w;
    const targetWeight = (!weightPrivate && !noGoalWeight && gw < w) ? gw : w;
    const isFemale = gender === "female";
    const bench = isFemale ? Math.round(targetWeight * 0.55) : Math.round(targetWeight);
    const deadlift = isFemale ? Math.round(targetWeight * 0.9) : Math.round(targetWeight * 1.5);
    let run5k;
    if (isFemale) {
      run5k = age < 50 ? "28:00" : age < 60 ? "32:00" : "36:00";
    } else {
      run5k = age < 50 ? "25:00" : age < 60 ? "28:00" : "32:00";
    }
    return { bench, deadlift, run5k };
  };

  const handleFinish = async () => {
    setSaving(true);
    const user = auth.currentUser;
    if (!user) return;
    const standards = getStandards();
    try {
      await updateDoc(doc(db, "users", user.uid), {
        nickname, gender, dob, height,
        weight: weightPrivate ? null : weight,
        goalWeight: noGoalWeight ? null : goalWeight,
        weightPrivate, noGoalWeight, units, goal, daysPerWeek,
        onboardingComplete: true,
        capabilityStandards: standards,
      });
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
    if (isInPerson) {
      setStep(9);
    } else {
      navigate("/dashboard");
    }
  };

  const handleParqAnswer = (questionId, answer) => {
    setParqAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleParqNext = () => {
    if (parqCurrentQ < PAR_Q_QUESTIONS.length - 1) {
      setParqCurrentQ(q => q + 1);
    } else {
      submitParq();
    }
  };

  const handleParqBack = () => {
    if (parqCurrentQ > 0) {
      setParqCurrentQ(q => q - 1);
    } else {
      setStep(8);
    }
  };

  const submitParq = async () => {
    setSaving(true);
    const user = auth.currentUser;
    if (!user) return;
    const hasFlag = Object.values(parqAnswers).some(a => a === "yes");
    try {
      await updateDoc(doc(db, "users", user.uid), {
        parQComplete: true,
        parQAnswers: parqAnswers,
        parQFlag: hasFlag,
        parQDate: new Date().toISOString(),
      });
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
    setStep(10);
  };

  const goals = [
    { id: "strength", icon: "🏋️", label: "Build Strength", sub: "Get stronger and more physically capable" },
    { id: "fitness", icon: "❤️", label: "Improve Fitness", sub: "Better energy, endurance and heart health" },
    { id: "independence", icon: "🧭", label: "Stay Independent", sub: "Move freely and confidently for decades ahead" },
    { id: "confidence", icon: "💪", label: "Build Confidence", sub: "Trust your body and feel capable every day" },
  ];

  const standards = getStandards();
  const totalScreens = 7;
  const hasFlag = Object.values(parqAnswers).some(a => a === "yes");
  const currentQuestion = PAR_Q_QUESTIONS[parqCurrentQ];
  const currentAnswer = parqAnswers[currentQuestion?.id];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>

      {step <= 8 && (
        <div style={{ padding: "16px 24px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {step > 1 && step < 8 ? (
            <button onClick={back} style={{ background: "none", border: "none", fontSize: "13px", fontWeight: 700, color: "#888", cursor: "pointer", padding: 0 }}>Back</button>
          ) : <div style={{ width: 40 }} />}
          <p style={{ fontSize: "12px", color: "#aaa", fontWeight: 600, margin: 0 }}>
            {step > 1 && step < 8 ? `${step - 1} of ${totalScreens}` : ""}
          </p>
          <div style={{ width: 40 }} />
        </div>
      )}

      {step > 1 && step < 8 && <ProgressBar step={step - 1} />}

      {/* SCREEN 1 -- Welcome */}
      {step === 1 && (
        <Screen>
          <div style={{ textAlign: "center", paddingTop: "40px" }}>
            <div style={{ fontSize: "48px", marginBottom: "20px" }}>💪</div>
            <Label>Training for Life</Label>
            <Title>Welcome to your capability journey</Title>
            <Subtitle>We'll build your personalised profile in about 2 minutes. This helps us tailor your training and capability standards to you.</Subtitle>
            <NextButton onClick={next} label="Let's go" />
            <button onClick={() => navigate("/dashboard")} style={{ background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "14px", display: "block", width: "100%" }}>
              Skip for now
            </button>
          </div>
        </Screen>
      )}

      {/* SCREEN 2 -- Nickname */}
      {step === 2 && (
        <Screen>
          <Label>Step 1</Label>
          <Title>What should we call you?</Title>
          <Subtitle>This is how we'll greet you in the app. Use your name, a nickname -- whatever feels right.</Subtitle>
          <Input placeholder="e.g. Michael, Mike, Mick..." value={nickname} onChange={e => setNickname(e.target.value)} />
          <NextButton onClick={next} disabled={!nickname.trim()} />
        </Screen>
      )}

      {/* SCREEN 3 -- Gender */}
      {step === 3 && (
        <Screen>
          <Label>Step 2</Label>
          <Title>What best describes you?</Title>
          <Subtitle>We use this to set appropriate capability standards for your physiology.</Subtitle>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[{ id: "male", icon: "♂", label: "Male" }, { id: "female", icon: "♀", label: "Female" }].map(g => (
              <div key={g.id} onClick={() => setGender(g.id)} style={{
                backgroundColor: gender === g.id ? "#eaf5ef" : "#fff",
                border: gender === g.id ? "2px solid #2d6a4f" : "1.5px solid #e5e5e5",
                borderRadius: "14px", padding: "20px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer",
              }}>
                <span style={{ fontSize: "28px", color: gender === g.id ? "#2d6a4f" : "#aaa" }}>{g.icon}</span>
                <p style={{ fontSize: "17px", fontWeight: 700, color: gender === g.id ? "#2d6a4f" : "#111", margin: 0 }}>{g.label}</p>
                {gender === g.id && (
                  <div style={{ marginLeft: "auto" }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="9" fill="#2d6a4f"/>
                      <path d="M5 10l4 4 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
          <NextButton onClick={next} disabled={!gender} />
        </Screen>
      )}

      {/* SCREEN 4 -- DOB */}
      {step === 4 && (
        <Screen>
          <Label>Step 3</Label>
          <Title>When were you born?</Title>
          <Subtitle>We use this to personalise your capability standards to your age group.</Subtitle>
          <Input type="date" value={dob} onChange={e => setDob(e.target.value)} />
          <NextButton onClick={next} disabled={!dob} />
        </Screen>
      )}

      {/* SCREEN 5 -- Body stats */}
      {step === 5 && (
        <Screen>
          <Label>Step 4</Label>
          <Title>Your body stats</Title>
          <Subtitle>Used to calculate your personalised strength and fitness targets. Weight fields are optional.</Subtitle>
          <div style={{ display: "flex", gap: "0", background: "#e5e5e5", borderRadius: "10px", padding: "3px", marginBottom: "20px" }}>
            {["metric", "imperial"].map(u => (
              <button key={u} onClick={() => setUnits(u)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer", backgroundColor: units === u ? "#fff" : "transparent", color: units === u ? "#2d6a4f" : "#888" }}>
                {u === "metric" ? "kg / cm" : "lbs / ft"}
              </button>
            ))}
          </div>
          <Input label={`Height (${units === "metric" ? "cm" : "ft"})`} placeholder={units === "metric" ? "e.g. 178" : "e.g. 5.10"} value={height} onChange={e => setHeight(e.target.value)} type="number" />
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>Current weight ({units === "metric" ? "kg" : "lbs"})</p>
            {!weightPrivate ? (
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder={units === "metric" ? "e.g. 85" : "e.g. 187"} style={{ flex: 1, padding: "14px 16px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "16px", color: "#111", backgroundColor: "#fff", outline: "none", boxSizing: "border-box" }} onFocus={e => e.target.style.borderColor = "#2d6a4f"} onBlur={e => e.target.style.borderColor = "#e5e5e5"} />
                <button onClick={() => { setWeightPrivate(true); setWeight(""); }} style={{ padding: "14px 12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", backgroundColor: "#fff", fontSize: "12px", fontWeight: 700, color: "#888", cursor: "pointer", whiteSpace: "nowrap" }}>Prefer not to say</button>
              </div>
            ) : (
              <div onClick={() => setWeightPrivate(false)} style={{ padding: "14px 16px", borderRadius: "12px", border: "1.5px solid #e5e5e5", backgroundColor: "#f7f5f2", fontSize: "14px", color: "#888", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Prefer not to say</span><span style={{ fontSize: "12px", color: "#2d6a4f", fontWeight: 700 }}>Change</span>
              </div>
            )}
          </div>
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>Goal weight ({units === "metric" ? "kg" : "lbs"})</p>
            {!noGoalWeight ? (
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="number" value={goalWeight} onChange={e => setGoalWeight(e.target.value)} placeholder={units === "metric" ? "e.g. 80" : "e.g. 176"} style={{ flex: 1, padding: "14px 16px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "16px", color: "#111", backgroundColor: "#fff", outline: "none", boxSizing: "border-box" }} onFocus={e => e.target.style.borderColor = "#2d6a4f"} onBlur={e => e.target.style.borderColor = "#e5e5e5"} />
                <button onClick={() => { setNoGoalWeight(true); setGoalWeight(""); }} style={{ padding: "14px 12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", backgroundColor: "#fff", fontSize: "12px", fontWeight: 700, color: "#888", cursor: "pointer", whiteSpace: "nowrap" }}>No goal weight</button>
              </div>
            ) : (
              <div onClick={() => setNoGoalWeight(false)} style={{ padding: "14px 16px", borderRadius: "12px", border: "1.5px solid #e5e5e5", backgroundColor: "#f7f5f2", fontSize: "14px", color: "#888", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>No goal weight</span><span style={{ fontSize: "12px", color: "#2d6a4f", fontWeight: 700 }}>Change</span>
              </div>
            )}
          </div>
          <NextButton onClick={next} disabled={!height} />
        </Screen>
      )}

      {/* SCREEN 6 -- Goal */}
      {step === 6 && (
        <Screen>
          <Label>Step 5</Label>
          <Title>What's your primary goal?</Title>
          <Subtitle>We'll build your programme around this.</Subtitle>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {goals.map(g => (
              <div key={g.id} onClick={() => setGoal(g.id)} style={{ backgroundColor: goal === g.id ? "#eaf5ef" : "#fff", border: goal === g.id ? "2px solid #2d6a4f" : "1.5px solid #e5e5e5", borderRadius: "14px", padding: "16px", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer" }}>
                <span style={{ fontSize: "28px" }}>{g.icon}</span>
                <div>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: goal === g.id ? "#2d6a4f" : "#111", margin: 0 }}>{g.label}</p>
                  <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>{g.sub}</p>
                </div>
              </div>
            ))}
          </div>
          <NextButton onClick={next} disabled={!goal} />
        </Screen>
      )}

      {/* SCREEN 7 -- Days per week */}
      {step === 7 && (
        <Screen>
          <Label>Step 6</Label>
          <Title>How many days per week can you train?</Title>
          <Subtitle>Be realistic. Consistency beats intensity every time.</Subtitle>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", margin: "8px 0 0" }}>
            {[2, 3, 4, 5].map(d => (
              <div key={d} onClick={() => setDaysPerWeek(d)} style={{ width: "64px", height: "64px", borderRadius: "16px", backgroundColor: daysPerWeek === d ? "#2d6a4f" : "#fff", border: daysPerWeek === d ? "none" : "1.5px solid #e5e5e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 700, color: daysPerWeek === d ? "#fff" : "#111", cursor: "pointer" }}>
                {d}
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", fontSize: "13px", color: "#888", marginTop: "12px" }}>
            {daysPerWeek === 2 && "2 sessions per week -- a solid, sustainable start"}
            {daysPerWeek === 3 && "3 sessions per week -- the sweet spot for most people"}
            {daysPerWeek === 4 && "4 sessions per week -- strong commitment, great results"}
            {daysPerWeek === 5 && "5 sessions per week -- high commitment, make sure to recover"}
          </p>
          <NextButton onClick={next} />
        </Screen>
      )}

      {/* SCREEN 8 -- Standards reveal */}
      {step === 8 && (
        <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", display: "flex", flexDirection: "column", padding: "48px 24px 40px", maxWidth: "480px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 12px" }}>Your Profile is Ready</p>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: "0 0 8px", lineHeight: 1.2 }}>Your Capability Standards</h1>
            <p style={{ fontSize: "14px", color: "#9fe1cb", margin: 0 }}>These are your personalised targets. Let's get to work.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
            {[
              { icon: "🏋️", label: "Bench Press", target: `${standards.bench}kg`, sub: gender === "female" ? "Female capability standard" : "Bodyweight standard" },
              { icon: "💪", label: "Deadlift", target: `${standards.deadlift}kg`, sub: gender === "female" ? "Female capability standard" : "1.5x bodyweight standard" },
              { icon: "🏃", label: "5k Run", target: standards.run5k, sub: "Age-adjusted standard" },
            ].map(s => (
              <div key={s.label} style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "24px" }}>{s.icon}</span>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0 }}>{s.label}</p>
                    <p style={{ fontSize: "11px", color: "#9fe1cb", margin: "2px 0 0" }}>{s.sub}</p>
                  </div>
                </div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#4ade80" }}>{s.target}</div>
              </div>
            ))}
          </div>
          <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px", marginBottom: "24px" }}>
            <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0, lineHeight: 1.6 }}>These targets will evolve as you progress. Your journey starts now.</p>
          </div>
          <button onClick={handleFinish} disabled={saving} style={{ backgroundColor: "#fff", color: "#1a3a2a", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", width: "100%" }}>
            {saving ? "Saving..." : isInPerson ? "Continue to Health Questionnaire" : "Go to Dashboard"}
          </button>
        </div>
      )}

      {/* SCREEN 9 -- PAR-Q questions (in-person only) */}
      {step === 9 && currentQuestion && (
        <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
          <div style={{ padding: "16px 24px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={handleParqBack} style={{ background: "none", border: "none", fontSize: "13px", fontWeight: 700, color: "#888", cursor: "pointer", padding: 0 }}>Back</button>
            <p style={{ fontSize: "12px", color: "#aaa", fontWeight: 600, margin: 0 }}>{parqCurrentQ + 1} of {PAR_Q_QUESTIONS.length}</p>
            <div style={{ width: 40 }} />
          </div>
          <div style={{ height: "3px", backgroundColor: "#e5e5e5", margin: "0 24px" }}>
            <div style={{ height: "3px", backgroundColor: "#2d6a4f", borderRadius: "2px", width: `${((parqCurrentQ + 1) / PAR_Q_QUESTIONS.length) * 100}%`, transition: "width 0.3s ease" }} />
          </div>
          <Screen>
            <Label>Health Questionnaire</Label>
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "20px", marginBottom: "20px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>Question {parqCurrentQ + 1}</p>
              <p style={{ fontSize: "17px", fontWeight: 600, color: "#111", lineHeight: 1.5, margin: 0 }}>{currentQuestion.question}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { id: "no", label: "No", icon: "✓", color: "#2d6a4f", bg: "#eaf5ef", border: "#86efac" },
                { id: "yes", label: "Yes", icon: "!", color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
              ].map(opt => (
                <div key={opt.id} onClick={() => handleParqAnswer(currentQuestion.id, opt.id)} style={{ padding: "18px 20px", borderRadius: "14px", border: `1.5px solid ${currentAnswer === opt.id ? opt.border : "#e5e5e5"}`, backgroundColor: currentAnswer === opt.id ? opt.bg : "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: currentAnswer === opt.id ? opt.color : "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: currentAnswer === opt.id ? "#fff" : "#aaa", flexShrink: 0 }}>
                    {opt.icon}
                  </div>
                  <p style={{ fontSize: "17px", fontWeight: 700, color: currentAnswer === opt.id ? opt.color : "#111", margin: 0 }}>{opt.label}</p>
                </div>
              ))}
            </div>
            <NextButton onClick={handleParqNext} disabled={!currentAnswer || saving} label={parqCurrentQ === PAR_Q_QUESTIONS.length - 1 ? (saving ? "Saving..." : "Submit") : "Next"} />
          </Screen>
        </div>
      )}

      {/* SCREEN 10 -- PAR-Q result */}
      {step === 10 && (
        <div style={{ minHeight: "100vh", background: hasFlag ? "linear-gradient(160deg, #78350f 0%, #b45309 100%)" : "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", display: "flex", flexDirection: "column", padding: "48px 24px 40px", maxWidth: "480px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>{hasFlag ? "⚠️" : "✅"}</div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: hasFlag ? "#fde68a" : "#9fe1cb", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 12px" }}>
              {hasFlag ? "Please read carefully" : "All clear"}
            </p>
            <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 12px", lineHeight: 1.2 }}>
              {hasFlag ? "Speak to your coach before training" : "You're good to go"}
            </h1>
            <p style={{ fontSize: "15px", color: hasFlag ? "#fde68a" : "#9fe1cb", margin: 0, lineHeight: 1.6 }}>
              {hasFlag
                ? "Based on your answers, we recommend speaking with your coach and your doctor before starting any training programme. Your coach has been notified."
                : "Your health questionnaire is complete. Your coach has your information and you're ready to start training."}
            </p>
          </div>
          {hasFlag && (
            <div style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "14px", padding: "16px", marginBottom: "24px" }}>
              <p style={{ fontSize: "13px", color: "#fff", margin: 0, lineHeight: 1.6 }}>
                This doesn't mean you can't exercise -- it means we want to make sure your programme is tailored to your specific needs. Your coach will be in touch.
              </p>
            </div>
          )}
          <button onClick={() => navigate("/dashboard")} style={{ backgroundColor: "#fff", color: hasFlag ? "#78350f" : "#1a3a2a", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: "pointer", width: "100%" }}>
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}