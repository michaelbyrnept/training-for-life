import { useState } from "react";

import ResultsHero from "../components/capability/ResultsHero";
import ResultsProfile from "../components/capability/ResultsProfile";
import ResultsStrength from "../components/capability/ResultsStrength";
import ResultsOpportunity from "../components/capability/ResultsOpportunity";
import ResultsNextStep from "../components/capability/ResultsNextStep";
import ResultsCTA from "../components/capability/ResultsCTA";
import { Link } from "react-router-dom";

import { collection, addDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function CapabilityScore() {
  const user = auth.currentUser;
 const questions = [
  // STRENGTH

  {
    id: "q1",
    question:
      "How confident are you lifting and carrying everyday objects?",
    options: [
      { text: "Very Confident", value: 5 },
      { text: "Mostly Confident", value: 4 },
      { text: "Somewhat Confident", value: 3 },
      { text: "Rarely Confident", value: 2 },
      { text: "Not Confident", value: 1 },
    ],
  },

  {
    id: "q2",
    question:
      "Can you comfortably carry two full shopping bags for 50 metres?",
    options: [
      { text: "Easily", value: 5 },
      { text: "With Minor Effort", value: 4 },
      { text: "With Moderate Effort", value: 3 },
      { text: "Difficult", value: 2 },
      { text: "Cannot", value: 1 },
    ],
  },

  // MOBILITY

  {
    id: "q3",
    question:
      "Can you get down to the floor and back up again without assistance?",
    options: [
      { text: "Easily", value: 5 },
      { text: "With Minor Effort", value: 4 },
      { text: "With Moderate Effort", value: 3 },
      { text: "Difficult", value: 2 },
      { text: "Cannot", value: 1 },
    ],
  },

  {
    id: "q4",
    question:
      "How often do stiffness, aches, or limited movement affect your day-to-day life?",
    options: [
      { text: "Never", value: 5 },
      { text: "Rarely", value: 4 },
      { text: "Sometimes", value: 3 },
      { text: "Often", value: 2 },
      { text: "Very Often", value: 1 },
    ],
  },

  // ENERGY

  {
    id: "q5",
    question:
      "At the end of most days, how physically energised do you feel?",
    options: [
      { text: "Very Energised", value: 5 },
      { text: "Mostly Energised", value: 4 },
      { text: "Average", value: 3 },
      { text: "Tired", value: 2 },
      { text: "Exhausted", value: 1 },
    ],
  },

  {
    id: "q6",
    question:
      "How often do you avoid activities because you feel you don't have the energy?",
    options: [
      { text: "Never", value: 5 },
      { text: "Rarely", value: 4 },
      { text: "Sometimes", value: 3 },
      { text: "Often", value: 2 },
      { text: "Very Often", value: 1 },
    ],
  },

  // CONFIDENCE

  {
    id: "q7",
    question:
      "How confident do you feel exercising without guidance or supervision?",
    options: [
      { text: "Very Confident", value: 5 },
      { text: "Mostly Confident", value: 4 },
      { text: "Somewhat Confident", value: 3 },
      { text: "Slightly Confident", value: 2 },
      { text: "Not Confident", value: 1 },
    ],
  },

  {
    id: "q8",
    question:
      "How much do you trust your body to do what you ask of it?",
    options: [
      { text: "Completely", value: 5 },
      { text: "Mostly", value: 4 },
      { text: "Somewhat", value: 3 },
      { text: "Very Little", value: 2 },
      { text: "Not At All", value: 1 },
    ],
  },

  // CONSISTENCY

  {
    id: "q9",
    question:
      "When life becomes busy, what usually happens to your exercise routine?",
    options: [
      { text: "It Stays Consistent", value: 5 },
      { text: "Slight Reduction", value: 4 },
      { text: "Moderate Reduction", value: 3 },
      { text: "Usually Stops", value: 2 },
      { text: "Completely Stops", value: 1 },
    ],
  },

  {
    id: "q10",
    question:
      "Over the last 12 months, how would you describe your consistency with exercise?",
    options: [
      { text: "Extremely Consistent", value: 5 },
      { text: "Mostly Consistent", value: 4 },
      { text: "Moderately Consistent", value: 3 },
      { text: "Occasionally Consistent", value: 2 },
      { text: "Rarely Consistent", value: 1 },
    ],
  },

  // FUTURE CAPABILITY

  {
    id: "q11",
    question:
      "If you woke up tomorrow at age 75, how confident would you feel in your body's ability to support your lifestyle?",
    options: [
      { text: "Extremely Confident", value: 5 },
      { text: "Mostly Confident", value: 4 },
      { text: "Unsure", value: 3 },
      { text: "Concerned", value: 2 },
      { text: "Very Concerned", value: 1 },
    ],
  },

  {
    id: "q12",
    question:
      "How confident are you that you will remain active and independent over the next 20 years?",
    options: [
      { text: "Extremely Confident", value: 5 },
      { text: "Mostly Confident", value: 4 },
      { text: "Unsure", value: 3 },
      { text: "Concerned", value: 2 },
      { text: "Very Concerned", value: 1 },
    ],
  },

  {
    id: "q13",
    question:
      "Which statement best describes you?",
    options: [
      {
        text: "I'm actively investing in my future health and capability.",
        value: 5,
      },
      {
        text: "I'm making progress but could be more consistent.",
        value: 4,
      },
      {
        text: "I know I should be doing more.",
        value: 3,
      },
      {
        text: "I've struggled to maintain healthy habits.",
        value: 2,
      },
      {
        text: "I'm worried about where my health is heading.",
        value: 1,
      },
    ],
  },
];
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
const [showResults, setShowResults] = useState(false);
const [firstName, setFirstName] = useState("");
const [email, setEmail] = useState("");
  const totalScore = Object.values(answers).reduce(
    (sum, score) => sum + score,
    0
  );
const strengthScore =
  (answers.q1 || 0) +
  (answers.q2 || 0);

const mobilityScore =
  (answers.q3 || 0) +
  (answers.q4 || 0);

const energyScore =
  (answers.q5 || 0) +
  (answers.q6 || 0);

const confidenceScore =
  (answers.q7 || 0) +
  (answers.q8 || 0);

const consistencyScore =
  (answers.q9 || 0) +
  (answers.q10 || 0);

const futureCapabilityScore =
  (answers.q11 || 0) +
  (answers.q12 || 0) +
  (answers.q13 || 0);
  const categories = [
  {
    name: "Strength",
    score: strengthScore,
  },
  {
    name: "Mobility",
    score: mobilityScore,
  },
  {
    name: "Energy",
    score: energyScore,
  },
  {
    name: "Confidence",
    score: confidenceScore,
  },
  {
    name: "Consistency",
    score: consistencyScore,
  },
  {
    name: "Future Capability",
    score: futureCapabilityScore,
  },
];
const getRecommendation = (category) => {
  switch (category) {
    case "Strength":
      return "Building strength is one of the most effective ways to improve long-term independence, resilience and physical capability. Small increases in strength can make everyday life significantly easier.";

    case "Mobility":
      return "Improving mobility can make everyday movements easier, reduce stiffness and help you maintain physical freedom as you age. Greater mobility often leads to greater confidence.";

    case "Energy":
      return "Low energy can make it difficult to stay active and consistent. Improving sleep, recovery and physical fitness can have a significant impact on daily energy levels.";

    case "Confidence":
      return "Many adults lose trust in their body after periods of inactivity, injury or inconsistent exercise. The good news is that confidence can be rebuilt through small, achievable wins.";

    case "Consistency":
      return "Consistency is often the biggest predictor of long-term success. A realistic approach that fits your lifestyle will usually outperform a perfect plan that cannot be maintained.";

    case "Future Capability":
      return "The choices you make today directly influence your future independence and quality of life. Investing in your health now can pay dividends for decades.";

    default:
      return "";
  }
};
const getNextStep = (category) => {
  switch (category) {
    case "Strength":
      return "Focus on building strength through progressive resistance training 2-3 times per week. Even small increases in strength can make everyday life easier and improve long-term independence.";

    case "Mobility":
      return "Prioritise mobility and movement quality. Improving mobility can make daily activities easier, reduce stiffness and help you stay active for years to come.";

    case "Energy":
      return "Focus on improving sleep, recovery and overall fitness. Better energy levels make it easier to stay active and consistent.";

    case "Confidence":
      return "Build confidence through small, achievable wins. A structured training plan can help you develop trust in your body and your abilities.";

    case "Consistency":
      return "Focus on creating a realistic routine you can maintain long-term. Consistency will always outperform short bursts of motivation.";

    case "Future Capability":
      return "Invest in habits that support your future health and independence. The actions you take today will have a major impact on your long-term quality of life.";

    default:
      return "";
  }
};
const lowestCategory = categories.reduce(
  (lowest, current) =>
    current.score < lowest.score ? current : lowest,
  categories[0]
);

const recommendation = getRecommendation(
  lowestCategory.name
);
const nextStep = getNextStep(
  lowestCategory.name
);
const highestCategory = categories.reduce(
  (highest, current) =>
    current.score > highest.score ? current : highest,
  categories[0]
);
 const getCategory = (score) => {
  if (score >= 52) return "Thriving";
  if (score >= 43) return "Advancing";
  if (score >= 34) return "Building";
  if (score >= 25) return "Foundation";

  return "At Risk";
};
const getSummary = (category) => {
  switch (category) {
    case "Thriving":
      return "You have strong foundations for long-term capability, confidence and independence. You're already doing many things well and have built habits that support a healthy, active future.";

    case "Advancing":
      return "You have several strong foundations in place and are moving in the right direction. Small improvements now can have a significant impact on your long-term capability and quality of life.";

    case "Building":
      return "You have a solid starting point, but there are several opportunities to improve your strength, confidence and long-term resilience. Consistent action now can create meaningful improvements over time.";

    case "Foundation":
      return "Several areas of capability would benefit from greater attention. The good news is that sustainable progress doesn't require perfection. Small, consistent actions can create significant change.";

    case "At Risk":
      return "Your results suggest there are important opportunities to improve your future capability and independence. The earlier action is taken, the easier it becomes to build a stronger and more capable future.";

    default:
      return "";
  }
};
  const category = getCategory(totalScore);
const summary = getSummary(category);
if (step >= questions.length && !showResults) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">

        <h2 className="mb-4 text-3xl font-bold">
          Unlock Your Results
        </h2>

        <p className="mb-6 text-zinc-600">
          Enter your details below to view your personalised Capability Assessment and receive your Capability Guide.
        </p>

        <input
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="mb-4 w-full rounded-xl border border-zinc-300 p-4"
        />

        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-6 w-full rounded-xl border border-zinc-300 p-4"
        />

        <button
      onClick={async () => {
        if (!firstName.trim()) {
  alert("Please enter your first name");
  return;
}

if (!email.trim()) {
  alert("Please enter your email address");
  return;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!emailRegex.test(email)) {
  alert("Please enter a valid email address");
  return;
}
  try {
    await fetch(
      
      
      "https://app.kit.com/forms/9528217/subscriptions",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "fields[first_name]": firstName,
          email_address: email,
        }),
        
      }
    );
await addDoc(
  collection(db, "assessmentResults"),
  {
    firstName,
    email,

    capabilityScore: totalScore,
    category,

    strengthScore,
    mobilityScore,
    energyScore,
    confidenceScore,
    consistencyScore,
    futureCapabilityScore,

    assessmentDate: new Date().toISOString(),
  }
);
    setShowResults(true);
  } catch (error) {
    console.error(error);
    alert("Something went wrong.");
  }
}}
          className="w-full rounded-xl bg-emerald-700 p-4 font-semibold text-white"
        >
          Unlock My Results
        </button>

      </div>
    </div>
  );
}
 if (step >= questions.length && showResults) {
  return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
     <div className="max-w-7xl mx-auto">
       <div className="grid gap-6 lg:grid-cols-2">

  <ResultsHero
    totalScore={totalScore}
    category={category}
  />

  <ResultsProfile
    strengthScore={strengthScore}
    mobilityScore={mobilityScore}
    energyScore={energyScore}
    confidenceScore={confidenceScore}
    consistencyScore={consistencyScore}
    futureCapabilityScore={futureCapabilityScore}
  />

</div>

<div className="mt-8 grid gap-6 md:grid-cols-3">

  <ResultsStrength
    highestCategory={highestCategory}
  />

  <ResultsOpportunity
    lowestCategory={lowestCategory}
    recommendation={recommendation}
  />

  <ResultsNextStep
    nextStep={nextStep}
  />

</div>
<ResultsCTA />

<div className="mt-12 text-center">

  <h3 className="text-2xl font-bold mb-3">
    Save Your Results
  </h3>

  <p className="text-zinc-600 mb-6">
    Create a free account to track your capability score over time.
  </p>

  <div className="flex flex-col sm:flex-row justify-center gap-4">

   <Link
  to={`/register?email=${encodeURIComponent(email)}`}
  className="rounded-xl bg-emerald-700 px-6 py-3 font-medium text-white"
>
  Create Free Account
</Link>
    <Link
      to="/login"
      className="rounded-xl border px-6 py-3 font-medium"
    >
      Login
    </Link>

  </div>

</div>
</div>
        </div>
    );
  }
  

  const currentQuestion = questions[step];

  const handleAnswer = (value) => {
    setAnswers({
      ...answers,
      [currentQuestion.id]: value,
    });

    setStep(step + 1);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-5xl font-bold mb-6">
          Discover Your Capability Score
        </h1>

        <p className="text-xl text-zinc-600">
          Assess your strength, mobility, confidence,
          energy and long-term independence in under
          3 minutes.
        </p>

        <div className="mt-10">
          <div className="h-3 w-full rounded-full bg-zinc-200">
            <div
              className="h-3 rounded-full bg-emerald-700"
              style={{
                width: `${((step + 1) / questions.length) * 100}%`,
              }}
            />
          </div>

          <p className="mt-2 text-sm text-zinc-500">
            Question {step + 1} of {questions.length}
          </p>
        </div>

        <h2 className="mt-12 text-3xl font-bold">
          {currentQuestion.question}
        </h2>

        <div className="mt-8 space-y-4">
          {currentQuestion.options.map((option) => (
            <button
              key={option.text}
              onClick={() => handleAnswer(option.value)}
              className="w-full rounded-2xl border border-zinc-300 bg-white p-5 text-left transition hover:border-emerald-700 hover:bg-emerald-50"
            >
              {option.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}