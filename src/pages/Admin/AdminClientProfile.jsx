import { useState, useEffect } from "react";
import { doc, getDoc, getDocs, collection, query, where, updateDoc, addDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { Link, useParams } from "react-router-dom";

const TIERS = [
  { id: "free", label: "Free", color: "#888", bg: "#f0f0f0" },
  { id: "premium", label: "Premium", color: "#b45309", bg: "#fffbeb" },
  { id: "premium_trial", label: "Trial", color: "#7c3aed", bg: "#f5f3ff" },
  { id: "in-person", label: "In-Person", color: "#2d6a4f", bg: "#eaf5ef" },
];

function tierInfo(tier) {
  return TIERS.find(t => t.id === tier) || TIERS[0];
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function timeAgo(dateStr) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

export default function AdminClientProfile() {
  const { uid } = useParams();
  const [client, setClient] = useState(null);
  const [programmes, setProgrammes] = useState([]);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [capabilityScore, setCapabilityScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTierSheet, setShowTierSheet] = useState(false);
  const [showProgrammeSheet, setShowProgrammeSheet] = useState(null); // "strength" | "cardio"
  const [showNoteSheet, setShowNoteSheet] = useState(false);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadAll();
  }, [uid]);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Load client
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        setClient({ uid, ...userSnap.data() });
      }

      // Load programmes
      const progSnap = await getDocs(collection(db, "programmes"));
      setProgrammes(progSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.published));

      // Load workout logs
      const logsSnap = await getDocs(collection(db, "workoutLogs"));
      const myLogs = logsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(l => l.userId === uid)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
      setWorkoutLogs(myLogs);

      // Load capability score
      const userData = userSnap.data();
      if (userData?.email) {
        const scoreSnap = await getDocs(query(collection(db, "assessmentResults"), where("email", "==", userData.email)));
        if (!scoreSnap.empty) {
          setCapabilityScore(scoreSnap.docs[0].data());
        }
      }

      // Load admin notes
      const notesSnap = await getDocs(collection(db, "clientNotes"));
      const clientNotes = notesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(n => n.clientId === uid)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setNotes(clientNotes);

    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const updateTier = async (tier) => {
    setSaving(true);
    await updateDoc(doc(db, "users", uid), { subscription: tier });
    setClient(prev => ({ ...prev, subscription: tier }));
    setShowTierSheet(false);
    setSaving(false);
  };

  const assignProgramme = async (type, programmeId) => {
    setSaving(true);
    const field = type === "strength" ? "strengthProgrammeId" : "cardioProgrammeId";
    await updateDoc(doc(db, "users", uid), { [field]: programmeId });
    setClient(prev => ({ ...prev, [field]: programmeId }));
    setShowProgrammeSheet(null);
    setSaving(false);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    const noteData = {
      clientId: uid,
      note: newNote.trim(),
      createdAt: new Date().toISOString(),
    };
    const ref = await addDoc(collection(db, "clientNotes"), noteData);
    setNotes(prev => [{ id: ref.id, ...noteData }, ...prev]);
    setNewNote("");
    setShowNoteSheet(false);
    setSaving(false);
  };

  const [resendStatus, setResendStatus] = useState(""); // "" | "sending" | "sent" | "error"

  const resendSetupEmail = async () => {
    if (!client.email) return;
    setResendStatus("sending");
    try {
      await sendPasswordResetEmail(getAuth(), client.email);
      setResendStatus("sent");
      setTimeout(() => setResendStatus(""), 3000);
    } catch (e) {
      console.error(e);
      setResendStatus("error");
      setTimeout(() => setResendStatus(""), 3000);
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 24px" }}>
        <Link to="/admin/clients" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>← Clients</Link>
      </div>
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
    </div>
  );

  if (!client) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 24px" }}>
        <Link to="/admin/clients" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>← Clients</Link>
      </div>
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Client not found.</p>
    </div>
  );

  const tier = tierInfo(client.subscription || "free");
  const displayName = client.nickname || client.firstName || client.email?.split("@")[0] || "Unknown";
  const strengthProgramme = programmes.find(p => p.id === client.strengthProgrammeId);
  const cardioProgramme = programmes.find(p => p.id === client.cardioProgrammeId);
  const { monday, sunday } = getWeekRange();
  const thisWeekLogs = workoutLogs.filter(l => {
    const d = new Date(l.completedAt);
    return d >= monday && d <= sunday;
  });
  const strengthOptions = programmes.filter(p => p.tag !== "cardio" && p.tag !== "walk");
  const cardioOptions = programmes.filter(p => p.tag === "cardio" || p.tag === "walk" || p.repeating);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 28px" }}>
        <Link to="/admin/clients" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>
          ← Clients
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "14px" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: tier.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 700, color: tier.color, flexShrink: 0 }}>
            {getInitials(displayName)}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>{displayName}</h1>
            <p style={{ fontSize: "13px", color: "#9fe1cb", margin: "0 0 6px" }}>{client.email}</p>
            {client.createdByAdmin && (
              <button
                onClick={resendSetupEmail}
                disabled={resendStatus === "sending"}
                style={{ background: "none", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "20px", padding: "4px 10px", fontSize: "11px", fontWeight: 700, color: resendStatus === "sent" ? "#4ade80" : resendStatus === "error" ? "#f87171" : "#9fe1cb", cursor: resendStatus === "sending" ? "not-allowed" : "pointer" }}
              >
                {resendStatus === "sending" ? "Sending..." : resendStatus === "sent" ? "✓ Email sent" : resendStatus === "error" ? "Failed -- try again" : "Resend setup email"}
              </button>
            )}
          </div>
          <div
            onClick={() => setShowTierSheet(true)}
            style={{ backgroundColor: tier.bg, color: tier.color, fontSize: "12px", fontWeight: 700, padding: "6px 12px", borderRadius: "20px", cursor: "pointer" }}
          >
            {tier.label}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", backgroundColor: "#fff", borderBottom: "0.5px solid #e5e5e5" }}>
        {["overview", "training", "notes"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ flex: 1, padding: "12px 8px", border: "none", backgroundColor: "transparent", fontSize: "13px", fontWeight: 700, color: activeTab === tab ? "#2d6a4f" : "#aaa", cursor: "pointer", borderBottom: activeTab === tab ? "2px solid #2d6a4f" : "2px solid transparent", textTransform: "capitalize" }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px" }}>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <>
            {/* This week */}
            <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "16px", marginBottom: "12px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>This Week</p>
              <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1 }}>{thisWeekLogs.length}</p>
                  <p style={{ fontSize: "11px", color: "#9fe1cb", margin: "4px 0 0" }}>Sessions</p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1 }}>{workoutLogs.length}</p>
                  <p style={{ fontSize: "11px", color: "#9fe1cb", margin: "4px 0 0" }}>Total</p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "28px", fontWeight: 700, color: workoutLogs.length > 0 ? "#4ade80" : "#aaa", margin: 0, lineHeight: 1 }}>
                    {workoutLogs.length > 0 ? timeAgo(workoutLogs[0].completedAt) : "Never"}
                  </p>
                  <p style={{ fontSize: "11px", color: "#9fe1cb", margin: "4px 0 0" }}>Last session</p>
                </div>
              </div>
            </div>
            {/* PAR-Q flag */}
{client.parQComplete && (
  <div style={{ backgroundColor: client.parQFlag ? "#fffbeb" : "#eaf5ef", borderRadius: "16px", border: `0.5px solid ${client.parQFlag ? "#fcd34d" : "#86efac"}`, padding: "14px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
    <span style={{ fontSize: "24px" }}>{client.parQFlag ? "⚠️" : "✅"}</span>
    <div>
      <p style={{ fontSize: "14px", fontWeight: 700, color: client.parQFlag ? "#b45309" : "#2d6a4f", margin: 0 }}>
        {client.parQFlag ? "PAR-Q Flag -- follow up required" : "PAR-Q complete -- all clear"}
      </p>
      <p style={{ fontSize: "12px", color: "#888", margin: "3px 0 0" }}>
        Completed {client.parQDate ? new Date(client.parQDate).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }) : ""}
      </p>
    </div>
  </div>
)}

{!client.parQComplete && client.subscription === "in-person" && (
  <div style={{ backgroundColor: "#f7f5f2", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "14px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
    <span style={{ fontSize: "24px" }}>📋</span>
    <p style={{ fontSize: "14px", fontWeight: 700, color: "#aaa", margin: 0 }}>PAR-Q not yet completed</p>
  </div>
)}
{/* Profile info */}
<div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
  <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Profile</p>

           
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Gender", value: client.gender ? client.gender.charAt(0).toUpperCase() + client.gender.slice(1) : "Not set" },
                  { label: "Date of birth", value: client.dob ? new Date(client.dob).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }) : "Not set" },
                  { label: "Height", value: client.height ? `${client.height}${client.units === "imperial" ? "ft" : "cm"}` : "Not set" },
                  { label: "Weight", value: client.weightPrivate ? "Prefer not to say" : client.weight ? `${client.weight}${client.units === "imperial" ? "lbs" : "kg"}` : "Not set" },
                  { label: "Goal weight", value: client.noGoalWeight ? "No goal" : client.goalWeight ? `${client.goalWeight}${client.units === "imperial" ? "lbs" : "kg"}` : "Not set" },
                  { label: "Primary goal", value: client.goal ? client.goal.charAt(0).toUpperCase() + client.goal.slice(1) : "Not set" },
                  { label: "Training days", value: client.daysPerWeek ? `${client.daysPerWeek}x per week` : "Not set" },
                  { label: "Joined", value: client.createdAt ? new Date(client.createdAt).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }) : "Unknown" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "0.5px solid #f5f5f5" }}>
                    <span style={{ fontSize: "13px", color: "#888" }}>{item.label}</span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#111" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Capability standards */}
            {client.capabilityStandards && (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Capability Standards</p>
                <div style={{ display: "flex", gap: "10px" }}>
                  {[
                    { icon: "🏋️", label: "Bench", value: `${client.capabilityStandards.bench}kg` },
                    { icon: "💪", label: "Deadlift", value: `${client.capabilityStandards.deadlift}kg` },
                    { icon: "🏃", label: "5k", value: client.capabilityStandards.run5k },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, backgroundColor: "#eaf5ef", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
                      <p style={{ fontSize: "18px", margin: "0 0 4px" }}>{s.icon}</p>
                      <p style={{ fontSize: "16px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{s.value}</p>
                      <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>{s.label}</p>
                    </div>
                  ))}
                </div>
                {capabilityScore && (
                  <div style={{ marginTop: "12px", padding: "10px 12px", backgroundColor: "#f7f5f2", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", color: "#555" }}>Capability Score</span>
                    <span style={{ fontSize: "18px", fontWeight: 700, color: "#2d6a4f" }}>{capabilityScore.capabilityScore} / 65</span>
                  </div>
                )}
              </div>
            )}

            {/* Recent sessions */}
            {workoutLogs.length > 0 && (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Recent Sessions</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {workoutLogs.slice(0, 5).map(log => (
                    <div key={log.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #f5f5f5" }}>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: 0 }}>{log.workoutId}</p>
                        <p style={{ fontSize: "11px", color: "#aaa", margin: "2px 0 0" }}>
                          {new Date(log.completedAt).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <span style={{ fontSize: "11px", color: "#2d6a4f", fontWeight: 700 }}>
                        {Object.keys(log.logs || {}).length} exercises
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* TRAINING TAB */}
        {activeTab === "training" && (
          <>
            {/* Strength programme */}
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Strength Programme</p>
                <button onClick={() => setShowProgrammeSheet("strength")} style={{ background: "none", border: "none", fontSize: "12px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer", padding: 0 }}>
                  {strengthProgramme ? "Change" : "Assign"}
                </button>
              </div>
              {strengthProgramme ? (
                <div style={{ backgroundColor: "#eaf5ef", borderRadius: "12px", padding: "12px 14px" }}>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#1a4a35", margin: 0 }}>{strengthProgramme.name}</p>
                  <p style={{ fontSize: "12px", color: "#2d6a4f", margin: "3px 0 0" }}>{strengthProgramme.description}</p>
                </div>
              ) : (
                <div onClick={() => setShowProgrammeSheet("strength")} style={{ padding: "14px", borderRadius: "12px", border: "1.5px dashed #e5e5e5", textAlign: "center", cursor: "pointer" }}>
                  <p style={{ fontSize: "13px", color: "#aaa", margin: 0 }}>No strength programme assigned</p>
                </div>
              )}
            </div>

            {/* Cardio programme */}
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Cardio Programme</p>
                <button onClick={() => setShowProgrammeSheet("cardio")} style={{ background: "none", border: "none", fontSize: "12px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer", padding: 0 }}>
                  {cardioProgramme ? "Change" : "Assign"}
                </button>
              </div>
              {cardioProgramme ? (
                <div style={{ backgroundColor: "#eaf5ef", borderRadius: "12px", padding: "12px 14px" }}>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#1a4a35", margin: 0 }}>{cardioProgramme.name}</p>
                  <p style={{ fontSize: "12px", color: "#2d6a4f", margin: "3px 0 0" }}>{cardioProgramme.description}</p>
                </div>
              ) : (
                <div onClick={() => setShowProgrammeSheet("cardio")} style={{ padding: "14px", borderRadius: "12px", border: "1.5px dashed #e5e5e5", textAlign: "center", cursor: "pointer" }}>
                  <p style={{ fontSize: "13px", color: "#aaa", margin: 0 }}>No cardio programme assigned</p>
                </div>
              )}
            </div>

            {/* Full workout log */}
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>
                All Sessions ({workoutLogs.length})
              </p>
              {workoutLogs.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#aaa", textAlign: "center", padding: "20px 0" }}>No sessions logged yet</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {workoutLogs.map(log => (
                    <div key={log.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "0.5px solid #f5f5f5" }}>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: 0 }}>{log.workoutId}</p>
                        <p style={{ fontSize: "11px", color: "#aaa", margin: "2px 0 0" }}>
                          {new Date(log.completedAt).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "12px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>
                          {Object.keys(log.logs || {}).length} exercises
                        </p>
                        <p style={{ fontSize: "11px", color: "#aaa", margin: "2px 0 0" }}>
                          {timeAgo(log.completedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* NOTES TAB */}
        {activeTab === "notes" && (
          <>
            <button
              onClick={() => setShowNoteSheet(true)}
              style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "13px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginBottom: "12px" }}
            >
              + Add Note
            </button>

            {notes.length === 0 ? (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "32px", textAlign: "center" }}>
                <p style={{ fontSize: "28px", margin: "0 0 10px" }}>📝</p>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No notes yet</p>
                <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Add coaching notes, observations or reminders about this client.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {notes.map(note => (
                  <div key={note.id} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px" }}>
                    <p style={{ fontSize: "14px", color: "#111", lineHeight: 1.6, margin: "0 0 8px" }}>{note.note}</p>
                    <p style={{ fontSize: "11px", color: "#aaa", margin: 0 }}>
                      {new Date(note.createdAt).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* TIER SHEET */}
      {showTierSheet && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowTierSheet(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Change Tier</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>{displayName}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {TIERS.map(t => {
                const isCurrent = (client.subscription || "free") === t.id;
                return (
                  <div key={t.id} onClick={() => !saving && !isCurrent && updateTier(t.id)} style={{ padding: "14px 16px", borderRadius: "14px", border: `1.5px solid ${isCurrent ? t.color : "#e5e5e5"}`, backgroundColor: isCurrent ? t.bg : "#fff", cursor: isCurrent ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: saving ? 0.6 : 1 }}>
                    <div>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: isCurrent ? t.color : "#111", margin: 0 }}>{t.label}</p>
                      <p style={{ fontSize: "12px", color: "#888", margin: "3px 0 0" }}>
                        {t.id === "free" && "Basic app access"}
                        {t.id === "premium" && "Full app access, all programmes"}
                        {t.id === "premium_trial" && "Temporary premium access (2 months)"}
                        {t.id === "in-person" && "Full access + personal coaching"}
                      </p>
                    </div>
                    {isCurrent && (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="9" fill={t.color}/>
                        <path d="M5 10l4 4 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowTierSheet(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "16px", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* PROGRAMME SELECTOR SHEET */}
      {showProgrammeSheet && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowProgrammeSheet(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "75vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>
              Assign {showProgrammeSheet === "strength" ? "Strength" : "Cardio"} Programme
            </h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>{displayName}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {(showProgrammeSheet === "strength" ? strengthOptions : cardioOptions).map(p => {
                const isSelected = showProgrammeSheet === "strength"
                  ? client.strengthProgrammeId === p.id
                  : client.cardioProgrammeId === p.id;
                return (
                  <div key={p.id} onClick={() => assignProgramme(showProgrammeSheet, p.id)} style={{ padding: "14px 16px", borderRadius: "14px", border: `1.5px solid ${isSelected ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: isSelected ? "#eaf5ef" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: isSelected ? "#2d6a4f" : "#111", margin: 0 }}>{p.name}</p>
                      <p style={{ fontSize: "12px", color: "#888", margin: "3px 0 0" }}>{p.description}</p>
                      <span style={{ fontSize: "11px", color: p.free === false ? "#b45309" : "#2d6a4f", fontWeight: 700 }}>
                        {p.free === false ? "Premium" : "Free"}
                      </span>
                    </div>
                    {isSelected && (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginLeft: 12 }}>
                        <circle cx="10" cy="10" r="9" fill="#2d6a4f"/>
                        <path d="M5 10l4 4 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowProgrammeSheet(null)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "16px", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ADD NOTE SHEET */}
      {showNoteSheet && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowNoteSheet(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 16px" }}>Add Note</h2>
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add a coaching note, observation or reminder..."
              rows={5}
              autoFocus
              style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "1.5px solid #2d6a4f", fontSize: "15px", outline: "none", boxSizing: "border-box", resize: "none", lineHeight: 1.6 }}
            />
            <button onClick={addNote} disabled={saving || !newNote.trim()} style={{ width: "100%", backgroundColor: saving || !newNote.trim() ? "#e5e5e5" : "#2d6a4f", color: saving || !newNote.trim() ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: saving || !newNote.trim() ? "not-allowed" : "pointer", marginTop: "12px", marginBottom: "8px" }}>
              {saving ? "Saving..." : "Save Note"}
            </button>
            <button onClick={() => setShowNoteSheet(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}