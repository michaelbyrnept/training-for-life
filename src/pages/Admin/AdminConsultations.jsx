import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";

const STATUSES = [
  { id: "new", label: "New", color: "#dc2626", bg: "#fef2f2" },
  { id: "contacted", label: "Contacted", color: "#b45309", bg: "#fffbeb" },
  { id: "booked", label: "Booked", color: "#0369a1", bg: "#e0f2fe" },
  { id: "converted", label: "Converted", color: "#2d6a4f", bg: "#eaf5ef" },
  { id: "not_interested", label: "Not Interested", color: "#888", bg: "#f0f0f0" },
];

export default function AdminConsultations() {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "consultations"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    setConsultations(data);
    setLoading(false);
  };

  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, "consultations", id), { status });
    setConsultations(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    if (selected?.id === id) setSelected(prev => ({ ...prev, status }));
  };

  const filtered = consultations.filter(c => filter === "all" || (c.status || "new") === filter);

  const newCount = consultations.filter(c => !c.status || c.status === "new").length;

  if (selected) {
    const statusInfo = STATUSES.find(s => s.id === (selected.status || "new")) || STATUSES[0];
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>
        <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 28px" }}>
          <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: "13px", color: "#9fe1cb", fontWeight: 700, cursor: "pointer", padding: 0 }}>← Back</button>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "14px 0 2px" }}>{selected.fullName}</h1>
          <p style={{ fontSize: "13px", color: "#9fe1cb", margin: "0 0 8px" }}>{selected.email} · {selected.phone}</p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: 0 }}>
            Age {selected.age} · Submitted {selected.submittedAt ? new Date(selected.submittedAt).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }) : "Unknown"}
          </p>
        </div>

        <div style={{ padding: "16px" }}>
          {/* Status */}
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Status</p>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {STATUSES.map(s => (
                <div key={s.id} onClick={() => updateStatus(selected.id, s.id)} style={{ padding: "6px 12px", borderRadius: "20px", border: `1.5px solid ${selected.status === s.id || (!selected.status && s.id === "new") ? s.color : "#e5e5e5"}`, backgroundColor: selected.status === s.id || (!selected.status && s.id === "new") ? s.bg : "#fff", fontSize: "13px", fontWeight: 700, color: selected.status === s.id || (!selected.status && s.id === "new") ? s.color : "#888", cursor: "pointer" }}>
                  {s.label}
                </div>
              ))}
            </div>
          </div>

          {/* Answers */}
          {[
            { label: "What they want help with", value: selected.helpWith },
            { label: "What feels most limiting", value: selected.limiting },
            { label: "What they want to feel capable of", value: selected.capable },
            { label: "Pain or injuries", value: selected.pain },
            { label: "Anything else", value: selected.other },
          ].filter(i => i.value).map(item => (
            <div key={item.label} style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>{item.label}</p>
              <p style={{ fontSize: "15px", color: "#111", margin: 0, lineHeight: 1.6 }}>{item.value}</p>
            </div>
          ))}

          {/* Contact buttons */}
          <a href={`mailto:${selected.email}`} style={{ display: "block", width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", textAlign: "center", textDecoration: "none", marginBottom: "10px", boxSizing: "border-box" }}>
            Email {selected.fullName?.split(" ")[0]}
          </a>
          {selected.phone && (
            <a href={`tel:${selected.phone}`} style={{ display: "block", width: "100%", backgroundColor: "#fff", color: "#2d6a4f", border: "1.5px solid #2d6a4f", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>
              Call {selected.fullName?.split(" ")[0]}
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "2rem" }}>
      <div style={{ padding: "1.5rem 1.25rem 1rem" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#2d6a4f", fontWeight: 600, textDecoration: "none" }}>← Admin</Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Consultations</h1>
          {newCount > 0 && <span style={{ backgroundColor: "#dc2626", color: "#fff", fontSize: "12px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px" }}>{newCount} new</span>}
        </div>
        <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>{consultations.length} total applications</p>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: "6px", padding: "0 1.25rem 1rem", overflowX: "auto" }}>
        <div onClick={() => setFilter("all")} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: "20px", border: `1.5px solid ${filter === "all" ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: filter === "all" ? "#eaf5ef" : "#fff", fontSize: "13px", fontWeight: 700, color: filter === "all" ? "#2d6a4f" : "#888", cursor: "pointer" }}>
          All ({consultations.length})
        </div>
        {STATUSES.map(s => {
          const count = consultations.filter(c => (c.status || "new") === s.id).length;
          if (count === 0) return null;
          return (
            <div key={s.id} onClick={() => setFilter(s.id)} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: "20px", border: `1.5px solid ${filter === s.id ? s.color : "#e5e5e5"}`, backgroundColor: filter === s.id ? s.bg : "#fff", fontSize: "13px", fontWeight: 700, color: filter === s.id ? s.color : "#888", cursor: "pointer" }}>
              {s.label} ({count})
            </div>
          );
        })}
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>No applications yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "0 1.25rem" }}>
          {filtered.map(c => {
            const statusInfo = STATUSES.find(s => s.id === (c.status || "new")) || STATUSES[0];
            return (
              <div key={c.id} onClick={() => setSelected(c)} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <p style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: 0 }}>{c.fullName}</p>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: statusInfo.color, backgroundColor: statusInfo.bg, padding: "3px 10px", borderRadius: "20px" }}>
                    {statusInfo.label}
                  </span>
                </div>
                <p style={{ fontSize: "13px", color: "#888", margin: "0 0 4px" }}>{c.email} · Age {c.age}</p>
                {c.helpWith && <p style={{ fontSize: "13px", color: "#555", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.helpWith}</p>}
                <p style={{ fontSize: "11px", color: "#aaa", margin: "6px 0 0" }}>
                  {c.submittedAt ? new Date(c.submittedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" }) : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
