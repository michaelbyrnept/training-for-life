import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Link, useParams } from "react-router-dom";
import PortalNav from "../components/PortalNav";

export default function Week() {
  const { programmeId, weekId } = useParams();
  const [programme, setProgramme] = useState(null);
  const [week, setWeek] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const progSnap = await getDoc(doc(db, "programmes", programmeId));
      if (!progSnap.exists()) { setLoading(false); return; }

      const progData = { id: progSnap.id, ...progSnap.data() };
      setProgramme(progData);

      const weekNumber = parseInt(weekId.replace("week-", ""));
      const weekData = progData.weeks?.find((w) => w.weekNumber === weekNumber);
      setWeek(weekData);

      if (weekData?.workouts?.length > 0) {
        const workoutSnaps = await Promise.all(
          weekData.workouts.map((wId) => getDoc(doc(db, "workouts", wId)))
        );
        setWorkouts(workoutSnaps.map((s) => ({ id: s.id, ...s.data() })));
      }

      setLoading(false);
    };
    fetch();
  }, [programmeId, weekId]);

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <PortalNav />
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
    </div>
  );

  if (!programme || !week) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <PortalNav />
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Week not found.</p>
    </div>
  );

  const isRepeating = programme.repeating === true;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <PortalNav />

      {/* Header */}
      <div style={{ padding: "1.5rem 1.25rem 1rem" }}>
        <Link to={`/programme/${programmeId}`} style={{ fontSize: "13px", color: "#2d6a4f", fontWeight: 600, textDecoration: "none" }}>
          ← {programme.name}
        </Link>

        <div style={{ marginTop: "12px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#2d6a4f", marginBottom: "4px" }}>
            {programme.name}
          </p>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>
            {isRepeating ? "This Week's Sessions" : week.title}
          </h1>
          <p style={{ color: "#888", fontSize: "14px", margin: 0 }}>
            {workouts.length} session{workouts.length !== 1 ? "s" : ""} {isRepeating ? "· Repeats every week" : "this week"}
          </p>
        </div>
      </div>

      {/* Workout cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "0 1.25rem" }}>
        {workouts.map((workout, index) => (
          <div key={workout.id} style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
            <div style={{ height: "4px", backgroundColor: "#2d6a4f" }} />
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "#2d6a4f", flexShrink: 0 }}>
                  {String.fromCharCode(65 + index)}
                </div>
                <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#111", margin: 0 }}>{workout.displayName || workout.name}</h2>
              </div>

              {workout.description && (
                <p style={{ fontSize: "13px", color: "#666", margin: "0 0 12px", paddingLeft: "42px", lineHeight: 1.5 }}>
                  {workout.description}
                </p>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: "42px" }}>
                <div style={{ display: "flex", gap: "10px" }}>
                  <span style={{ fontSize: "11px", color: "#888" }}>{workout.exercises?.length || 0} exercises</span>
                  <span style={{ fontSize: "11px", color: "#888" }}>{workout.estimatedTime} min</span>
                </div>
                <Link
                  to={`/programme/${programmeId}/${weekId}/${workout.id}`}
                  style={{ backgroundColor: "#2d6a4f", color: "#fff", fontSize: "13px", fontWeight: 700, padding: "9px 18px", borderRadius: "10px", textDecoration: "none" }}
                >
                  Start →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom message for repeating programmes */}
      {isRepeating && (
        <div style={{ margin: "20px 1.25rem 0", backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "16px" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#9fe1cb", margin: "0 0 6px" }}>
            How progression works
          </p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, margin: 0 }}>
            Complete all three sessions, in any order. When you hit the top of your rep range, the app will prompt you to add weight. Come back next week and do it again. That's how capability is built.
          </p>
        </div>
      )}
    </div>
  );
}
