import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Link, useParams } from "react-router-dom";
import PortalNav from "../components/PortalNav";

export default function Programme() {
  const { id } = useParams();
  const [programme, setProgramme] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDoc(doc(db, "programmes", id));
      if (snap.exists()) setProgramme({ id: snap.id, ...snap.data() });
      setLoading(false);
    };
    fetch();
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <PortalNav />
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
    </div>
  );

  if (!programme) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <PortalNav />
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Programme not found.</p>
    </div>
  );

  const isPremium = programme.free === false;
  const isRepeating = programme.repeating === true;
  const firstWeek = programme.weeks?.[0];
  const weekLink = `/programme/${id}/week-${firstWeek?.weekNumber || 1}`;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <PortalNav />

      {/* Header */}
      <div style={{
        background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)",
        padding: "16px 20px 40px",
      }}>
        <Link to="/training" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 600, textDecoration: "none" }}>
          ← Training
        </Link>
        <div style={{ marginTop: "16px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9fe1cb", marginBottom: "6px" }}>
            {isPremium ? "🔒 Premium" : programme.tag || "Free"}
          </p>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
            {programme.name}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px", margin: "0 0 14px", lineHeight: 1.6 }}>
            {programme.description}
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {isRepeating && (
              <span style={{ fontSize: "12px", color: "#9fe1cb", backgroundColor: "rgba(255,255,255,0.12)", padding: "4px 12px", borderRadius: "20px" }}>
                Repeating programme
              </span>
            )}
            {programme.level && (
              <span style={{ fontSize: "12px", color: "#9fe1cb", backgroundColor: "rgba(255,255,255,0.12)", padding: "4px 12px", borderRadius: "20px" }}>
                {programme.level}
              </span>
            )}
            <span style={{ fontSize: "12px", color: "#9fe1cb", backgroundColor: "rgba(255,255,255,0.12)", padding: "4px 12px", borderRadius: "20px" }}>
              {firstWeek?.workouts?.length || 0} sessions per week
            </span>
          </div>
        </div>
      </div>

      {/* White curve */}
      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      {/* Premium lock */}
      {isPremium && (
        <div style={{ margin: "0 1.25rem 1.5rem", backgroundColor: "#fef9c3", borderRadius: "12px", padding: "14px 16px", border: "0.5px solid #fde68a" }}>
          <p style={{ fontWeight: 700, fontSize: "14px", color: "#854d0e", margin: "0 0 4px" }}>🔒 Premium Programme</p>
          <p style={{ fontSize: "13px", color: "#92400e", margin: 0 }}>Upgrade to access this programme and all premium content.</p>
        </div>
      )}

      {/* Repeating programme -- single week view */}
      {isRepeating && firstWeek && !isPremium ? (
        <div style={{ padding: "0 1.25rem" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "12px" }}>
            Your Weekly Sessions
          </p>

          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", overflow: "hidden", marginBottom: "16px" }}>
            <div style={{ height: "4px", backgroundColor: "#2d6a4f" }} />
            <div style={{ padding: "16px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>
                This week
              </p>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>
                {firstWeek.title}
              </h2>
              <p style={{ fontSize: "13px", color: "#888", margin: "0 0 14px" }}>
                {firstWeek.workouts?.length || 0} sessions · Repeats every week
              </p>
              <Link
                to={weekLink}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#2d6a4f", color: "#fff", fontSize: "14px", fontWeight: 700, padding: "12px 20px", borderRadius: "10px", textDecoration: "none" }}
              >
                Start Training →
              </Link>
            </div>
          </div>

          {/* How it works */}
          <div style={{ backgroundColor: "#eaf5ef", borderRadius: "14px", padding: "16px", marginBottom: "16px" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a4a35", margin: "0 0 8px" }}>How this programme works</p>
            <p style={{ fontSize: "13px", color: "#2d6a4f", lineHeight: 1.6, margin: 0 }}>
              Complete all three sessions each week, in any order. When you hit the top of your rep range, the app will guide you to add weight. The programme repeats every week -- the weights change, the structure stays the same. That's how capability is built.
            </p>
          </div>
        </div>
      ) : !isRepeating ? (
        /* Standard week-by-week programme */
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "0 1.25rem" }}>
          {programme.weeks?.map((week, index) => {
            const isLocked = isPremium || index > 0;
            return (
              <div key={index} style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", overflow: "hidden", opacity: isLocked ? 0.7 : 1 }}>
                <div style={{ height: "4px", backgroundColor: isLocked ? "#e5e5e5" : "#2d6a4f" }} />
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div>
                      <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: isLocked ? "#aaa" : "#2d6a4f", margin: "0 0 3px" }}>
                        {isLocked ? "🔒 Locked" : "Current"}
                      </p>
                      <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#111", margin: 0 }}>{week.title}</h2>
                    </div>
                    <span style={{ fontSize: "11px", color: "#888", backgroundColor: "#f5f5f5", padding: "4px 10px", borderRadius: "20px" }}>
                      {week.workouts?.length || 0} workouts
                    </span>
                  </div>
                  {isLocked ? (
                    <div style={{ backgroundColor: "#f5f5f5", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#888" }}>
                      {isPremium ? "Upgrade to unlock" : `Complete Week ${index} to unlock`}
                    </div>
                  ) : (
                    <Link to={`/programme/${id}/week-${week.weekNumber || index + 1}`} style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#2d6a4f", color: "#fff", fontSize: "13px", fontWeight: 600, padding: "8px 16px", borderRadius: "8px", textDecoration: "none" }}>
                      Start Week →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}