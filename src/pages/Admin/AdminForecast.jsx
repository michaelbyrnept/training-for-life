import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";
const TARGET = 10000;

const TIERS = [
  { id: "in-person",  label: "In-Person",    color: "#2d6a4f", bg: "#eaf5ef",  defaultVal: 180 },
  { id: "hybrid",     label: "Hybrid",       color: "#0891b2", bg: "#ecfeff",  defaultVal: 220 },
  { id: "online",     label: "Online",       color: "#0369a1", bg: "#e0f2fe",  defaultVal: 80  },
  { id: "premium",    label: "Premium",      color: "#b45309", bg: "#fffbeb",  defaultVal: 40  },
  { id: "premium_trial", label: "Trial",     color: "#7c3aed", bg: "#f5f3ff",  defaultVal: 0   },
  { id: "free",       label: "Free",         color: "#888",    bg: "#f0f0f0",  defaultVal: 0   },
];

function toDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

export default function AdminForecast() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [gymSalary, setGymSalary] = useState(2214);
  const [tierValues, setTierValues] = useState(() =>
    Object.fromEntries(TIERS.map(t => [t.id, t.defaultVal]))
  );

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "sessions")),
    ]).then(([uSnap, sSnap]) => {
      setClients(uSnap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(c => c.uid !== ADMIN_UID));
      setSessions(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  // Tier counts
  const tierCounts = {};
  clients.forEach(c => {
    const sub = c.subscription || "free";
    tierCounts[sub] = (tierCounts[sub] || 0) + 1;
  });

  // MRR from subscriptions
  const subMRR = TIERS.reduce((sum, t) => sum + (tierCounts[t.id] || 0) * (tierValues[t.id] || 0), 0);
  const totalMRR = subMRR + gymSalary;
  const gap = Math.max(TARGET - totalMRR, 0);
  const pct = Math.min((totalMRR / TARGET) * 100, 100);

  // Sessions this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();

  const completedThisMonth = sessions.filter(s => {
    const d = toDate(s.date);
    return d && d >= monthStart && s.status === "completed";
  });
  const sessionRevThisMonth = completedThisMonth.reduce((s, ss) => s + (ss.sessionRevenue || 0), 0);
  const projectedSessionRev = dayOfMonth > 0
    ? Math.round((sessionRevThisMonth / dayOfMonth) * daysInMonth)
    : 0;

  function setVal(id, val) {
    setTierValues(prev => ({ ...prev, [id]: Number(val) || 0 }));
  }

  const paidTiers = TIERS.filter(t => (tierValues[t.id] || 0) > 0 && t.id !== "free" && t.id !== "premium_trial");

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "16px 20px 24px" }}>
        <button onClick={() => navigate("/admin")}
          style={{ background: "none", border: "none", color: "#9fe1cb", fontSize: "14px", cursor: "pointer", padding: 0, marginBottom: "12px" }}>
          ← Admin
        </button>
        <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: 700, margin: "0 0 4px" }}>Revenue Forecast</h1>
        <p style={{ color: "#9fe1cb", fontSize: "13px", margin: 0 }}>Projected MRR and path to {"€"}10k</p>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#888", padding: "40px" }}>Loading...</p>
      ) : (
        <div style={{ padding: "16px" }}>

          {/* HERO PROGRESS */}
          <div style={{ backgroundColor: "#1a3a2a", borderRadius: "18px", padding: "20px", marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Projected MRR</p>
                <p style={{ fontSize: "32px", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1 }}>{"€"}{totalMRR.toLocaleString()}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Target</p>
                <p style={{ fontSize: "32px", fontWeight: 700, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1 }}>{"€"}10k</p>
              </div>
            </div>
            <div style={{ height: 12, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, overflow: "hidden", marginBottom: "8px" }}>
              <div style={{ height: "100%", width: `${pct}%`, backgroundColor: pct >= 100 ? "#4ade80" : "#9fe1cb", borderRadius: 8, transition: "width 0.6s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>{pct.toFixed(0)}% of target</p>
              <p style={{ fontSize: "13px", fontWeight: 700, color: gap > 0 ? "#fcd34d" : "#4ade80", margin: 0 }}>
                {gap > 0 ? `${"€"}${gap.toLocaleString()} to go` : "Target hit!"}
              </p>
            </div>
          </div>

          {/* SESSION PROJECTION */}
          {completedThisMonth.length > 0 && (
            <div style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "14px 16px", border: "0.5px solid #e5e5e5", marginBottom: "16px" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Session revenue (this month)</p>
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1, textAlign: "center", backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "10px" }}>
                  <p style={{ fontSize: "18px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{"€"}{sessionRevThisMonth.toLocaleString()}</p>
                  <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>Earned so far</p>
                </div>
                <div style={{ flex: 1, textAlign: "center", backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "10px" }}>
                  <p style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: 0 }}>{"€"}{projectedSessionRev.toLocaleString()}</p>
                  <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>Projected full month</p>
                </div>
              </div>
            </div>
          )}

          {/* INCOME BREAKDOWN */}
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#aaa", margin: "0 0 10px" }}>Income breakdown</p>

          {/* Gym salary */}
          <div style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "14px 16px", border: "0.5px solid #e5e5e5", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>Gym salary</p>
              <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>Fixed monthly</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontSize: "15px", color: "#888" }}>{"€"}</span>
              <input
                type="number"
                value={gymSalary}
                onChange={e => setGymSalary(Number(e.target.value) || 0)}
                style={{ width: 76, padding: "7px 8px", borderRadius: "9px", border: "0.5px solid #e5e5e5", fontSize: "16px", fontWeight: 700, color: "#111", textAlign: "right", outline: "none" }}
              />
            </div>
          </div>

          {/* Subscription tiers */}
          {TIERS.map(tier => {
            const count = tierCounts[tier.id] || 0;
            if (count === 0 && tier.defaultVal === 0) return null;
            const val = tierValues[tier.id] || 0;
            const subtotal = count * val;
            return (
              <div key={tier.id} style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "14px 16px", border: "0.5px solid #e5e5e5", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: tier.color, flexShrink: 0 }} />
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{tier.label}</p>
                    <div style={{ backgroundColor: tier.bg, color: tier.color, fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px" }}>
                      {count} clients
                    </div>
                  </div>
                  <p style={{ fontSize: "16px", fontWeight: 700, color: subtotal > 0 ? "#2d6a4f" : "#ccc", margin: 0 }}>
                    {"€"}{subtotal.toLocaleString()}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontSize: "12px", color: "#aaa", margin: 0 }}>
                    {count} x {"€"}{val} = {"€"}{subtotal}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <p style={{ fontSize: "11px", color: "#aaa", margin: 0 }}>avg/mo:</p>
                    <span style={{ fontSize: "13px", color: "#aaa" }}>{"€"}</span>
                    <input
                      type="number"
                      value={val}
                      onChange={e => setVal(tier.id, e.target.value)}
                      style={{ width: 60, padding: "5px 6px", borderRadius: "7px", border: "0.5px solid #e5e5e5", fontSize: "13px", textAlign: "right", outline: "none" }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* TOTAL ROW */}
          <div style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "14px 16px", border: "0.5px solid #e5e5e5", marginBottom: "20px" }}>
            {[
              { label: "Gym salary", val: gymSalary },
              { label: "Subscriptions MRR", val: subMRR },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>{row.label}</p>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: 0 }}>{"€"}{row.val.toLocaleString()}</p>
              </div>
            ))}
            <div style={{ height: "0.5px", backgroundColor: "#f0f0f0", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>Total MRR</p>
              <p style={{ fontSize: "20px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{"€"}{totalMRR.toLocaleString()}</p>
            </div>
          </div>

          {/* HOW TO CLOSE THE GAP */}
          {gap > 0 && (
            <>
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#aaa", margin: "0 0 10px" }}>
                How to close the {"€"}{gap.toLocaleString()} gap
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                {paidTiers.map(tier => {
                  const needed = Math.ceil(gap / (tierValues[tier.id] || 1));
                  return (
                    <div key={tier.id} style={{ backgroundColor: tier.bg, borderRadius: "12px", padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: tier.color, margin: 0 }}>
                        +{needed} {tier.label} client{needed !== 1 ? "s" : ""}
                      </p>
                      <p style={{ fontSize: "12px", color: tier.color, margin: 0, opacity: 0.8 }}>
                        {"€"}{tierValues[tier.id]}/mo each
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "0.5px solid #e5e5e5", padding: "13px 16px" }}>
            <p style={{ fontSize: "12px", color: "#888", margin: 0, lineHeight: 1.5 }}>
              Edit the "avg/mo" for each tier to match your actual pricing. Changes reset on refresh, so these are working estimates, not saved data.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
