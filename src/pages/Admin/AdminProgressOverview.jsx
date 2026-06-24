import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";

const TIERS = {
  free:          { label: "Free",      color: "#888",    bg: "#f0f0f0" },
  premium:       { label: "Premium",   color: "#b45309", bg: "#fffbeb" },
  premium_trial: { label: "Trial",     color: "#7c3aed", bg: "#f5f3ff" },
  online:        { label: "Online",    color: "#0369a1", bg: "#e0f2fe" },
  hybrid:        { label: "Hybrid",    color: "#0891b2", bg: "#ecfeff" },
  "in-person":   { label: "In-Person", color: "#2d6a4f", bg: "#eaf5ef" },
};

function toDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekTimestamp(date) {
  return getMonday(date).getTime();
}

function getInitials(client) {
  const name = client.firstName || client.displayName || client.email || "?";
  const parts = name.trim().split(" ");
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name[0].toUpperCase();
}

function timeAgo(date) {
  if (!date) return "never";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// 8 small squares showing the last 8 weeks of activity
function ActivityDots({ activeWeeks }) {
  const nowWeek = weekTimestamp(new Date());
  return (
    <div style={{ display: "flex", gap: "3px" }}>
      {Array.from({ length: 8 }, (_, i) => {
        const wk = nowWeek - (7 - i) * 7 * 86400000;
        const active = activeWeeks.has(wk);
        return (
          <div key={i} style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: active ? "#2d6a4f" : "#e5e5e5" }} />
        );
      })}
    </div>
  );
}

const FILTERS = [
  { id: "all",     label: "All" },
  { id: "active",  label: "Active" },
  { id: "quiet",   label: "Quiet" },
  { id: "checkin", label: "Check-in due" },
];

export default function AdminProgressOverview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [clientData, setClientData] = useState({});
  const [filter, setFilter] = useState("all");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [userSnap, wLogSnap, cLogSnap, checkSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "workoutLogs")),
        getDocs(collection(db, "classLogs")),
        getDocs(collection(db, "checkIns")),
      ]);

      const allClients = userSnap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(c => c.uid !== ADMIN_UID);

      const thisWeekStart = getMonday(new Date());
      const thisWeekTs = weekTimestamp(new Date());

      // Build per-client summary
      const data = {};
      allClients.forEach(c => {
        data[c.uid] = { activeWeeks: new Set(), thisWeek: 0, lastActive: null, checkInPending: false };
      });

      [...wLogSnap.docs, ...cLogSnap.docs].forEach(doc => {
        const log = doc.data();
        const uid = log.userId;
        if (!data[uid]) return;
        const d = toDate(log.completedAt);
        if (!d) return;
        data[uid].activeWeeks.add(weekTimestamp(d));
        if (d >= thisWeekStart) data[uid].thisWeek++;
        if (!data[uid].lastActive || d > data[uid].lastActive) data[uid].lastActive = d;
      });

      checkSnap.docs.forEach(doc => {
        const ci = doc.data();
        if (!data[ci.userId]) return;
        const d = toDate(ci.submittedAt);
        if (d && weekTimestamp(d) === thisWeekTs && !ci.coachReply) {
          data[ci.userId].checkInPending = true;
        }
      });

      // Sort: pending check-ins first, then by last active desc
      const sorted = allClients.sort((a, b) => {
        const da = data[a.uid], db_ = data[b.uid];
        if (da.checkInPending && !db_.checkInPending) return -1;
        if (!da.checkInPending && db_.checkInPending) return 1;
        if (!da.lastActive && !db_.lastActive) return 0;
        if (!da.lastActive) return 1;
        if (!db_.lastActive) return -1;
        return db_.lastActive.getTime() - da.lastActive.getTime();
      });

      setClients(sorted);
      setClientData(data);
    } finally {
      setLoading(false);
    }
  }

  function matchesFilter(client) {
    const d = clientData[client.uid];
    if (!d) return filter === "all";
    if (filter === "active") return d.thisWeek > 0;
    if (filter === "quiet") {
      const daysSince = d.lastActive ? Math.floor((Date.now() - d.lastActive.getTime()) / 86400000) : 999;
      return daysSince > 14;
    }
    if (filter === "checkin") return d.checkInPending;
    return true;
  }

  const visible = clients.filter(matchesFilter);
  const activeCount = clients.filter(c => (clientData[c.uid]?.thisWeek || 0) > 0).length;
  const pendingCount = clients.filter(c => clientData[c.uid]?.checkInPending).length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "16px 20px 24px" }}>
        <button onClick={() => navigate("/admin")}
          style={{ background: "none", border: "none", color: "#9fe1cb", fontSize: "14px", cursor: "pointer", padding: 0, marginBottom: "12px" }}>
          ← Admin
        </button>
        <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: 700, margin: "0 0 4px" }}>Client Progress</h1>
        <p style={{ color: "#9fe1cb", fontSize: "13px", margin: 0 }}>Activity, streaks, and check-ins at a glance</p>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#888", padding: "40px" }}>Loading...</p>
      ) : (
        <div style={{ padding: "16px" }}>

          {/* SUMMARY STATS */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <div style={{ flex: 1, backgroundColor: "#1a3a2a", borderRadius: "14px", padding: "14px", textAlign: "center" }}>
              <p style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: 0 }}>{clients.length}</p>
              <p style={{ fontSize: "10px", fontWeight: 700, color: "#9fe1cb", margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Clients</p>
            </div>
            <div style={{ flex: 1, backgroundColor: "#fff", borderRadius: "14px", padding: "14px", textAlign: "center", border: "0.5px solid #e5e5e5" }}>
              <p style={{ fontSize: "24px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{activeCount}</p>
              <p style={{ fontSize: "10px", fontWeight: 700, color: "#888", margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>This week</p>
            </div>
            <div onClick={() => pendingCount > 0 && setFilter("checkin")}
              style={{ flex: 1, backgroundColor: pendingCount > 0 ? "#fef3c7" : "#fff", borderRadius: "14px", padding: "14px", textAlign: "center", border: "0.5px solid #e5e5e5", cursor: pendingCount > 0 ? "pointer" : "default" }}>
              <p style={{ fontSize: "24px", fontWeight: 700, color: pendingCount > 0 ? "#92400e" : "#111", margin: 0 }}>{pendingCount}</p>
              <p style={{ fontSize: "10px", fontWeight: 700, color: pendingCount > 0 ? "#92400e" : "#888", margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pending</p>
            </div>
          </div>

          {/* FILTERS */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px", overflowX: "auto", paddingBottom: "2px" }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                style={{ background: filter === f.id ? "#1a3a2a" : "#fff", color: filter === f.id ? "#fff" : "#444", border: "0.5px solid #e5e5e5", borderRadius: "20px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* COLUMN HEADERS */}
          <div style={{ display: "flex", alignItems: "center", padding: "0 16px 6px", gap: "12px" }}>
            <div style={{ width: 40, flexShrink: 0 }} />
            <p style={{ flex: 1, fontSize: "10px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Client</p>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, width: 60, textAlign: "right" }}>Last active</p>
          </div>

          {/* CLIENT LIST */}
          {visible.length === 0 ? (
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "40px", textAlign: "center" }}>
              <p style={{ fontSize: "28px", margin: "0 0 8px" }}>🎉</p>
              <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>No clients in this filter</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {visible.map(client => {
                const d = clientData[client.uid] || {};
                const tier = TIERS[client.subscription] || TIERS.free;
                return (
                  <div key={client.uid}
                    onClick={() => navigate(`/admin/clients/${client.uid}`)}
                    style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "13px 14px", border: d.checkInPending ? "1.5px solid #f59e0b" : "0.5px solid #e5e5e5", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px" }}>

                    {/* Avatar */}
                    <div style={{ width: 40, height: 40, borderRadius: "12px", backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f" }}>{getInitials(client)}</span>
                    </div>

                    {/* Main info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
                        <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          {client.firstName || client.displayName || client.email}
                        </p>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: tier.color, backgroundColor: tier.bg, padding: "2px 7px", borderRadius: "10px", flexShrink: 0 }}>
                          {tier.label}
                        </div>
                        {d.checkInPending && (
                          <div style={{ fontSize: "10px", fontWeight: 700, color: "#92400e", backgroundColor: "#fef3c7", padding: "2px 7px", borderRadius: "10px", flexShrink: 0 }}>
                            Check-in
                          </div>
                        )}
                      </div>
                      <ActivityDots activeWeeks={d.activeWeeks || new Set()} />
                      <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
                        <p style={{ fontSize: "11px", margin: 0, color: d.thisWeek > 0 ? "#2d6a4f" : "#bbb", fontWeight: d.thisWeek > 0 ? 700 : 400 }}>
                          {d.thisWeek > 0 ? `${d.thisWeek} this week` : "0 this week"}
                        </p>
                      </div>
                    </div>

                    {/* Last active */}
                    <p style={{ fontSize: "11px", color: "#aaa", margin: 0, flexShrink: 0, textAlign: "right", width: 60 }}>
                      {timeAgo(d.lastActive)}
                    </p>
                    <div style={{ color: "#ddd", fontSize: "16px", flexShrink: 0 }}>›</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ACTIVITY KEY */}
          <div style={{ marginTop: "16px", backgroundColor: "#fff", borderRadius: "12px", border: "0.5px solid #e5e5e5", padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ display: "flex", gap: "3px" }}>
                {[false, false, true, false, true, true, false, true].map((a, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: a ? "#2d6a4f" : "#e5e5e5" }} />
                ))}
              </div>
              <p style={{ fontSize: "11px", color: "#888", margin: 0 }}>Each square = one week. Green = trained. Last 8 weeks, oldest left.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
