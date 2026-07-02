import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import PortalNav from "../components/PortalNav";
import { SPLITS, BUILD_YOUR_OWN } from "../lib/workoutRecommendations";

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "#2d6a4f",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

// Simple stroke-based line icons, no emoji. Kept intentionally abstract
// (chevrons, bars, badges) rather than literal body parts so they stay
// clean at small sizes and match the rest of the app's icon language.
function SplitIcon({ id }) {
  switch (id) {
    case "full_body":
      return (
        <svg {...ICON_PROPS}>
          <circle cx="10" cy="4.5" r="2" />
          <path d="M10 6.5v5.5M6.5 9h7M7.5 19l2.5-6.5 2.5 6.5" />
        </svg>
      );
    case "upper":
      return (
        <svg {...ICON_PROPS}>
          <path d="M5 13l5-7 5 7" />
        </svg>
      );
    case "lower":
      return (
        <svg {...ICON_PROPS}>
          <path d="M5 7l5 7 5-7" />
        </svg>
      );
    case "push":
      return (
        <svg {...ICON_PROPS}>
          <path d="M7 5l7 5-7 5" />
        </svg>
      );
    case "pull":
      return (
        <svg {...ICON_PROPS}>
          <path d="M13 5l-7 5 7 5" />
        </svg>
      );
    case "legs":
      return (
        <svg {...ICON_PROPS}>
          <path d="M7 3v14M13 3v14" />
        </svg>
      );
    case "chest":
      return (
        <svg {...ICON_PROPS}>
          <path d="M2 10h16M4 7v6M16 7v6" />
        </svg>
      );
    case "back":
      return (
        <svg {...ICON_PROPS}>
          <path d="M10 2v16M7 4h6M7 16h6" />
        </svg>
      );
    case "shoulders":
      return (
        <svg {...ICON_PROPS}>
          <path d="M10 3.5L17 16H3L10 3.5z" />
        </svg>
      );
    case "arms":
      return (
        <svg {...ICON_PROPS}>
          <circle cx="4" cy="10" r="2.2" />
          <circle cx="16" cy="10" r="2.2" />
          <path d="M6.2 10h7.6" />
        </svg>
      );
    case "core":
      return (
        <svg {...ICON_PROPS}>
          <circle cx="10" cy="10" r="6.5" />
          <circle cx="10" cy="10" r="2.5" />
        </svg>
      );
    case "custom":
      return (
        <svg {...ICON_PROPS}>
          <path d="M4 16.5V20h3.5L18 9.5a2 2 0 000-2.8l-.7-.7a2 2 0 00-2.8 0L4 16.5z" />
          <path d="M12.5 6.5l3 3" />
        </svg>
      );
    default:
      return (
        <svg {...ICON_PROPS}>
          <circle cx="10" cy="10" r="6.5" />
        </svg>
      );
  }
}

/**
 * StartWorkout — "How would you like to train today?"
 *
 * The single entry point for training. One tap here replaces the old
 * name-it-then-build-it flow: choosing a card builds a full session via the
 * recommendation engine and drops the member straight into it.
 */
export default function StartWorkout() {
  const navigate = useNavigate();
  const [recentWorkout, setRecentWorkout] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      try {
        const snap = await getDocs(collection(db, "users", u.uid, "workouts"));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const withUse = data
          .filter((w) => w.lastUsedAt)
          .sort((a, b) => (b.lastUsedAt?.seconds ?? 0) - (a.lastUsedAt?.seconds ?? 0));
        setRecentWorkout(withUse[0] || null);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const selectSplit = (splitId) => {
    navigate(`/my-workouts/new?split=${splitId}`);
  };

  const buildMyOwn = () => {
    navigate("/my-workouts/new");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <PortalNav />

      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "20px 20px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => navigate("/my-workouts")}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}
          >
            ←
          </button>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.3px" }}>
          How would you like to train today?
        </h1>
        <p style={{ fontSize: 13, color: "#9fe1cb", margin: 0 }}>
          Pick a style, we'll build the session. Swap anything once you're in.
        </p>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      <div style={{ padding: "0 16px" }}>
        {!loading && recentWorkout && (
          <button
            onClick={() => navigate(`/my-workouts/${recentWorkout.id}`)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
              borderRadius: 16, border: "0.5px solid #e5e5e5", backgroundColor: "#fff", cursor: "pointer",
              textAlign: "left", marginBottom: 20,
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#2d6a4f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10a6 6 0 0110-4.5M4 5.5V9h3.5" />
                <path d="M16 10a6 6 0 01-10 4.5M16 14.5V11h-3.5" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>
                Repeat last workout
              </p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {recentWorkout.name || "Untitled Workout"}
              </p>
            </div>
            <span style={{ color: "#2d6a4f", fontSize: 18 }}>→</span>
          </button>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {SPLITS.map((split) => (
            <button
              key={split.id}
              onClick={() => selectSplit(split.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center",
                gap: 8, padding: "20px 16px", minHeight: 108, borderRadius: 20, border: "none",
                backgroundColor: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <SplitIcon id={split.id} />
              </div>
              <span style={{ fontSize: 15.5, fontWeight: 700, color: "#111" }}>{split.label}</span>
              <span style={{ fontSize: 11.5, color: "#999", lineHeight: 1.3 }}>{split.subtitle}</span>
            </button>
          ))}

          <button
            onClick={buildMyOwn}
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center",
              gap: 8, padding: "20px 16px", minHeight: 108, borderRadius: 20, border: "2px solid #2d6a4f",
              backgroundColor: "transparent", cursor: "pointer", textAlign: "left",
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SplitIcon id="custom" />
            </div>
            <span style={{ fontSize: 15.5, fontWeight: 700, color: "#2d6a4f" }}>{BUILD_YOUR_OWN.label}</span>
            <span style={{ fontSize: 11.5, color: "#5a9e7a", lineHeight: 1.3 }}>{BUILD_YOUR_OWN.subtitle}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
