import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useUserProfile } from "../hooks/useUserProfile";
import { useUnreadMessageCount } from "../hooks/useUnreadMessageCount";

const ALL_TABS = [
  { to: "/dashboard", label: "Home", icon: "🏠", always: true },
  { to: "/training", label: "Training", icon: "💪", always: true },
  { to: "/classes", label: "Classes", icon: "🏛️", always: false },
  { to: "/nutrition", label: "Nutrition", icon: "🥗", always: true },
  { to: "/progress", label: "Progress", icon: "📈", always: true },
  { to: "/messages", label: "Messages", icon: "💬", always: true },
];

const IN_PERSON_TIERS = ["hybrid", "elite", "inperson", "in_person"];

export default function PortalNav() {
  const location = useLocation();
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const { profile } = useUserProfile();

  const tier = profile?.subscriptionTier || profile?.subscription || "";
  const hasClasses = IN_PERSON_TIERS.some(t => tier.toLowerCase().includes(t));
  const tabs = ALL_TABS.filter(tab => tab.always || hasClasses);
  const unreadMessages = useUnreadMessageCount();

  const resumeKey = Object.keys(localStorage).find(
    k => k.startsWith("tfl_workout_") &&
    !k.endsWith("_index") &&
    !k.endsWith("_programme") &&
    !k.endsWith("_week")
  );
  const resumeWorkoutId = resumeKey?.replace("tfl_workout_", "");
  const resumeProgrammeId = resumeWorkoutId
    ? localStorage.getItem("tfl_workout_" + resumeWorkoutId + "_programme")
    : null;
  const resumeWeekId = resumeWorkoutId
    ? localStorage.getItem("tfl_workout_" + resumeWorkoutId + "_week")
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
      localStorage.removeItem("tfl_workout_" + resumeWorkoutId);
      localStorage.removeItem("tfl_workout_" + resumeWorkoutId + "_index");
      localStorage.removeItem("tfl_workout_" + resumeWorkoutId + "_programme");
      localStorage.removeItem("tfl_workout_" + resumeWorkoutId + "_week");
      window.location.reload();
    }
  };

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100 }}>

      {resumeWorkoutId && resumeProgrammeId && !isOnWorkout && (
        <div style={{ margin: "0 12px 8px" }}>
          <div style={{ backgroundColor: "#1a3a2a", borderRadius: "14px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
            <Link
              to={"/programme/" + resumeProgrammeId + "/" + resumeWeekId + "/" + resumeWorkoutId}
              style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "12px", flex: 1 }}
            >
              <div style={{ width: 36, height: 36, borderRadius: "10px", backgroundColor: "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                💪
              </div>
              <div>
                <p style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
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
                style={{ backgroundColor: discardConfirm ? "#dc2626" : "rgba(255,255,255,0.1)", color: discardConfirm ? "#fff" : "rgba(255,255,255,0.5)", border: "none", borderRadius: "8px", padding: "6px 10px", fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {discardConfirm ? "Confirm?" : "Discard"}
              </button>
              <Link
                to={"/programme/" + resumeProgrammeId + "/" + resumeWeekId + "/" + resumeWorkoutId}
                style={{ backgroundColor: "#2d6a4f", color: "#fff", fontSize: "13px", fontWeight: 700, padding: "6px 12px", borderRadius: "8px", textDecoration: "none" }}
              >
                Resume →
              </Link>
            </div>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: "#fff", borderTop: "1px solid #e5e5e5", display: "flex", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {tabs.map((tab) => {
          const active = location.pathname === tab.to ||
            (tab.to !== "/dashboard" && location.pathname.startsWith(tab.to));
          const badge = tab.to === "/messages" && unreadMessages > 0 ? unreadMessages : 0;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 0", textDecoration: "none", color: active ? "#2d6a4f" : "#999", fontSize: "10px", fontWeight: active ? 600 : 400, gap: "3px", position: "relative" }}
            >
              <span style={{ fontSize: "20px", position: "relative" }}>
                {tab.icon}
                {badge > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -6, backgroundColor: "#ef4444", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: "10px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
