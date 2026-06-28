import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import PortalNav from "../components/PortalNav";

const CLASS_TYPES = {
  strength:     { icon: "🏋️", color: "#2d6a4f", bg: "#eaf5ef", border: "#86efac", label: "Strength" },
  conditioning: { icon: "🔥", color: "#b45309", bg: "#fffbeb", border: "#fcd34d", label: "Conditioning" },
  spin:         { icon: "🚴", color: "#0369a1", bg: "#e0f2fe", border: "#7dd3fc", label: "Spin" },
  other:        { icon: "⚡", color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd", label: "Other" },
};

function classEndTime(c) {
  const start = new Date(`${c.date}T${c.time || "00:00"}:00`);
  return new Date(start.getTime() + (c.duration || 0) * 60000);
}

function classDateTime(cls) {
  return new Date(`${cls.date}T${cls.time || "00:00"}:00`);
}

function groupByWeek(classes) {
  const groups = {};
  classes.forEach(cls => {
    const d = new Date(cls.date + "T12:00:00");
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    mon.setHours(0, 0, 0, 0);
    const key = mon.toISOString();
    if (!groups[key]) groups[key] = { monday: mon, classes: [] };
    groups[key].classes.push(cls);
  });
  return Object.values(groups).sort((a, b) => a.monday - b.monday);
}

function weekLabel(monday) {
  const now = new Date();
  const thisMonday = new Date(now);
  const day = now.getDay();
  thisMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  thisMonday.setHours(0, 0, 0, 0);
  const diff = Math.round((monday - thisMonday) / 86400000);
  if (diff === 0) return "This week";
  if (diff === 7) return "Next week";
  return monday.toLocaleDateString("en-IE", { day: "numeric", month: "long" });
}

const emptyCustomForm = {
  title: "",
  type: "other",
  date: new Date().toISOString().split("T")[0],
  time: new Date().toTimeString().slice(0, 5),
  duration: "",
};

export default function Classes() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [attendedIds, setAttendedIds] = useState(new Set());
  const [customLogs, setCustomLogs] = useState([]); // user-created class logs
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");
  const [showCustomSheet, setShowCustomSheet] = useState(false);
  const [customForm, setCustomForm] = useState(emptyCustomForm);
  const [savingCustom, setSavingCustom] = useState(false);
  const [markingId, setMarkingId] = useState(null); // classId being marked

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);

      const [classSnap, logSnap] = await Promise.all([
        getDocs(collection(db, "classes")),
        getDocs(query(collection(db, "classLogs"), where("userId", "==", u.uid))),
      ]);

      const allClasses = classSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.published !== false && c.date);
      setClasses(allClasses.sort((a, b) => classDateTime(a) - classDateTime(b)));

      const logs = logSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAttendedIds(new Set(logs.filter(l => l.classId).map(l => l.classId)));
      setCustomLogs(logs.filter(l => l.userCreated));
      setLoading(false);
    });
    return () => unsub();
  }, [navigate]);

  const markAttended = async (cls) => {
    if (!user || markingId) return;
    setMarkingId(cls.id);
    try {
      await addDoc(collection(db, "classLogs"), {
        userId: user.uid,
        classId: cls.id,
        classTitle: cls.title,
        classType: cls.type,
        logs: {},
        completedAt: new Date().toISOString(),
      });
      setAttendedIds(prev => new Set([...prev, cls.id]));
    } catch (e) { console.error(e); }
    setMarkingId(null);
  };

  const saveCustomClass = async () => {
    if (!user || !customForm.title.trim()) return;
    setSavingCustom(true);
    try {
      const completedAt = customForm.date && customForm.time
        ? new Date(`${customForm.date}T${customForm.time}:00`).toISOString()
        : new Date().toISOString();
      const ref = await addDoc(collection(db, "classLogs"), {
        userId: user.uid,
        userCreated: true,
        classTitle: customForm.title.trim(),
        classType: customForm.type,
        duration: customForm.duration ? parseInt(customForm.duration) : null,
        logs: {},
        completedAt,
      });
      setCustomLogs(prev => [...prev, { id: ref.id, userCreated: true, classTitle: customForm.title.trim(), classType: customForm.type, duration: customForm.duration ? parseInt(customForm.duration) : null, completedAt }]);
      setCustomForm(emptyCustomForm);
      setShowCustomSheet(false);
      setTab("past"); // show them the result
    } catch (e) { console.error(e); }
    setSavingCustom(false);
  };

  const now = new Date();
  const upcoming = classes.filter(c => classEndTime(c) > now);
  const past = classes.filter(c => classEndTime(c) <= now).reverse();
  const upcomingGroups = groupByWeek(upcoming);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#aaa", fontSize: "14px" }}>Loading classes...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <PortalNav />

      {/* HEADER */}
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 36px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 16px" }}>Training for Life</p>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>Classes</h1>
            <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>Strength, conditioning and spin</p>
          </div>
          <button
            onClick={() => setShowCustomSheet(true)}
            style={{ backgroundColor: "rgba(255,255,255,0.15)", border: "none", borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: 700, color: "#fff", cursor: "pointer", flexShrink: 0 }}
          >
            + Log a class
          </button>
        </div>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      {/* TABS */}
      <div style={{ display: "flex", padding: "0 16px", borderBottom: "1px solid #e5e5e5", marginBottom: "16px" }}>
        {["upcoming", "past"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 16px", border: "none", background: "none", fontSize: "13px", fontWeight: 700, color: tab === t ? "#2d6a4f" : "#aaa", borderBottom: tab === t ? "2px solid #2d6a4f" : "2px solid transparent", cursor: "pointer", textTransform: "capitalize" }}>
            {t}
          </button>
        ))}
      </div>

      {/* UPCOMING */}
      {tab === "upcoming" && (
        <div style={{ padding: "0 16px" }}>
          {upcomingGroups.length === 0 ? (
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "40px 24px", textAlign: "center" }}>
              <p style={{ fontSize: "32px", margin: "0 0 12px" }}>📅</p>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No upcoming classes</p>
              <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Check back soon, classes are added weekly.</p>
            </div>
          ) : (
            upcomingGroups.map(group => (
              <div key={group.monday.toISOString()} style={{ marginBottom: "24px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", margin: "0 0 10px" }}>
                  {weekLabel(group.monday)}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {group.classes.map(cls => (
                    <ClassCard
                      key={cls.id}
                      cls={cls}
                      attended={attendedIds.has(cls.id)}
                      marking={markingId === cls.id}
                      onMarkAttended={() => markAttended(cls)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* PAST */}
      {tab === "past" && (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* User-created class logs */}
          {customLogs.length > 0 && (
            <>
              <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", margin: "0 0 2px" }}>Your logged classes</p>
              {customLogs.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).map(log => {
                const t = CLASS_TYPES[log.classType] || CLASS_TYPES.other;
                const dateLabel = new Date(log.completedAt).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
                return (
                  <div key={log.id} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: t.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>{t.icon}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{log.classTitle}</p>
                      <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>{dateLabel}{log.duration ? ` · ${log.duration} min` : ""}</p>
                    </div>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="#2d6a4f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                );
              })}
              {past.length > 0 && <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", margin: "8px 0 2px" }}>TFL classes</p>}
            </>
          )}

          {past.length === 0 && customLogs.length === 0 ? (
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "40px 24px", textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>No past classes yet.</p>
            </div>
          ) : (
            past.map(cls => (
              <ClassCard
                key={cls.id}
                cls={cls}
                attended={attendedIds.has(cls.id)}
                past
                marking={markingId === cls.id}
                onMarkAttended={() => markAttended(cls)}
              />
            ))
          )}
        </div>
      )}

      {/* LOG CUSTOM CLASS SHEET */}
      {showCustomSheet && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setShowCustomSheet(false); setCustomForm(emptyCustomForm); } }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
        >
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Log a class</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>Did a Hyrox, yoga, or anything else? Log it here and it counts.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Class name</label>
                <input
                  type="text"
                  placeholder="e.g. Hyrox, Yoga, Pilates..."
                  value={customForm.title}
                  onChange={e => setCustomForm(f => ({ ...f, title: e.target.value }))}
                  style={{ width: "100%", padding: "13px 14px", borderRadius: "10px", border: "1px solid #e5e5e5", fontSize: "15px", color: "#111", backgroundColor: "#fafafa", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "8px" }}>Type</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {Object.entries(CLASS_TYPES).map(([key, t]) => (
                    <button
                      key={key}
                      onClick={() => setCustomForm(f => ({ ...f, type: key }))}
                      style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "10px", border: `1.5px solid ${customForm.type === key ? t.color : "#e5e5e5"}`, backgroundColor: customForm.type === key ? t.bg : "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: customForm.type === key ? t.color : "#555" }}
                    >
                      <span>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Date</label>
                  <input
                    type="date"
                    value={customForm.date}
                    onChange={e => setCustomForm(f => ({ ...f, date: e.target.value }))}
                    style={{ width: "100%", padding: "13px 14px", borderRadius: "10px", border: "1px solid #e5e5e5", fontSize: "14px", color: "#111", backgroundColor: "#fafafa", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Duration (min)</label>
                  <input
                    type="number"
                    placeholder="e.g. 60"
                    value={customForm.duration}
                    onChange={e => setCustomForm(f => ({ ...f, duration: e.target.value }))}
                    style={{ width: "100%", padding: "13px 14px", borderRadius: "10px", border: "1px solid #e5e5e5", fontSize: "15px", color: "#111", backgroundColor: "#fafafa", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <button
                onClick={saveCustomClass}
                disabled={savingCustom || !customForm.title.trim()}
                style={{ backgroundColor: savingCustom || !customForm.title.trim() ? "#aaa" : "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: savingCustom || !customForm.title.trim() ? "not-allowed" : "pointer" }}
              >
                {savingCustom ? "Saving..." : "Log class"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClassCard({ cls, attended, past, marking, onMarkAttended }) {
  const type = CLASS_TYPES[cls.type] || CLASS_TYPES.strength;
  const isStrength = cls.type === "strength";
  const dateLabel = new Date(cls.date + "T12:00:00").toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "short" });
  const isToday = cls.date === new Date().toISOString().split("T")[0];

  const rightSlot = (() => {
    if (attended) {
      return (
        <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="#2d6a4f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      );
    }
    if (isStrength && !past) {
      return <div style={{ backgroundColor: type.color, color: "#fff", fontSize: "12px", fontWeight: 700, padding: "6px 12px", borderRadius: "8px", flexShrink: 0 }}>Log →</div>;
    }
    // Conditioning / spin — either past or today after class started
    const classStarted = classEndTime(cls) <= new Date() || isToday;
    if (!isStrength && (past || classStarted)) {
      return (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMarkAttended(); }}
          disabled={marking}
          style={{ backgroundColor: marking ? "#f0f0f0" : type.bg, color: marking ? "#aaa" : type.color, border: `1.5px solid ${type.border}`, fontSize: "11px", fontWeight: 700, padding: "6px 10px", borderRadius: "8px", cursor: marking ? "not-allowed" : "pointer", flexShrink: 0 }}
        >
          {marking ? "..." : "Attended"}
        </button>
      );
    }
    // Upcoming non-strength — show type label
    return (
      <span style={{ fontSize: "11px", fontWeight: 700, color: type.color, backgroundColor: type.bg, padding: "4px 10px", borderRadius: "20px", flexShrink: 0 }}>
        {type.label}
      </span>
    );
  })();

  const card = (
    <div style={{
      backgroundColor: "#fff",
      borderRadius: "14px",
      border: `0.5px solid ${isToday ? type.border : "#e5e5e5"}`,
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      opacity: past && !attended ? 0.65 : 1,
    }}>
      <div style={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: type.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
        {type.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{cls.title}</p>
          {isToday && <span style={{ fontSize: "10px", fontWeight: 700, backgroundColor: type.color, color: "#fff", padding: "2px 7px", borderRadius: "10px" }}>TODAY</span>}
        </div>
        <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>{dateLabel} · {cls.time} · {cls.duration} min</p>
      </div>
      {rightSlot}
    </div>
  );

  if (isStrength) {
    return <Link to={`/class/${cls.id}`} style={{ textDecoration: "none", display: "block" }}>{card}</Link>;
  }
  return card;
}
   