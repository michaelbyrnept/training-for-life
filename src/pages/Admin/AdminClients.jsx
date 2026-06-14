import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { Link } from "react-router-dom";

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

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState("all");
  const [changingTier, setChangingTier] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "users"));
    const data = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => {
        // Sort: in-person first, then premium, then free
        const order = { "in-person": 0, "premium": 1, "premium_trial": 2, "free": 3 };
        return (order[a.subscription] ?? 3) - (order[b.subscription] ?? 3);
      });
    setClients(data);
    setLoading(false);
  };

  const updateTier = async (uid, tier) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", uid), { subscription: tier });
      setClients(prev => prev.map(c => c.uid === uid ? { ...c, subscription: tier } : c));
      setChangingTier(null);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [createForm, setCreateForm] = useState({ firstName: "", email: "", tier: "in-person" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  const createClient = async () => {
    if (!createForm.firstName.trim() || !createForm.email.trim()) return;
    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const secondaryAuth = getAuth();
      // Create account with temporary password
      const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
      const cred = await createUserWithEmailAndPassword(secondaryAuth, createForm.email.toLowerCase(), tempPassword);
      const newUid = cred.user.uid;

      // Save user doc to Firestore
      await setDoc(doc(db, "users", newUid), {
        firstName: createForm.firstName.trim(),
        nickname: createForm.firstName.trim(),
        email: createForm.email.toLowerCase(),
        subscription: createForm.tier,
        onboardingComplete: false,
        parQComplete: false,
        createdAt: new Date().toISOString(),
        createdByAdmin: true,
      });

      // Send password reset email -- this is how they set their own password
      await sendPasswordResetEmail(secondaryAuth, createForm.email.toLowerCase());

      setCreateSuccess(`Account created! A password setup email has been sent to ${createForm.email}.`);
      setCreateForm({ firstName: "", email: "", tier: "in-person" });
      await loadClients();
    } catch (e) {
      console.error(e);
      if (e.code === "auth/email-already-in-use") {
        setCreateError("An account with this email already exists.");
      } else if (e.code === "auth/invalid-email") {
        setCreateError("Please enter a valid email address.");
      } else {
        setCreateError("Something went wrong. Please try again.");
      }
    }
    setCreating(false);
  };
   const filtered = clients.filter(c => {
    const matchesTier = filterTier === "all" || (c.subscription || "free") === filterTier;
    const name = `${c.firstName || ""} ${c.nickname || ""} ${c.email || ""}`.toLowerCase();
    const matchesSearch = search.trim() === "" || name.includes(search.toLowerCase());
    return matchesTier && matchesSearch;
  });

  const counts = {
    all: clients.length,
    "in-person": clients.filter(c => c.subscription === "in-person").length,
    premium: clients.filter(c => c.subscription === "premium").length,
    premium_trial: clients.filter(c => c.subscription === "premium_trial").length,
    free: clients.filter(c => !c.subscription || c.subscription === "free").length,
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 24px" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>
          Admin
        </Link>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "8px 0 4px" }}>Clients</h1>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
            {clients.length} total accounts
          </p>
          <button
            onClick={() => { setShowCreateSheet(true); setCreateError(""); setCreateSuccess(""); }}
            style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "20px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
          >
            + Create Client
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>

        {/* SEARCH */}
        <div style={{ position: "relative", marginBottom: "12px" }}>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "12px 14px 12px 38px", borderRadius: "12px", border: "0.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box", backgroundColor: "#fff" }}
          />
          <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", color: "#aaa" }}>🔍</span>
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", fontSize: "16px", color: "#aaa", cursor: "pointer" }}>✕</button>
          )}
        </div>

        {/* TIER FILTERS */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "auto", paddingBottom: "4px" }}>
          {[{ id: "all", label: "All", color: "#111", bg: filterTier === "all" ? "#1a3a2a" : "#fff" }, ...TIERS].map(t => {
            const isActive = filterTier === t.id;
            const count = counts[t.id] || 0;
            return (
              <button
                key={t.id}
                onClick={() => setFilterTier(t.id)}
                style={{ flexShrink: 0, padding: "7px 14px", borderRadius: "20px", border: isActive ? "none" : "0.5px solid #e5e5e5", backgroundColor: isActive ? "#1a3a2a" : "#fff", color: isActive ? "#fff" : "#555", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
              >
                {t.label}
                <span style={{ fontSize: "11px", opacity: 0.7 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* CLIENT LIST */}
        {loading ? (
          <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>Loading clients...</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5" }}>
            <p style={{ fontSize: "32px", margin: "0 0 12px" }}>👥</p>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>
              {search ? "No clients match your search" : "No clients in this tier"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filtered.map(client => {
              const tier = tierInfo(client.subscription || "free");
              const displayName = client.nickname || client.firstName || client.email?.split("@")[0] || "Unknown";
              const fullName = client.firstName ? `${client.firstName}` : null;

              return (
                <div key={client.uid} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>

                    {/* Avatar */}
                    <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: tier.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: tier.color, flexShrink: 0 }}>
                      {getInitials(displayName)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                        <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {displayName}
                        </p>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: tier.color, backgroundColor: tier.bg, padding: "2px 8px", borderRadius: "10px", flexShrink: 0 }}>
                          {tier.label}
                        </span>
                      </div>
                      <p style={{ fontSize: "12px", color: "#888", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {client.email}
                      </p>
                      <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                        {client.goal && (
                          <span style={{ fontSize: "10px", color: "#aaa" }}>
                            {client.goal === "strength" ? "💪 Strength" : client.goal === "fitness" ? "❤️ Fitness" : client.goal === "independence" ? "🧭 Independence" : "💪 Confidence"}
                          </span>
                        )}
                        {client.daysPerWeek && (
                          <span style={{ fontSize: "10px", color: "#aaa" }}>{client.daysPerWeek}x/week</span>
                        )}
                        {client.createdAt && (
                          <span style={{ fontSize: "10px", color: "#aaa" }}>Joined {timeAgo(client.createdAt)}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                      <button
                        onClick={() => setChangingTier(client)}
                        style={{ padding: "7px 12px", borderRadius: "8px", border: "0.5px solid #e5e5e5", backgroundColor: "#f7f5f2", fontSize: "12px", fontWeight: 700, color: "#555", cursor: "pointer" }}
                      >
                        Tag
                      </button>
                      <Link
                        to={`/admin/clients/${client.uid}`}
                        style={{ padding: "7px 12px", borderRadius: "8px", border: "none", backgroundColor: "#eaf5ef", fontSize: "12px", fontWeight: 700, color: "#2d6a4f", textDecoration: "none" }}
                      >
                        View
                      </Link>
                    </div>
                  </div>

                  {/* In-person extra info */}
                  {client.subscription === "in-person" && (
                    <div style={{ padding: "8px 16px 12px", borderTop: "0.5px solid #f0f0f0", display: "flex", gap: "12px" }}>
                      <div style={{ fontSize: "11px", color: "#2d6a4f", fontWeight: 700 }}>
                        {client.strengthProgrammeId ? "✓ Strength programme" : "⚠ No strength programme"}
                      </div>
                      <div style={{ fontSize: "11px", color: "#2d6a4f", fontWeight: 700 }}>
                        {client.cardioProgrammeId ? "✓ Cardio programme" : "⚠ No cardio programme"}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CHANGE TIER SHEET */}
      {changingTier && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setChangingTier(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
        >
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>
              Change Tier
            </h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>
              {changingTier.nickname || changingTier.firstName || changingTier.email}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {TIERS.map(t => {
                const isCurrent = (changingTier.subscription || "free") === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => !saving && !isCurrent && updateTier(changingTier.uid, t.id)}
                    style={{ padding: "14px 16px", borderRadius: "14px", border: `1.5px solid ${isCurrent ? t.color : "#e5e5e5"}`, backgroundColor: isCurrent ? t.bg : "#fff", cursor: isCurrent ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: saving ? 0.6 : 1 }}
                  >
                    <div>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: isCurrent ? t.color : "#111", margin: 0 }}>{t.label}</p>
                      <p style={{ fontSize: "12px", color: "#888", margin: "3px 0 0" }}>
                        {t.id === "free" && "Basic app access, 1 programme"}
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

            <button onClick={() => setChangingTier(null)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "16px", padding: "6px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* CREATE CLIENT SHEET */}
      {showCreateSheet && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateSheet(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
        >
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Create Client Account</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>
              They'll receive an email to set their password and will be taken through onboarding when they first log in.
            </p>

            {createSuccess ? (
              <div style={{ backgroundColor: "#eaf5ef", borderRadius: "12px", padding: "16px", marginBottom: "16px", textAlign: "center" }}>
                <p style={{ fontSize: "24px", margin: "0 0 8px" }}>✅</p>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#2d6a4f", margin: "0 0 4px" }}>Account Created</p>
                <p style={{ fontSize: "13px", color: "#555", margin: 0 }}>{createSuccess}</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>First Name</label>
                  <input
                    value={createForm.firstName}
                    onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))}
                    placeholder="e.g. Sarah"
                    style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={e => e.target.style.borderColor = "#e5e5e5"}
                  />
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Email Address</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="e.g. sarah@email.com"
                    style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={e => e.target.style.borderColor = "#e5e5e5"}
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "8px" }}>Account Tier</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {TIERS.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setCreateForm(f => ({ ...f, tier: t.id }))}
                        style={{ flex: 1, padding: "10px 6px", borderRadius: "10px", border: createForm.tier === t.id ? `2px solid ${t.color}` : "1px solid #e5e5e5", backgroundColor: createForm.tier === t.id ? t.bg : "#fff", fontSize: "11px", fontWeight: 700, color: createForm.tier === t.id ? t.color : "#555", cursor: "pointer" }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {createError && (
                  <div style={{ backgroundColor: "#fef2f2", borderRadius: "10px", padding: "10px 14px", marginBottom: "14px" }}>
                    <p style={{ fontSize: "13px", color: "#dc2626", margin: 0 }}>{createError}</p>
                  </div>
                )}

                <button
                  onClick={createClient}
                  disabled={creating || !createForm.firstName.trim() || !createForm.email.trim()}
                  style={{ width: "100%", backgroundColor: creating || !createForm.firstName.trim() || !createForm.email.trim() ? "#e5e5e5" : "#2d6a4f", color: creating || !createForm.firstName.trim() || !createForm.email.trim() ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: creating || !createForm.firstName.trim() || !createForm.email.trim() ? "not-allowed" : "pointer", marginBottom: "10px" }}
                >
                  {creating ? "Creating account..." : "Create Account and Send Email"}
                </button>
              </>
            )}

            <button
              onClick={() => { setShowCreateSheet(false); setCreateSuccess(""); setCreateError(""); }}
              style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}
            >
              {createSuccess ? "Done" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}