import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, addDoc, query, where, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";

const CATEGORY_FILTERS = ["All", "Workout", "Weight", "Strength", "Habit", "Coaching", "Custom"];

const PRIORITY_STYLE = {
  high:   { color: "#9a3412", bg: "#fee2e2", label: "High" },
  medium: { color: "#92400e", bg: "#fef3c7", label: "Medium" },
  low:    { color: "#374151", bg: "#f3f4f6", label: "Low" },
};

const CATEGORY_ICON = {
  Workout:  "🏋️",
  Weight:   "⚖️",
  Strength: "💪",
  Habit:    "🔥",
  Coaching: "🏆",
  Custom:   "⭐",
};

const WHATSAPP_TEMPLATES = {
  Workout: (name, title) => `Hey ${name}, you've just hit ${title.toLowerCase()}. That's a serious body of work. Really proud of how consistent you've been. Keep it going.`,
  Weight:  (name, title) => `Hey ${name}, just saw you've officially hit ${title.toLowerCase()}. Brilliant work. Keep doing exactly what you're doing. Looking forward to seeing what we can achieve next.`,
  Strength:(name, title) => `Hey ${name}, massive achievement — ${title.toLowerCase()}. You've earned that. Keep pushing.`,
  Habit:   (name, title) => `${name}, ${title.toLowerCase()} — that's not a coincidence, that's a habit. This is exactly what long-term change looks like.`,
  Coaching:(name, title) => `${name}, we've just hit ${title.toLowerCase()} working together. I just want to say — I can genuinely see the difference this has made. Keep showing up like you do.`,
  Custom:  (name, title) => `Hey ${name}, just wanted to reach out — ${title.toLowerCase()}. Really impressive progress. Keep it up.`,
};

function timeAgo(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
}

function getInitials(name) {
  return (name || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function AdminWins() {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending"); // pending | recognised
  const [filterCategory, setFilterCategory] = useState("All");
  const [saving, setSaving] = useState(null);
  const [whatsappSheet, setWhatsappSheet] = useState(null); // { milestone, message }
  const [commentSheet, setCommentSheet] = useState(null);   // { milestone }
  const [comment, setComment] = useState("");
  const [editedMessage, setEditedMessage] = useState("");

  // Custom milestone creator
  const [createSheet, setCreateSheet] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", description: "", category: "Custom", priority: "medium" });
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadMilestones(); }, []);

  const loadMilestones = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "milestones"), orderBy("detectedAt", "desc"))
      );
      setMilestones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  };

  const markRecognised = async (milestone, method = "marked", note = null) => {
    setSaving(milestone.id);
    try {
      await updateDoc(doc(db, "milestones", milestone.id), {
        recognised: true,
        recognisedAt: new Date(),
        recognitionMethod: method,
        ...(note ? { coachNote: note } : {}),
      });
      setMilestones(prev => prev.map(m =>
        m.id === milestone.id
          ? { ...m, recognised: true, recognisedAt: new Date(), recognitionMethod: method, ...(note ? { coachNote: note } : {}) }
          : m
      ));
    } finally {
      setSaving(null);
    }
  };

  const openWhatsApp = (milestone) => {
    const firstName = (milestone.clientName || "").split(" ")[0];
    const template = WHATSAPP_TEMPLATES[milestone.category] || WHATSAPP_TEMPLATES.Custom;
    const msg = template(firstName, milestone.title);
    setEditedMessage(msg);
    setWhatsappSheet(milestone);
  };

  const sendWhatsApp = async (milestone, message) => {
    // Get phone number from user profile
    const usersSnap = await getDocs(
      query(collection(db, "users"), where("__name__", "==", milestone.clientId))
    );
    const phone = usersSnap.empty ? null : usersSnap.docs[0].data().phone;

    if (phone) {
      const url = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank");
    } else {
      // No phone — open WhatsApp without a number (coach can search manually)
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank");
    }

    await markRecognised(milestone, "whatsapp");
    setWhatsappSheet(null);
  };

  const submitComment = async () => {
    if (!comment.trim() || !commentSheet) return;
    await markRecognised(commentSheet, "comment", comment.trim());
    setCommentSheet(null);
    setComment("");
  };

  const searchClients = async (term) => {
    setClientSearch(term);
    setSelectedClient(null);
    if (term.trim().length < 2) { setClientResults([]); return; }
    const snap = await getDocs(collection(db, "users"));
    const results = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => {
        const name = `${u.firstName || ""} ${u.lastName || ""} ${u.email || ""}`.toLowerCase();
        return name.includes(term.toLowerCase()) && u.email;
      })
      .slice(0, 8);
    setClientResults(results);
  };

  const createCustomMilestone = async () => {
    if (!selectedClient || !createForm.title.trim()) return;
    setCreating(true);
    try {
      const clientName = `${selectedClient.firstName || ""} ${selectedClient.lastName || ""}`.trim() || selectedClient.email;
      const milestoneData = {
        clientId: selectedClient.id,
        clientName,
        category: createForm.category,
        type: `custom_${createForm.category.toLowerCase()}`,
        title: createForm.title.trim(),
        description: createForm.description.trim() || null,
        priority: createForm.priority,
        detectedAt: serverTimestamp(),
        recognised: false,
        source: "manual",
      };

      // Write to milestones (shows in the queue)
      const milestoneRef = await addDoc(collection(db, "milestones"), milestoneData);

      // Write to clientTimeline (shows on client's timeline)
      await addDoc(collection(db, "clientTimeline"), {
        ...milestoneData,
        milestoneId: milestoneRef.id,
      });

      // Write to customMilestones (template/history)
      await addDoc(collection(db, "customMilestones"), milestoneData);

      setCreateSheet(false);
      setCreateForm({ title: "", description: "", category: "Custom", priority: "medium" });
      setSelectedClient(null);
      setClientSearch("");
      setClientResults([]);
      await loadMilestones();
    } catch (e) {
      console.error("Error creating milestone:", e);
    }
    setCreating(false);
  };

  // Filter milestones
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);

  const filtered = milestones.filter(m => {
    const matchesTab = activeTab === "pending" ? !m.recognised : m.recognised;
    const matchesCat = filterCategory === "All" || m.category === filterCategory;
    if (activeTab === "recognised") {
      const rAt = m.recognisedAt?.toDate ? m.recognisedAt.toDate() : m.recognisedAt ? new Date(m.recognisedAt) : null;
      if (!rAt || rAt < weekAgo) return false;
    }
    return matchesTab && matchesCat;
  });

  // Sort pending: high priority first, then by date
  const sorted = [...filtered].sort((a, b) => {
    if (activeTab === "pending") {
      const pa = a.priority === "high" ? 0 : a.priority === "medium" ? 1 : 2;
      const pb = b.priority === "high" ? 0 : b.priority === "medium" ? 1 : 2;
      if (pa !== pb) return pa - pb;
    }
    const da = a.detectedAt?.toDate ? a.detectedAt.toDate() : new Date(a.detectedAt || 0);
    const db2 = b.detectedAt?.toDate ? b.detectedAt.toDate() : new Date(b.detectedAt || 0);
    return db2 - da;
  });

  const pendingCount = milestones.filter(m => !m.recognised).length;
  const highPriorityCount = milestones.filter(m => !m.recognised && m.priority === "high").length;
  const recognisedThisWeek = milestones.filter(m => {
    if (!m.recognised) return false;
    const rAt = m.recognisedAt?.toDate ? m.recognisedAt.toDate() : m.recognisedAt ? new Date(m.recognisedAt) : null;
    return rAt && rAt >= weekAgo;
  }).length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 24px" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>Admin</Link>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "8px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>Wins & Recognition</h1>
            <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
              {pendingCount > 0 ? `${pendingCount} client${pendingCount > 1 ? "s" : ""} waiting for recognition` : "All clients recognised"}
            </p>
          </div>
          {highPriorityCount > 0 && (
            <div style={{ backgroundColor: "#fee2e2", borderRadius: "20px", padding: "6px 12px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#9a3412" }}>{highPriorityCount} high priority</span>
            </div>
          )}
        </div>

        {/* STAT PILLS */}
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          {[
            { label: "Unrecognised", value: pendingCount, urgent: pendingCount > 0 },
            { label: "This week", value: recognisedThisWeek },
            { label: "Total milestones", value: milestones.length },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "12px", padding: "10px 12px", textAlign: "center" }}>
              <p style={{ fontSize: "20px", fontWeight: 700, color: s.urgent ? "#f87171" : "#fff", margin: "0 0 2px", lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: "10px", color: "#9fe1cb", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>

        {/* TABS */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          {[
            { id: "pending", label: `Needs Recognition${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
            { id: "recognised", label: `Recognised This Week${recognisedThisWeek > 0 ? ` (${recognisedThisWeek})` : ""}` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{ flex: 1, padding: "10px 12px", borderRadius: "12px", border: "none", backgroundColor: activeTab === t.id ? "#1a3a2a" : "#fff", color: activeTab === t.id ? "#fff" : "#888", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* CATEGORY FILTERS */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px", overflowX: "auto", paddingBottom: "4px" }}>
          {CATEGORY_FILTERS.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              style={{ flexShrink: 0, padding: "6px 12px", borderRadius: "20px", border: filterCategory === cat ? "none" : "0.5px solid #e5e5e5", backgroundColor: filterCategory === cat ? "#2d6a4f" : "#fff", color: filterCategory === cat ? "#fff" : "#888", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              {CATEGORY_ICON[cat] && cat !== "All" ? `${CATEGORY_ICON[cat]} ` : ""}{cat}
            </button>
          ))}
        </div>

        {/* ADD CUSTOM MILESTONE */}
        <button
          onClick={() => { setCreateSheet(true); setCreateForm({ title: "", description: "", category: "Custom", priority: "medium" }); setSelectedClient(null); setClientSearch(""); setClientResults([]); }}
          style={{ width: "100%", padding: "11px", borderRadius: "12px", border: "1.5px dashed #2d6a4f", backgroundColor: "#fff", color: "#2d6a4f", fontSize: "13px", fontWeight: 700, cursor: "pointer", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
        >
          + Add Custom Milestone
        </button>

        {/* MILESTONE LIST */}
        {loading ? (
          <p style={{ textAlign: "center", color: "#888", padding: "40px 0" }}>Loading...</p>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5" }}>
            <p style={{ fontSize: "36px", margin: "0 0 12px" }}>{activeTab === "pending" ? "🎉" : "📋"}</p>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>
              {activeTab === "pending" ? "All caught up" : "Nothing recognised this week yet"}
            </p>
            <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>
              {activeTab === "pending" ? "No milestones waiting for recognition." : "Milestones you recognise will appear here."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {sorted.map(m => {
              const priorityStyle = PRIORITY_STYLE[m.priority] || PRIORITY_STYLE.low;
              const isSaving = saving === m.id;

              return (
                <div
                  key={m.id}
                  style={{ backgroundColor: "#fff", borderRadius: "16px", border: m.priority === "high" && !m.recognised ? "1.5px solid #fca5a5" : "0.5px solid #e5e5e5", overflow: "hidden" }}
                >
                  {/* CARD HEADER */}
                  <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    {/* Avatar */}
                    <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "#2d6a4f", flexShrink: 0 }}>
                      {getInitials(m.clientName)}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "2px" }}>
                        <Link to={`/admin/clients/${m.clientId}`} style={{ fontSize: "14px", fontWeight: 700, color: "#111", textDecoration: "none" }}>
                          {m.clientName}
                        </Link>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: priorityStyle.color, backgroundColor: priorityStyle.bg, padding: "2px 7px", borderRadius: "10px" }}>
                          {priorityStyle.label}
                        </span>
                      </div>

                      <p style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f", margin: "0 0 3px" }}>
                        {CATEGORY_ICON[m.category]} {m.title}
                      </p>
                      <p style={{ fontSize: "12px", color: "#888", margin: "0 0 3px", lineHeight: 1.5 }}>
                        {m.description}
                      </p>
                      <p style={{ fontSize: "11px", color: "#aaa", margin: 0 }}>
                        {timeAgo(m.detectedAt)}
                        {m.recognised && m.recognitionMethod && (
                          <span style={{ marginLeft: "8px", color: "#2d6a4f", fontWeight: 700 }}>
                            {m.recognitionMethod === "whatsapp" ? "via WhatsApp" : m.recognitionMethod === "message" ? "via message" : m.recognitionMethod === "comment" ? "note added" : "marked"}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* ACTION ROW */}
                  {!m.recognised && (
                    <div style={{ padding: "10px 16px 14px", borderTop: "0.5px solid #f5f5f5", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => openWhatsApp(m)}
                        style={{ flex: 1, minWidth: "80px", padding: "9px 10px", borderRadius: "10px", border: "none", backgroundColor: "#25D366", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                      >
                        <span>WhatsApp</span>
                      </button>
                      <button
                        onClick={() => { setCommentSheet(m); setComment(""); }}
                        style={{ flex: 1, minWidth: "80px", padding: "9px 10px", borderRadius: "10px", border: "0.5px solid #e5e5e5", backgroundColor: "#fff", color: "#555", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                      >
                        Add Note
                      </button>
                      <button
                        onClick={() => markRecognised(m, "marked")}
                        disabled={isSaving}
                        style={{ flex: 1, minWidth: "80px", padding: "9px 10px", borderRadius: "10px", border: "none", backgroundColor: isSaving ? "#e5e5e5" : "#eaf5ef", color: isSaving ? "#aaa" : "#2d6a4f", fontSize: "12px", fontWeight: 700, cursor: isSaving ? "default" : "pointer" }}
                      >
                        {isSaving ? "Saving..." : "Mark Done"}
                      </button>
                    </div>
                  )}

                  {/* COACH NOTE (if present) */}
                  {m.coachNote && (
                    <div style={{ padding: "10px 16px 12px", borderTop: "0.5px solid #f5f5f5" }}>
                      <p style={{ fontSize: "12px", color: "#555", margin: 0, fontStyle: "italic" }}>Note: {m.coachNote}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* WHATSAPP SHEET */}
      {whatsappSheet && (
        <div onClick={e => { if (e.target === e.currentTarget) setWhatsappSheet(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Send WhatsApp</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>
              {whatsappSheet.clientName} — {whatsappSheet.title}
            </p>

            <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "8px" }}>Suggested Message</label>
            <textarea
              value={editedMessage}
              onChange={e => setEditedMessage(e.target.value)}
              rows={5}
              style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "14px", lineHeight: "1.6", color: "#111", outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "Arial, sans-serif" }}
              onFocus={e => e.target.style.borderColor = "#2d6a4f"}
              onBlur={e => e.target.style.borderColor = "#e5e5e5"}
            />
            <p style={{ fontSize: "11px", color: "#aaa", margin: "6px 0 20px" }}>Edit the message before sending if you want. It opens WhatsApp with the text pre-filled.</p>

            <button
              onClick={() => sendWhatsApp(whatsappSheet, editedMessage)}
              style={{ width: "100%", backgroundColor: "#25D366", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}
            >
              Open WhatsApp
            </button>
            <button
              onClick={() => setWhatsappSheet(null)}
              style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* CREATE CUSTOM MILESTONE SHEET */}
      {createSheet && (
        <div onClick={e => { if (e.target === e.currentTarget) setCreateSheet(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Add Custom Milestone</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>Manually log a win for any client</p>

            {/* Client picker */}
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Client</label>
            {selectedClient ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: "12px", backgroundColor: "#eaf5ef", border: "1.5px solid #2d6a4f", marginBottom: "16px" }}>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a3a2a", margin: 0 }}>
                    {selectedClient.firstName || ""} {selectedClient.lastName || ""}
                  </p>
                  <p style={{ fontSize: "12px", color: "#2d6a4f", margin: "2px 0 0" }}>{selectedClient.email}</p>
                </div>
                <button onClick={() => { setSelectedClient(null); setClientSearch(""); setClientResults([]); }} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#888", padding: "4px" }}>×</button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={clientSearch}
                  onChange={e => searchClients(e.target.value)}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "14px", outline: "none", boxSizing: "border-box", marginBottom: "8px" }}
                />
                {clientResults.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                    {clientResults.map(c => (
                      <div key={c.id} onClick={() => { setSelectedClient(c); setClientResults([]); }} style={{ padding: "12px 14px", borderRadius: "12px", backgroundColor: "#f7f5f2", border: "0.5px solid #e5e5e5", cursor: "pointer" }}>
                        <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{c.firstName || ""} {c.lastName || ""}</p>
                        <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>{c.email}</p>
                      </div>
                    ))}
                  </div>
                )}
                {clientSearch.length >= 2 && clientResults.length === 0 && (
                  <p style={{ fontSize: "13px", color: "#aaa", marginBottom: "16px" }}>No clients found</p>
                )}
              </>
            )}

            {/* Title */}
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Title</label>
            <input
              type="text"
              placeholder="e.g. Ran first 5k, Lost 10kg, 6 months consistent"
              value={createForm.title}
              onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
              style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "14px", outline: "none", boxSizing: "border-box", marginBottom: "16px" }}
            />

            {/* Description */}
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Description (optional)</label>
            <textarea
              placeholder="Add more context..."
              value={createForm.description}
              onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "14px", outline: "none", boxSizing: "border-box", resize: "none", marginBottom: "16px", fontFamily: "inherit" }}
            />

            {/* Category */}
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>Category</label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
              {["Custom", "Workout", "Weight", "Strength", "Habit", "Coaching"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCreateForm(f => ({ ...f, category: cat }))}
                  style={{ padding: "7px 12px", borderRadius: "20px", border: createForm.category === cat ? "none" : "0.5px solid #e5e5e5", backgroundColor: createForm.category === cat ? "#2d6a4f" : "#fff", color: createForm.category === cat ? "#fff" : "#888", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                >
                  {CATEGORY_ICON[cat] ? `${CATEGORY_ICON[cat]} ` : ""}{cat}
                </button>
              ))}
            </div>

            {/* Priority */}
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>Priority</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
              {[
                { value: "high",   label: "High",   color: "#9a3412", bg: "#fee2e2" },
                { value: "medium", label: "Medium", color: "#92400e", bg: "#fef3c7" },
                { value: "low",    label: "Low",    color: "#374151", bg: "#f3f4f6" },
              ].map(p => (
                <button
                  key={p.value}
                  onClick={() => setCreateForm(f => ({ ...f, priority: p.value }))}
                  style={{ flex: 1, padding: "10px", borderRadius: "12px", border: createForm.priority === p.value ? `1.5px solid ${p.color}` : "0.5px solid #e5e5e5", backgroundColor: createForm.priority === p.value ? p.bg : "#fff", color: createForm.priority === p.value ? p.color : "#888", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              onClick={createCustomMilestone}
              disabled={creating || !selectedClient || !createForm.title.trim()}
              style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "none", backgroundColor: (!selectedClient || !createForm.title.trim()) ? "#e5e5e5" : creating ? "#aaa" : "#1a3a2a", color: (!selectedClient || !createForm.title.trim() || creating) ? "#aaa" : "#fff", fontSize: "15px", fontWeight: 700, cursor: (!selectedClient || !createForm.title.trim() || creating) ? "default" : "pointer", marginBottom: "10px" }}
            >
              {creating ? "Adding..." : "Add Milestone"}
            </button>
            <button onClick={() => setCreateSheet(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* COMMENT SHEET */}
      {commentSheet && (
        <div onClick={e => { if (e.target === e.currentTarget) { setCommentSheet(null); setComment(""); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Add Note</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>
              Private note for {commentSheet.clientName} — {commentSheet.title}
            </p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="e.g. Called her about this. She was delighted."
              rows={4}
              style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "14px", color: "#111", outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Arial, sans-serif" }}
              onFocus={e => e.target.style.borderColor = "#2d6a4f"}
              onBlur={e => e.target.style.borderColor = "#e5e5e5"}
            />
            <button
              onClick={submitComment}
              disabled={!comment.trim()}
              style={{ width: "100%", backgroundColor: comment.trim() ? "#2d6a4f" : "#e5e5e5", color: comment.trim() ? "#fff" : "#aaa", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: comment.trim() ? "pointer" : "default", marginTop: "12px", marginBottom: "10px" }}
            >
              Save Note and Mark Recognised
            </button>
            <button
              onClick={() => { setCommentSheet(null); setComment(""); }}
              style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
