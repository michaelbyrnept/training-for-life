import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Link, useNavigate } from "react-router-dom";

const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";

const TIERS = [
  { id: "free",          label: "Free",      color: "#888",    bg: "#f0f0f0" },
  { id: "premium",       label: "Premium",   color: "#b45309", bg: "#fffbeb" },
  { id: "premium_trial", label: "Trial",     color: "#7c3aed", bg: "#f5f3ff" },
  { id: "in-person",     label: "In-Person", color: "#2d6a4f", bg: "#eaf5ef" },
];

const STATUS_CONFIG = {
  new:      { label: "New",      color: "#0369a1", bg: "#e0f2fe" },
  active:   { label: "Active",   color: "#166534", bg: "#dcfce7" },
  at_risk:  { label: "At Risk",  color: "#92400e", bg: "#fef3c7" },
  lapsed:   { label: "Lapsed",   color: "#9a3412", bg: "#fee2e2" },
  inactive: { label: "Inactive", color: "#6b7280", bg: "#f3f4f6" },
};

function computeStatus(client, sessionMap, balanceMap) {
  // Only track status for paying/coached clients
  const tracked = ["in-person", "hybrid", "online", "premium", "premium_trial"].includes(client.subscription);
  if (!tracked) return "inactive";

  const info = sessionMap[client.uid] || {};
  const balance = balanceMap[client.uid] ?? null;
  const joinedDaysAgo = client.createdAt
    ? Math.floor((Date.now() - new Date(client.createdAt).getTime()) / 86400000)
    : 999;

  const daysSinceLast = info.lastSessionDate
    ? Math.floor((Date.now() - info.lastSessionDate.getTime()) / 86400000)
    : null;

  // New: joined within 14 days, no completed sessions yet
  if (joinedDaysAgo < 14 && daysSinceLast === null) return "new";

  // Active: session in last 14 days
  if (daysSinceLast !== null && daysSinceLast <= 14) return "active";

  // At risk: session 14-28 days ago, OR low credits with no upcoming
  if (daysSinceLast !== null && daysSinceLast <= 28) return "at_risk";
  if (balance !== null && balance <= 2 && !info.hasUpcoming) return "at_risk";

  // Lapsed: had sessions but > 28 days ago
  if (daysSinceLast !== null && daysSinceLast > 28) return "lapsed";

  // Joined > 14 days, no sessions ever
  if (joinedDaysAgo >= 14 && daysSinceLast === null) return "lapsed";

  return "inactive";
}

function tierInfo(tier) { return TIERS.find(t => t.id === tier) || TIERS[0]; }

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
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [sessionMap, setSessionMap] = useState({});   // clientId -> { lastSessionDate, hasUpcoming }
  const [balanceMap, setBalanceMap] = useState({});   // clientId -> balance
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [changingTier, setChangingTier] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [createForm, setCreateForm] = useState({ firstName: "", lastName: "", email: "", tier: "in-person" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [usersSnap, sessionsSnap, txSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "sessions")),
        getDocs(collection(db, "walletTransactions")),
      ]);

      const now = new Date();

      // Build session map
      const sMap = {};
      sessionsSnap.docs.forEach(d => {
        const s = d.data();
        const cid = s.clientId;
        if (!cid) return;
        const date = s.date?.toDate ? s.date.toDate() : s.date ? new Date(s.date) : null;
        if (!sMap[cid]) sMap[cid] = { lastSessionDate: null, hasUpcoming: false };
        if (s.status === "scheduled" && date && date >= now) {
          sMap[cid].hasUpcoming = true;
        }
        if (["completed", "no_show", "late_cancelled"].includes(s.status) && date) {
          if (!sMap[cid].lastSessionDate || date > sMap[cid].lastSessionDate) {
            sMap[cid].lastSessionDate = date;
          }
        }
      });
      setSessionMap(sMap);

      // Build balance map
      const bMap = {};
      txSnap.docs.forEach(d => {
        const tx = d.data();
        if (!tx.clientId) return;
        bMap[tx.clientId] = (bMap[tx.clientId] || 0) + (tx.amount || 0);
      });
      setBalanceMap(bMap);

      const data = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }))
        .filter(c => c.uid !== ADMIN_UID)
        .sort((a, b) => {
          const order = { "in-person": 0, "premium": 1, "premium_trial": 2, "free": 3 };
          return (order[a.subscription] ?? 3) - (order[b.subscription] ?? 3);
        });
      setClients(data);
    } finally {
      setLoading(false);
    }
  };

  const updateTier = async (uid, tier) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", uid), { subscription: tier });
      setClients(prev => prev.map(c => c.uid === uid ? { ...c, subscription: tier } : c));
      setChangingTier(null);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const createClient = async () => {
    if (!createForm.firstName.trim() || !createForm.email.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const functions = getFunctions(undefined, "us-central1");
      const adminCreateClient = httpsCallable(functions, "adminCreateClient");
      const { data } = await adminCreateClient({
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName?.trim() || "",
        email: createForm.email.trim(),
        subscription: createForm.tier,
      });
      setShowCreateSheet(false);
      setCreateForm({ firstName: "", lastName: "", email: "", tier: "in-person" });
      // Navigate straight to their profile to set up programmes
      navigate(`/admin/clients/${data.uid}`);
    } catch (e) {
      console.error(e);
      if (e.message?.includes("already-exists") || e.code === "already-exists") {
        setCreateError("An account with this email already exists.");
      } else {
        setCreateError("Something went wrong. Please try again.");
      }
    }
    setCreating(false);
  };

  // Compute statuses
  const clientsWithStatus = clients.map(c => ({
    ...c,
    status: computeStatus(c, sessionMap, balanceMap),
  }));

  const atRiskClients = clientsWithStatus.filter(c => c.status === "at_risk");

  const filtered = clientsWithStatus.filter(c => {
    const matchesTier = filterTier === "all" || (c.subscription || "free") === filterTier;
    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    const name = `${c.firstName || ""} ${c.nickname || ""} ${c.email || ""}`.toLowerCase();
    const matchesSearch = search.trim() === "" || name.includes(search.toLowerCase());
    return matchesTier && matchesStatus && matchesSearch;
  });

  const tierCounts = {
    all: clients.length,
    "in-person": clients.filter(c => c.subscription === "in-person").length,
    premium: clients.filter(c => c.subscription === "premium").length,
    premium_trial: clients.filter(c => c.subscription === "premium_trial").length,
    free: clients.filter(c => !c.subscription || c.subscription === "free").length,
  };

  const statusCounts = {
    all: clientsWithStatus.length,
    active: clientsWithStatus.filter(c => c.status === "active").length,
    at_risk: clientsWithStatus.filter(c => c.status === "at_risk").length,
    lapsed: clientsWithStatus.filter(c => c.status === "lapsed").length,
    new: clientsWithStatus.filter(c => c.status === "new").length,
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 24px" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>Admin</Link>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "8px 0 4px" }}>Clients</h1>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>{clients.length} total accounts</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <Link
              to="/admin/import-clients"
              style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#9fe1cb", border: "none", borderRadius: "20px", padding: "8px 14px", fontSize: "13px", fontWeight: 700, textDecoration: "none" }}
            >
              Import
            </Link>
            <Link
              to="/admin/groups"
              style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#9fe1cb", border: "none", borderRadius: "20px", padding: "8px 14px", fontSize: "13px", fontWeight: 700, textDecoration: "none" }}
            >
              Groups
            </Link>
            <button
              onClick={() => { setShowCreateSheet(true); setCreateError(""); setCreateSuccess(""); }}
              style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "20px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
            >
              + Create Client
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>

        {/* AT RISK ALERT */}
        {!loading && atRiskClients.length > 0 && filterStatus === "all" && (
          <div
            onClick={() => setFilterStatus("at_risk")}
            style={{ backgroundColor: "#fef3c7", borderRadius: "16px", padding: "14px 16px", marginBottom: "14px", border: "1.5px solid #f59e0b", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px" }}
          >
            <span style={{ fontSize: "22px" }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#92400e", margin: "0 0 2px" }}>
                {atRiskClients.length} client{atRiskClients.length > 1 ? "s" : ""} at risk
              </p>
              <p style={{ fontSize: "12px", color: "#92400e", margin: 0 }}>
                {atRiskClients.map(c => c.nickname || c.firstName || c.email?.split("@")[0]).join(", ")}
              </p>
            </div>
            <span style={{ fontSize: "14px", color: "#92400e" }}>→</span>
          </div>
        )}

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

        {/* STATUS FILTERS */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px", overflowX: "auto", paddingBottom: "4px" }}>
          {[
            { id: "all",     label: "All" },
            { id: "active",  label: "Active" },
            { id: "at_risk", label: "At Risk" },
            { id: "lapsed",  label: "Lapsed" },
            { id: "new",     label: "New" },
          ].map(s => {
            const isActive = filterStatus === s.id;
            const cfg = STATUS_CONFIG[s.id] || {};
            return (
              <button
                key={s.id}
                onClick={() => setFilterStatus(s.id)}
                style={{ flexShrink: 0, padding: "7px 14px", borderRadius: "20px", border: isActive ? "none" : "0.5px solid #e5e5e5", backgroundColor: isActive ? (cfg.bg || "#1a3a2a") : "#fff", color: isActive ? (cfg.color || "#fff") : "#555", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
              >
                {s.label}
                <span style={{ fontSize: "11px", opacity: 0.7 }}>({statusCounts[s.id] ?? clientsWithStatus.length})</span>
              </button>
            );
          })}
        </div>

        {/* TIER FILTERS */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "auto", paddingBottom: "4px" }}>
          {[{ id: "all", label: "All tiers" }, ...TIERS].map(t => {
            const isActive = filterTier === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setFilterTier(t.id)}
                style={{ flexShrink: 0, padding: "6px 12px", borderRadius: "20px", border: isActive ? "none" : "0.5px solid #e5e5e5", backgroundColor: isActive ? "#1a3a2a" : "#fff", color: isActive ? "#fff" : "#888", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
              >
                {t.label} ({tierCounts[t.id] ?? 0})
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
              {search ? "No clients match your search" : "No clients in this view"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filtered.map(client => {
              const tier = tierInfo(client.subscription || "free");
              const statusCfg = STATUS_CONFIG[client.status] || STATUS_CONFIG.inactive;
              const displayName = client.nickname || client.firstName || client.email?.split("@")[0] || "Unknown";
              const info = sessionMap[client.uid] || {};
              const balance = balanceMap[client.uid] ?? null;

              return (
                <div key={client.uid} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>

                    {/* Avatar */}
                    <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: tier.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: tier.color, flexShrink: 0 }}>
                      {getInitials(displayName)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px", flexWrap: "wrap" }}>
                        <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{displayName}</p>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: statusCfg.color, backgroundColor: statusCfg.bg, padding: "2px 8px", borderRadius: "10px" }}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <p style={{ fontSize: "12px", color: "#888", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {client.email}
                      </p>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: tier.color, backgroundColor: tier.bg, padding: "1px 6px", borderRadius: "8px" }}>{tier.label}</span>
                        {info.lastSessionDate && (
                          <span style={{ fontSize: "10px", color: "#aaa" }}>Last session {timeAgo(info.lastSessionDate.toISOString())}</span>
                        )}
                        {balance !== null && client.subscription === "in-person" && (
                          <span style={{ fontSize: "10px", color: balance <= 2 ? "#dc2626" : "#2d6a4f", fontWeight: 700 }}>
                            {balance} credit{balance !== 1 ? "s" : ""}
                          </span>
                        )}
                        {info.hasUpcoming && (
                          <span style={{ fontSize: "10px", color: "#0369a1" }}>Session booked</span>
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

                  {/* In-person programme status */}
                  {client.subscription === "in-person" && (
                    <div style={{ padding: "8px 16px 12px", borderTop: "0.5px solid #f0f0f0", display: "flex", gap: "12px" }}>
                      <span style={{ fontSize: "11px", color: client.strengthProgrammeId ? "#2d6a4f" : "#f59e0b", fontWeight: 700 }}>
                        {client.strengthProgrammeId ? "✓ Strength" : "⚠ No strength"}
                      </span>
                      <span style={{ fontSize: "11px", color: client.cardioProgrammeId ? "#2d6a4f" : "#f59e0b", fontWeight: 700 }}>
                        {client.cardioProgrammeId ? "✓ Cardio" : "⚠ No cardio"}
                      </span>
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
        <div onClick={e => { if (e.target === e.currentTarget) setChangingTier(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Change Tier</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>
              {changingTier.nickname || changingTier.firstName || changingTier.email}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {TIERS.map(t => {
                const isCurrent = (changingTier.subscription || "free") === t.id;
                return (
                  <div key={t.id} onClick={() => !saving && !isCurrent && updateTier(changingTier.uid, t.id)} style={{ padding: "14px 16px", borderRadius: "14px", border: `1.5px solid ${isCurrent ? t.color : "#e5e5e5"}`, backgroundColor: isCurrent ? t.bg : "#fff", cursor: isCurrent ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: saving ? 0.6 : 1 }}>
                    <div>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: isCurrent ? t.color : "#111", margin: 0 }}>{t.label}</p>
                      <p style={{ fontSize: "12px", color: "#888", margin: "3px 0 0" }}>
                        {t.id === "free" && "Basic app access, 1 programme"}
                        {t.id === "premium" && "Full app access, all programmes"}
                        {t.id === "premium_trial" && "Temporary premium access (2 months)"}
                        {t.id === "in-person" && "Full access + personal coaching"}
                      </p>
                    </div>
                    {isCurrent && <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill={t.color}/><path d="M5 10l4 4 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setChangingTier(null)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "16px", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* CREATE CLIENT SHEET */}
      {showCreateSheet && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowCreateSheet(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Create Client Account</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>Creates the account silently — no email sent. You'll be taken to their profile to assign their programme. Send the welcome email when you're ready.</p>

            <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>First Name</label>
                <input value={createForm.firstName} onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Sarah" style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box" }} onFocus={e => e.target.style.borderColor = "#2d6a4f"} onBlur={e => e.target.style.borderColor = "#e5e5e5"} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Last Name</label>
                <input value={createForm.lastName} onChange={e => setCreateForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Murphy" style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box" }} onFocus={e => e.target.style.borderColor = "#2d6a4f"} onBlur={e => e.target.style.borderColor = "#e5e5e5"} />
              </div>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Email Address</label>
              <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="sarah@email.com" style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box" }} onFocus={e => e.target.style.borderColor = "#2d6a4f"} onBlur={e => e.target.style.borderColor = "#e5e5e5"} />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "8px" }}>Account Tier</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {TIERS.map(t => (
                  <button key={t.id} onClick={() => setCreateForm(f => ({ ...f, tier: t.id }))} style={{ flex: 1, padding: "10px 6px", borderRadius: "10px", border: createForm.tier === t.id ? `2px solid ${t.color}` : "1px solid #e5e5e5", backgroundColor: createForm.tier === t.id ? t.bg : "#fff", fontSize: "11px", fontWeight: 700, color: createForm.tier === t.id ? t.color : "#555", cursor: "pointer" }}>{t.label}</button>
                ))}
              </div>
            </div>
            {createError && (
              <div style={{ backgroundColor: "#fef2f2", borderRadius: "10px", padding: "10px 14px", marginBottom: "14px" }}>
                <p style={{ fontSize: "13px", color: "#dc2626", margin: 0 }}>{createError}</p>
              </div>
            )}
            <button onClick={createClient} disabled={creating || !createForm.firstName.trim() || !createForm.email.trim()} style={{ width: "100%", backgroundColor: creating || !createForm.firstName.trim() || !createForm.email.trim() ? "#e5e5e5" : "#2d6a4f", color: creating || !createForm.firstName.trim() || !createForm.email.trim() ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>
              {creating ? "Creating account..." : "Create Account"}
            </button>
            <button onClick={() => { setShowCreateSheet(false); setCreateError(""); }} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
