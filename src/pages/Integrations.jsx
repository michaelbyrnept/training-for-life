import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebase";
import PortalNav from "../components/PortalNav";

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/strava/callback`;

function buildStravaAuthUrl() {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read_all,activity:write",
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

function formatDistance(meters) {
  if (!meters) return null;
  const km = meters / 1000;
  return km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(seconds) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function activityIcon(type) {
  const icons = {
    Run: "🏃",
    Ride: "🚴",
    Swim: "🏊",
    Walk: "🚶",
    Hike: "🥾",
    WeightTraining: "🏋️",
    Workout: "💪",
    Yoga: "🧘",
    Crossfit: "🔥",
    Rowing: "🚣",
  };
  return icons[type] || "⚡";
}

export default function Integrations() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [stravaInteg, setStravaInteg] = useState(undefined); // undefined=loading, null=not connected
  const [activities, setActivities] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [toast, setToast] = useState(null);
  const [syncError, setSyncError] = useState(null);

  // Show toast from redirect params
  useEffect(() => {
    const s = searchParams.get("strava");
    if (s === "connected") showToast("Strava connected!", "success");
    if (s === "denied") showToast("Strava connection cancelled.", "info");
    if (s === "error") showToast("Strava connection failed. Please try again.", "error");
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Listen to Strava integration doc in real time
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "integrations", "strava");
    const unsub = onSnapshot(ref, (snap) => {
      setStravaInteg(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [user]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleStravaSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const fn = httpsCallable(functions, "stravaSync");
      const result = await fn({});
      setActivities(result.data.activities || []);
      showToast(`Synced ${result.data.count} activities from Strava.`, "success");
    } catch (err) {
      console.error(err);
      setSyncError(err.message || "Sync failed.");
      showToast("Sync failed. Please try again.", "error");
    } finally {
      setSyncing(false);
    }
  }

  async function handleStravaDisconnect() {
    if (!window.confirm("Disconnect Strava? Your synced activity data will be removed.")) return;
    setDisconnecting(true);
    try {
      const fn = httpsCallable(functions, "stravaDisconnect");
      await fn({});
      setActivities([]);
      showToast("Strava disconnected.", "info");
    } catch (err) {
      console.error(err);
      showToast("Failed to disconnect. Try again.", "error");
    } finally {
      setDisconnecting(false);
    }
  }

  const isStravaConnected = stravaInteg !== null && stravaInteg !== undefined;
  const stravaLoading = stravaInteg === undefined;

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", color: "#fff", fontFamily: "sans-serif" }}>
      <PortalNav />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          zIndex: 1000,
          padding: "0.75rem 1.25rem",
          borderRadius: "10px",
          fontWeight: 600,
          fontSize: "0.9rem",
          background: toast.type === "success" ? "#16a34a" : toast.type === "error" ? "#dc2626" : "#374151",
          color: "#fff",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "2rem 1rem 4rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>Integrations</h1>
        <p style={{ color: "#9ca3af", marginBottom: "2rem", fontSize: "0.95rem" }}>
          Connect your training apps so your data flows automatically.
        </p>

        {/* Strava Card */}
        <div style={{
          background: "#1a1a1a",
          borderRadius: "14px",
          padding: "1.5rem",
          border: isStravaConnected ? "1px solid #FC4C02" : "1px solid #2a2a2a",
          marginBottom: "1.5rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/c/cb/Strava_Logo.svg"
              alt="Strava"
              style={{ height: "28px", filter: "brightness(1)" }}
            />
            {isStravaConnected && (
              <span style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#FC4C02",
                background: "rgba(252,76,2,0.12)",
                padding: "0.2rem 0.6rem",
                borderRadius: "999px",
              }}>
                CONNECTED
              </span>
            )}
          </div>

          <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginBottom: "1.25rem", lineHeight: 1.6 }}>
            Sync your runs, cycles, and other activities from Strava. Workouts you log in TFL get posted to Strava automatically.
          </p>

          {stravaLoading ? (
            <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>Loading...</div>
          ) : isStravaConnected ? (
            <>
              {stravaInteg.athleteName && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                  {stravaInteg.athletePhoto && (
                    <img
                      src={stravaInteg.athletePhoto}
                      alt={stravaInteg.athleteName}
                      style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                    />
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{stravaInteg.athleteName}</div>
                    <div style={{ color: "#6b7280", fontSize: "0.75rem" }}>Connected athlete</div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  onClick={handleStravaSync}
                  disabled={syncing}
                  style={{
                    padding: "0.6rem 1.25rem",
                    background: "#FC4C02",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    cursor: syncing ? "not-allowed" : "pointer",
                    opacity: syncing ? 0.7 : 1,
                  }}
                >
                  {syncing ? "Syncing..." : "Sync Activities"}
                </button>
                <button
                  onClick={handleStravaDisconnect}
                  disabled={disconnecting}
                  style={{
                    padding: "0.6rem 1.25rem",
                    background: "transparent",
                    color: "#6b7280",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    cursor: disconnecting ? "not-allowed" : "pointer",
                    opacity: disconnecting ? 0.7 : 1,
                  }}
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>

              {syncError && (
                <p style={{ marginTop: "0.75rem", color: "#f87171", fontSize: "0.8rem" }}>{syncError}</p>
              )}

              {/* Recent activities */}
              {activities.length > 0 && (
                <div style={{ marginTop: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#9ca3af", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Recent Activities
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {activities.slice(0, 8).map((act) => (
                      <div key={act.id} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.75rem",
                        background: "#111",
                        borderRadius: "8px",
                      }}>
                        <span style={{ fontSize: "1.25rem" }}>{activityIcon(act.sportType || act.type)}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{act.name}</div>
                          <div style={{ color: "#6b7280", fontSize: "0.75rem" }}>
                            {new Date(act.startDateLocal).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}
                            {act.distance > 0 && ` · ${formatDistance(act.distance)}`}
                            {act.movingTime > 0 && ` · ${formatDuration(act.movingTime)}`}
                            {act.averageHeartrate && ` · ${Math.round(act.averageHeartrate)} bpm`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <a
              href={buildStravaAuthUrl()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.7rem 1.5rem",
                background: "#FC4C02",
                color: "#fff",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.9rem",
                textDecoration: "none",
              }}
            >
              Connect Strava
            </a>
          )}
        </div>

        {/* Coming soon placeholder cards */}
        {[
          { name: "Apple Health", icon: "🍎", desc: "Sync HealthKit data including steps, heart rate, HRV, and sleep. Requires the TFL native app (coming soon)." },
          { name: "Google Health Connect", icon: "🤖", desc: "Sync Health Connect data on Android. Requires the TFL native app (coming soon)." },
        ].map((item) => (
          <div key={item.name} style={{
            background: "#1a1a1a",
            borderRadius: "14px",
            padding: "1.5rem",
            border: "1px solid #2a2a2a",
            marginBottom: "1rem",
            opacity: 0.6,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.5rem" }}>{item.icon}</span>
              <span style={{ fontWeight: 700 }}>{item.name}</span>
              <span style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "#6b7280",
                background: "#2a2a2a",
                padding: "0.15rem 0.5rem",
                borderRadius: "999px",
              }}>
                COMING SOON
              </span>
            </div>
            <p style={{ color: "#6b7280", fontSize: "0.875rem", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
