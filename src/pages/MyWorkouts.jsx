import { useState, useEffect } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import PortalNav from "../components/PortalNav";
import PremiumGate from "../components/PremiumGate";
import { useFeatures } from "../hooks/useFeatures";

function formatDate(val) {
  if (!val) return null;
  const d = val.toDate ? val.toDate() : new Date(val.seconds ? val.seconds * 1000 : val);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
}

export default function MyWorkouts() {
  const navigate = useNavigate();
  const features = useFeatures();
  const [user, setUser] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGate, setShowGate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);
      await loadWorkouts(u.uid);
    });
    return () => unsub();
  }, []);

  const loadWorkouts = async (uid) => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users", uid, "workouts"));
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aTime = a.updatedAt?.seconds ?? a.updatedAt?.toMillis?.() / 1000 ?? 0;
          const bTime = b.updatedAt?.seconds ?? b.updatedAt?.toMillis?.() / 1000 ?? 0;
          return bTime - aTime;
        });
      setWorkouts(data);
    } catch (e) {
      console.error("Failed to load workouts:", e);
      setWorkouts([]);
    }
    setLoading(false);
  };

  const handleCreateNew = () => {
    if (!features.unlimitedWorkouts && workouts.length >= features.maxSavedWorkouts) {
      setShowGate(true);
    } else {
      navigate("/my-workouts/new");
    }
  };

  const handleDelete = async (workoutId) => {
    if (confirmDelete !== workoutId) {
      setConfirmDelete(workoutId);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    setDeletingId(workoutId);
    try {
      await deleteDoc(doc(db, "users", user.uid, "workouts", workoutId));
      setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
    } catch (e) {
      console.error(e);
    }
    setDeletingId(null);
    setConfirmDelete(null);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <PortalNav />

      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 36px" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 16px" }}>
          Training
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>My Workouts</h1>
        <p style={{ fontSize: 13, color: "#9fe1cb", margin: 0 }}>
          {loading ? "" : workouts.length === 0 ? "Build your first workout" : `${workouts.length} saved workout${workouts.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      <div style={{ padding: "0 16px" }}>

        {/* Create new workout button */}
        <button
          onClick={handleCreateNew}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "16px",
            border: "2px dashed #2d6a4f",
            backgroundColor: "#eaf5ef",
            color: "#2d6a4f",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 20 }}>+</span>
          Create New Workout
        </button>

        {/* Free tier notice */}
        {!features.isPremium && (
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "14px",
              border: "0.5px solid #e5e5e5",
              padding: "14px 16px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 20 }}>⭐</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: "0 0 2px" }}>
                Free plan: 1 workout
              </p>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                Premium unlocks unlimited workouts.
              </p>
            </div>
            <button
              onClick={() => setShowGate(true)}
              style={{
                backgroundColor: "#1a3a2a",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Upgrade
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2].map((i) => (
              <div key={i} style={{ backgroundColor: "#fff", borderRadius: "16px", height: 100, border: "0.5px solid #e5e5e5", opacity: 0.5 }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && workouts.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏋️</div>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 8px" }}>No workouts yet</p>
            <p style={{ fontSize: 14, color: "#888", margin: 0, lineHeight: 1.5 }}>
              Build your first workout from your exercise library. Mix and match to fit your life.
            </p>
          </div>
        )}

        {/* Workout cards */}
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {workouts.map((workout) => {
              const exerciseCount = workout.exercises?.length ?? 0;
              const isConfirmingDelete = confirmDelete === workout.id;

              return (
                <div
                  key={workout.id}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: "16px",
                    border: "0.5px solid #e5e5e5",
                    overflow: "hidden",
                  }}
                >
                  {/* Main tap area */}
                  <Link
                    to={`/my-workouts/${workout.id}`}
                    style={{ textDecoration: "none", display: "block", padding: "16px 16px 12px" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {workout.name || "Untitled Workout"}
                        </p>
                        <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
                          {exerciseCount} exercise{exerciseCount === 1 ? "" : "s"}
                          {workout.lastUsedAt && ` • Last used ${formatDate(workout.lastUsedAt)}`}
                        </p>
                      </div>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "12px",
                          backgroundColor: "#eaf5ef",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginLeft: 12,
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M6 4l4 4-4 4" stroke="#2d6a4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>

                    {/* Exercise preview chips */}
                    {exerciseCount > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                        {(workout.exercises || []).slice(0, 4).map((ex, i) => (
                          <span
                            key={i}
                            style={{
                              backgroundColor: "#f7f5f2",
                              borderRadius: "8px",
                              padding: "4px 8px",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#555",
                            }}
                          >
                            {ex.exerciseName || "Exercise"}
                          </span>
                        ))}
                        {exerciseCount > 4 && (
                          <span style={{ backgroundColor: "#f7f5f2", borderRadius: "8px", padding: "4px 8px", fontSize: 11, fontWeight: 600, color: "#aaa" }}>
                            +{exerciseCount - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </Link>

                  {/* Action row */}
                  <div
                    style={{
                      borderTop: "0.5px solid #f0f0f0",
                      display: "flex",
                    }}
                  >
                    <Link
                      to={`/my-workouts/${workout.id}`}
                      style={{
                        flex: 2,
                        padding: "12px 0",
                        textAlign: "center",
                        textDecoration: "none",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#2d6a4f",
                        borderRight: "0.5px solid #f0f0f0",
                      }}
                    >
                      Start
                    </Link>
                    <Link
                      to={`/my-workouts/${workout.id}/edit`}
                      style={{
                        flex: 1,
                        padding: "12px 0",
                        textAlign: "center",
                        textDecoration: "none",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#888",
                        borderRight: "0.5px solid #f0f0f0",
                      }}
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(workout.id)}
                      disabled={deletingId === workout.id}
                      style={{
                        flex: 1,
                        padding: "12px 0",
                        border: "none",
                        background: "none",
                        fontSize: 13,
                        fontWeight: 600,
                        color: isConfirmingDelete ? "#dc2626" : "#bbb",
                        cursor: "pointer",
                      }}
                    >
                      {deletingId === workout.id ? "..." : isConfirmingDelete ? "Sure?" : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showGate && (
        <PremiumGate
          reason="workout_limit"
          onClose={() => setShowGate(false)}
        />
      )}
    </div>
  );
}
