import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../../firebase";

const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";

const TIERS = [
  { id: "free", label: "Free", color: "#888", bg: "#f0f0f0" },
  { id: "premium", label: "Premium", color: "#b45309", bg: "#fffbeb" },
  { id: "premium_trial", label: "Trial", color: "#7c3aed", bg: "#f5f3ff" },
  { id: "online", label: "Online", color: "#0369a1", bg: "#e0f2fe" },
  { id: "hybrid", label: "Hybrid", color: "#0891b2", bg: "#ecfeff" },
  { id: "in-person", label: "In-Person", color: "#2d6a4f", bg: "#eaf5ef" },
];

const sections = [
  {
    to: "/admin/check-ins",
    label: "Check-ins",
    description: "Review weekly check-ins and send video replies.",
    icon: "📋",
    highlight: true,
  },
  {
    to: "/admin/clients",
    label: "Clients",
    description: "View and manage all client profiles.",
    icon: "👥",
    highlight: true,
  },
  {
    to: "/admin/consultations",
    label: "Consultations",
    description: "Review incoming consultation applications.",
    icon: "📝",
    highlight: true,
  },
  {
    to: "/admin/classes",
    label: "Class Timetable",
    description: "Schedule and manage AMRAP class blocks.",
    icon: "🏋️",
    highlight: true,
  },
  {
    to: "/admin/outreach",
    label: "Outreach Tracker",
    description: "Log and track your daily outreach. 20/day target.",
    icon: "📣",
    highlight: true,
  },
  {
    to: "/admin/waitlist",
    label: "Premium Waitlist",
    description: "People waiting for Premium. Copy emails to reach out.",
    icon: "🔔",
    highlight: true,
  },
  {
    to: "/admin/metrics",
    label: "Metrics Builder",
    description: "Define what clients track.",
    icon: "📊",
  },
  {
    to: "/admin/exercises",
    label: "Exercise Library",
    description: "Add, edit and manage all exercises.",
    icon: "💪",
  },
  {
    to: "/admin/workouts",
    label: "Workout Builder",
    description: "Build workouts from your exercise library.",
    icon: "🏋️",
  },
  {
    to: "/admin/programmes",
    label: "Programme Builder",
    description: "Arrange workouts into weekly programmes.",
    icon: "📋",
  },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [myTier, setMyTier] = useState("in-person");
  const [saving, setSaving] = useState(false);
  const [showTierSheet, setShowTierSheet] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) setMyTier(snap.data().subscription || "free");
    });
    return () => unsub();
  }, []);

  const updateMyTier = async (tier) => {
    setSaving(true);
    await updateDoc(doc(db, "users", ADMIN_UID), { subscription: tier });
    setMyTier(tier);
    setShowTierSheet(false);
    setSaving(false);
  };

  const currentTier = TIERS.find(t => t.id === myTier) || TIERS[0];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", padding: "2rem 1.25rem" }}>

      {/* MY ACCOUNT */}
      <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "16px", marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>My Account</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>Michael Byrne</p>
            <p style={{ fontSize: "12px", color: "#9fe1cb", margin: 0 }}>Admin account</p>
          </div>
          <div onClick={() => setShowTierSheet(true)} style={{ backgroundColor: currentTier.bg, color: currentTier.color, fontSize: "12px", fontWeight: 700, padding: "6px 12px", borderRadius: "20px", cursor: "pointer" }}>
            {currentTier.label} ▾
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link to="/dashboard" style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)", color: "#fff", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
            View as Client
          </Link>
          <Link to="/training" style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)", color: "#fff", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
            My Training
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#2d6a4f", marginBottom: "4px" }}>
          Admin Panel
        </p>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#111", margin: 0 }}>
          Training for Life
        </h1>
        <p style={{ color: "#666", marginTop: "6px", fontSize: "15px" }}>
          Manage your content and clients from here.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {sections.map((section) => (
          <Link key={section.to} to={section.to} style={{ textDecoration: "none" }}>
            <div style={{
              backgroundColor: section.highlight ? "#1a3a2a" : "#fff",
              borderRadius: "16px",
              padding: "20px",
              border: section.highlight ? "none" : "0.5px solid #e5e5e5",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: section.highlight ? "rgba(255,255,255,0.12)" : "#eaf5ef",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                flexShrink: 0,
              }}>
                {section.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: "16px", color: section.highlight ? "#fff" : "#111", margin: 0 }}>
                  {section.label}
                </p>
                <p style={{ fontSize: "13px", color: section.highlight ? "#9fe1cb" : "#888", margin: "3px 0 0" }}>
                  {section.description}
                </p>
              </div>
              <div style={{ color: section.highlight ? "#9fe1cb" : "#2d6a4f", fontSize: "18px" }}>→</div>
            </div>
          </Link>
        ))}
      </div>

      {/* TIER SHEET */}
      {showTierSheet && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowTierSheet(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>My Subscription Tier</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>Change your own tier to test the app as a client</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {TIERS.map(t => {
                const isCurrent = myTier === t.id;
                return (
                  <div key={t.id} onClick={() => !saving && updateMyTier(t.id)} style={{ padding: "14px 16px", borderRadius: "14px", border: `1.5px solid ${isCurrent ? t.color : "#e5e5e5"}`, backgroundColor: isCurrent ? t.bg : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: saving ? 0.6 : 1 }}>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: isCurrent ? t.color : "#111", margin: 0 }}>{t.label}</p>
                    {isCurrent && <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill={t.color}/><path d="M5 10l4 4 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowTierSheet(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "16px", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}