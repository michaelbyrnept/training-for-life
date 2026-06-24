import { useState, useEffect } from "react";
import {
  doc, getDoc, getDocs, updateDoc, addDoc, collection,
  query, where, orderBy, Timestamp
} from "firebase/firestore";
import { db } from "../../firebase";
import { useParams, useNavigate, Link } from "react-router-dom";

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function timeAgo(dateVal) {
  if (!dateVal) return "";
  const date = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function AdminGroupProfile() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add member
  const [showAddMember, setShowAddMember] = useState(false);
  const [allClients, setAllClients] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");

  // Add credits
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [creditsToAdd, setCreditsToAdd] = useState("");
  const [savingCredits, setSavingCredits] = useState(false);

  useEffect(() => { loadAll(); }, [groupId]);

  async function loadAll() {
    setLoading(true);
    try {
      const groupSnap = await getDoc(doc(db, "groups", groupId));
      if (!groupSnap.exists()) { navigate("/admin/groups"); return; }
      const groupData = { id: groupSnap.id, ...groupSnap.data() };
      setGroup(groupData);

      // Load members
      const memberIds = groupData.memberIds || [];
      const memberDocs = await Promise.all(
        memberIds.map(uid => getDoc(doc(db, "users", uid)))
      );
      setMembers(memberDocs.filter(d => d.exists()).map(d => ({ uid: d.id, ...d.data() })));

      // Load all clients for add-member picker
      const usersSnap = await getDocs(collection(db, "users"));
      setAllClients(usersSnap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== "wKbgHNtTMtS01BQ4ddfAwTQaIgA3"));

      // Load group sessions
      const sessSnap = await getDocs(
        query(collection(db, "sessions"), where("groupId", "==", groupId), orderBy("date", "desc"))
      );
      setSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function addMember(uid) {
    const current = group.memberIds || [];
    if (current.includes(uid)) return;
    const updated = [...current, uid];
    await updateDoc(doc(db, "groups", groupId), { memberIds: updated });
    setGroup(g => ({ ...g, memberIds: updated }));
    const uSnap = await getDoc(doc(db, "users", uid));
    if (uSnap.exists()) setMembers(m => [...m, { uid, ...uSnap.data() }]);
    setShowAddMember(false);
    setMemberSearch("");
  }

  async function removeMember(uid) {
    const updated = (group.memberIds || []).filter(id => id !== uid);
    await updateDoc(doc(db, "groups", groupId), { memberIds: updated });
    setGroup(g => ({ ...g, memberIds: updated }));
    setMembers(m => m.filter(c => c.uid !== uid));
  }

  async function addCredits() {
    const amount = parseInt(creditsToAdd);
    if (!amount || amount <= 0) return;
    setSavingCredits(true);
    try {
      const newBalance = (group.credits || 0) + amount;
      await updateDoc(doc(db, "groups", groupId), { credits: newBalance });
      // Log the transaction
      await addDoc(collection(db, "groupWalletTransactions"), {
        groupId,
        amount,
        type: "topup",
        createdAt: new Date().toISOString(),
        note: `Added ${amount} credit${amount !== 1 ? "s" : ""}`,
      });
      setGroup(g => ({ ...g, credits: newBalance }));
      setShowAddCredits(false);
      setCreditsToAdd("");
    } catch (e) {
      console.error(e);
    }
    setSavingCredits(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#888" }}>Loading group...</p>
      </div>
    );
  }

  if (!group) return null;

  const filteredClients = allClients.filter(c => {
    if ((group.memberIds || []).includes(c.uid)) return false;
    const name = `${c.firstName || ""} ${c.nickname || ""} ${c.email || ""}`.toLowerCase();
    return name.includes(memberSearch.toLowerCase());
  });

  const upcomingSessions = sessions.filter(s => {
    const d = s.date?.toDate ? s.date.toDate() : s.date ? new Date(s.date) : null;
    return d && d >= new Date() && s.status === "scheduled";
  });
  const pastSessions = sessions.filter(s => {
    const d = s.date?.toDate ? s.date.toDate() : s.date ? new Date(s.date) : null;
    return !d || d < new Date() || s.status === "completed";
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "60px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 28px" }}>
        <Link to="/admin/groups" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>Groups</Link>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "8px 0 4px" }}>{group.name}</h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>{(group.memberIds || []).length} member{(group.memberIds || []).length !== 1 ? "s" : ""}</p>
      </div>

      {/* CREDIT CARD */}
      <div style={{ margin: "16px 16px 0" }}>
        <div style={{ backgroundColor: "#2d6a4f", borderRadius: "18px", padding: "20px", color: "#fff" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "#9fe1cb", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Group Credits</p>
          <p style={{ fontSize: "40px", fontWeight: 800, margin: "0 0 16px", color: (group.credits || 0) <= 2 ? "#fca5a5" : "#fff" }}>
            {group.credits || 0}
          </p>
          <button
            onClick={() => setShowAddCredits(true)}
            style={{ backgroundColor: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "10px", padding: "10px 18px", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
          >
            + Add Credits
          </button>
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* MEMBERS */}
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid #f0f0f0" }}>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>Members</p>
            <button
              onClick={() => setShowAddMember(true)}
              style={{ backgroundColor: "#eaf5ef", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer" }}
            >
              + Add
            </button>
          </div>
          {members.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>No members yet. Add clients to get started.</p>
            </div>
          ) : (
            members.map((member, i) => {
              const displayName = member.nickname || member.firstName || member.email?.split("@")[0] || "Unknown";
              return (
                <div key={member.uid} style={{ padding: "12px 16px", borderBottom: i < members.length - 1 ? "0.5px solid #f0f0f0" : "none", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "#2d6a4f", flexShrink: 0 }}>
                    {getInitials(displayName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{displayName}</p>
                    <p style={{ fontSize: "11px", color: "#aaa", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.email}</p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Link
                      to={`/admin/clients/${member.uid}`}
                      style={{ padding: "6px 10px", borderRadius: "8px", backgroundColor: "#f7f5f2", fontSize: "11px", fontWeight: 700, color: "#555", textDecoration: "none" }}
                    >
                      Profile
                    </Link>
                    <button
                      onClick={() => removeMember(member.uid)}
                      style={{ padding: "6px 10px", borderRadius: "8px", backgroundColor: "#fff1f1", border: "none", fontSize: "11px", fontWeight: 700, color: "#dc2626", cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* START SESSION BUTTON */}
        {members.length >= 2 && (
          <Link
            to={`/admin/groups/${groupId}/session`}
            style={{ display: "block", backgroundColor: "#2d6a4f", color: "#fff", textAlign: "center", textDecoration: "none", borderRadius: "14px", padding: "16px", fontSize: "15px", fontWeight: 700 }}
          >
            Start Group Session
          </Link>
        )}

        {/* UPCOMING SESSIONS */}
        {upcomingSessions.length > 0 && (
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #f0f0f0" }}>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>Upcoming</p>
            </div>
            {upcomingSessions.map((s, i) => {
              const d = s.date?.toDate ? s.date.toDate() : new Date(s.date);
              return (
                <div key={s.id} style={{ padding: "12px 16px", borderBottom: i < upcomingSessions.length - 1 ? "0.5px solid #f0f0f0" : "none", display: "flex", gap: "12px", alignItems: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#e0f2fe", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#0369a1", margin: 0 }}>{d.toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{s.type || "Session"}</p>
                    <p style={{ fontSize: "11px", color: "#888", margin: 0 }}>{d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })} — {s.durationMins || 60} min</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PAST SESSIONS */}
        {pastSessions.length > 0 && (
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #f0f0f0" }}>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>Session History</p>
            </div>
            {pastSessions.slice(0, 10).map((s, i) => {
              const d = s.date?.toDate ? s.date.toDate() : s.date ? new Date(s.date) : null;
              return (
                <div key={s.id} style={{ padding: "12px 16px", borderBottom: i < Math.min(pastSessions.length, 10) - 1 ? "0.5px solid #f0f0f0" : "none", display: "flex", gap: "12px", alignItems: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "#f0f0f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#888", margin: 0 }}>{d ? d.toLocaleDateString("en-IE", { day: "numeric", month: "short" }) : "?"}</p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{s.type || "Session"}</p>
                    <p style={{ fontSize: "11px", color: "#888", margin: 0 }}>{d ? timeAgo(d) : ""} — {s.durationMins || 60} min</p>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: s.status === "completed" ? "#2d6a4f" : "#888", backgroundColor: s.status === "completed" ? "#eaf5ef" : "#f0f0f0", padding: "2px 8px", borderRadius: "8px" }}>
                    {s.status === "completed" ? "Done" : s.status || "scheduled"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD MEMBER SHEET */}
      {showAddMember && (
        <div onClick={e => { if (e.target === e.currentTarget) { setShowAddMember(false); setMemberSearch(""); }}} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 14px" }}>Add Member</h2>
            <input
              autoFocus
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder="Search clients..."
              style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box", marginBottom: "12px" }}
            />
            <div style={{ overflowY: "auto", flex: 1 }}>
              {filteredClients.slice(0, 20).map(client => {
                const displayName = client.nickname || client.firstName || client.email?.split("@")[0] || "Unknown";
                return (
                  <div
                    key={client.uid}
                    onClick={() => addMember(client.uid)}
                    style={{ padding: "12px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", marginBottom: "4px" }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f7f5f2"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: "50%", backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "#2d6a4f", flexShrink: 0 }}>
                      {getInitials(displayName)}
                    </div>
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{displayName}</p>
                      <p style={{ fontSize: "11px", color: "#aaa", margin: 0 }}>{client.email}</p>
                    </div>
                  </div>
                );
              })}
              {filteredClients.length === 0 && (
                <p style={{ textAlign: "center", color: "#888", fontSize: "13px", padding: "20px" }}>No clients found</p>
              )}
            </div>
            <button onClick={() => { setShowAddMember(false); setMemberSearch(""); }} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "12px", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ADD CREDITS SHEET */}
      {showAddCredits && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowAddCredits(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Add Credits</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>Current balance: {group.credits || 0} credit{(group.credits || 0) !== 1 ? "s" : ""}</p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              {[4, 8, 10, 12, 16, 20].map(n => (
                <button
                  key={n}
                  onClick={() => setCreditsToAdd(String(n))}
                  style={{ padding: "10px 16px", borderRadius: "10px", border: creditsToAdd === String(n) ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: creditsToAdd === String(n) ? "#eaf5ef" : "#fff", fontSize: "14px", fontWeight: 700, color: creditsToAdd === String(n) ? "#2d6a4f" : "#555", cursor: "pointer" }}
                >
                  +{n}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={creditsToAdd}
              onChange={e => setCreditsToAdd(e.target.value)}
              placeholder="Or enter custom amount"
              min="1"
              style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box", marginBottom: "20px" }}
            />
            <button
              onClick={addCredits}
              disabled={savingCredits || !creditsToAdd || parseInt(creditsToAdd) <= 0}
              style={{ width: "100%", backgroundColor: savingCredits || !creditsToAdd ? "#e5e5e5" : "#2d6a4f", color: savingCredits || !creditsToAdd ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}
            >
              {savingCredits ? "Saving..." : `Add ${creditsToAdd || "0"} Credit${parseInt(creditsToAdd) !== 1 ? "s" : ""}`}
            </button>
            <button onClick={() => setShowAddCredits(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
