import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import PortalNav from "../components/PortalNav";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getStreak(logs, habitId) {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const log = logs[dateStr];
    if (log && log[habitId]) {
      streak++;
    } else if (i === 0) {
      // today not done yet, skip
    } else {
      break;
    }
  }
  return streak;
}

export default function Habits() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [habitLogs, setHabitLogs] = useState({});
  const [proteinToday, setProteinToday] = useState(0);
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [tapping, setTapping] = useState(null);

  const today = getToday();
  const weekDates = getWeekDates();
  const todayLog = habitLogs[today] || {};

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);

      // Load user data
      const userSnap = await getDoc(doc(db, "users", u.uid));
      if (userSnap.exists()) setUserData(userSnap.data());

      // Load habit logs for this user
      const habitsSnap = await getDoc(doc(db, "habitLogs", u.uid));
      if (habitsSnap.exists()) {
        const data = habitsSnap.data();
        setHabitLogs(data.logs || {});
        // Load today's water glasses
        const todayData = (data.logs || {})[getToday()];
        if (todayData?.waterGlasses) setWaterGlasses(todayData.waterGlasses);
      }

      // Load today's nutrition to auto-check protein
      const nutritionSnap = await getDoc(doc(db, "nutritionLogs", `${u.uid}_${getToday()}`));
      if (nutritionSnap.exists()) {
        const meals = nutritionSnap.data().meals || {};
        const allFoods = Object.values(meals).flat();
        const totalProtein = allFoods.reduce((s, f) => s + (f.protein || 0), 0);
        setProteinToday(Math.round(totalProtein * 10) / 10);
      }

      setLoading(false);
    });
    return () => unsub();
  }, [navigate]);

  const saveLog = async (newLogs) => {
    if (!user) return;
    await setDoc(doc(db, "habitLogs", user.uid), {
      userId: user.uid,
      logs: newLogs,
      updatedAt: new Date().toISOString(),
    });
  };

  const toggleHabit = async (habitId) => {
    setTapping(habitId);
    setTimeout(() => setTapping(null), 400);

    const newLogs = {
      ...habitLogs,
      [today]: {
        ...todayLog,
        [habitId]: !todayLog[habitId],
      },
    };
    setHabitLogs(newLogs);
    await saveLog(newLogs);
  };

  const updateWater = async (glasses) => {
    const clamped = Math.max(0, Math.min(10, glasses));
    setWaterGlasses(clamped);
    const waterDone = clamped >= 8;
    const newLogs = {
      ...habitLogs,
      [today]: {
        ...todayLog,
        water: waterDone,
        waterGlasses: clamped,
      },
    };
    setHabitLogs(newLogs);
    await saveLog(newLogs);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "100px" }}>
      <PortalNav />
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
    </div>
  );

  const proteinTarget = userData?.nutritionTargets?.protein || 0;
  const proteinPct = proteinTarget > 0 ? Math.min((proteinToday / proteinTarget) * 100, 100) : 0;
  const proteinAuto = proteinTarget > 0 && proteinToday >= proteinTarget;

  const habits = [
    {
      id: "sleep",
      icon: "😴",
      label: "Sleep",
      description: "I got a good night's sleep",
      detail: "7+ hours of quality rest",
      color: "#7c3aed",
      bg: "#f5f3ff",
      border: "#c4b5fd",
      manual: true,
    },
    {
      id: "water",
      icon: "💧",
      label: "Water",
      description: "I stayed well hydrated today",
      detail: "8 glasses of water",
      color: "#0369a1",
      bg: "#e0f2fe",
      border: "#7dd3fc",
      manual: false,
    },
    {
      id: "protein",
      icon: "🥩",
      label: "Protein",
      description: proteinTarget > 0 ? `Hit your ${proteinTarget}g protein target` : "Hit your protein target today",
      detail: proteinTarget > 0 ? `${proteinToday}g of ${proteinTarget}g logged` : "Set up nutrition targets to track",
      color: "#2d6a4f",
      bg: "#eaf5ef",
      border: "#86efac",
      manual: proteinTarget === 0,
      auto: proteinAuto,
    },
  ];

  const allDone = habits.every(h => {
    if (h.id === "protein" && proteinAuto) return true;
    if (h.id === "water") return todayLog.water;
    return todayLog[h.id];
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "120px" }}>
      <PortalNav />

      {/* HEADER */}
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 36px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 16px" }}>Habits</p>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>
          {allDone ? "Perfect day. 🔥" : "Build your daily habits"}
        </h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
          {new Date().toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      <div style={{ padding: "0 16px" }}>

        {/* TODAY'S HABITS */}
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Today</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
          {habits.map(habit => {
            const isDone = habit.id === "protein" && proteinAuto ? true : todayLog[habit.id];
            const isTapping = tapping === habit.id;

            return (
              <div key={habit.id}>
                <div
                  onClick={() => !habit.auto && toggleHabit(habit.id)}
                  style={{
                    backgroundColor: isDone ? habit.bg : "#fff",
                    borderRadius: "16px",
                    border: `1.5px solid ${isDone ? habit.border : "#e5e5e5"}`,
                    padding: "16px",
                    cursor: habit.auto ? "default" : "pointer",
                    transform: isTapping ? "scale(0.97)" : "scale(1)",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                  }}
                >
                  {/* Icon */}
                  <div style={{ width: 52, height: 52, borderRadius: "14px", backgroundColor: isDone ? habit.color : "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", flexShrink: 0, transition: "background 0.3s ease" }}>
                    {isDone ? "✓" : habit.icon}
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: isDone ? habit.color : "#111", margin: "0 0 2px" }}>{habit.label}</p>
                    <p style={{ fontSize: "13px", color: isDone ? habit.color : "#888", margin: 0, opacity: isDone ? 0.8 : 1 }}>{habit.description}</p>
                    {habit.detail && (
                      <p style={{ fontSize: "11px", color: isDone ? habit.color : "#aaa", margin: "3px 0 0", opacity: 0.8 }}>{habit.detail}</p>
                    )}
                  </div>

                  {/* Status */}
                  <div style={{ flexShrink: 0 }}>
                    {isDone ? (
                      <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: habit.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 7l4 4 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #e5e5e5" }} />
                    )}
                  </div>
                </div>

                {/* Water glasses tracker */}
                {habit.id === "water" && (
                  <div style={{ backgroundColor: "#fff", borderRadius: "0 0 16px 16px", border: "1.5px solid #e5e5e5", borderTop: "none", padding: "12px 16px", marginTop: "-4px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: 0 }}>Glasses today</p>
                      <p style={{ fontSize: "12px", color: "#aaa", margin: 0 }}>{waterGlasses} / 8</p>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <button onClick={() => updateWater(waterGlasses - 1)} style={{ width: 32, height: 32, borderRadius: "50%", border: "1.5px solid #e5e5e5", backgroundColor: "#f7f5f2", fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}>
                        -
                      </button>
                      <div style={{ flex: 1, display: "flex", gap: "4px" }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div
                            key={i}
                            onClick={() => updateWater(i + 1)}
                            style={{ flex: 1, height: 28, borderRadius: "6px", backgroundColor: i < waterGlasses ? "#0369a1" : "#f0f0f0", cursor: "pointer", transition: "background 0.2s ease" }}
                          />
                        ))}
                      </div>
                      <button onClick={() => updateWater(waterGlasses + 1)} style={{ width: 32, height: 32, borderRadius: "50%", border: "1.5px solid #0369a1", backgroundColor: "#e0f2fe", fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#0369a1", fontWeight: 700 }}>
                        +
                      </button>
                    </div>
                    <p style={{ fontSize: "11px", color: "#aaa", margin: "6px 0 0", textAlign: "center" }}>
                      {waterGlasses >= 8 ? "🎉 Hydration goal hit!" : `${8 - waterGlasses} more to go`}
                    </p>
                  </div>
                )}

                {/* Protein progress bar */}
                {habit.id === "protein" && proteinTarget > 0 && (
                  <div style={{ backgroundColor: "#fff", borderRadius: "0 0 16px 16px", border: "1.5px solid #e5e5e5", borderTop: "none", padding: "12px 16px", marginTop: "-4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: 0 }}>From nutrition log</p>
                      <p style={{ fontSize: "12px", color: proteinAuto ? "#2d6a4f" : "#aaa", fontWeight: proteinAuto ? 700 : 400, margin: 0 }}>{proteinToday}g / {proteinTarget}g</p>
                    </div>
                    <div style={{ height: "6px", backgroundColor: "#f0f0f0", borderRadius: "3px" }}>
                      <div style={{ height: "6px", backgroundColor: proteinAuto ? "#4ade80" : "#2d6a4f", borderRadius: "3px", width: `${proteinPct}%`, transition: "width 0.5s ease" }} />
                    </div>
                    {!proteinAuto && (
                      <p style={{ fontSize: "11px", color: "#aaa", margin: "6px 0 0", textAlign: "center" }}>
                        Log food in Nutrition to track automatically
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* WEEKLY VIEW */}
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>This Week</p>
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "16px" }}>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "80px repeat(7, 1fr)", gap: "4px", marginBottom: "10px" }}>
            <div />
            {weekDates.map((date, i) => {
              const isToday = date === today;
              return (
                <div key={i} style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "10px", fontWeight: 700, color: isToday ? "#2d6a4f" : "#aaa", margin: 0 }}>{DAYS[i]}</p>
                  <p style={{ fontSize: "11px", fontWeight: isToday ? 700 : 400, color: isToday ? "#2d6a4f" : "#888", margin: "2px 0 0" }}>
                    {new Date(date).getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Habit rows */}
          {habits.map(habit => (
            <div key={habit.id} style={{ display: "grid", gridTemplateColumns: "80px repeat(7, 1fr)", gap: "4px", marginBottom: "8px", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "14px" }}>{habit.icon}</span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#555" }}>{habit.label}</span>
              </div>
              {weekDates.map((date, i) => {
                const log = habitLogs[date] || {};
                const done = habit.id === "protein" && date === today && proteinAuto ? true : log[habit.id];
                const isFuture = date > today;
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "center" }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      backgroundColor: isFuture ? "transparent" : done ? habit.color : "#f0f0f0",
                      border: isFuture ? "1.5px dashed #e5e5e5" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {done && !isFuture && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* STREAKS */}
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Streaks</p>
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
          {habits.map(habit => {
            const streak = getStreak(habitLogs, habit.id);
            return (
              <div key={habit.id} style={{ flex: 1, backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 12px", textAlign: "center" }}>
                <span style={{ fontSize: "20px" }}>{habit.icon}</span>
                <p style={{ fontSize: "22px", fontWeight: 700, color: streak > 0 ? habit.color : "#aaa", margin: "6px 0 2px", lineHeight: 1 }}>
                  {streak > 0 ? `🔥${streak}` : "—"}
                </p>
                <p style={{ fontSize: "10px", fontWeight: 700, color: "#aaa", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{habit.label}</p>
                <p style={{ fontSize: "10px", color: "#ccc", margin: "2px 0 0" }}>{streak === 1 ? "1 day" : streak > 1 ? `${streak} days` : "Not started"}</p>
              </div>
            );
          })}
        </div>

        {/* Coaching tip */}
        <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "16px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Coach's Note</p>
          <p style={{ fontSize: "14px", color: "#fff", margin: 0, lineHeight: 1.6 }}>
            {allDone
              ? "Brilliant. You've nailed all three today. These small daily wins are what build lasting capability. Keep it going."
              : "Sleep, water and protein are the foundation of everything. Get these three right consistently and your training will take care of itself."}
          </p>
        </div>
      </div>
    </div>
  );
}