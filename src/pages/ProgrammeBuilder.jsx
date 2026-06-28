import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate, useParams } from "react-router-dom";
import { db, auth } from "../firebase";
import { useFeatures } from "../hooks/useFeatures";
import PremiumGate from "../components/PremiumGate";

const DAYS = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
];

const emptyTemplate = () => Object.fromEntries(DAYS.map((d) => [d.key, null]));

export default function ProgrammeBuilder() {
  const navigate = useNavigate();
  const { programmeId } = useParams();
  const isEdit = !!programmeId;
  const features = useFeatures();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showGate, setShowGate] = useState(false);

  // Programme fields
  const [name, setName] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [weekTemplate, setWeekTemplate] = useState(emptyTemplate());

  // Workout picker
  const [workouts, setWorkouts] = useState([]);
  const [pickingDay, setPickingDay] = useState(null); // day key being assigned

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);

      if (!features.isPremium) { setShowGate(true); }

      // Load saved workouts
      const wSnap = await getDocs(collection(db, "users", u.uid, "workouts"));
      const wData = wSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setWorkouts(wData);

      // If editing, load existing programme
      if (isEdit) {
        const pSnap = await getDoc(doc(db, "users", u.uid, "userProgrammes", programmeId));
        if (pSnap.exists()) {
          const data = pSnap.data();
          setName(data.name || "");
          setWeeks(data.weeks || 4);
          setWeekTemplate(data.weekTemplate || emptyTemplate());
        }
      }

      setLoading(false);
    });
    return () => unsub();
  }, [programmeId]);

  const assignWorkout = (workout) => {
    if (!pickingDay) return;
    setWeekTemplate((prev) => ({
      ...prev,
      [pickingDay]: workout ? { workoutId: workout.id, workoutName: workout.name } : null,
    }));
    setPickingDay(null);
  };

  const handleSave = async () => {
    if (!name.trim()) { alert("Give your programme a name."); return; }
    setSaving(true);
    const payload = {
      name: name.trim(),
      weeks,
      weekTemplate,
      updatedAt: serverTimestamp(),
    };
    try {
      if (isEdit) {
        await updateDoc(doc(db, "users", user.uid, "userProgrammes", programmeId), payload);
      } else {
        await addDoc(collection(db, "users", user.uid, "userProgrammes"), {
          ...payload,
          isActive: false,
          startedAt: null,
          currentWeek: 1,
          completedSessions: [],
          createdAt: serverTimestamp(),
        });
      }
      navigate("/my-programmes");
    } catch (e) {
      console.error(e);
      alert("Failed to save.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#888" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "52px 20px 24px" }}>
        <button onClick={() => navigate("/my-programmes")} style={{ background: "none", border: "none", color: "#9fe1cb", fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 12 }}>
          ← Back
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: 0 }}>
          {isEdit ? "Edit Programme" : "New Programme"}
        </h1>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {/* Name */}
        <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: "18px", marginBottom: 14, border: "0.5px solid #e5e5e5" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Programme Name</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 8 Week Strength Block"
            style={{ width: "100%", border: "none", outline: "none", fontSize: 17, fontWeight: 700, color: "#111", backgroundColor: "transparent", padding: 0, boxSizing: "border-box" }}
          />
        </div>

        {/* Weeks */}
        <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: "18px", marginBottom: 14, border: "0.5px solid #e5e5e5" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Duration</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[2, 4, 6, 8, 10, 12].map((w) => (
              <button
                key={w}
                onClick={() => setWeeks(w)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 10,
                  border: weeks === w ? "2px solid #2d6a4f" : "1.5px solid #e5e5e5",
                  backgroundColor: weeks === w ? "#eaf5ef" : "#fff",
                  color: weeks === w ? "#2d6a4f" : "#555",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {w}w
              </button>
            ))}
          </div>
        </div>

        {/* Weekly Template */}
        <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: "18px", marginBottom: 20, border: "0.5px solid #e5e5e5" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Weekly Schedule</p>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 14px" }}>This same schedule repeats every week.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {DAYS.map((day) => {
              const assigned = weekTemplate[day.key];
              return (
                <div key={day.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#444", width: 36 }}>{day.short}</span>
                  {assigned ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        onClick={() => setPickingDay(day.key)}
                        style={{ flex: 1, backgroundColor: "#eaf5ef", borderRadius: 10, padding: "10px 14px", cursor: "pointer", border: "1.5px solid #2d6a4f" }}
                      >
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#1a3a2a", margin: 0 }}>{assigned.workoutName}</p>
                      </div>
                      <button
                        onClick={() => setWeekTemplate((prev) => ({ ...prev, [day.key]: null }))}
                        style={{ background: "none", border: "none", color: "#aaa", fontSize: 18, cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPickingDay(day.key)}
                      style={{ flex: 1, border: "1.5px dashed #d5d5d5", borderRadius: 10, padding: "10px 14px", backgroundColor: "transparent", color: "#aaa", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}
                    >
                      + Assign workout (rest day)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{ width: "100%", backgroundColor: "#1a3a2a", color: "#fff", border: "none", borderRadius: 14, padding: "16px", fontWeight: 700, fontSize: 16, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Programme"}
        </button>
      </div>

      {/* Workout Picker Sheet */}
      {pickingDay && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setPickingDay(null); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
        >
          <div style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px 0" }}>
              <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
              <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 14px" }}>
                {DAYS.find((d) => d.key === pickingDay)?.label} workout
              </p>
            </div>
            <div style={{ overflowY: "auto", padding: "0 20px 40px" }}>
              {workouts.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ color: "#888", fontSize: 14 }}>No saved workouts yet.</p>
                  <p style={{ color: "#aaa", fontSize: 13 }}>Build one in My Workouts first.</p>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {workouts.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => assignWorkout(w)}
                    style={{ width: "100%", textAlign: "left", backgroundColor: "#f7f5f2", border: "1.5px solid #e5e5e5", borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}
                  >
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{w.name}</p>
                    <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{w.exercises?.length || 0} exercises</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showGate && <PremiumGate onClose={() => { setShowGate(false); navigate("/my-programmes"); }} feature="custom programmes" />}
    </div>
  );
}
