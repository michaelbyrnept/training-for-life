
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
const [metricName, setMetricName] = useState("Bodyweight");
const [metricValue, setMetricValue] = useState("");
  const [firstName, setFirstName] = useState("");
  const [capabilityScore, setCapabilityScore] = useState("");
  const [category, setCategory] = useState("");
  const [email, setEmail] = useState("");
  const [assessmentDate, setAssessmentDate] = useState("");
  const [strengthScore, setStrengthScore] = useState("");
const [mobilityScore, setMobilityScore] = useState("");
const [energyScore, setEnergyScore] = useState("");
const [confidenceScore, setConfidenceScore] = useState("");
const [consistencyScore, setConsistencyScore] = useState("");
const handleLogout = async () => {
  await signOut(auth);
  navigate("/");
};
const handleSaveMetric = async () => {
  if (!metricValue) return;

  await addDoc(
    collection(db, "metrics"),
    {
      email,
      metricName,
      value: Number(metricValue),
      date: new Date().toISOString(),
    }
  );

  setMetricValue("");
  alert("Metric saved");
};
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
  navigate("/login");
  return;
}

      setEmail(user.email);

      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setFirstName(docSnap.data().firstName);
      }
      const resultsQuery = query(
  collection(db, "assessmentResults"),
  where("email", "==", user.email)
);

const resultsSnapshot = await getDocs(resultsQuery);

if (!resultsSnapshot.empty) {
    console.log(resultsSnapshot.docs.map(doc => doc.data()));
  const resultData = resultsSnapshot.docs[0].data();

  setCapabilityScore(resultData.capabilityScore);
  setCategory(resultData.category);
  setAssessmentDate(resultData.assessmentDate);
  setStrengthScore(resultData.strengthScore);
setMobilityScore(resultData.mobilityScore);
setEnergyScore(resultData.energyScore);
setConfidenceScore(resultData.confidenceScore);
setConsistencyScore(resultData.consistencyScore);
}
    });

    return () => unsubscribe();
  }, [navigate]);
let scoreColor = "text-red-600";
let badgeColor = "bg-red-100 text-red-700";

if (category === "Developing") {
  scoreColor = "text-amber-600";
  badgeColor = "bg-amber-100 text-amber-700";
}

if (category === "Thriving") {
  scoreColor = "text-emerald-600";
  badgeColor = "bg-emerald-100 text-emerald-700";
}
  return (
  <div className="min-h-screen bg-stone-50 p-8">

    <div className="flex justify-between items-center mb-8">
      <div>
    <h1 className="text-3xl font-bold text-emerald-700">
  Training For Life
</h1>

        <h2 className="text-xl font-semibold">
  Welcome Back, {firstName}
</h2>
<p className="text-zinc-500 mt-1">
  Training For Life Member Portal
</p>
       <p className="text-zinc-500 text-sm">
  {email}
</p>
      </div>

      <div className="flex gap-3">
       <Link
  to="/"
  className="px-4 py-2 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 transition"
>
  Home
</Link>

       <Link
  to="/capability-score"
  className="px-4 py-2 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 transition"
>
  Retake Assessment
</Link>
     <button
  onClick={handleLogout}
  className="text-zinc-500 hover:text-zinc-700"
>
  Logout
</button>
      </div>
    </div>

    <hr className="mb-6" />

  <div className="bg-white rounded-2xl shadow-lg p-8">
  <p className="text-zinc-500">
    Capability Score
  </p>

 <h2 className={`text-7xl font-bold ${scoreColor}`}>
  {capabilityScore}
</h2>

<span
  className={`inline-block mt-3 px-3 py-1 rounded-full font-medium ${badgeColor}`}
>
  {category}
</span>
</div>

<div className="grid md:grid-cols-2 gap-4 mt-6">

  <div className="bg-white p-4 rounded-xl shadow">
    <p className="text-zinc-500">
      Category
    </p>

    <h3 className="text-2xl font-bold">
      {category}
    </h3>
  </div>

  <div className="bg-white p-4 rounded-xl shadow">
    <p className="text-zinc-500">
      Assessment Date
    </p>

    <h3 className="text-2xl font-bold">
      {assessmentDate
        ? new Date(assessmentDate).toLocaleDateString()
        : "-"}
    </h3>
  </div>

</div>
<h2 className="text-2xl font-bold mt-8 mb-4">
  Capability Breakdown
</h2>
<div className="grid md:grid-cols-5 gap-4 mt-8">

 <div className="bg-white border-l-4 border-emerald-600 p-4 rounded-xl shadow">
    <h3>Strength</h3>
    <p className="text-3xl font-bold">
      {strengthScore}
    </p>
  </div>

 <div className="bg-white border-l-4 border-emerald-600 p-4 rounded-xl shadow">
    <h3>Mobility</h3>
    <p className="text-3xl font-bold">
      {mobilityScore}
    </p>
  </div>

 <div className="bg-white border-l-4 border-emerald-600 p-4 rounded-xl shadow">
    <h3>Energy</h3>
    <p className="text-3xl font-bold">
      {energyScore}
    </p>
  </div>

 <div className="bg-white border-l-4 border-emerald-600 p-4 rounded-xl shadow">
    <h3>Confidence</h3>
    <p className="text-3xl font-bold">
      {confidenceScore}
    </p>
  </div>

 <div className="bg-white border-l-4 border-emerald-600 p-4 rounded-xl shadow">
    <h3>Consistency</h3>
    <p className="text-3xl font-bold">
      {consistencyScore}
    </p>
  </div>

</div>
</div>

  );
}