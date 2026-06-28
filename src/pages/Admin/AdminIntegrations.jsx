import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../../firebase";

const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";
const WEBHOOK_URL = "https://us-central1-trainingforlife-1422f.cloudfunctions.net/stravaWebhook";

export default function AdminIntegrations() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stravaUsers, setStravaUsers] = useState([]);
  const [webhookStatus, setWebhookStatus] = useState(null); // null | "registering" | { id } | "error"
  const [webhookError, setWebhookError] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u || u.uid !== ADMIN_UID) { navigate("/admin"); return; }

      // Load connected Strava users
      const athletesSnap = await getDocs(collection(db, "stravaAthletes"));
      setStravaUsers(athletesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Load recent Strava-sourced workout logs
      const logsSnap = await getDocs(collection(db, "workoutLogs"));
      const stravaLogs = logsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(l => l.source === "strava")
        .sort((a, b) => {
          const aT = a.completedAt?.seconds ?? 0;
          const bT = b.completedAt?.seconds ?? 0;
          return bT - aT;
        })
        .slice(0, 20);
      setRecentLogs(stravaLogs);

      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function registerWebhook() {
    setWebhookStatus("registering");
    setWebhookError(null);
    try {
      const fn = httpsCallable(functions, "stravaRegisterWebhook");
      const result = await fn({ callbackUrl: WEBHOOK_URL });
      setWebhookStatus(result.data);
    } catch (err) {
      setWebhookError(err.message || "Registration failed.");
      setWebhookStatus("error");
    }
  }

  function formatDate(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleDateString("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  if (loading) return <div style={{ padding: "2rem", color: "#fff", background: "#0f0f0f", minHeight: "100vh" }}>Loading...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", color: "#fff", fontFamily: "sans-serif", padding: "1.5rem" }}>
      <Link to="/admin" style={{ color: "#9ca3af", fontSize: "0.875rem", textDecoration: "none" }}>← Admin</Link>

      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "1rem 0 0.25rem" }}>Integrations</h1>
      <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "2rem" }}>Manage third-party connections and webhooks.</p>

      {/* Strava Overview */}
      <div style={{ background: "#1a1a1a", borderRadius: "12px", padding: "1.25rem", marginBottom: "1.5rem", border: "1px solid #FC4C02" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/cb/Strava_Logo.svg" alt="Strava" style={{ height: "22px" }} />
          <span style={{ fontWeight: 700 }}>Strava</span>
          <span style={{ fontSize: "0.75rem", background: "rgba(252,76,2,0.15)", color: "#FC4C02", padding: "0.2rem 0.6rem", borderRadius: "999px", fontWeight: 700 }}>
            {stravaUsers.length} connected
          </span>
        </div>

        {/* Connected users */}
        {stravaUsers.length > 0 && (
          <div style={{ marginBottom: "1.25rem" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Connected Athletes</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {stravaUsers.map(u => (
                <span key={u.id} style={{ fontSize: "0.8rem", background: "#2a2a2a", padding: "0.3rem 0.75rem", borderRadius: "999px", color: "#d1d5db" }}>
                  {u.athleteName || u.id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Webhook registration */}
        <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: "1.25rem" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Webhook</p>
          <p style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: "1rem", lineHeight: 1.5 }}>
            Register TFL's webhook with Strava so connected users' activities automatically count toward their weekly target. Only needs to be done once.
          </p>

          {webhookStatus && webhookStatus !== "registering" && webhookStatus !== "error" && (
            <div style={{ background: "#16a34a22", border: "1px solid #16a34a", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.8rem" }}>
              Webhook registered. Subscription ID: <strong>{webhookStatus.id}</strong>
            </div>
          )}
          {webhookStatus === "error" && (
            <div style={{ background: "#dc262622", border: "1px solid #dc2626", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.8rem", color: "#f87171" }}>
              {webhookError}
            </div>
          )}

          <button
            onClick={registerWebhook}
            disabled={webhookStatus === "registering"}
            style={{
              padding: "0.6rem 1.25rem",
              background: "#FC4C02",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.875rem",
              cursor: webhookStatus === "registering" ? "not-allowed" : "pointer",
              opacity: webhookStatus === "registering" ? 0.7 : 1,
            }}
          >
            {webhookStatus === "registering" ? "Registering..." : "Register Strava Webhook"}
          </button>

          <p style={{ fontSize: "0.7rem", color: "#4b5563", marginTop: "0.5rem" }}>
            Callback URL: {WEBHOOK_URL}
          </p>
        </div>
      </div>

      {/* Recent Strava-sourced logs */}
      {recentLogs.length > 0 && (
        <div style={{ background: "#1a1a1a", borderRadius: "12px", padding: "1.25rem", border: "1px solid #2a2a2a" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
            Recent Auto-Logged Activities
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {recentLogs.map(log => (
              <div key={log.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 0.75rem", background: "#111", borderRadius: "8px" }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{log.workoutName}</span>
                  <span style={{ color: "#6b7280", fontSize: "0.75rem", marginLeft: "0.5rem" }}>{log.stravaActivityType}</span>
                  {log.notes && <span style={{ color: "#4b5563", fontSize: "0.75rem", marginLeft: "0.5rem" }}>{log.notes}</span>}
                </div>
                <span style={{ color: "#6b7280", fontSize: "0.75rem", whiteSpace: "nowrap" }}>{formatDate(log.completedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
