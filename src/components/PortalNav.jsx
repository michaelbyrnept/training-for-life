import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const tabs = [
  { to: "/dashboard", label: "Home", icon: "🏠" },
  { to: "/training", label: "Training", icon: "💪" },
  { to: "/nutrition", label: "Nutrition", icon: "🥗" },
  { to: "/habits", label: "Habits", icon: "✅" },
  { to: "/progress", label: "Progress", icon: "📈" },
];

export default function PortalNav() {
  const location = useLocation();
  const [discardConfirm, setDiscardConfirm] = useState(false);

  const resumeKey = Object.keys(sessionStorage).find(
    k => k.startsWith("tfl_workout_") &&
    !k.endsWith("_index") &&
    !k.endsWith("_programme") &&
    !k.endsWith("_week")
  );
  const resumeWorkoutId = resumeKey?.replace("tfl_workout_", "");
  const resumeProgrammeId = resumeWorkoutId
    ? sessionStorage.getItem(`tfl_workout_${resumeWorkoutId}_programme`)
    : null;
  const resumeWeekId = resumeWorkoutId
    ? sessionStorage.getItem(`tfl_workout_${resumeWorkoutId}_week`)
    : null;

  const isOnWorkout = location.pathname.includes(resumeWorkoutId || "____");

  const discardWorkout = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!discardConfirm) {
      setDiscardConfirm(true);
      setTimeout(() => setDiscardConfirm(false), 3000);
      return;
    }
    if (resumeWorkoutId) {
      sessionStorage.removeItem(`tfl_workout_${resumeWorkoutId}`);
      sessionStorage.removeItem(`tfl_workout_${resumeWorkoutId}_index`);
      sessionStorage.removeItem(`tfl_workout_${resumeWorkoutId}_programme`);
      sessionStorage.removeItem(`tfl_workout_${resumeWorkoutId}_week`);
      window.location.reload();
    }
  };

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100 }}>

      {/* Resume workout banner */}
      {resumeWorkoutId && resumeProgrammeId && !isOnWorkout && (
        <div style={{ margin: "0 12px 8px" }}>
          <div style={{
            backgroundColor: "#1a3a2a",
            borderRadius: "14px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          }}>
            <Link
              to={`/programme/${resumeProgrammeId}/${resumeWeekId}/${resumeWorkoutId}`}
              style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "12px", flex: 1 }}
            >
              <div style={{ width: 36, height: 36, borderRadius: "10px", backgroundColor: "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                💪
              </div>
              <div>
                <p style={{ fontSize: "11px", color: "#9fe1cb", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                  Workout in progress
                </p>
                <p style={{ fontSize: "14px", color: "#fff", fontWeight: 700, margin: 0 }}>
                  Tap to resume
                </p>
              </div>
            </Link>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                onClick={discardWorkout}
                style={{
                  backgroundColor: discardConfirm ? "#dc2626" : "rgba(255,255,255,0.1)",
                  color: discardConfirm ? "#fff" : "rgba(255,255,255,0.5)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {discardConfirm ? "Confirm?" : "Discard"}
              </button>
              <Link
                to={`/programme/${resumeProgrammeId}/${resumeWeekId}/${resumeWorkoutId}`}
                style={{ backgroundColor: "#2d6a4f", color: "#fff", fontSize: "13px", fontWeight: 700, padding: "6px 12px", borderRadius: "8px", textDecoration: "none" }}
              >
                Resume →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{
        backgroundColor: "#fff",
        borderTop: "1px solid #e5e5e5",
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {tabs.map((tab) => {
          const active = location.pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 0",
                textDecoration: "none",
                color: active ? "#2d6a4f" : "#999",
                fontSize: "10px",
                fontWeight: active ? 600 : 400,
                gap: "3px",
              }}
            >
              <span style={{ fontSize: "20px" }}>{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}