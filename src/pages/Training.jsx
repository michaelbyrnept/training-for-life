import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import PortalNav from "../components/PortalNav";
import PremiumGate from "../components/PremiumGate";
import { useFeatures } from "../hooks/useFeatures";

const WEEKLY_TARGETS = { strength: 3, cardio: 2, mobility: 1 };

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

// ─── Compact programme row ────────────────────────────────────────────────────

function ProgrammeCard({ programme: p, isPremiumUser }) {
  const isLocked = p.free === false && !isPremiumUser;
  const tag = (p.tag || "").toLowerCase();
  const accentColor = isLocked ? "#d97706" : tag === "cardio" || tag === "walk" ? "#0369a1" : "#2d6a4f";

  return (
    <Link
      to={isLocked ? "#" : `/programme/${p.id}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 14,
          border: "0.5px solid #e5e5e5",
          padding: "13px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: isLocked ? 0.72 : 1,
        }}
      >
        <div
          style={{
            width: 4,
            height: 36,
            borderRadius: 2,
            backgroundColor: accentColor,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#111",
              margin: "0 0 2px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {p.name}
          </p>
          <p
            style={{
              fontSize: 12,
              color: "#888",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {p.description || `${p.weeks?.length || 0} weeks · ${p.level || ""}`}
          </p>
        </div>
        {isLocked ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#d97706",
              backgroundColor: "#fffbeb",
              padding: "4px 10px",
              borderRadius: 20,
              flexShrink: 0,
            }}
          >
            Premium
          </span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: accentColor, flexShrink: 0 }}>
            View →
          </span>
        )}
      </div>
    </Link>
  );
}

// ─── Collapsible programme group ──────────────────────────────────────────────

function ProgrammeGroup({ title, programmes, isPremiumUser, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  if (programmes.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          padding: "10px 0 8px",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>{title}</p>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#aaa",
              backgroundColor: "#f0f0f0",
              borderRadius: 20,
              padding: "2px 8px",
            }}
          >
            {programmes.length}
          </span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="#aaa"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8 }}>
          {programmes.map((p) => (
            <ProgrammeCard key={p.id} programme={p} isPremiumUser={isPremiumUser} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Coming Soon (collapsed by default) ──────────────────────────────────────

function ComingSoonSection({ user, userData }) {
  const [expanded, setExpanded] = useState(false);
  const [notified, setNotified] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleNotify = async () => {
    if (!user || saving || notified) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "waitlist", user.uid), {
        userId: user.uid,
        email: userData?.email || user.email || "",
        name: userData?.nickname || userData?.firstName || "",
        signedUpAt: new Date().toISOString(),
      });
      setNotified(true);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const items = [
    { icon: "🏋️", name: "Capability Full Body", sub: "Premium strength with full exercise swap library", tag: "Strength" },
    { icon: "🍑", name: "Glute Builder", sub: "Glute-focused with quad work and upper body", tag: "Strength" },
    { icon: "💪", name: "Bro Split", sub: "Upper / Lower / Push / Pull / Legs with gym swaps", tag: "Strength" },
    { icon: "🏃", name: "5k Foundation", sub: "Get your first 5k from any starting point", tag: "Running" },
    { icon: "🏅", name: "10k Builder", sub: "Step up your distance and pace", tag: "Running" },
    { icon: "🎽", name: "Half Marathon", sub: "16 week structured plan", tag: "Running" },
    { icon: "🏆", name: "Coach to Marathon", sub: "52 weeks. One goal. Cross the finish line.", tag: "Running" },
  ];

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          width: "100%",
          backgroundColor: "#1a3a2a",
          borderRadius: 16,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>
            {items.length} programmes coming soon
          </p>
          <p style={{ fontSize: 12, color: "#9fe1cb", margin: 0 }}>Premium · €19.99/mo</p>
        </div>
        <span style={{ fontSize: 22, color: "#9fe1cb", lineHeight: 1 }}>+</span>
      </button>
    );
  }

  return (
    <div style={{ backgroundColor: "#1a3a2a", borderRadius: 16, padding: "16px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#9fe1cb", margin: 0 }}>
          Premium programmes dropping soon
        </p>
        <button
          onClick={() => setExpanded(false)}
          style={{ background: "none", border: "none", color: "#9fe1cb", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "11px 14px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{item.name}</p>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: item.tag === "Running" ? "#60a5fa" : "#9fe1cb",
                    backgroundColor: "rgba(255,255,255,0.08)",
                    padding: "1px 7px",
                    borderRadius: 10,
                    flexShrink: 0,
                  }}
                >
                  {item.tag}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: 0 }}>{item.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          backgroundColor: "rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "14px",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 13, color: "#fff", fontWeight: 700, margin: "0 0 4px" }}>
          Founding Member Price
        </p>
        <p
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#4ade80",
            margin: "0 0 4px",
            lineHeight: 1,
          }}
        >
          €19.99
          <span style={{ fontSize: 14, color: "#9fe1cb" }}>/month</span>
        </p>
        <p style={{ fontSize: 12, color: "#9fe1cb", margin: "0 0 12px" }}>
          Unlock all programmes, past and future
        </p>
        <button
          onClick={handleNotify}
          disabled={saving || notified}
          style={{
            width: "100%",
            backgroundColor: notified ? "#4ade80" : "#2d6a4f",
            borderRadius: 10,
            padding: 13,
            fontSize: 14,
            fontWeight: 700,
            color: notified ? "#1a3a2a" : "#fff",
            border: "none",
            cursor: notified ? "default" : "pointer",
            transition: "all 0.3s ease",
          }}
        >
          {saving ? "Saving..." : notified ? "You're on the list!" : "Notify me when available"}
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Training() {
  const navigate = useNavigate();
  const features = useFeatures();
  const [programmes, setProgrammes] = useState([]);
  const [userData, setUserData] = useState(null);
  const [user, setUser] = useState(null);
  const [weeklyLogs, setWeeklyLogs] = useState({ strength: 0, cardio: 0, mobility: 0 });
  const [weeklyClassCount, setWeeklyClassCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectingType, setSelectingType] = useState(null);
  const [classes, setClasses] = useState([]);
  const [showUpgradeGate, setShowUpgradeGate] = useState(false);
  const [customWorkoutCount, setCustomWorkoutCount] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUser(u);
      getDocs(collection(db, "users", u.uid, "workouts")).then((s) => setCustomWorkoutCount(s.size));
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const uData = userSnap.exists() ? userSnap.data() : {};
      setUserData(uData);

      const snap = await getDocs(collection(db, "programmes"));
      const allProgrammes = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.published);
      setProgrammes(allProgrammes);

      const { monday, sunday } = getWeekRange();
      const logsSnap = await getDocs(
        query(collection(db, "workoutLogs"), where("userId", "==", u.uid))
      );
      const myLogs = logsSnap.docs.map((d) => d.data()).filter((l) => {
        const d = new Date(l.completedAt);
        return d >= monday && d <= sunday;
      });

      const strengthCount = uData.strengthProgrammeId
        ? myLogs.filter((l) => l.programmeId === uData.strengthProgrammeId).length
        : 0;
      const cardioCount = uData.cardioProgrammeId
        ? myLogs.filter((l) => l.programmeId === uData.cardioProgrammeId).length
        : 0;
      setWeeklyLogs({ strength: strengthCount, cardio: cardioCount, mobility: 0 });

      const classSnap = await getDocs(collection(db, "classes"));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const classData = classSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => {
          if (c.published === false || !c.date) return false;
          const classDate = new Date(c.date + "T12:00:00");
          return classDate >= today;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 10);
      setClasses(classData);

      const classLogSnap = await getDocs(
        query(collection(db, "classLogs"), where("userId", "==", u.uid))
      );
      const classesThisWeek = classLogSnap.docs
        .map((d) => d.data())
        .filter((l) => {
          if (!l.completedAt) return false;
          const d = new Date(l.completedAt);
          return d >= monday && d <= sunday;
        }).length;
      setWeeklyClassCount(classesThisWeek);

      setLoading(false);
    });
    return () => unsub();
  }, []);

  const selectProgramme = async (type, programmeId) => {
    if (!user) return;
    const field = type === "strength" ? "strengthProgrammeId" : "cardioProgrammeId";
    await updateDoc(doc(db, "users", user.uid), { [field]: programmeId });
    setUserData((prev) => ({ ...prev, [field]: programmeId }));
    setSelectingType(null);
  };

  const strengthProgramme = programmes.find((p) => p.id === userData?.strengthProgrammeId);
  const cardioProgramme = programmes.find((p) => p.id === userData?.cardioProgrammeId);
  const isPremium =
    userData?.subscription === "premium" ||
    userData?.subscription === "hybrid" ||
    userData?.subscription === "in-person" ||
    user?.uid === "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";

  const strengthOptions = programmes.filter(
    (p) => (p.tag || "").toLowerCase() !== "cardio" && (p.tag || "").toLowerCase() !== "walk"
  );
  const cardioOptions = programmes.filter(
    (p) =>
      (p.tag || "").toLowerCase() === "cardio" ||
      (p.tag || "").toLowerCase() === "walk" ||
      p.repeating
  );

  // Programme groups for "All Programmes"
  const strengthProgs = programmes.filter(
    (p) => (p.tag || "").toLowerCase() !== "cardio" && (p.tag || "").toLowerCase() !== "walk"
  );
  const cardioProgs = programmes.filter(
    (p) =>
      (p.tag || "").toLowerCase() === "cardio" || (p.tag || "").toLowerCase() === "walk"
  );

  const weekStatus = [
    {
      type: "strength",
      icon: "🏋️",
      label: "Strength",
      done: weeklyLogs.strength,
      target: WEEKLY_TARGETS.strength,
      programme: strengthProgramme,
    },
    {
      type: "cardio",
      icon: "🏃",
      label: "Cardio",
      done: weeklyLogs.cardio,
      target: WEEKLY_TARGETS.cardio,
      programme: cardioProgramme,
    },
    {
      type: "mobility",
      icon: "🧘",
      label: "Mobility",
      done: weeklyLogs.mobility,
      target: WEEKLY_TARGETS.mobility,
      programme: null,
      comingSoon: true,
    },
    {
      type: "classes",
      icon: "🏛️",
      label: "Classes",
      done: weeklyClassCount,
      target: 2,
      programme: null,
      isClasses: true,
    },
  ];

  const totalDone = weeklyLogs.strength + weeklyLogs.cardio + weeklyLogs.mobility + weeklyClassCount;
  const totalTarget = WEEKLY_TARGETS.strength + WEEKLY_TARGETS.cardio + WEEKLY_TARGETS.mobility + 2;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <PortalNav />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)",
          padding: "16px 20px 36px",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            margin: "0 0 16px",
          }}
        >
          Training
        </p>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>
          This Week
        </h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
          {totalDone} of {totalTarget} sessions complete
        </p>
      </div>

      <div
        style={{
          height: 24,
          background: "#f7f5f2",
          borderRadius: "24px 24px 0 0",
          marginTop: -24,
        }}
      />

      {/* ── Custom Workouts (top position — if user has saved workouts) ───── */}
      {customWorkoutCount > 0 && (
      <div style={{ padding: "0 16px 16px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", margin: "0 0 10px" }}>
          Custom Workouts
        </p>
        <Link to="/my-workouts" style={{ textDecoration: "none", display: "block" }}>
          <div style={{
            background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)",
            borderRadius: "20px",
            padding: "22px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "16px",
              backgroundColor: "rgba(255,255,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, flexShrink: 0,
            }}>
              🏗️
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>My Workouts</p>
              <p style={{ fontSize: 13, color: "#9fe1cb", margin: 0 }}>{customWorkoutCount} saved workout{customWorkoutCount === 1 ? "" : "s"}</p>
            </div>
            <div style={{ backgroundColor: "#4ade80", color: "#1a3a2a", fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 10, flexShrink: 0 }}>
              Open →
            </div>
          </div>
        </Link>
      </div>
      )}

      {/* ── My Week ───────────────────────────────────────────────────────── */}
      <div style={{ padding: "0 16px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#aaa",
              margin: 0,
            }}
          >
            My Week
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {weekStatus.map((item) => {
            const remaining = item.target - item.done;
            const complete = item.done >= item.target;
            return (
              <div
                key={item.type}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "16px",
                  border: `0.5px solid ${complete ? "#86efac" : "#e5e5e5"}`,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "14px 16px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "20px" }}>{item.icon}</span>
                      <div>
                        <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>
                          {item.label}
                        </p>
                        <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>
                          {item.comingSoon
                            ? "Coming soon"
                            : complete
                            ? "Week complete"
                            : `${remaining} more this week`}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {Array.from({ length: item.target }).map((_, i) => (
                        <div
                          key={i}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            backgroundColor: i < item.done ? "#2d6a4f" : "#f0f0f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {i < item.done && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path
                                d="M2 6l3 3 5-5"
                                stroke="#fff"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {!item.comingSoon &&
                    (item.isClasses ? (
                      <Link
                        to="/classes"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          backgroundColor: "#f7f5f2",
                          borderRadius: "10px",
                          padding: "10px 12px",
                          textDecoration: "none",
                        }}
                      >
                        <p style={{ fontSize: "12px", fontWeight: 700, color: "#111", margin: 0 }}>
                          View full timetable
                        </p>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#2d6a4f" }}>→</span>
                      </Link>
                    ) : item.programme ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          backgroundColor: "#f7f5f2",
                          borderRadius: "10px",
                          padding: "10px 12px",
                        }}
                      >
                        <div>
                          <p style={{ fontSize: "12px", fontWeight: 700, color: "#111", margin: 0 }}>
                            {item.programme.name}
                          </p>
                          <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>
                            Active programme
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectingType(item.type)}
                          style={{
                            background: "none",
                            border: "none",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#2d6a4f",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectingType(item.type)}
                        style={{
                          width: "100%",
                          padding: "10px",
                          borderRadius: "10px",
                          border: "1.5px dashed #e5e5e5",
                          background: "none",
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#2d6a4f",
                          cursor: "pointer",
                        }}
                      >
                        + Select {item.label} Programme
                      </button>
                    ))}
                </div>

                {!item.comingSoon && (
                  <div style={{ height: "3px", backgroundColor: "#f0f0f0" }}>
                    <div
                      style={{
                        height: "3px",
                        backgroundColor: complete ? "#4ade80" : "#2d6a4f",
                        width: `${Math.min((item.done / item.target) * 100, 100)}%`,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Custom Workouts (lower position — no saved workouts yet) ─────── */}
      {customWorkoutCount === 0 && <div style={{ padding: "0 16px 16px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", margin: "0 0 10px" }}>
          Custom Workouts
        </p>
        {features.isPremium ? (
          <Link to="/my-workouts" style={{ textDecoration: "none", display: "block" }}>
            <div style={{
              background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)",
              borderRadius: "20px",
              padding: "22px 20px",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: "16px",
                backgroundColor: "rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, flexShrink: 0,
              }}>
                🏗️
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>My Workouts</p>
                <p style={{ fontSize: 13, color: "#9fe1cb", margin: 0 }}>Build, save and run your own sessions</p>
              </div>
              <div style={{ backgroundColor: "#4ade80", color: "#1a3a2a", fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 10, flexShrink: 0 }}>
                Open →
              </div>
            </div>
          </Link>
        ) : (
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "20px",
            border: "0.5px solid #e5e5e5",
            overflow: "hidden",
          }}>
            {/* Hero */}
            <div style={{
              background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)",
              padding: "22px 20px 20px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "14px",
                  backgroundColor: "rgba(255,255,255,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, flexShrink: 0,
                }}>
                  🏗️
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#9fe1cb", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 3px" }}>Premium</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>Build Your Own Workouts</p>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: 0, lineHeight: 1.5 }}>
                Train exactly how you want. Pick your exercises, sets, reps and rest. Save it. Run it anytime.
              </p>
            </div>
            {/* Benefits */}
            <div style={{ padding: "16px 20px" }}>
              {[
                ["💪", "Any exercise from the full library"],
                ["📋", "Unlimited saved workouts"],
                ["📈", "Personal bests tracked automatically"],
                ["⚡", "Start a session in seconds"],
              ].map(([icon, text]) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "#111", margin: 0 }}>{text}</p>
                </div>
              ))}
              <button
                onClick={() => setShowUpgradeGate(true)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: "15px",
                  borderRadius: "14px",
                  border: "none",
                  backgroundColor: "#2d6a4f",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Upgrade to Premium for €19.99/month
              </button>
              <p style={{ fontSize: 11, color: "#aaa", textAlign: "center", margin: "10px 0 0" }}>Cancel anytime</p>
            </div>
          </div>
        )}
      </div>}

      {/* ── Upcoming Classes ──────────────────────────────────────────────── */}
      {classes.length > 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#aaa",
              marginBottom: "10px",
            }}
          >
            Upcoming Classes
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {classes.map((cls) => {
              const isStrength = cls.type === "strength";
              const isConditioning = cls.type === "conditioning";
              const icon = isStrength ? "🏋️" : isConditioning ? "🔥" : "🚴";
              const color = isStrength ? "#2d6a4f" : isConditioning ? "#b45309" : "#0369a1";
              const bg = isStrength ? "#eaf5ef" : isConditioning ? "#fffbeb" : "#e0f2fe";
              const dateLabel = new Date(cls.date + "T12:00:00").toLocaleDateString("en-IE", {
                weekday: "long",
                day: "numeric",
                month: "short",
              });
              const cardContent = (
                <div
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: "14px",
                    border: `0.5px solid ${isStrength ? "#86efac" : "#e5e5e5"}`,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "12px",
                      backgroundColor: bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>
                      {cls.title}
                    </p>
                    <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>
                      {dateLabel} · {cls.time} · {cls.duration} min
                    </p>
                  </div>
                  {isStrength ? (
                    <div
                      style={{
                        backgroundColor: color,
                        color: "#fff",
                        fontSize: "12px",
                        fontWeight: 700,
                        padding: "6px 12px",
                        borderRadius: "8px",
                      }}
                    >
                      Log →
                    </div>
                  ) : (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#aaa",
                        backgroundColor: "#f0f0f0",
                        padding: "4px 10px",
                        borderRadius: "20px",
                      }}
                    >
                      {isConditioning ? "Surprise" : "Spin"}
                    </span>
                  )}
                </div>
              );
              return isStrength ? (
                <Link
                  key={cls.id}
                  to={`/class/${cls.id}`}
                  style={{ textDecoration: "none", display: "block" }}
                >
                  {cardContent}
                </Link>
              ) : (
                <div key={cls.id}>{cardContent}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── AI Tools ──────────────────────────────────────────────────────── */}
      <div style={{ padding: "0 16px 16px" }}>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#aaa",
            marginBottom: "10px",
          }}
        >
          AI Tools
        </p>
        {isPremium ? (
          <Link to="/ai-running-plan" style={{ textDecoration: "none", display: "block" }}>
            <div
              style={{
                background: "linear-gradient(135deg, #0d2b1f 0%, #1a3a2a 50%, #2d6a4f 100%)",
                borderRadius: "16px",
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "14px",
                  backgroundColor: "rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "26px",
                  flexShrink: 0,
                }}
              >
                🤖
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: "0 0 3px" }}>
                  AI Running Plan
                </p>
                <p style={{ fontSize: "12px", color: "#9fe1cb", margin: 0 }}>
                  Personalised to your goals, fitness and race date
                </p>
              </div>
              <div
                style={{
                  backgroundColor: "#4ade80",
                  color: "#1a3a2a",
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "6px 12px",
                  borderRadius: "8px",
                  flexShrink: 0,
                }}
              >
                Generate →
              </div>
            </div>
          </Link>
        ) : (
          <div
            style={{
              background: "linear-gradient(135deg, #0d2b1f 0%, #1a3a2a 50%, #2d6a4f 100%)",
              borderRadius: "16px",
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              opacity: 0.7,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "14px",
                backgroundColor: "rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "26px",
                flexShrink: 0,
              }}
            >
              🤖
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: "0 0 3px" }}>
                AI Running Plan
              </p>
              <p style={{ fontSize: "12px", color: "#9fe1cb", margin: 0 }}>
                Personalised to your goals, fitness and race date
              </p>
            </div>
            <div
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                color: "#fff",
                fontSize: "11px",
                fontWeight: 700,
                padding: "6px 12px",
                borderRadius: "8px",
                flexShrink: 0,
              }}
            >
              Premium
            </div>
          </div>
        )}
      </div>

      {/* ── All Programmes ────────────────────────────────────────────────── */}
      <div style={{ padding: "0 16px 16px" }}>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#aaa",
            marginBottom: 4,
          }}
        >
          All Programmes
        </p>

        {loading ? (
          <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>Loading...</p>
        ) : (
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              border: "0.5px solid #e5e5e5",
              padding: "0 16px",
            }}
          >
            <ProgrammeGroup
              title="Strength"
              programmes={strengthProgs}
              isPremiumUser={isPremium}
              defaultOpen={!!userData?.strengthProgrammeId}
            />
            {strengthProgs.length > 0 && cardioProgs.length > 0 && (
              <div style={{ height: "0.5px", backgroundColor: "#f0f0f0" }} />
            )}
            <ProgrammeGroup
              title="Cardio & Walking"
              programmes={cardioProgs}
              isPremiumUser={isPremium}
              defaultOpen={!!userData?.cardioProgrammeId && !userData?.strengthProgrammeId}
            />
          </div>
        )}
      </div>

      {/* ── Coming Soon ────────────────────────�