import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Link, useNavigate } from "react-router-dom";

const today = new Date().toISOString().split("T")[0];

function getTotals(meals) {
  if (!meals) return { calories: 0, protein: 0 };
  const all = Object.values(meals).flat();
  return {
    calories: all.reduce((s, f) => s + (f.calories || 0), 0),
    protein: Math.round(all.reduce((s, f) => s + (f.protein || 0), 0) * 10) / 10,
  };
}

export default function AdminNutrition() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const usersSnap = await getDocs(collection(db, "users"));
    const allUsers = usersSnap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.displayName || u.email)
      .sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));

    const logsSnap = await getDocs(collection(db, "nutritionLogs"));
    const logsMap = {};
    logsSnap.docs.forEach(d => {
      const data = d.data();
      if (data.date === today) logsMap[data.userId] = data;
    });

    setClients(allUsers.map(u => ({
      ...u,
      todayLog: logsMap[u.uid] || null,
    })));
    setLoading(false);
  };

  const logged = clients.filter(c => c.todayLog);
  const notLogged = clients.filter(c => !c.todayLog);

  const getStatus = (client) => {
    if (!client.todayLog) return "none";
    const { calories } = getTotals(client.todayLog.meals);
    const target = client.nutritionTargets?.calories;
    if (!target) return "logged";
    const ratio = calories / target;
    if (ratio >= 0.85 && ratio <= 1.15) return "on";
    if (ratio < 0.85) return "under";
    return "over";
  };

  const STATUS = {
    none:   { label: "Not logged", color: "#888",   bg: "#f0f0f0" },
    logged: { label: "Logged",     color: "#2d6a4f", bg: "#eaf5ef" },
    on:     { label: "On target",  color: "#166534", bg: "#dcfce7" },
    under:  { label: "Under",      color: "#0369a1", bg: "#e0f2fe" },
    over:   { label: "Over",       color: "#b45309", bg: "#fef3c7" },
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 24px" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>← Admin</Link>
      </div>
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
    </div>
  );

  const ClientRow = ({ client }) => {
    const status = getStatus(client);
    const s = STATUS[status];
    const { calories, protein } = client.todayLog ? getTotals(client.todayLog.meals) : { calories: 0, protein: 0 };
    const target = client.nutritionTargets?.calories;
    const initials = (client.displayName || client.email || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

    return (
      <div
        onClick={() => navigate(`/admin/nutrition/${client.uid}`)}
        style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}
      >
        <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#1a3a2a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "#9fe1cb", fontSize: "13px", fontWeight: 700 }}>{initials}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {client.displayName || client.email}
          </p>
          {client.todayLog ? (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f" }}>{calories} kcal</span>
              {target && <span style={{ fontSize: "11px", color: "#aaa" }}>/ {target} target</span>}
              <span style={{ fontSize: "11px", color: "#3b82f6" }}>P: {protein}g</span>
            </div>
          ) : (
            <p style={{ fontSize: "12px", color: "#aaa", margin: 0 }}>Nothing logged today</p>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: s.color, backgroundColor: s.bg, padding: "3px 8px", borderRadius: "8px" }}>
            {s.label}
          </span>
          {target && client.todayLog && (
            <div style={{ width: 60, height: 4, backgroundColor: "#f0f0f0", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, Math.round(getTotals(client.todayLog.meals).calories / target * 100))}%`, height: "100%", backgroundColor: "#2d6a4f", borderRadius: 2 }} />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 28px" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>← Admin</Link>
        <div style={{ marginTop: "14px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: 0 }}>Nutrition</h1>
          <p style={{ fontSize: "13px", color: "#9fe1cb", margin: "4px 0 0" }}>
            {today} · {logged.length} of {clients.length} logged today
          </p>
        </div>

        {/* Summary bar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "16px" }}>
          {[
            { label: "Logged", value: logged.length, color: "#4ade80" },
            { label: "Not logged", value: notLogged.length, color: "#f87171" },
            { label: "On target", value: clients.filter(c => getStatus(c) === "on").length, color: "#fbbf24" },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
              <p style={{ fontSize: "22px", fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", margin: "2px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {logged.length > 0 && (
          <>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px" }}>Logged today</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
              {logged.map(c => <ClientRow key={c.uid} client={c} />)}
            </div>
          </>
        )}

        {notLogged.length > 0 && (
          <>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px" }}>Not logged</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {notLogged.map(c => <ClientRow key={c.uid} client={c} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
