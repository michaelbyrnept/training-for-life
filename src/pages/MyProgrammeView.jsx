import { useState, useEffect } from "react";
import { doc, getDoc, onSnapshot, updateDoc, arrayRemove, arrayUnion } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import { db, auth } from "../firebase";
import PortalNav from "../components/PortalNav";

const DAYS = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
];

function totalSessions(prog) {
  return (prog.weeks || 1) * DAYS.filter((d) => prog.weekTemplate?.[d.key]).length;
}

export default function MyProgrammeView() {
  const navigate = useNavigate();
  const { programmeId } = useParams();
  const [searchParams] = useSearchParams();

  const [user, setUser] = useState(null);
  const [programme, setProgramme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeWeek, setActiveWeek] = useState(1);
  const [togglingActive, setTogglingActive] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "userProgrammes", programmeId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) { navigate("/my-programmes"); return; }
      const data = { id: snap.id, ...snap.data() };
      setProgramme(data);
      setActiveWeek(data.currentWeek || 1);
      setLoading(false);
    });
    return () => unsub();
  }, [user, programmeId]);

  const toggleActive = async () => {
    if (!programme || togglingActive) return;
    setTogglingActive(true);
    const ref = doc(db, "users", user.uid, "userProgrammes", programmeId);
    try {
      await updateDoc(ref, {
        isActive: !programme.isActive,
        startedAt: !programme.isActive ? new Date() : programme.startedAt,
      });
    } catch (e) { console.error(e); }
    setTogglingActive(false);
  };

  const isSessionDone = (week, dayKey) => {
    return (programme?.completedSessions || []).some(
      (s) => s.week === week && s.day === dayKey
    );
  };

  const scheduledDays = DAYS.filter((d) => programme?.weekTemplate?.[d.key]);
  const completedCount = (programme?.completedSessions || []).length;
  const total = programme ? totalSessions(programme) : 0;
  const pct = total > 0 ? Math.min(100, Math.round((completedCount / total) * 100)) : 0;

  if (loading || !programme) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#1a3a2a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9fe1cb" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "52px 20px 28px" }}>
        <button onClick={() => navigate("/my-programmes")} style={{ background: "none", border: "none", color: "#9fe1cb", fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 12 }}>
          ← My Programmes
        </button>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>{programme.name}</h1>
            <p style={{ fontSize: 13, color: "#9fe1cb", margin: 0 }}>
              {programme.weeks} week{programme.weeks !== 1 ? "s" : ""} &middot; {scheduledDays.length} sessions/week
            </p>
          </div>
          <Link
            to={`/my-programmes/${programmeId}/edit`}
            style={{ color: "#9fe1cb", fontSize: 13, fontWeight: 600, textDecoration: "none", flexShrink: 0, marginLeft: 12, marginTop: 4 }}
          >
            Edit
          </Link>
        </div>

        {/* Progress */}
        <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#9fe1cb", fontWeight: 600 }}>Overall progress</span>
            <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>{completedCount}/{total} sessions</span>
          </div>
          <div style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 6, height: 6 }}>
            <div style={{ backgroundColor: "#9fe1cb", borderRadius: 6, height: "100%", width: `${pct}%`, transition: "width 0.3s" }} />
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {/* Active toggle */}
        <div style={{ backgroundColor: "#fff", borderRadius: 14, padding: "14px 18px", marginBottom: 16, border: "0.5px solid #e5e5e5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#111", margin: "0 0 2px" }}>
              {programme.isActive ? "Currently active" : "Not active"}
            </p>
            <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
              {programme.isActive ? "This is your active training plan." : "Set as active to track this programme."}
            </p>
          </div>
          <button
            onClick={toggleActive}
            disabled={togglingActive}
            style={{
              backgroundColor: programme.isActive ? "#eaf5ef" : "#1a3a2a",
              color: programme.isActive ? "#2d6a4f" : "#fff",
              border: "none",
              borderRadius: 10,
              padding: "8px 14px",
              fontWeight: 700,
              fontSize: 13,
              cursor: togglingActive ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {programme.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>

        {/* Week selector */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button
            onClick={() => setActiveWeek((w) => Math.max(1, w - 1))}
            disabled={activeWeek <= 1}
            style={{ background: "none", border: "none", fontSize: 20, color: activeWeek <= 1 ? "#ccc" : "#1a3a2a", cursor: activeWeek <= 1 ? "default" : "pointer", padding: "4px 8px" }}
          >
            ‹
          </button>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#111", margin: 0 }}>Week {activeWeek}</p>
            <p style={{ fontSize: 12, color: "#888", margin: 0 }}>of {programme.weeks}</p>
          </div>
          <button
            onClick={() => setActiveWeek((w) => Math.min(programme.weeks, w + 1))}
            disabled={activeWeek >= programme.weeks}
            style={{ background: "none", border: "none", fontSize: 20, color: activeWeek >= programme.weeks ? "#ccc" : "#1a3a2a", cursor: activeWeek >= programme.weeks ? "default" : "pointer", padding: "4px 8px" }}
          >
            ›
          </button>
        </div>

        {/* Day cards */}
        {scheduledDays.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p style={{ color: "#888", fontSize: 14 }}>No workouts assigned yet.</p>
            <Link to={`/my-programmes/${programmeId}/edit`} style={{ color: "#2d6a4f", fontWeight: 700, fontSize: 14 }}>
              Edit programme
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {DAYS.map((day) => {
              const assigned = programme.weekTemplate?.[day.key];
              if (!assigned) return null;
              const done = isSessionDone(activeWeek, day.key);
              return (
                <div
                  key={day.key}
                  onClick={() => {
                    if (done) return;
                    navigate(`/my-workouts/${assigned.workoutId}?programmeId=${programmeId}&week=${activeWeek}&day=${day.key}`);
                  }}
                  style={{
                    backgroundColor: done ? "#eaf5ef" : "#fff",
                    borderRadius: 14,
                    padding: "16px 18px",
                    border: done ? "1.5px solid #2d6a4f" : "0.5px solid #e5e5e5",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    cursor: done ? "default" : "pointer",
                  }}
                >
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    backgroundColor: done ? "#2d6a4f" : "#f7f5f2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {done ? (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M4 10l5 5 7-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#888" }}>{day.short.toUpperCase()}</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: done ? "#2d6a4f" : "#111", margin: "0 0 2px" }}>
                      {assigned.workoutName}
                    </p>
                    <p style={{ fontSize: 12, color: done ? "#5a9e7a" : "#888", margin: 0 }}>
                      {day.label} {done ? "· Done" : ""}
                    </p>
                  </div>
                  {!done && (
                    <span style={{ fontSize: 20, color: "#bbb" }}>›</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Rest days */}
        {DAYS.filter((d) => !programme.weekTemplate?.[d.key]).length > 0 && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Rest days</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DAYS.filter((d) => !programme.weekTemplate?.[d.key]).map((d) => (
                <span key={d.key} style={{ fontSize: 13, color: "#aaa", backgroundColor: "#f0f0f0", padding: "6px 12px", borderRadius: 20 }}>
                  {d.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <PortalNav active="training" />
    </div>
  );
}
