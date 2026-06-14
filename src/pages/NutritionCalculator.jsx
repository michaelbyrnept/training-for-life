import { useState } from "react";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";

const TOTAL_STEPS = 6;

function ProgressBar({ step }) {
  return (
    <div style={{ height: "3px", backgroundColor: "#e5e5e5", margin: "0 24px" }}>
      <div style={{ height: "3px", backgroundColor: "#2d6a4f", borderRadius: "2px", width: `${(step / TOTAL_STEPS) * 100}%`, transition: "width 0.3s ease" }} />
    </div>
  );
}

function Screen({ children }) {
  return <div style={{ padding: "32px 24px", maxWidth: "480px", margin: "0 auto" }}>{children}</div>;
}

function Label({ children }) {
  return <p style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 8px" }}>{children}</p>;
}

function Title({ children }) {
  return <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#111", lineHeight: 1.2, margin: "0 0 6px" }}>{children}</h1>;
}

function Subtitle({ children }) {
  return <p style={{ fontSize: "14px", color: "#888", margin: "0 0 28px", lineHeight: 1.6 }}>{children}</p>;
}

function NextButton({ onClick, label = "Continue", disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: "100%", backgroundColor: disabled ? "#e5e5e5" : "#2d6a4f", color: disabled ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", marginTop: "24px" }}>
      {label}
    </button>
  );
}

function OptionCard({ icon, label, sub, selected, onClick }) {
  return (
    <div onClick={onClick} style={{ backgroundColor: selected ? "#eaf5ef" : "#fff", border: `2px solid ${selected ? "#2d6a4f" : "#e5e5e5"}`, borderRadius: "14px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", marginBottom: "10px" }}>
      <span style={{ fontSize: "24px" }}>{icon}</span>
      <div>
        <p style={{ fontSize: "15px", fontWeight: 700, color: selected ? "#2d6a4f" : "#111", margin: 0 }}>{label}</p>
        {sub && <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>{sub}</p>}
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange, placeholder, unit }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      {label && <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>{label}</p>}
      <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #e5e5e5", borderRadius: "12px", overflow: "hidden", backgroundColor: "#fff" }}>
        <input type="number" value={value} onChange={onChange} placeholder={placeholder} style={{ flex: 1, padding: "13px 14px", border: "none", fontSize: "16px", fontWeight: 700, outline: "none", backgroundColor: "transparent" }}
          onFocus={e => e.target.closest("div").style.borderColor = "#2d6a4f"}
          onBlur={e => e.target.closest("div").style.borderColor = "#e5e5e5"}
        />
        {unit && <span style={{ padding: "0 14px", fontSize: "14px", color: "#888", fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  );
}

function calculateTargets({ age, weight, goalWeight, height, gender, jobType, stepsPerDay, exerciseDays, goal }) {
  // BMR using Mifflin-St Jeor
  const w = parseFloat(weight);
  const h = parseFloat(height);
  const a = parseInt(age);
  const bmr = gender === "female"
    ? (10 * w) + (6.25 * h) - (5 * a) - 161
    : (10 * w) + (6.25 * h) - (5 * a) + 5;

  // Activity multiplier
  const jobMultiplier = { sedentary: 1.0, light: 1.1, moderate: 1.2, heavy: 1.3 }[jobType] || 1.0;
  const stepsMultiplier = stepsPerDay < 5000 ? 1.0 : stepsPerDay < 8000 ? 1.05 : stepsPerDay < 12000 ? 1.1 : 1.15;
  const exerciseMultiplier = { 0: 1.0, 1: 1.05, 2: 1.1, 3: 1.15, 4: 1.2, 5: 1.25 }[Math.min(exerciseDays, 5)] || 1.0;

  const tdee = Math.round(bmr * jobMultiplier * stepsMultiplier * exerciseMultiplier);

  // Goal adjustment
  const goalAdj = { lose: -400, maintain: 0, build: 250, health: 0 }[goal] || 0;
  const calories = Math.round(tdee + goalAdj);

  // Macros
  const gw = parseFloat(goalWeight) || w;
  const protein = Math.round(gw * 1.6);
  const fat = gender === "female" ? 50 : 60;
  const proteinCals = protein * 4;
  const fatCals = fat * 9;
  const carbCals = Math.max(0, calories - proteinCals - fatCals);
  const carbs = Math.round(carbCals / 4);
  const fibre = a >= 50 ? (gender === "female" ? 21 : 30) : (gender === "female" ? 25 : 35);

  return { calories, protein, carbs, fat, fibre, tdee };
}

export default function NutritionCalculator() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [jobType, setJobType] = useState("");
  const [stepsPerDay, setStepsPerDay] = useState("");
  const [exerciseDays, setExerciseDays] = useState(3);
  const [goal, setGoal] = useState("");
  const [results, setResults] = useState(null);

  const next = () => {
    if (step === 5) {
      const r = calculateTargets({ age, weight, goalWeight, height, gender, jobType, stepsPerDay: parseInt(stepsPerDay) || 7000, exerciseDays, goal });
      setResults(r);
    }
    setStep(s => s + 1);
  };
  const back = () => setStep(s => s - 1);

  const saveTargets = async () => {
    setSaving(true);
    const user = auth.currentUser;
    if (user && results) {
      await setDoc(doc(db, "users", user.uid), { nutritionTargets: results }, { merge: true });
    }
    navigate("/nutrition");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
      <div style={{ padding: "16px 24px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {step > 1 && step < 6 ? (
          <button onClick={back} style={{ background: "none", border: "none", fontSize: "13px", fontWeight: 700, color: "#888", cursor: "pointer", padding: 0 }}>← Back</button>
        ) : <div style={{ width: 40 }} />}
        <p style={{ fontSize: "12px", color: "#aaa", fontWeight: 600, margin: 0 }}>{step < 6 ? `${step} of 5` : ""}</p>
        <Link to="/nutrition" style={{ fontSize: "13px", color: "#aaa", textDecoration: "none" }}>Cancel</Link>
      </div>

      {step < 6 && <ProgressBar step={step} />}

      {/* STEP 1 -- Gender */}
      {step === 1 && (
        <Screen>
          <Label>Step 1</Label>
          <Title>Tell us about yourself</Title>
          <Subtitle>We use this to calculate your basal metabolic rate accurately.</Subtitle>
          <OptionCard icon="👨" label="Male" selected={gender === "male"} onClick={() => setGender("male")} />
          <OptionCard icon="👩" label="Female" selected={gender === "female"} onClick={() => setGender("female")} />
          <NextButton onClick={next} disabled={!gender} />
        </Screen>
      )}

      {/* STEP 2 -- Body stats */}
      {step === 2 && (
        <Screen>
          <Label>Step 2</Label>
          <Title>Your body stats</Title>
          <Subtitle>Used to calculate your calorie needs and personalise your targets.</Subtitle>
          <NumberInput label="Age" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 45" unit="years" />
          <NumberInput label="Height" value={height} onChange={e => setHeight(e.target.value)} placeholder="e.g. 178" unit="cm" />
          <NumberInput label="Current weight" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 87" unit="kg" />
          <NumberInput label="Goal weight" value={goalWeight} onChange={e => setGoalWeight(e.target.value)} placeholder="e.g. 80" unit="kg" />
          <NextButton onClick={next} disabled={!age || !height || !weight || !goalWeight} />
        </Screen>
      )}

      {/* STEP 3 -- Job type */}
      {step === 3 && (
        <Screen>
          <Label>Step 3</Label>
          <Title>What does your typical day look like?</Title>
          <Subtitle>Your daily activity outside of exercise matters a lot for your calorie needs.</Subtitle>
          <OptionCard icon="💻" label="Mostly sitting" sub="Desk job, driving, watching TV" selected={jobType === "sedentary"} onClick={() => setJobType("sedentary")} />
          <OptionCard icon="🚶" label="Lightly active" sub="Some walking, standing, light tasks" selected={jobType === "light"} onClick={() => setJobType("light")} />
          <OptionCard icon="🔧" label="Moderately active" sub="On your feet most of the day" selected={jobType === "moderate"} onClick={() => setJobType("moderate")} />
          <OptionCard icon="🏗️" label="Very active" sub="Physical labour, heavy work" selected={jobType === "heavy"} onClick={() => setJobType("heavy")} />
          <NextButton onClick={next} disabled={!jobType} />
        </Screen>
      )}

      {/* STEP 4 -- Steps & exercise */}
      {step === 4 && (
        <Screen>
          <Label>Step 4</Label>
          <Title>Your movement habits</Title>
          <Subtitle>How active are you on a typical day outside of structured exercise?</Subtitle>
          <NumberInput label="Average daily steps" value={stepsPerDay} onChange={e => setStepsPerDay(e.target.value)} placeholder="e.g. 8000" unit="steps" />
          <p style={{ fontSize: "12px", color: "#aaa", margin: "-8px 0 20px" }}>Not sure? Most adults average 5,000-8,000 steps per day.</p>

          <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 10px" }}>How many days per week do you exercise?</p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "space-between" }}>
            {[0, 1, 2, 3, 4, 5].map(d => (
              <div key={d} onClick={() => setExerciseDays(d)} style={{ flex: 1, height: "48px", borderRadius: "10px", border: `2px solid ${exerciseDays === d ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: exerciseDays === d ? "#eaf5ef" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: exerciseDays === d ? "#2d6a4f" : "#aaa", cursor: "pointer" }}>
                {d}
              </div>
            ))}
          </div>
          <NextButton onClick={next} />
        </Screen>
      )}

      {/* STEP 5 -- Goal */}
      {step === 5 && (
        <Screen>
          <Label>Step 5</Label>
          <Title>What is your primary goal?</Title>
          <Subtitle>This adjusts your calorie target up or down from your maintenance level.</Subtitle>
          <OptionCard icon="📉" label="Lose body fat" sub="Calorie deficit of ~400 kcal per day" selected={goal === "lose"} onClick={() => setGoal("lose")} />
          <OptionCard icon="💪" label="Build muscle" sub="Calorie surplus of ~250 kcal per day" selected={goal === "build"} onClick={() => setGoal("build")} />
          <OptionCard icon="⚖️" label="Maintain weight" sub="Stay at maintenance calories" selected={goal === "maintain"} onClick={() => setGoal("maintain")} />
          <OptionCard icon="❤️" label="Improve health" sub="Maintenance with focus on food quality" selected={goal === "health"} onClick={() => setGoal("health")} />
          <NextButton onClick={next} disabled={!goal} label="Calculate My Targets →" />
        </Screen>
      )}

      {/* STEP 6 -- Results */}
      {step === 6 && results && (
        <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", minHeight: "100vh", padding: "32px 24px 40px" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 10px" }}>Your Personalised Targets</p>
            <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>Here are your numbers</h1>
            <p style={{ fontSize: "14px", color: "#9fe1cb", margin: 0 }}>Based on your body, lifestyle and goals</p>
          </div>

          {/* Calories -- hero */}
          <div style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "16px", padding: "20px", marginBottom: "12px", textAlign: "center" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>Daily Calories</p>
            <p style={{ fontSize: "52px", fontWeight: 700, color: "#fff", margin: "0 0 4px", lineHeight: 1 }}>{results.calories}</p>
            <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>kcal per day · Maintenance: {results.tdee} kcal</p>
          </div>

          {/* Macros grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
            {[
              { label: "Protein", value: results.protein, unit: "g/day", color: "#60a5fa", note: `1.6g per kg of ${goalWeight}kg goal weight` },
              { label: "Carbohydrates", value: results.carbs, unit: "g/day", color: "#fbbf24", note: "Remaining calories after protein and fat" },
              { label: "Fat", value: results.fat, unit: "g/day", color: "#f87171", note: "Foundation for hormonal health" },
              { label: "Fibre", value: results.fibre, unit: "g/day", color: "#a78bfa", note: "For gut health and satiety" },
            ].map(m => (
              <div key={m.label} style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: m.color, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>{m.label}</p>
                <p style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: "0 0 4px", lineHeight: 1 }}>{m.value}<span style={{ fontSize: "13px", color: "#9fe1cb", marginLeft: "3px" }}>{m.unit}</span></p>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.4 }}>{m.note}</p>
              </div>
            ))}
          </div>

          {/* Info box */}
          <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px", marginBottom: "20px" }}>
            <p style={{ fontSize: "12px", color: "#9fe1cb", lineHeight: 1.6, margin: 0 }}>
              These targets are a starting point. Give them 3-4 weeks and adjust based on how your body responds. Protein is the most important number to hit every day.
            </p>
          </div>

          <button onClick={saveTargets} disabled={saving} style={{ width: "100%", backgroundColor: "#fff", color: "#1a3a2a", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>
            {saving ? "Saving..." : "Save My Targets →"}
          </button>
          <Link to="/nutrition" style={{ display: "block", textAlign: "center", fontSize: "13px", color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>
            Not now
          </Link>
        </div>
      )}
    </div>
  );
}