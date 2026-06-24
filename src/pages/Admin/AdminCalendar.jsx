import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";

const CLASS_COLORS = {
  strength:     { color: "#1a3a2a", bg: "#eaf5ef" },
  conditioning: { color: "#b45309", bg: "#fffbeb" },
  spin:         { color: "#0369a1", bg: "#e0f2fe" },
  other:        { color: "#7c3aed", bg: "#f5f3ff" },
};

const SESSION_STATUS = {
  scheduled:      { color: "#0369a1", bg: "#e0f2fe" },
  completed:      { color: "#166534", bg: "#dcfce7" },
  no_show:        { color: "#9a3412", bg: "#fee2e2" },
  late_cancelled: { color: "#92400e", bg: "#fef3c7" },
  cancelled:      { color: "#6b7280", bg: "#f3f4f6" },
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date) {
  return date.toISOString().split("T")[0];
}

function toDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

function EventPill({ event, onClick }) {
  let color, bg, icon;
  if (event.type === "session") {
    const st = SESSION_STATUS[event.status] || SESSION_STATUS.scheduled;
    color = st.color; bg = st.bg; icon = "📅";
  } else if (event.type === "class") {
    const ct = CLASS_COLORS[event.classType] || CLASS_COLORS.other;
    color = ct.color; bg = ct.bg; icon = "🏛️";
  } else {
    color = event.replied ? "#166534" : "#92400e";
    bg = event.replied ? "#dcfce7" : "#fef3c7";
    icon = "📋";
  }
  return (
    <div onClick={onClick} style={{ backgroundColor: bg, borderRadius: "8px", padding: "5px 8px", marginBottom: "4px", cursor: "pointer", border: `1px solid ${color}20` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <span style={{ fontSize: "10px" }}>{icon}</span>
        <span style={{ fontSize: "11px", fontWeight: 700, color, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {event.label}
        </span>
        {event.time && <span style={{ fontSize: "10px", color, opacity: 0.7, flexShrink: 0 }}>{event.time}</span>}
      </div>
      {event.sub && (
        <p style={{ fontSize: "10px", color, margin: "1px 0 0 18px", opacity: 0.75, textTransform: "capitalize" }}>{event.sub}</p>
      )}
    </div>
  );
}

export default function AdminCalendar() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [sessSnap, classSnap, checkSnap, clientSnap] = await Promise.all([
        getDocs(collection(db, "sessions")),
        getDocs(collection(db, "classes")),
        getDocs(collection(db, "checkIns")),
        getDocs(collection(db, "users")),
      ]);
      setSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCheckIns(checkSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setClients(
        clientSnap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(c => c.uid !== ADMIN_UID)
      );
    } finally {
      setLoading(false);
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = toDateStr(new Date());
  const isThisWeek = toDateStr(weekStart) === toDateStr(getMonday(new Date()));

  function clientName(uid) {
    const c = clients.find(c => c.uid === uid);
    return c?.firstName || c?.displayName || uid?.slice(0, 6) || "Client";
  }

  function eventsForDay(day) {
    const dayStr = toDateStr(day);
    const events = [];

    sessions.forEach(s => {
      const d = toDate(s.date);
      if (!d || toDateStr(d) !== dayStr) return;
      events.push({
        type: "session",
        id: s.id,
        time: s.time || d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" }),
        label: clientName(s.clientId),
        sub: s.type || "session",
        status: s.status || "scheduled",
        sortKey: s.time || "00:00",
      });
    });

    classes.forEach(c => {
      if (c.date !== dayStr) return;
      events.push({
        type: "class",
        id: c.id,
        time: c.time || "",
        label: c.title || c.type,
        sub: c.type,
        classType: c.type,
        published: c.published,
        sortKey: c.time || "00:00",
      });
    });

    checkIns.forEach(ci => {
      const d = toDate(ci.submittedAt);
      if (!d || toDateStr(d) !== dayStr) return;
      const t = d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
      events.push({
        type: "checkin",
        id: ci.id,
        time: t,
        label: clientName(ci.userId),
        sub: ci.coachReply ? "Replied" : "Needs reply",
        replied: !!ci.coachReply,
        sortKey: t,
      });
    });

    return events.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  function handleClick(event) {
    if (event.type === "session") navigate("/admin/sessions");
    else if (event.type === "class") navigate("/admin/classes");
    else navigate("/admin/check-ins");
  }

  function weekLabel() {
    if (isThisWeek) return "This week";
    const s = weekStart.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
    const e = addDays(weekStart, 6).toLocaleDateString("en-IE", { day: "numeric", month: "short" });
    return `${s} - ${e}`;
  }

  const weekDayStrs = days.map(toDateStr);
  const weekSessions = sessions.filter(s => { const d = toDate(s.date); return d && weekDayStrs.includes(toDateStr(d)); });
  const weekClasses = classes.filter(c => weekDayStrs.includes(c.date));
  const weekCheckIns = checkIns.filter(ci => { const d = toDate(ci.submittedAt); return d && weekDayStrs.includes(toDateStr(d)); });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "16px 20px 20px" }}>
        <button onClick={() => navigate("/admin")}
          style={{ background: "none", border: "none", color: "#9fe1cb", fontSize: "14px", cursor: "pointer", padding: 0, marginBottom: "12px" }}>
          ← Admin
        </button>
        <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: 700, margin: "0 0 4px" }}>Calendar</h1>
        <p style={{ color: "#9fe1cb", fontSize: "13px", margin: "0 0 16px" }}>Sessions, classes, and check-ins</p>

        {/* Week navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => setWeekStart(addDays(weekStart, -7))}
            style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: "20px", width: 38, height: 38, borderRadius: "10px", cursor: "pointer", flexShrink: 0 }}>
            ‹
          </button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ color: "#fff", fontSize: "15px", fontWeight: 700, margin: 0 }}>{weekLabel()}</p>
            {!isThisWeek && (
              <button onClick={() => setWeekStart(getMonday(new Date()))}
                style={{ background: "none", border: "none", color: "#9fe1cb", fontSize: "12px", cursor: "pointer", padding: "2px 0 0", margin: 0 }}>
                Back to today
              </button>
            )}
          </div>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))}
            style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: "20px", width: 38, height: 38, borderRadius: "10px", cursor: "pointer", flexShrink: 0 }}>
            ›
          </button>
        </div>
      </div>

      {/* SUMMARY PILLS */}
      <div style={{ display: "flex", gap: "8px", padding: "12px 16px", overflowX: "auto" }}>
        {[
          { label: `📅 ${weekSessions.length} sessions`, color: "#0369a1", bg: "#e0f2fe" },
          { label: `🏛️ ${weekClasses.length} classes`, color: "#2d6a4f", bg: "#eaf5ef" },
          { label: `📋 ${weekCheckIns.length} check-ins`, color: "#92400e", bg: "#fef3c7" },
        ].map(p => (
          <div key={p.label} style={{ background: p.bg, borderRadius: "20px", padding: "6px 14px", whiteSpace: "nowrap", fontSize: "12px", fontWeight: 700, color: p.color, flexShrink: 0 }}>
            {p.label}
          </div>
        ))}
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#888", padding: "40px" }}>Loading...</p>
      ) : (
        <div style={{ padding: "0 14px 16px" }}>
          {days.map((day, i) => {
            const dayStr = toDateStr(day);
            const isToday = dayStr === today;
            const events = eventsForDay(day);
            return (
              <div key={dayStr} style={{ marginBottom: "10px" }}>
                {/* Day header row */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: "12px", flexShrink: 0,
                    backgroundColor: isToday ? "#2d6a4f" : "transparent",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  }}>
                    <p style={{ fontSize: "9px", fontWeight: 700, color: isToday ? "#9fe1cb" : "#aaa", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {DAY_LABELS[i]}
                    </p>
                    <p style={{ fontSize: "17px", fontWeight: 700, color: isToday ? "#fff" : "#111", margin: 0, lineHeight: 1.1 }}>
                      {day.getDate()}
                    </p>
                  </div>
                  <div style={{ flex: 1, height: "1px", backgroundColor: isToday ? "#2d6a4f" : "#e5e5e5" }} />
                  <p style={{ fontSize: "11px", color: "#bbb", margin: 0, flexShrink: 0 }}>
                    {day.toLocaleDateString("en-IE", { month: "short" })}
                  </p>
                </div>

                {/* Events */}
                <div style={{ marginLeft: 52 }}>
                  {events.length === 0 ? (
                    <p style={{ fontSize: "12px", color: "#ccc", margin: "0 0 4px" }}>No events</p>
                  ) : (
                    events.map((ev, j) => (
                      <EventPill key={j} event={ev} onClick={() => handleClick(ev)} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LEGEND */}
      <div style={{ margin: "0 14px 16px", backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Legend</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {[
            { label: "Scheduled session", bg: "#e0f2fe", color: "#0369a1" },
            { label: "Completed session", bg: "#dcfce7", color: "#166534" },
            { label: "Strength class", bg: "#eaf5ef", color: "#1a3a2a" },
            { label: "Conditioning", bg: "#fffbeb", color: "#b45309" },
            { label: "Spin", bg: "#e0f2fe", color: "#0369a1" },
            { label: "Check-in (pending)", bg: "#fef3c7", color: "#92400e" },
            { label: "Check-in (replied)", bg: "#dcfce7", color: "#166534" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: l.bg, border: `1.5px solid ${l.color}`, flexShrink: 0 }} />
              <p style={{ fontSize: "11px", color: "#666", margin: 0 }}>{l.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
