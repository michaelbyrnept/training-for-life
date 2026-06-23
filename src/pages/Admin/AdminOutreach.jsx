import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";

const PLATFORMS = ["Instagram", "Facebook", "WhatsApp", "Email", "Text", "In Person", "Other"];
const STATUSES = [
  { id: "sent", label: "Sent", color: "#888", bg: "#f0f0f0" },
  { id: "replied", label: "Replied", color: "#0369a1", bg: "#e0f2fe" },
  { id: "booked", label: "Booked", color: "#2d6a4f", bg: "#eaf5ef" },
  { id: "not_interested", label: "Not Interested", color: "#888", bg: "#f0f0f0" },
  { id: "follow_up", label: "Follow Up", color: "#b45309", bg: "#fffbeb" },
];

const SOURCES = ["FLYEfit followers", "Instagram hashtag", "Facebook group", "Referral", "Cold follow", "Engagement on post", "Class attendee", "Other"];

const emptyForm = {
  name: "",
  platform: "Instagram",
  handle: "",
  source: "Cold follow",
  messageType: "",
  status: "sent",
  notes: "",
  date: new Date().toISOString().split("T")[0],
};

export default function AdminOutreach() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => { fetchEntries(); }, []);

  const fetchEntries = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "outreach"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    setEntries(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return alert("Name is required.");
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "outreach", editing), { ...form, updatedAt: new Date().toISOString() });
      } else {
        await addDoc(collection(db, "outreach"), { ...form, createdAt: new Date().toISOString() });
      }
      setForm(emptyForm);
      setEditing(null);
      setShowForm(false);
      await fetchEntries();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const handleEdit = (entry) => {
    setForm({
      name: entry.name || "",
      platform: entry.platform || "Instagram",
      handle: entry.handle || "",
      source: entry.source || "Cold follow",
      messageType: entry.messageType || "",
      status: entry.status || "sent",
      notes: entry.notes || "",
      date: entry.date || new Date().toISOString().split("T")[0],
    });
    setEditing(entry.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, "outreach", id), { status, updatedAt: new Date().toISOString() });
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    await deleteDoc(doc(db, "outreach", id));
    await fetchEntries();
  };

  // Stats
  const today = new Date().toISOString().split("T")[0];
  const todayEntries = entries.filter(e => e.date === today);
  const thisWeek = entries.filter(e => {
    const d = new Date(e.date);
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
    monday.setHours(0,0,0,0);
    return d >= monday;
  });
  const totalBooked = entries.filter(e => e.status === "booked").length;
  const totalReplied = entries.filter(e => e.status === "replied" || e.status === "booked").length;
  const replyRate = entries.length > 0 ? Math.round((totalReplied / entries.length) * 100) : 0;

  const filtered = entries.filter(e => {
    if (filter !== "all" && e.status !== filter) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.handle?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by date
  const grouped = filtered.reduce((acc, e) => {
    const key = e.date || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "2rem" }}>
      <div style={{ padding: "1.5rem 1.25rem 1rem" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#2d6a4f", fontWeight: 600, textDecoration: "none" }}>← Admin</Link>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#111", margin: "8px 0 4px" }}>Outreach Tracker</h1>
        <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>{entries.length} total contacts</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", padding: "0 1.25rem 1rem" }}>
        {[
          { label: "Today", value: todayEntries.length, sub: "messages sent", color: "#2d6a4f" },
          { label: "This Week", value: thisWeek.length, sub: "messages sent", color: "#2d6a4f" },
          { label: "Reply Rate", value: `${replyRate}%`, sub: "of all outreach", color: "#0369a1" },
          { label: "Consultations", value: totalBooked, sub: "booked from DMs", color: "#7c3aed" },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>{s.label}</p>
            <p style={{ fontSize: "26px", fontWeight: 700, color: s.color, margin: "0 0 2px", lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: "11px", color: "#aaa", margin: 0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Daily target */}
      <div style={{ margin: "0 1.25rem 1rem", backgroundColor: "#1a3a2a", borderRadius: "14px", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#fff", margin: 0 }}>Today's target: 20 outreaches</p>
          <p style={{ fontSize: "13px", fontWeight: 700, color: todayEntries.length >= 20 ? "#4ade80" : "#9fe1cb", margin: 0 }}>
            {todayEntries.length}/20
          </p>
        </div>
        <div style={{ height: "6px", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "3px" }}>
          <div style={{ height: "6px", backgroundColor: todayEntries.length >= 20 ? "#4ade80" : "#2d6a4f", borderRadius: "3px", width: `${Math.min((todayEntries.length / 20) * 100, 100)}%`, transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* Add button */}
      {!showForm && (
        <div style={{ padding: "0 1.25rem 1rem" }}>
          <button onClick={() => { setForm(emptyForm); setEditing(null); setShowForm(true); }} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontWeight: 700, fontSize: "15px", cursor: "pointer" }}>
            + Log Outreach
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div style={{ margin: "0 1.25rem 1.5rem", backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 16px" }}>
            {editing ? "Edit Entry" : "Log Outreach"}
          </h2>

          <p style={labelStyle}>Name</p>
          <input style={inputStyle} placeholder="e.g. Mary Murphy" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

          <p style={labelStyle}>Platform</p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "4px" }}>
            {PLATFORMS.map(p => (
              <div key={p} onClick={() => setForm(f => ({ ...f, platform: p }))} style={{ padding: "6px 12px", borderRadius: "20px", border: `1.5px solid ${form.platform === p ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: form.platform === p ? "#eaf5ef" : "#fff", fontSize: "13px", fontWeight: 700, color: form.platform === p ? "#2d6a4f" : "#888", cursor: "pointer" }}>
                {p}
              </div>
            ))}
          </div>

          <p style={labelStyle}>Handle / Contact</p>
          <input style={inputStyle} placeholder="@username or phone number" value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} />

          <p style={labelStyle}>Source</p>
          <select style={inputStyle} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <p style={labelStyle}>Message sent</p>
          <input style={inputStyle} placeholder="e.g. Simple opener, Free app offer, Doctor referral angle..." value={form.messageType} onChange={e => setForm(f => ({ ...f, messageType: e.target.value }))} />

          <p style={labelStyle}>Date</p>
          <input type="date" style={inputStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />

          <p style={labelStyle}>Status</p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "4px" }}>
            {STATUSES.map(s => (
              <div key={s.id} onClick={() => setForm(f => ({ ...f, status: s.id }))} style={{ padding: "6px 12px", borderRadius: "20px", border: `1.5px solid ${form.status === s.id ? s.color : "#e5e5e5"}`, backgroundColor: form.status === s.id ? s.bg : "#fff", fontSize: "13px", fontWeight: 700, color: form.status === s.id ? s.color : "#888", cursor: "pointer" }}>
                {s.label}
              </div>
            ))}
          </div>

          <p style={labelStyle}>Notes</p>
          <textarea style={{ ...inputStyle, height: "80px", resize: "vertical" }} placeholder="Any context -- what did they say, what's the follow up plan..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "10px", padding: "13px", fontWeight: 700, fontSize: "15px", cursor: "pointer" }}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Log It"}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm); }} style={{ backgroundColor: "#f0f0f0", color: "#555", border: "none", borderRadius: "10px", padding: "13px 20px", fontWeight: 600, fontSize: "15px", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ padding: "0 1.25rem 10px" }}>
        <input style={{ ...inputStyle, backgroundColor: "#fff", marginBottom: "10px" }} placeholder="Search by name or handle..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
          <div onClick={() => setFilter("all")} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: "20px", border: `1.5px solid ${filter === "all" ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: filter === "all" ? "#eaf5ef" : "#fff", fontSize: "13px", fontWeight: 700, color: filter === "all" ? "#2d6a4f" : "#888", cursor: "pointer" }}>
            All ({entries.length})
          </div>
          {STATUSES.map(s => {
            const count = entries.filter(e => e.status === s.id).length;
            if (count === 0) return null;
            return (
              <div key={s.id} onClick={() => setFilter(s.id)} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: "20px", border: `1.5px solid ${filter === s.id ? s.color : "#e5e5e5"}`, backgroundColor: filter === s.id ? s.bg : "#fff", fontSize: "13px", fontWeight: 700, color: filter === s.id ? s.color : "#888", cursor: "pointer" }}>
                {s.label} ({count})
              </div>
            );
          })}
        </div>
      </div>

      {/* Entries */}
      {loading ? (
        <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>No entries yet. Start logging your outreach!</p>
      ) : (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date} style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#888", padding: "0 1.25rem", marginBottom: "8px" }}>
              {new Date(date + "T12:00:00").toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" })}
              <span style={{ marginLeft: "8px", color: "#aaa", fontWeight: 400 }}>({items.length})</span>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "0 1.25rem" }}>
              {items.map(entry => {
                const statusInfo = STATUSES.find(s => s.id === entry.status) || STATUSES[0];
                return (
                  <div key={entry.id} style={{ backgroundColor: "#fff", borderRadius: "12px", border: "0.5px solid #e5e5e5", padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                          <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{entry.name}</p>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "#888", backgroundColor: "#f0f0f0", padding: "2px 8px", borderRadius: "10px" }}>{entry.platform}</span>
                        </div>
                        {entry.handle && <p style={{ fontSize: "12px", color: "#aaa", margin: "0 0 4px" }}>{entry.handle}</p>}
                        {entry.messageType && <p style={{ fontSize: "12px", color: "#555", margin: "0 0 4px" }}>{entry.messageType}</p>}
                        {entry.notes && <p style={{ fontSize: "12px", color: "#888", margin: "0 0 8px", fontStyle: "italic" }}>{entry.notes}</p>}

                        {/* Status quick update */}
                        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                          {STATUSES.map(s => (
                            <div key={s.id} onClick={() => updateStatus(entry.id, s.id)} style={{ padding: "3px 8px", borderRadius: "20px", border: `1px solid ${entry.status === s.id ? s.color : "#e5e5e5"}`, backgroundColor: entry.status === s.id ? s.bg : "#fff", fontSize: "11px", fontWeight: 700, color: entry.status === s.id ? s.color : "#aaa", cursor: "pointer" }}>
                              {s.label}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                        <button onClick={() => handleEdit(entry)} style={smallBtn("#eaf5ef", "#2d6a4f")}>Edit</button>
                        <button onClick={() => handleDelete(entry.id)} style={smallBtn("#fef2f2", "#dc2626")}>✕</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: "12px", fontWeight: 600, color: "#555", marginBottom: "6px", marginTop: "14px" };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", color: "#111", backgroundColor: "#fafafa", boxSizing: "border-box" };
const smallBtn = (bg, color) => ({ backgroundColor: bg, color, border: "none", borderRadius: "8px", padding: "6px 10px", fontSize: "12px", fontWeight: 600, cursor: "pointer" });