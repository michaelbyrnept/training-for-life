import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";

export default function AdminWaitlist() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "waitlist"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.signedUpAt) - new Date(a.signedUpAt));
    setEntries(data);
    setLoading(false);
  };

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    setSelected(selected.length === entries.length ? [] : entries.map(e => e.id));
  };

  const copyEmails = () => {
    const toExport = selected.length > 0 ? entries.filter(e => selected.includes(e.id)) : entries;
    const emails = toExport.map(e => e.email).filter(Boolean).join(", ");
    navigator.clipboard.writeText(emails);
    alert(`${toExport.length} email${toExport.length > 1 ? "s" : ""} copied to clipboard`);
  };

  const removeEntry = async (id) => {
    if (!window.confirm("Remove from waitlist?")) return;
    await deleteDoc(doc(db, "waitlist", id));
    setEntries(prev => prev.filter(e => e.id !== id));
    setSelected(prev => prev.filter(i => i !== id));
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "2rem" }}>
      <div style={{ padding: "1.5rem 1.25rem 1rem" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#2d6a4f", fontWeight: 600, textDecoration: "none" }}>← Admin</Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Premium Waitlist</h1>
            <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>{entries.length} people waiting</p>
          </div>
          {entries.length > 0 && (
            <button onClick={copyEmails} style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
              {selected.length > 0 ? `Copy ${selected.length} emails` : "Copy all emails"}
            </button>
          )}
        </div>
      </div>

      {/* Info card */}
      <div style={{ margin: "0 1.25rem 1rem", backgroundColor: "#1a3a2a", borderRadius: "14px", padding: "14px 16px" }}>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: "0 0 4px", fontWeight: 700 }}>How to reach out</p>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.6 }}>
          Select contacts and copy their emails to send a personal message, or copy all to send a group announcement when Premium launches.
        </p>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>Loading...</p>
      ) : entries.length === 0 ? (
        <div style={{ margin: "0 1.25rem", backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "32px", textAlign: "center" }}>
          <p style={{ fontSize: "28px", margin: "0 0 10px" }}>🔔</p>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No one on the waitlist yet</p>
          <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>When people tap "Notify me" on the Training page they'll appear here.</p>
        </div>
      ) : (
        <div style={{ padding: "0 1.25rem" }}>
          {/* Select all */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <button onClick={selectAll} style={{ background: "none", border: "none", fontSize: "13px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer", padding: 0 }}>
              {selected.length === entries.length ? "Deselect all" : "Select all"}
            </button>
            {selected.length > 0 && (
              <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>{selected.length} selected</p>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {entries.map(entry => {
              const isSelected = selected.includes(entry.id);
              return (
                <div key={entry.id} onClick={() => toggleSelect(entry.id)} style={{ backgroundColor: "#fff", borderRadius: "14px", border: `0.5px solid ${isSelected ? "#2d6a4f" : "#e5e5e5"}`, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px" }}>
                  {/* Checkbox */}
                  <div style={{ width: 22, height: 22, borderRadius: "6px", border: `2px solid ${isSelected ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: isSelected ? "#2d6a4f" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isSelected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>

                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{entry.name || "Unknown"}</p>
                    <p style={{ fontSize: "13px", color: "#888", margin: "2px 0 0" }}>{entry.email}</p>
                    <p style={{ fontSize: "11px", color: "#aaa", margin: "2px 0 0" }}>
                      Joined {entry.signedUpAt ? new Date(entry.signedUpAt).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }) : "Unknown"}
                    </p>
                  </div>

                  <button onClick={e => { e.stopPropagation(); removeEntry(entry.id); }} style={{ background: "none", border: "none", color: "#dc2626", fontSize: "16px", cursor: "pointer", padding: "4px", flexShrink: 0 }}>✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}