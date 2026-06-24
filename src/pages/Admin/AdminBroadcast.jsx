import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";

const TIER_FILTERS = [
  { id: "all",        label: "All clients" },
  { id: "in-person",  label: "In-Person" },
  { id: "online",     label: "Online" },
  { id: "hybrid",     label: "Hybrid" },
  { id: "premium",    label: "Premium" },
  { id: "free",       label: "Free" },
];

const TIERS = {
  free:          { label: "Free",      color: "#888",    bg: "#f0f0f0" },
  premium:       { label: "Premium",   color: "#b45309", bg: "#fffbeb" },
  premium_trial: { label: "Trial",     color: "#7c3aed", bg: "#f5f3ff" },
  online:        { label: "Online",    color: "#0369a1", bg: "#e0f2fe" },
  hybrid:        { label: "Hybrid",    color: "#0891b2", bg: "#ecfeff" },
  "in-person":   { label: "In-Person", color: "#2d6a4f", bg: "#eaf5ef" },
};

export default function AdminBroadcast() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [tierFilter, setTierFilter] = useState("all");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);

  useEffect(() => {
    getDocs(collection(db, "users")).then(snap => {
      const all = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(c => c.uid !== ADMIN_UID && c.email);
      setClients(all);
      setLoading(false);
    });
  }, []);

  const filtered = tierFilter === "all"
    ? clients
    : clients.filter(c => c.subscription === tierFilter);

  const emails = filtered.map(c => c.email).filter(Boolean);

  function copyEmails() {
    navigator.clipboard.writeText(emails.join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function openMailto() {
    const bcc = emails.join(",");
    const sub = encodeURIComponent(subject || "(no subject)");
    const body = encodeURIComponent(message);
    window.location.href = `mailto:?bcc=${bcc}&subject=${sub}&body=${body}`;
  }

  const filterLabel = TIER_FILTERS.find(f => f.id === tierFilter)?.label || "All clients";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "16px 20px 24px" }}>
        <button onClick={() => navigate("/admin")}
          style={{ background: "none", border: "none", color: "#9fe1cb", fontSize: "14px", cursor: "pointer", padding: 0, marginBottom: "12px" }}>
          ← Admin
        </button>
        <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: 700, margin: "0 0 4px" }}>Broadcast</h1>
        <p style={{ color: "#9fe1cb", fontSize: "13px", margin: 0 }}>Send a message to your clients</p>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#888", padding: "40px" }}>Loading...</p>
      ) : (
        <div style={{ padding: "16px" }}>

          {/* AUDIENCE */}
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#aaa", margin: "0 0 10px" }}>Audience</p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "10px", overflowX: "auto", paddingBottom: "4px" }}>
            {TIER_FILTERS.map(f => (
              <button key={f.id} onClick={() => setTierFilter(f.id)}
                style={{ background: tierFilter === f.id ? "#1a3a2a" : "#fff", color: tierFilter === f.id ? "#fff" : "#444", border: "0.5px solid #e5e5e5", borderRadius: "20px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* RECIPIENT COUNT */}
          <div onClick={() => setShowRecipients(!showRecipients)}
            style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "14px 16px", border: "0.5px solid #e5e5e5", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <div>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>
                {emails.length} {emails.length === 1 ? "recipient" : "recipients"}
              </p>
              <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>{filterLabel}</p>
            </div>
            <p style={{ fontSize: "13px", color: "#2d6a4f", margin: 0 }}>{showRecipients ? "Hide" : "Show"} list</p>
          </div>

          {/* RECIPIENT LIST */}
          {showRecipients && emails.length > 0 && (
            <div style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", marginBottom: "16px", overflow: "hidden" }}>
              {filtered.map((client, i) => {
                const tier = TIERS[client.subscription] || TIERS.free;
                return (
                  <div key={client.uid} style={{ padding: "11px 16px", borderBottom: i < filtered.length - 1 ? "0.5px solid #f0f0f0" : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "#111", margin: 0 }}>
                        {client.firstName || client.displayName || "Client"}
                      </p>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: tier.color, backgroundColor: tier.bg, padding: "2px 7px", borderRadius: "10px" }}>
                        {tier.label}
                      </div>
                    </div>
                    <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>{client.email}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* COMPOSE */}
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#aaa", margin: "0 0 10px" }}>Message</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject line"
              style={{ width: "100%", padding: "13px 14px", borderRadius: "12px", border: "0.5px solid #e5e5e5", fontSize: "15px", background: "#fff", boxSizing: "border-box", outline: "none" }}
            />
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write your message here..."
              rows={7}
              style={{ width: "100%", padding: "13px 14px", borderRadius: "12px", border: "0.5px solid #e5e5e5", fontSize: "14px", background: "#fff", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5, outline: "none" }}
            />
          </div>

          {/* SEND ACTIONS */}
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#aaa", margin: "0 0 10px" }}>Send via</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={openMailto} disabled={emails.length === 0}
              style={{ width: "100%", backgroundColor: emails.length === 0 ? "#ccc" : "#1a3a2a", color: "#fff", border: "none", borderRadius: "14px", padding: "17px", fontSize: "15px", fontWeight: 700, cursor: emails.length === 0 ? "not-allowed" : "pointer" }}>
              Open in Mail App →
            </button>
            <button onClick={copyEmails} disabled={emails.length === 0}
              style={{ width: "100%", backgroundColor: copied ? "#eaf5ef" : "#fff", color: copied ? "#2d6a4f" : "#444", border: copied ? "1.5px solid #2d6a4f" : "0.5px solid #e5e5e5", borderRadius: "14px", padding: "17px", fontSize: "15px", fontWeight: 700, cursor: emails.length === 0 ? "not-allowed" : "pointer", opacity: emails.length === 0 ? 0.5 : 1 }}>
              {copied ? "Copied to clipboard!" : "Copy email addresses"}
            </button>
          </div>

          <p style={{ fontSize: "12px", color: "#aaa", margin: "14px 0 0", textAlign: "center" }}>
            "Open in Mail App" adds all addresses as BCC automatically.
          </p>
        </div>
      )}
    </div>
  );
}
