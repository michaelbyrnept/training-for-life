import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Link, useNavigate } from "react-router-dom";

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function AdminGroups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadGroups(); }, []);

  async function loadGroups() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "groups"));
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Enrich each group with member names
      const enriched = await Promise.all(raw.map(async (group) => {
        const memberIds = group.memberIds || [];
        const members = await Promise.all(
          memberIds.slice(0, 3).map(async uid => {
            const uSnap = await getDoc(doc(db, "users", uid));
            if (!uSnap.exists()) return null;
            const u = uSnap.data();
            return u.nickname || u.firstName || u.email?.split("@")[0] || "Unknown";
          })
        );
        return { ...group, memberNames: members.filter(Boolean) };
      }));

      setGroups(enriched);
    } finally {
      setLoading(false);
    }
  }

  async function createGroup() {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, "groups"), {
        name: createName.trim(),
        memberIds: [],
        credits: 0,
        createdAt: new Date().toISOString(),
      });
      setShowCreate(false);
      setCreateName("");
      navigate(`/admin/groups/${ref.id}`);
    } catch (e) {
      console.error(e);
    }
    setCreating(false);
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 24px" }}>
        <Link to="/admin/clients" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>Clients</Link>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "8px 0 4px" }}>Groups</h1>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>{groups.length} group{groups.length !== 1 ? "s" : ""}</p>
          <button
            onClick={() => setShowCreate(true)}
            style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "20px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
          >
            + Create Group
          </button>
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>Loading groups...</p>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5" }}>
            <p style={{ fontSize: "40px", margin: "0 0 12px" }}>👥</p>
            <p style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: "0 0 8px" }}>No groups yet</p>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>Create a group to run shared sessions and track credits together</p>
            <button
              onClick={() => setShowCreate(true)}
              style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "12px 24px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
            >
              + Create Group
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {groups.map(group => (
              <Link
                key={group.id}
                to={`/admin/groups/${group.id}`}
                style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "16px", textDecoration: "none", display: "block" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ width: 48, height: 48, borderRadius: "14px", backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
                    👥
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>{group.name}</p>
                    <p style={{ fontSize: "12px", color: "#888", margin: "0 0 6px" }}>
                      {(group.memberIds || []).length} member{(group.memberIds || []).length !== 1 ? "s" : ""}
                      {group.memberNames?.length > 0 && ` — ${group.memberNames.join(", ")}${(group.memberIds || []).length > 3 ? " ..." : ""}`}
                    </p>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: (group.credits || 0) <= 2 ? "#dc2626" : "#2d6a4f", backgroundColor: (group.credits || 0) <= 2 ? "#fee2e2" : "#eaf5ef", padding: "2px 10px", borderRadius: "10px" }}>
                        {group.credits || 0} credit{(group.credits || 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: "18px", color: "#ccc" }}>›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* CREATE GROUP SHEET */}
      {showCreate && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
        >
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Create Group</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>Give the group a name. You can add members from the group profile.</p>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Group Name</label>
            <input
              autoFocus
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createGroup()}
              placeholder="e.g. Monday Crew"
              style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box", marginBottom: "20px" }}
            />
            <button
              onClick={createGroup}
              disabled={creating || !createName.trim()}
              style={{ width: "100%", backgroundColor: creating || !createName.trim() ? "#e5e5e5" : "#2d6a4f", color: creating || !createName.trim() ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}
            >
              {creating ? "Creating..." : "Create Group"}
            </button>
            <button onClick={() => setShowCreate(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
