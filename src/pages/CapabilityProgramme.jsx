import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, collection, getDocs, orderBy, query } from "firebase/firestore";

import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

// ----------------------------------------------------------------
// Utility
// ----------------------------------------------------------------
const DAY_ORDER = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const DAY_LABEL = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed",
  thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
};
const DAY_FULL = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

function sessionTypeColor(type) {
  if (type === "weights") return "#e8f4fd";
  if (type === "run")     return "#edfaed";
  if (type === "rest")    return "#f5f5f5";
  return "#fff";
}
function sessionTypeBadge(type) {
  if (type === "weights") return { bg: "#2563eb", color: "#fff", label: "Weights" };
  if (type === "run")     return { bg: "#16a34a", color: "#fff", label: "Run" };
  return { bg: "#9ca3af", color: "#fff", label: "Rest" };
}

// ----------------------------------------------------------------
// Programme Overview (week grid)
// ----------------------------------------------------------------
export default function CapabilityProgramme() {
 const [user, setUser] = useState(null);
const [userProfile, setUserProfile] = useState(null);
useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (u) => {
    setUser(u);
    if (u) {
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) setUserProfile(snap.data());
    }
  });
  return () => unsub();
}, []);
  const navigate = useNavigate();
  const [programme, setProgramme] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBlock, setActiveBlock] = useState(1);

  const isPremium = userProfile?.subscription === "premium" || 
                  userProfile?.subscription === "hybrid" || 
                  userProfile?.subscription === "in-person" ||
                  userProfile?.tier === "admin";

  useEffect(() => {
    async function load() {
      try {
        const progRef = doc(db, "programmes", "capability-programme");
        const progSnap = await getDoc(progRef);
        if (!progSnap.exists()) { setLoading(false); return; }
        setProgramme({ id: progSnap.id, ...progSnap.data() });

        const weeksSnap = await getDocs(
          query(collection(db, "programmes", "capability-programme", "weeks"), orderBy("weekNum"))
        );
        setWeeks(weeksSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#6b7280" }}>Loading programme...</p>
      </div>
    );
  }

  if (!programme) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", padding: "0 20px", textAlign: "center" }}>
        <h2 style={{ color: "#111" }}>Programme not found</h2>
        <p style={{ color: "#6b7280" }}>The Capability Programme hasn't been seeded yet.</p>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", padding: "0 20px", textAlign: "center" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#111", marginBottom: 8 }}>
            Premium Programme
          </h2>
          <p style={{ color: "#6b7280", marginBottom: 24 }}>
            The Capability Programme is available to premium members. Upgrade to access all 12 weeks of structured strength and running.
          </p>
          <button
            onClick={() => navigate("/profile")}
            style={{
              background: "#2563eb", color: "#fff", border: "none", borderRadius: 8,
              padding: "12px 28px", fontSize: 16, fontWeight: 600, cursor: "pointer",
            }}
          >
            Upgrade to Premium
          </button>
        </div>
      </div>
    );
  }

  const blockWeeks = weeks.filter(w => w.block === activeBlock);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => navigate("/training")}
          style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14, padding: 0, marginBottom: 12 }}
        >
          &larr; Back to Training
        </button>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#111", margin: "0 0 8px" }}>
          The Capability Programme
        </h1>
        <p style={{ color: "#6b7280", fontSize: 16, margin: 0 }}>
          12 weeks -- 3 blocks -- Strength + Running
        </p>
      </div>

      {/* Programme summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
        {[
          { label: "Duration", value: "12 Weeks" },
          { label: "Lifting Days", value: "Mon / Wed / Fri" },
          { label: "Run Days", value: "Tue / Thu / Sat" },
          { label: "Main Lifts", value: "Squat / Bench / Deadlift" },
        ].map(c => (
          <div key={c.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              {c.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Block tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[1,2,3].map(b => (
          <button
            key={b}
            onClick={() => setActiveBlock(b)}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "1px solid",
              borderColor: activeBlock === b ? "#2563eb" : "#e5e7eb",
              background: activeBlock === b ? "#2563eb" : "#fff",
              color: activeBlock === b ? "#fff" : "#374151",
              fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}
          >
            Block {b}
          </button>
        ))}
      </div>

      {/* Block description */}
      <BlockDescription block={activeBlock} />

      {/* Week cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {blockWeeks.map(week => (
          <WeekCard key={week.id} week={week} navigate={navigate} />
        ))}
      </div>
    </div>
  );
}

function BlockDescription({ block }) {
  const descriptions = {
    1: "Foundation block. 5-rep top sets, 80% back offs. Build technique and establish working weights. Week 4 is a deload.",
    2: "Strength block. 3-rep top sets, 4 back off sets at 82.5%. Push the weights while keeping form tight. Week 8 is a deload.",
    3: "Peak block. 1-rep top sets, 5 back off sets at 85%. This is where PRs happen. Week 12 is a deload to finish the cycle.",
  };
  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
      padding: "14px 18px", marginBottom: 20, color: "#374151", fontSize: 14,
    }}>
      <strong>Block {block}:</strong> {descriptions[block]}
    </div>
  );
}

function WeekCard({ week, navigate }) {
  const [expanded, setExpanded] = useState(false);
  const isDeload = week.isDeload;

  return (
    <div style={{
      background: "#fff", border: "1px solid",
      borderColor: isDeload ? "#fbbf24" : "#e5e7eb",
      borderRadius: 12, overflow: "hidden",
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>
            Week {week.weekNum}
          </span>
          {isDeload && (
            <span style={{
              background: "#fef3c7", color: "#92400e", fontSize: 11,
              fontWeight: 700, padding: "2px 8px", borderRadius: 20, textTransform: "uppercase",
            }}>
              Deload
            </span>
          )}
          <span style={{ color: "#9ca3af", fontSize: 13 }}>{week.blockLabel}</span>
        </div>
        <span style={{ color: "#9ca3af", fontSize: 18 }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Day strip */}
      <div style={{ display: "flex", borderTop: "1px solid #f3f4f6", padding: "0 20px 0" }}>
        {DAY_ORDER.map(day => {
          const session = week.sessions?.[day];
          if (!session) return null;
          const badge = sessionTypeBadge(session.type);
          return (
            <button
              key={day}
              onClick={() => navigate(`/programme/capability-programme/week-${week.weekNum}/${day}`)}
              style={{
                flex: 1, padding: "10px 4px", background: "none", border: "none",
                cursor: session.type === "rest" ? "default" : "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}
            >
              <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{DAY_LABEL[day]}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 10,
                background: badge.bg, color: badge.color, textTransform: "uppercase",
              }}>
                {badge.label}
              </span>
            </button>
          );
        })}
      </div>

      {expanded && (
        <div style={{ padding: "16px 20px 20px", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
            {DAY_ORDER.filter(d => d !== "sunday").map(day => {
              const session = week.sessions?.[day];
              if (!session) return null;
              return (
                <SessionSummaryCard
                  key={day}
                  day={day}
                  session={session}
                  onClick={() => {
                    if (session.type !== "rest") {
                      navigate(`/programme/capability-programme/week-${week.weekNum}/${day}`);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionSummaryCard({ day, session, onClick }) {
  const badge = sessionTypeBadge(session.type);
  return (
    <div
      onClick={onClick}
      style={{
        background: sessionTypeColor(session.type),
        border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px",
        cursor: session.type === "rest" ? "default" : "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: "#111", fontSize: 14 }}>{DAY_FULL[day]}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
          background: badge.bg, color: badge.color, textTransform: "uppercase",
        }}>
          {badge.label}
        </span>
      </div>
      <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>
        {session.label || session.name || session.description?.slice(0, 80)}
      </p>
    </div>
  );
}