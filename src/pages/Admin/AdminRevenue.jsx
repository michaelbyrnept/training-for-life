import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";
const MONTHLY_TARGET = 10000;

function getMonthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getWeekKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

function monthLabel(key) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString("en-IE", { month: "short", year: "2-digit" });
}

function getLast6Months() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(getMonthKey(d));
  }
  return months;
}

function toDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

function StatCard({ label, value, sub, highlight, warn }) {
  return (
    <div style={{ backgroundColor: highlight ? "#1a3a2a" : "#fff", borderRadius: "16px", padding: "16px", border: highlight ? "none" : "0.5px solid #e5e5e5", flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: "11px", fontWeight: 700, color: highlight ? "#9fe1cb" : "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>{label}</p>
      <p style={{ fontSize: "24px", fontWeight: 700, color: warn ? "#f59e0b" : highlight ? "#fff" : "#111", margin: "0 0 2px", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: "12px", color: highlight ? "#9fe1cb" : "#888", margin: 0 }}>{sub}</p>}
    </div>
  );
}

function RevenueBar({ months, collectedByMonth, earnedByMonth }) {
  const max = Math.max(...months.flatMap(m => [collectedByMonth[m] || 0, earnedByMonth[m] || 0]), 1);
  const height = 100;
  const barW = 14;
  const gap = 4;
  const groupW = barW * 2 + gap;
  const groupGap = 16;
  const totalW = months.length * (groupW + groupGap) - groupGap;

  return (
    <svg viewBox={`0 0 ${totalW} ${height + 28}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      {/* Target line */}
      {MONTHLY_TARGET <= max && (
        <line x1={0} y1={height - (MONTHLY_TARGET / max) * height} x2={totalW} y2={height - (MONTHLY_TARGET / max) * height}
          stroke="#9fe1cb" strokeWidth="1.5" strokeDasharray="4 3" />
      )}
      {months.map((m, i) => {
        const collected = collectedByMonth[m] || 0;
        const earned = earnedByMonth[m] || 0;
        const x = i * (groupW + groupGap);
        const isCurrentMonth = m === getMonthKey(new Date());
        const cH = Math.max((collected / max) * height, collected > 0 ? 3 : 0);
        const eH = Math.max((earned / max) * height, earned > 0 ? 3 : 0);
        return (
          <g key={m}>
            {/* Collected bar */}
            <rect x={x} y={height - cH} width={barW} height={cH || 2} rx={4}
              fill={isCurrentMonth ? "#2d6a4f" : "#d1fae5"} />
            {/* Earned bar */}
            <rect x={x + barW + gap} y={height - eH} width={barW} height={eH || 2} rx={4}
              fill={isCurrentMonth ? "#9fe1cb" : "#e5e5e5"} />
            <text x={x + groupW / 2} y={height + 16} textAnchor="middle" fontSize="9" fill="#aaa">
              {monthLabel(m)}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      <rect x={0} y={height + 22} width={8} height={8} rx={2} fill="#2d6a4f" />
      <text x={12} y={height + 30} fontSize="9" fill="#888">Collected</text>
      <rect x={60} y={height + 22} width={8} height={8} rx={2} fill="#9fe1cb" />
      <text x={72} y={height + 30} fontSize="9" fill="#888">Earned</text>
    </svg>
  );
}

export default function AdminRevenue() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [clients, setClients] = useState([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [purchaseSnap, sessSnap, clientSnap] = await Promise.all([
        getDocs(collection(db, "bundlePurchases")),
        getDocs(collection(db, "sessions")),
        getDocs(collection(db, "users")),
      ]);
      setPurchases(purchaseSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setClients(clientSnap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(c => c.uid !== ADMIN_UID));
    } finally {
      setLoading(false);
    }
  }

  const now = new Date();
  const thisMonthKey = getMonthKey(now);
  const thisWeekKey = getWeekKey(now);
  const last6 = getLast6Months();

  // Delivered sessions (completed, no show, late cancel — all use a credit)
  const deliveredSessions = sessions.filter(s =>
    ["completed", "no_show", "late_cancelled"].includes(s.status) && s.sessionRevenue != null
  );

  // Cash collected by month (bundle purchases)
  const collectedByMonth = {};
  purchases.forEach(p => {
    const d = toDate(p.purchasedAt);
    if (!d) return;
    const key = getMonthKey(d);
    collectedByMonth[key] = (collectedByMonth[key] || 0) + (p.pricePaid || 0);
  });

  // Earned revenue by month (sessions × sessionRevenue)
  const earnedByMonth = {};
  const earnedByWeek = {};
  deliveredSessions.forEach(s => {
    const d = toDate(s.date);
    if (!d) return;
    const rev = s.sessionRevenue || 0;
    const mk = getMonthKey(d);
    const wk = getWeekKey(d);
    earnedByMonth[mk] = (earnedByMonth[mk] || 0) + rev;
    earnedByWeek[wk] = (earnedByWeek[wk] || 0) + rev;
  });

  const thisMonthCollected = collectedByMonth[thisMonthKey] || 0;
  const thisMonthEarned = earnedByMonth[thisMonthKey] || 0;
  const thisWeekEarned = earnedByWeek[thisWeekKey] || 0;

  const ytdCollected = Object.entries(collectedByMonth)
    .filter(([k]) => k.startsWith(String(now.getFullYear())))
    .reduce((s, [, v]) => s + v, 0);

  const ytdEarned = Object.entries(earnedByMonth)
    .filter(([k]) => k.startsWith(String(now.getFullYear())))
    .reduce((s, [, v]) => s + v, 0);

  const sessionsThisMonth = deliveredSessions.filter(s => {
    const d = toDate(s.date);
    return d && getMonthKey(d) === thisMonthKey;
  }).length;

  const sessionsThisWeek = deliveredSessions.filter(s => {
    const d = toDate(s.date);
    return d && getWeekKey(d) === thisWeekKey;
  }).length;

  const avgRate = deliveredSessions.length > 0
    ? Math.round(deliveredSessions.reduce((s, ss) => s + (ss.sessionRevenue || 0), 0) / deliveredSessions.length)
    : 0;

  // Active clients (session in last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const activeClientIds = new Set(
    sessions.filter(s => { const d = toDate(s.date); return d && d >= thirtyDaysAgo; }).map(s => s.clientId)
  );

  // Target progress based on earned revenue
  const targetPct = Math.min((thisMonthEarned / MONTHLY_TARGET) * 100, 100);
  const toTarget = Math.max(MONTHLY_TARGET - thisMonthEarned, 0);

  // Recent purchases
  const recentPurchases = [...purchases]
    .sort((a, b) => new Date(toDate(b.purchasedAt)) - new Date(toDate(a.purchasedAt)))
    .slice(0, 10);

  function clientName(clientId) {
    const c = clients.find(c => c.uid === clientId);
    return c?.nickname || c?.firstName || clientId?.slice(0, 8) || "Unknown";
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "16px 20px 24px" }}>
        <button onClick={() => navigate("/admin")}
          style={{ background: "none", border: "none", color: "#9fe1cb", fontSize: "14px", cursor: "pointer", padding: 0, marginBottom: "12px" }}>
          Admin
        </button>
        <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: 700, margin: "0 0 4px" }}>Revenue</h1>
        <p style={{ color: "#9fe1cb", fontSize: "13px", margin: 0 }}>
          {now.toLocaleDateString("en-IE", { month: "long", year: "numeric" })}
        </p>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#888", padding: "40px" }}>Loading...</p>
      ) : (
        <div style={{ padding: "16px" }}>

          {/* THIS MONTH */}
          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>This Month</p>
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <StatCard label="Cash Collected" value={`€${thisMonthCollected.toLocaleString()}`} sub="bundles sold" highlight />
            <StatCard label="Earned Revenue" value={`€${thisMonthEarned.toLocaleString()}`} sub="sessions delivered" highlight />
          </div>
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <StatCard label="Sessions" value={sessionsThisMonth} sub="this month" />
            <StatCard label="This Week" value={`€${thisWeekEarned.toLocaleString()}`} sub={`${sessionsThisWeek} sessions`} />
            <StatCard label="Avg Rate" value={`€${avgRate}`} sub="per session" />
          </div>

          {/* PROGRESS TO €10k */}
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "16px", border: "0.5px solid #e5e5e5", marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>Progress to €10k</p>
                <p style={{ fontSize: "11px", color: "#888", margin: 0 }}>Based on earned (sessions delivered)</p>
              </div>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{targetPct.toFixed(0)}%</p>
            </div>
            <div style={{ height: "10px", backgroundColor: "#f0f0f0", borderRadius: "8px", overflow: "hidden", marginBottom: "8px" }}>
              <div style={{ height: "100%", width: `${targetPct}%`, backgroundColor: targetPct >= 100 ? "#4ade80" : "#2d6a4f", borderRadius: "8px", transition: "width 0.6s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>€{thisMonthEarned.toLocaleString()} earned</p>
              <p style={{ fontSize: "12px", color: toTarget > 0 ? "#888" : "#2d6a4f", margin: 0 }}>
                {toTarget > 0 ? `€${toTarget.toLocaleString()} to go` : "Target hit!"}
              </p>
            </div>
          </div>

          {/* YTD */}
          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>Year to Date</p>
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <StatCard label="YTD Collected" value={`€${ytdCollected.toLocaleString()}`} sub="cash in" />
            <StatCard label="YTD Earned" value={`€${ytdEarned.toLocaleString()}`} sub="sessions × rate" />
            <StatCard label="Active Clients" value={activeClientIds.size} sub="last 30 days" />
          </div>

          {/* 6-MONTH CHART */}
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "16px", border: "0.5px solid #e5e5e5", marginBottom: "16px" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: "0 0 16px" }}>Monthly Revenue</p>
            <RevenueBar months={last6} collectedByMonth={collectedByMonth} earnedByMonth={earnedByMonth} />
          </div>

          {/* RECENT PURCHASES */}
          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>Recent Purchases</p>
          {recentPurchases.length === 0 ? (
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "32px", textAlign: "center" }}>
              <p style={{ fontSize: "28px", margin: "0 0 8px" }}>💳</p>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>No purchases yet</p>
              <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Bundle purchases will show here once recorded.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {recentPurchases.map(p => {
                const d = toDate(p.purchasedAt);
                const perSession = p.sessionCredits > 0
                  ? Math.round((p.pricePaid / p.sessionCredits) * 100) / 100
                  : null;
                return (
                  <div key={p.id} style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "14px 16px", border: "0.5px solid #e5e5e5" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{p.bundleName}</p>
                      <p style={{ fontSize: "16px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>€{(p.pricePaid || 0).toLocaleString()}</p>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
                        {clientName(p.clientId)}
                        {" "}&middot;{" "}
                        {d ? d.toLocaleDateString("en-IE", { day: "numeric", month: "short" }) : ""}
                        {" "}&middot;{" "}
                        <span style={{ textTransform: "capitalize" }}>{p.paymentMethod || "cash"}</span>
                      </p>
                      {perSession && (
                        <p style={{ fontSize: "12px", color: "#2d6a4f", fontWeight: 700, margin: 0 }}>€{perSession}/session</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
