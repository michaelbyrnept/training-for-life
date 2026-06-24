import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, query, orderBy, getDocs, addDoc, updateDoc,
  doc, serverTimestamp, Timestamp, where,
} from "firebase/firestore";
import { db } from "../../firebase";

const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";

const OUTCOME_OPTIONS = [
  { value: "completed",      label: "Completed",             emoji: "✅", credits: -1 },
  { value: "no_show",        label: "No Show",               emoji: "🚫", credits: -1 },
  { value: "late_cancelled", label: "Late Cancelled",        emoji: "⚠️", credits: -1 },
  { value: "cancelled",      label: "Cancelled with Notice", emoji: "❌", credits: 0  },
];

const STATUS_STYLES = {
  scheduled:      { color: "#0369a1", bg: "#e0f2fe", label: "Scheduled" },
  completed:      { color: "#166534", bg: "#dcfce7", label: "Completed" },
  no_show:        { color: "#9a3412", bg: "#fee2e2", label: "No Show" },
  late_cancelled: { color: "#92400e", bg: "#fef3c7", label: "Late Cancel" },
  cancelled:      { color: "#6b7280", bg: "#f3f4f6", label: "Cancelled" },
};

function formatDateTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" })
    + " at "
    + d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
}

function toTimestamp(dateStr, timeStr) {
  return Timestamp.fromDate(new Date(`${dateStr}T${timeStr}`));
}

export default function AdminSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [showBookSheet, setShowBookSheet] = useState(false);
  const [showOutcomeSheet, setShowOutcomeSheet] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [saving, setSaving] = useState(false);

  const [bundlePurchases, setBundlePurchases] = useState([]);
  const [bookForm, setBookForm] = useState({
    clientId: "", date: "", time: "", durationMins: 60, type: "in-person", notes: "",
  });
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [outcomeForm, setOutcomeForm] = useState({ outcome: "completed", notes: "", sessionRevenue: "" });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [sessSnap, clientSnap, purchaseSnap] = await Promise.all([
        getDocs(query(collection(db, "sessions"), orderBy("date", "asc"))),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "bundlePurchases")),
      ]);
      setSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setBundlePurchases(purchaseSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setClients(
        clientSnap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(c => c.uid !== ADMIN_UID)
          .sort((a, b) =>
            (a.displayName || a.firstName || a.email || "").localeCompare(b.displayName || b.firstName || b.email || "")
          )
      );
    } finally {
      setLoading(false);
    }
  }

  function getClientRate(clientId) {
    const clientPurchases = bundlePurchases
      .filter(p => p.clientId === clientId && p.sessionCredits > 0 && p.pricePaid > 0)
      .sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
    if (!clientPurchases.length) return 60; // default single session rate
    const latest = clientPurchases[0];
    return Math.round((latest.pricePaid / latest.sessionCredits) * 100) / 100;
  }

  function clientDisplayName(c) {
    return c.nickname || c.firstName || c.displayName || c.email || c.uid;
  }

  async function bookSession() {
    if (!bookForm.clientId || !bookForm.date || !bookForm.time) return;
    setSaving(true);
    try {
      const client = clients.find(c => c.uid === bookForm.clientId);
      await addDoc(collection(db, "sessions"), {
        clientId: bookForm.clientId,
        clientName: clientDisplayName(client),
        date: toTimestamp(bookForm.date, bookForm.time),
        durationMins: Number(bookForm.durationMins),
        type: bookForm.type,
        status: "scheduled",
        notes: bookForm.notes.trim() || null,
        walletTxId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowBookSheet(false);
      setBookForm({ clientId: "", date: "", time: "", durationMins: 60, type: "in-person", notes: "" });
      setClientSearch("");
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function markOutcome() {
    if (!selectedSession) return;
    setSaving(true);
    try {
      const opt = OUTCOME_OPTIONS.find(o => o.value === outcomeForm.outcome);
      const credits = opt?.credits ?? 0;
      let walletTxId = null;

      if (credits !== 0) {
        const REASON_MAP = {
          completed:      "session_completed",
          no_show:        "no_show",
          late_cancelled: "late_cancellation",
        };
        const txRef = await addDoc(collection(db, "walletTransactions"), {
          clientId: selectedSession.clientId,
          amount: credits,
          reason: REASON_MAP[outcomeForm.outcome] || "session_completed",
          description: outcomeForm.notes.trim() ||
            `${opt?.label || outcomeForm.outcome} — ${formatDateTime(selectedSession.date)}`,
          performedByUserId: ADMIN_UID,
          sessionId: selectedSession.id,
          bundlePurchaseId: null,
          isAutomatic: false,
          creditDeducted: true,
          createdAt: new Date().toISOString(),
        });
        walletTxId = txRef.id;
      }

      await updateDoc(doc(db, "sessions", selectedSession.id), {
        status: outcomeForm.outcome,
        walletTxId,
        outcomeNotes: outcomeForm.notes.trim() || null,
        sessionRevenue: credits !== 0 ? Number(outcomeForm.sessionRevenue) || 0 : 0,
        updatedAt: serverTimestamp(),
      });

      setShowOutcomeSheet(false);
      setSelectedSession(null);
      setOutcomeForm({ outcome: "completed", notes: "" });
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const upcomingSessions = sessions.filter(s => {
    const d = s.date?.toDate ? s.date.toDate() : new Date(s.date);
    return s.status === "scheduled" && d >= todayStart;
  });
  const pastSessions = sessions.filter(s => {
    const d = s.date?.toDate ? s.date.toDate() : new Date(s.date);
    return s.status !== "scheduled" || d < todayStart;
  }).sort((a, b) => {
    const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
    const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date);
    return db2 - da;
  });

  const displayed = activeTab === "upcoming" ? upcomingSessions : pastSessions;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "16px 20px 20px" }}>
        <button
          onClick={() => navigate("/admin")}
          style={{ background: "none", border: "none", color: "#9fe1cb", fontSize: "14px", cursor: "pointer", padding: 0, marginBottom: "12px" }}
        >
          Admin
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: 700, margin: 0 }}>Sessions</h1>
            <p style={{ color: "#9fe1cb", fontSize: "13px", margin: "4px 0 0" }}>
              {upcomingSessions.length} upcoming
            </p>
          </div>
          <button
            onClick={() => setShowBookSheet(true)}
            style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "10px 18px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
          >
            + Book
          </button>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          {[
            { key: "upcoming", label: "Upcoming" },
            { key: "past",     label: "Past" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1, padding: "8px", borderRadius: "10px", border: "none", cursor: "pointer",
                fontSize: "13px", fontWeight: 700,
                backgroundColor: activeTab === t.key ? "#fff" : "rgba(255,255,255,0.1)",
                color: activeTab === t.key ? "#1a3a2a" : "#9fe1cb",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* LIST */}
      <div style={{ padding: "16px 20px" }}>
        {loading ? (
          <p style={{ color: "#888", textAlign: "center", padding: "40px 0" }}>Loading...</p>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontSize: "32px", margin: "0 0 8px" }}>📅</p>
            <p style={{ color: "#888", fontSize: "15px" }}>
              {activeTab === "upcoming" ? "No upcoming sessions" : "No past sessions"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {displayed.map(session => {
              const st = STATUS_STYLES[session.status] || STATUS_STYLES.scheduled;
              return (
                <div key={session.id} style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "16px", border: "0.5px solid #e5e5e5" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: "15px", color: "#111", margin: "0 0 2px" }}>
                        {session.clientName}
                      </p>
                      <p style={{ fontSize: "13px", color: "#666", margin: 0 }}>
                        {formatDateTime(session.date)}
                      </p>
                    </div>
                    <span style={{ backgroundColor: st.bg, color: st.color, fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px", whiteSpace: "nowrap", marginLeft: "8px" }}>
                      {st.label}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: session.status === "scheduled" ? "12px" : "0" }}>
                    <span style={{ fontSize: "12px", color: "#888" }}>{session.durationMins} min</span>
                    <span style={{ fontSize: "12px", color: "#ccc" }}>·</span>
                    <span style={{ fontSize: "12px", color: "#888", textTransform: "capitalize" }}>{session.type}</span>
                    {session.notes && (
                      <>
                        <span style={{ fontSize: "12px", color: "#ccc" }}>·</span>
                        <span style={{ fontSize: "12px", color: "#888" }}>{session.notes}</span>
                      </>
                    )}
                  </div>

                  {session.status === "scheduled" && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => navigate(`/admin/clients/${session.clientId}`)}
                        style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "1px solid #e5e5e5", background: "#fff", fontSize: "13px", color: "#555", cursor: "pointer", fontWeight: 600 }}
                      >
                        View Client
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSession(session);
                          setOutcomeForm({ outcome: "completed", notes: "", sessionRevenue: getClientRate(session.clientId) });
                          setShowOutcomeSheet(true);
                        }}
                        style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "none", background: "#1a3a2a", fontSize: "13px", color: "#fff", cursor: "pointer", fontWeight: 700 }}
                      >
                        Mark Outcome
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BOOK SESSION SHEET */}
      {showBookSheet && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowBookSheet(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "flex-end" }}
        >
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 20px" }}>Book Session</h2>

            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Client</label>
            <div style={{ position: "relative", marginBottom: "16px" }}>
              <input
                type="text"
                placeholder="Search client..."
                value={clientSearch}
                onChange={e => {
                  setClientSearch(e.target.value);
                  setShowClientDropdown(true);
                  if (!e.target.value) setBookForm(f => ({ ...f, clientId: "" }));
                }}
                onFocus={() => setShowClientDropdown(true)}
                style={{ width: "100%", padding: "12px", borderRadius: "12px", border: `1.5px solid ${bookForm.clientId ? "#2d6a4f" : "#e5e5e5"}`, fontSize: "15px", boxSizing: "border-box", backgroundColor: "#fff" }}
              />
              {showClientDropdown && clientSearch && (() => {
                const filtered = clients.filter(c =>
                  clientDisplayName(c).toLowerCase().includes(clientSearch.toLowerCase()) ||
                  (c.email || "").toLowerCase().includes(clientSearch.toLowerCase())
                );
                if (filtered.length === 0) return null;
                return (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#fff", border: "1.5px solid #e5e5e5", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 10, maxHeight: "200px", overflowY: "auto", marginTop: "4px" }}>
                    {filtered.map(c => (
                      <div
                        key={c.uid}
                        onClick={() => {
                          setBookForm(f => ({ ...f, clientId: c.uid }));
                          setClientSearch(clientDisplayName(c));
                          setShowClientDropdown(false);
                        }}
                        style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "0.5px solid #f0f0f0", fontSize: "14px", color: "#111" }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f7f5f2"}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "#fff"}
                      >
                        <span style={{ fontWeight: 600 }}>{clientDisplayName(c)}</span>
                        {c.email && <span style={{ fontSize: "12px", color: "#888", marginLeft: "8px" }}>{c.email}</span>}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Date</label>
                <input
                  type="date"
                  value={bookForm.date}
                  onChange={e => setBookForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Time</label>
                <input
                  type="time"
                  value={bookForm.time}
                  onChange={e => setBookForm(f => ({ ...f, time: e.target.value }))}
                  style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Duration</label>
                <select
                  value={bookForm.durationMins}
                  onChange={e => setBookForm(f => ({ ...f, durationMins: Number(e.target.value) }))}
                  style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", backgroundColor: "#fff" }}
                >
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Type</label>
                <select
                  value={bookForm.type}
                  onChange={e => setBookForm(f => ({ ...f, type: e.target.value }))}
                  style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", backgroundColor: "#fff" }}
                >
                  <option value="in-person">In Person</option>
                  <option value="online">Online</option>
                </select>
              </div>
            </div>

            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Notes (optional)</label>
            <textarea
              value={bookForm.notes}
              onChange={e => setBookForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any notes for this session..."
              rows={2}
              style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", resize: "none", marginBottom: "20px", boxSizing: "border-box" }}
            />

            <button
              onClick={bookSession}
              disabled={saving || !bookForm.clientId || !bookForm.date || !bookForm.time}
              style={{
                width: "100%", padding: "14px", borderRadius: "14px", border: "none", fontSize: "16px", fontWeight: 700,
                backgroundColor: (!bookForm.clientId || !bookForm.date || !bookForm.time) ? "#ccc" : "#1a3a2a",
                color: "#fff", cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Booking..." : "Book Session"}
            </button>
            <button
              onClick={() => { setShowBookSheet(false); setClientSearch(""); setBookForm({ clientId: "", date: "", time: "", durationMins: 60, type: "in-person", notes: "" }); }}
              style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "12px", padding: "6px" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* MARK OUTCOME SHEET */}
      {showOutcomeSheet && selectedSession && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setShowOutcomeSheet(false); setSelectedSession(null); } }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "flex-end" }}
        >
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Mark Outcome</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>
              {selectedSession.clientName} — {formatDateTime(selectedSession.date)}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {OUTCOME_OPTIONS.map(opt => {
                const selected = outcomeForm.outcome === opt.value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => setOutcomeForm(f => ({ ...f, outcome: opt.value }))}
                    style={{
                      padding: "14px 16px", borderRadius: "14px", cursor: "pointer",
                      border: `1.5px solid ${selected ? "#1a3a2a" : "#e5e5e5"}`,
                      backgroundColor: selected ? "#eaf5ef" : "#fff",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "18px" }}>{opt.emoji}</span>
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{opt.label}</p>
                        <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
                          {opt.credits === 0 ? "No credit deducted" : "1 credit deducted"}
                        </p>
                      </div>
                    </div>
                    {selected && (
                      <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#1a3a2a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: "#fff", fontSize: "12px" }}>✓</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {OUTCOME_OPTIONS.find(o => o.value === outcomeForm.outcome)?.credits !== 0 && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
                  Session Rate (€)
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "15px", color: "#555", fontWeight: 700 }}>€</span>
                  <input
                    type="number"
                    value={outcomeForm.sessionRevenue}
                    onChange={e => setOutcomeForm(f => ({ ...f, sessionRevenue: e.target.value }))}
                    style={{ width: "100%", padding: "12px 12px 12px 28px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", boxSizing: "border-box" }}
                  />
                </div>
                <p style={{ fontSize: "11px", color: "#aaa", margin: "4px 0 0" }}>
                  Auto-set from client's bundle. Change for grandfathered rates.
                </p>
              </div>
            )}

            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Notes (optional)</label>
            <textarea
              value={outcomeForm.notes}
              onChange={e => setOutcomeForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Add a note..."
              rows={2}
              style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", resize: "none", marginBottom: "20px", boxSizing: "border-box" }}
            />

            <button
              onClick={markOutcome}
              disabled={saving}
              style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "none", backgroundColor: "#1a3a2a", color: "#fff", fontSize: "16px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}
            >
              {saving ? "Saving..." : "Confirm Outcome"}
            </button>
            <button
              onClick={() => { setShowOutcomeSheet(false); setSelectedSession(null); }}
              style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "12px", padding: "6px" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
