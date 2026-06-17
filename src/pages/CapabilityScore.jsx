import { useState, useEffect } from "react";

import ResultsHero from "../components/capability/ResultsHero";
import ResultsProfile from "../components/capability/ResultsProfile";
import ResultsStrength from "../components/capability/ResultsStrength";
import ResultsOpportunity from "../components/capability/ResultsOpportunity";
import ResultsNextStep from "../components/capability/ResultsNextStep";
import ResultsCTA from "../components/capability/ResultsCTA";
import { Link } from "react-router-dom";

import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const CATEGORIES = [
  { label: "Strength", questions: ["q1", "q2"], max: 10 },
  { label: "Mobility", questions: ["q3", "q4"], max: 10 },
  { label: "Energy", questions: ["q5", "q6"], max: 10 },
  { label: "Confidence", questions: ["q7", "q8"], max: 10 },
  { label: "Consistency", questions: ["q9", "q10"], max: 10 },
  { label: "Future Capability", questions: ["q11", "q12", "q13"], max: 15 },
];

const SECTION_LABELS = {
  q1: "Strength", q2: "Strength",
  q3: "Mobility", q4: "Mobility",
  q5: "Energy", q6: "Energy",
  q7: "Confidence", q8: "Confidence",
  q9: "Consistency", q10: "Consistency",
  q11: "Future Capability", q12: "Future Capability", q13: "Future Capability",
};

export default function CapabilityScore() {
  const user = auth.currentUser;
  const [userDbData, setUserDbData] = useState(null);

  useEffect(() => {
    if (user) {
      getDoc(doc(db, "users", user.uid)).then(snap => {
        if (snap.exists()) setUserDbData(snap.data());
      });
    }
  }, [user]);

  const questions = [
    { id: "q1", question: "How confident are you lifting and carrying everyday objects?", options: [{ text: "Very Confident", value: 5 }, { text: "Mostly Confident", value: 4 }, { text: "Somewhat Confident", value: 3 }, { text: "Rarely Confident", value: 2 }, { text: "Not Confident", value: 1 }] },
    { id: "q2", question: "Can you comfortably carry two full shopping bags for 50 metres?", options: [{ text: "Easily", value: 5 }, { text: "With Minor Effort", value: 4 }, { text: "With Moderate Effort", value: 3 }, { text: "Difficult", value: 2 }, { text: "Cannot", value: 1 }] },
    { id: "q3", question: "Can you get down to the floor and back up again without assistance?", options: [{ text: "Easily", value: 5 }, { text: "With Minor Effort", value: 4 }, { text: "With Moderate Effort", value: 3 }, { text: "Difficult", value: 2 }, { text: "Cannot", value: 1 }] },
    { id: "q4", question: "How often do stiffness, aches, or limited movement affect your day-to-day life?", options: [{ text: "Never", value: 5 }, { text: "Rarely", value: 4 }, { text: "Sometimes", value: 3 }, { text: "Often", value: 2 }, { text: "Very Often", value: 1 }] },
    { id: "q5", question: "At the end of most days, how physically energised do you feel?", options: [{ text: "Very Energised", value: 5 }, { text: "Mostly Energised", value: 4 }, { text: "Average", value: 3 }, { text: "Tired", value: 2 }, { text: "Exhausted", value: 1 }] },
    { id: "q6", question: "How often do you avoid activities because you feel you don't have the energy?", options: [{ text: "Never", value: 5 }, { text: "Rarely", value: 4 }, { text: "Sometimes", value: 3 }, { text: "Often", value: 2 }, { text: "Very Often", value: 1 }] },
    { id: "q7", question: "How confident do you feel exercising without guidance or supervision?", options: [{ text: "Very Confident", value: 5 }, { text: "Mostly Confident", value: 4 }, { text: "Somewhat Confident", value: 3 }, { text: "Slightly Confident", value: 2 }, { text: "Not Confident", value: 1 }] },
    { id: "q8", question: "How much do you trust your body to do what you ask of it?", options: [{ text: "Completely", value: 5 }, { text: "Mostly", value: 4 }, { text: "Somewhat", value: 3 }, { text: "Very Little", value: 2 }, { text: "Not At All", value: 1 }] },
    { id: "q9", question: "When life becomes busy, what usually happens to your exercise routine?", options: [{ text: "It Stays Consistent", value: 5 }, { text: "Slight Reduction", value: 4 }, { text: "Moderate Reduction", value: 3 }, { text: "Usually Stops", value: 2 }, { text: "Completely Stops", value: 1 }] },
    { id: "q10", question: "Over the last 12 months, how would you describe your consistency with exercise?", options: [{ text: "Extremely Consistent", value: 5 }, { text: "Mostly Consistent", value: 4 }, { text: "Moderately Consistent", value: 3 }, { text: "Occasionally Consistent", value: 2 }, { text: "Rarely Consistent", value: 1 }] },
    { id: "q11", question: "If you woke up tomorrow at age 75, how confident would you feel in your body's ability to support your lifestyle?", options: [{ text: "Extremely Confident", value: 5 }, { text: "Mostly Confident", value: 4 }, { text: "Unsure", value: 3 }, { text: "Concerned", value: 2 }, { text: "Very Concerned", value: 1 }] },
    { id: "q12", question: "How confident are you that you will remain active and independent over the next 20 years?", options: [{ text: "Extremely Confident", value: 5 }, { text: "Mostly Confident", value: 4 }, { text: "Unsure", value: 3 }, { text: "Concerned", value: 2 }, { text: "Very Concerned", value: 1 }] },
    { id: "q13", question: "Which statement best describes you?", options: [{ text: "I'm actively investing in my future health and capability.", value: 5 }, { text: "I'm making progress but could be more consistent.", value: 4 }, { text: "I know I should be doing more.", value: 3 }, { text: "I've struggled to maintain healthy habits.", value: 2 }, { text: "I'm worried about where my health is heading.", value: 1 }] },
  ];

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [marketingConsent, setMarketingConsent] = useState(false);

  const totalScore = Object.values(answers).reduce((sum, score) => sum + score, 0);
  const strengthScore = (answers.q1 || 0) + (answers.q2 || 0);
  const mobilityScore = (answers.q3 || 0) + (answers.q4 || 0);
  const energyScore = (answers.q5 || 0) + (answers.q6 || 0);
  const confidenceScore = (answers.q7 || 0) + (answers.q8 || 0);
  const consistencyScore = (answers.q9 || 0) + (answers.q10 || 0);
  const futureCapabilityScore = (answers.q11 || 0) + (answers.q12 || 0) + (answers.q13 || 0);

  const categories = [
    { name: "Strength", score: strengthScore },
    { name: "Mobility", score: mobilityScore },
    { name: "Energy", score: energyScore },
    { name: "Confidence", score: confidenceScore },
    { name: "Consistency", score: consistencyScore },
    { name: "Future Capability", score: futureCapabilityScore },
  ];

  const getRecommendation = (cat) => ({ Strength: "Building strength is one of the most effective ways to improve long-term independence, resilience and physical capability. Small increases in strength can make everyday life significantly easier.", Mobility: "Improving mobility can make everyday movements easier, reduce stiffness and help you maintain physical freedom as you age. Greater mobility often leads to greater confidence.", Energy: "Low energy can make it difficult to stay active and consistent. Improving sleep, recovery and physical fitness can have a significant impact on daily energy levels.", Confidence: "Many adults lose trust in their body after periods of inactivity, injury or inconsistent exercise. The good news is that confidence can be rebuilt through small, achievable wins.", Consistency: "Consistency is often the biggest predictor of long-term success. A realistic approach that fits your lifestyle will usually outperform a perfect plan that cannot be maintained.", "Future Capability": "The choices you make today directly influence your future independence and quality of life. Investing in your health now can pay dividends for decades." })[cat] || "";

  const getNextStep = (cat) => ({ Strength: "Focus on building strength through progressive resistance training 2-3 times per week. Even small increases in strength can make everyday life easier and improve long-term independence.", Mobility: "Prioritise mobility and movement quality. Improving mobility can make daily activities easier, reduce stiffness and help you stay active for years to come.", Energy: "Focus on improving sleep, recovery and overall fitness. Better energy levels make it easier to stay active and consistent.", Confidence: "Build confidence through small, achievable wins. A structured training plan can help you develop trust in your body and your abilities.", Consistency: "Focus on creating a realistic routine you can maintain long-term. Consistency will always outperform short bursts of motivation.", "Future Capability": "Invest in habits that support your future health and independence. The actions you take today will have a major impact on your long-term quality of life." })[cat] || "";

  const lowestCategory = categories.reduce((l, c) => c.score < l.score ? c : l, categories[0]);
  const highestCategory = categories.reduce((h, c) => c.score > h.score ? c : h, categories[0]);
  const recommendation = getRecommendation(lowestCategory.name);
  const nextStep = getNextStep(lowestCategory.name);

  const getCategory = (score) => score >= 52 ? "Thriving" : score >= 43 ? "Advancing" : score >= 34 ? "Building" : score >= 25 ? "Foundation" : "At Risk";
  const category = getCategory(totalScore);

  const saveResult = async (consent) => {
    try {
      const nameToSave = firstName || userDbData?.firstName || "";
      const emailToSave = (email || user?.email || "").toLowerCase();
      if (consent && emailToSave) {
        await fetch("https://app.kit.com/forms/9528217/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ "fields[first_name]": nameToSave, email_address: emailToSave }),
        });
      }
      await addDoc(collection(db, "assessmentResults"), {
        firstName: nameToSave, email: emailToSave, capabilityScore: totalScore, category,
        strengthScore, mobilityScore, energyScore, confidenceScore, consistencyScore, futureCapabilityScore,
        marketingConsent: consent, assessmentDate: new Date().toISOString(),
      });
      setShowResults(true);
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
    }
  };

  // CONSENT SCREEN
  if (step >= questions.length && !showResults) {
    const isLoggedIn = !!user;
    const alreadyConsented = userDbData?.marketingConsent === true;

    if (isLoggedIn && alreadyConsented) {
      saveResult(true);
      return null;
    }

    if (isLoggedIn) {
      return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0d2b1f 0%, #1a3a2a 50%, #2d6a4f 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: "36px 28px", width: "100%", maxWidth: "420px" }}>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎯</div>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Your results are ready</h2>
              <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>One quick question before you see your score.</p>
            </div>
            <div onClick={() => setMarketingConsent(c => !c)} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px", borderRadius: "12px", backgroundColor: marketingConsent ? "#eaf5ef" : "#f7f5f2", border: `1.5px solid ${marketingConsent ? "#2d6a4f" : "#e5e5e5"}`, cursor: "pointer", marginBottom: "20px" }}>
              <div style={{ width: 20, height: 20, borderRadius: "5px", backgroundColor: marketingConsent ? "#2d6a4f" : "#fff", border: `2px solid ${marketingConsent ? "#2d6a4f" : "#ccc"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                {marketingConsent && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <p style={{ fontSize: "13px", color: "#555", margin: 0, lineHeight: 1.5 }}>I'd like to receive training tips, programme updates and coaching advice from Training for Life. You can unsubscribe at any time.</p>
            </div>
            <button onClick={() => saveResult(marketingConsent)} style={{ width: "100%", background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", color: "#fff", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>
              See My Results
            </button>
            <button onClick={() => saveResult(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>Skip</button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0d2b1f 0%, #1a3a2a 50%, #2d6a4f 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: "36px 28px", width: "100%", maxWidth: "420px" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎯</div>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Unlock Your Results</h2>
            <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>Enter your details to view your personalised Capability Assessment.</p>
          </div>
          <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ width: "100%", padding: "13px 14px", borderRadius: "10px", border: "1px solid #e5e5e5", fontSize: "15px", marginBottom: "12px", boxSizing: "border-box", outline: "none" }} />
          <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: "13px 14px", borderRadius: "10px", border: "1px solid #e5e5e5", fontSize: "15px", marginBottom: "12px", boxSizing: "border-box", outline: "none" }} />
          <div onClick={() => setMarketingConsent(c => !c)} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px", borderRadius: "12px", backgroundColor: marketingConsent ? "#eaf5ef" : "#f7f5f2", border: `1.5px solid ${marketingConsent ? "#2d6a4f" : "#e5e5e5"}`, cursor: "pointer", marginBottom: "20px" }}>
            <div style={{ width: 20, height: 20, borderRadius: "5px", backgroundColor: marketingConsent ? "#2d6a4f" : "#fff", border: `2px solid ${marketingConsent ? "#2d6a4f" : "#ccc"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
              {marketingConsent && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <p style={{ fontSize: "13px", color: "#555", margin: 0, lineHeight: 1.5 }}>I'd like to receive training tips, programme updates and coaching advice from Training for Life. You can unsubscribe at any time.</p>
          </div>
          <button onClick={async () => {
            if (!firstName.trim()) { alert("Please enter your first name"); return; }
            if (!email.trim()) { alert("Please enter your email address"); return; }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert("Please enter a valid email address"); return; }
            await saveResult(marketingConsent);
          }} style={{ width: "100%", background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", color: "#fff", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>
            Unlock My Results
          </button>
        </div>
      </div>
    );
  }

  // RESULTS SCREEN
  if (step >= questions.length && showResults) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", padding: "24px 16px 48px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          <ResultsHero totalScore={totalScore} category={category} />
          <ResultsProfile strengthScore={strengthScore} mobilityScore={mobilityScore} energyScore={energyScore} confidenceScore={confidenceScore} consistencyScore={consistencyScore} futureCapabilityScore={futureCapabilityScore} />
          <ResultsStrength highestCategory={highestCategory} />
          <ResultsOpportunity lowestCategory={lowestCategory} recommendation={recommendation} />
          <ResultsNextStep nextStep={nextStep} />
          <ResultsCTA />
          <div style={{ textAlign: "center", paddingTop: "8px" }}>
            {user ? (
              <Link to="/dashboard" style={{ display: "inline-block", background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", color: "#fff", fontSize: "15px", fontWeight: 700, padding: "15px 32px", borderRadius: "14px", textDecoration: "none" }}>
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Save Your Results</h3>
                <p style={{ fontSize: "14px", color: "#666", margin: "0 0 20px" }}>Create a free account to track your capability score over time.</p>
                <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                  <Link to={`/register?email=${encodeURIComponent(email || "")}`} style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", color: "#fff", fontSize: "15px", fontWeight: 700, padding: "13px 24px", borderRadius: "12px", textDecoration: "none" }}>
                    Create Free Account
                  </Link>
                  <Link to="/login" style={{ backgroundColor: "#fff", color: "#111", fontSize: "15px", fontWeight: 700, padding: "13px 24px", borderRadius: "12px", textDecoration: "none", border: "0.5px solid #e5e5e5" }}>
                    Login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // QUIZ SCREEN
  const currentQuestion = questions[step];
  const sectionLabel = SECTION_LABELS[currentQuestion.id];
  const pct = ((step + 1) / questions.length) * 100;

  const handleAnswer = (value) => {
    setSelected(value);
    setTimeout(() => {
      setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));
      setSelected(null);
      setStep(s => s + 1);
    }, 300);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0d2b1f 0%, #1a3a2a 60%, #2d6a4f 100%)", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Training for Life</p>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontWeight: 600, margin: 0 }}>{step + 1} / {questions.length}</p>
      </div>

      {/* Progress bar */}
      <div style={{ margin: "14px 20px 0", height: "3px", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: "2px" }}>
        <div style={{ height: "3px", backgroundColor: "#4ade80", borderRadius: "2px", width: `${pct}%`, transition: "width 0.3s ease" }} />
      </div>

      {/* Section label */}
      <div style={{ padding: "16px 20px 0" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.1em", backgroundColor: "rgba(159,225,203,0.12)", padding: "4px 10px", borderRadius: "20px" }}>
          {sectionLabel}
        </span>
      </div>

      {/* Question */}
      <div style={{ padding: "20px 20px 0", flex: 1 }}>
        <h2 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", lineHeight: 1.3, margin: "0 0 28px" }}>
          {currentQuestion.question}
        </h2>

        {/* Answer options */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {currentQuestion.options.map((option, i) => {
            const isSelected = selected === option.value;
            return (
              <button
                key={option.text}
                onClick={() => handleAnswer(option.value)}
                style={{
                  width: "100%",
                  padding: "16px 18px",
                  borderRadius: "14px",
                  border: `1.5px solid ${isSelected ? "#4ade80" : "rgba(255,255,255,0.12)"}`,
                  backgroundColor: isSelected ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)",
                  color: isSelected ? "#4ade80" : "#fff",
                  fontSize: "15px",
                  fontWeight: isSelected ? 700 : 500,
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  transform: isSelected ? "scale(0.98)" : "scale(1)",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: isSelected ? "#4ade80" : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "12px", fontWeight: 700, color: isSelected ? "#1a3a2a" : "rgba(255,255,255,0.4)" }}>
                  {isSelected ? "✓" : String.fromCharCode(65 + i)}
                </div>
                {option.text}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "24px 20px 40px", textAlign: "center" }}>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", margin: 0 }}>
          Tap an answer to continue
        </p>
      </div>
    </div>
  );
}
