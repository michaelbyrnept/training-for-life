import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, addDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
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
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Booking sheet
  const [showBook, setShowBook] = useState(false);
  const [bookSearch, setBookSearch] = useState("");
  const [bookTarget, setBookTarget] = useState(null); // { type: "client"|"group", id, name }
  const [bookForm, setBookForm] = useState({ date: "", time: "09:00", durationMins: 60, type: "In Person", notes: "" });
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [sessSnap, classSnap, checkSnap, clientSnap, groupSnap] = await Promise.all([
        getDocs(collection(db, "sessions")),
        getDocs(collection(db, "classes")),
        getDocs(collection(db, "checkIns")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "groups")),
      ]);
      setSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCheckIns(checkSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setClients(
        clientSnap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(c => c.uid !== ADMIN_UID)
      );
      setGroups(groupSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  }

  async function bookSession() {
    if (!bookTarget || !bookForm.date || !bookForm.time) {
      setBookError("Please select a client or group, and set a date and time.");
      return;
    }
    setBooking(true);
    setBookError("");
    try {
      const dateTime = new Date(`${bookForm.date}T${bookForm.time}`);
      const dateTs = Timestamp.fromDate(dateTime);

      if (bookTarget.type === "group") {
        const group = groups.find(g => g.id === bookTarget.id);
        const memberIds = group?.memberIds || [];

        // Create a session for each group member
        await Promise.all(memberIds.map(uid => {
          const client = clients.find(c => c.uid === uid);
          return addDoc(collection(db, "sessions"), {
            clientId: uid,
            clientName: client?.nickname || client?.firstName || client?.email || uid,
            groupId: bookTarget.id,
            groupName: bookTarget.name,
            isGroupSession: true,
            date: dateTs,
            durationMins: Number(bookForm.durationMins),
            type: bookForm.type,
            status: "scheduled",
            notes: bookForm.notes.trim() || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }));

        // Deduct 1 group credit
        const newCredits = Math.max(0, (group?.credits || 0) - 1);
        await updateDoc(doc(db, "groups", bookTarget.id), { credits: newCredits });
        await addDoc(collection(db, "groupWalletTransactions"), {
          groupId: bookTarget.id,
          amount: -1,
          type: "session",
          createdAt: new Date().toISOString(),
          note: `Session booked ${bookForm.date}`,
        });
      } else {
        const client = clients.find(c => c.uid === bookTarget.id);
        await addDoc(collection(db, "sessions"), {
          clientId: bookTarget.id,
          clientName: client?.nickname || client?.firstName || client?.email || bookTarget.id,
          date: dateTs,
          durationMins: Number(bookForm.durationMins),
          type: bookForm.type,
          status: "scheduled",
          notes: bookForm.notes.trim() || null,
          walletTxId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Reload sessions and reset
      const sessSnap = await getDocs(collection(db, "sessions"));
      setSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const groupSnap = await getDocs(collection(db, "groups"));
      setGroups(groupSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setShowBook(false);
      setBookTarget(null);
      setBookSearch("");
      setBookForm({ date: "", time: "09:00", durationMins: 60, type: "In Person", notes: "" });
    } catch (e) {
      console.error(e);
      setBookError("Something went wrong. Please try again.");
    }
    setBooking(false);
  }

  const bookSearchResults = bookSearch.trim().length === 0 ? [] : [
    ...clients
      .filter(c => {
        const name = `${c.firstName || ""} ${c.nickname || ""} ${c.email || ""}`.toLowerCase();
        return name.includes(bookSearch.toLowerCase());
      })
      .slice(0, 6)
      .map(c => ({ type: "client", id: c.uid, name: c.nickname || c.firstName || c.email?.split("@")[0] || "Client", sub: c.email })),
    ...groups
      .filter(g => g.name?.toLowerCase().includes(bookSearch.toLowerCase()))
      .slice(0, 4)
      .map(g => ({ type: "group", id: g.id, name: g.name, sub: `${(g.memberIds || []).length} members — ${g.credits || 0} credits` })),
  ];

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = toDateStr(new Date());
  const isThisWeek = toDateStr(weekStart) === toDateStr(getMonday(new Date()));

  function clientName(uid) {
    const c = clients.find(c => c.uid === uid);
    return c?.nickname || c?.firstName || c?.displayName || uid?.slice(0, 6) || "Client";
  }

  function eventsForDay(day) {
    const dayStr = toDateStr(day);
    const events = [];
    const seenGroupSessions = new Set();

    sessions.forEach(s => {
      const d = toDate(s.date);
      if (!d || toDateStr(d) !== dayStr) return;

      // For group sessions, show once under the group name
      if (s.groupId) {
        if (seenGroupSessions.has(s.groupId + toDateStr(d) + (s.time || ""))) return;
        seenGroupSessions.add(s.groupId + toDateStr(d) + (s.time || ""));
        events.push({
          type: "session",
          id: s.id,
          time: s.time || d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" }),
          label: s.groupName || "Group",
          sub: `group — ${s.type || "session"}`,
          status: s.status || "scheduled",
          sortKey: s.time || "00:00",
          isGroup: true,
        });
        return;
      }

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <p style={{ color: "#9fe1cb", fontSize: "13px", margin: 0 }}>Sessions, classes, and check-ins</p>
          <button
            onClick={() => { setShowBook(true); setBookError(""); }}
            style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "20px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
          >
            + Book
          </button>
        </div>

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

      {/* BOOK SESSION SHEET */}
      {showBook && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowBook(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Book Session</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>Search for a client or a group</p>

            {/* Target picker */}
            {bookTarget ? (
              <div style={{ backgroundColor: bookTarget.type === "group" ? "#eaf5ef" : "#f0f7ff", borderRadius: "12px", padding: "12px 14px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px" }}>{bookTarget.type === "group" ? "👥" : "👤"}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{bookTarget.name}</p>
                  <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>{bookTarget.type === "group" ? "Group session" : "Individual session"}</p>
                </div>
                <button onClick={() => { setBookTarget(null); setBookSearch(""); }} style={{ background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "4px 8px" }}>Change</button>
              </div>
            ) : (
              <div style={{ position: "relative", marginBottom: "12px" }}>
                <input
                  autoFocus
                  value={bookSearch}
                  onChange={e => setBookSearch(e.target.value)}
                  placeholder="Search clients or groups..."
                  style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box" }}
                />
                {bookSearchResults.length > 0 && (
                  <div style={{ border: "1px solid #e5e5e5", borderRadius: "12px", overflow: "hidden", marginTop: "6px" }}>
                    {bookSearchResults.map((r, i) => (
                      <div
                        key={r.id}
                        onClick={() => { setBookTarget(r); setBookSearch(""); }}
                        style={{ padding: "12px 14px", cursor: "pointer", borderBottom: i < bookSearchResults.length - 1 ? "0.5px solid #f0f0f0" : "none", display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#fff" }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f7f5f2"}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "#fff"}
                      >
                        <span style={{ fontSize: "18px" }}>{r.type === "group" ? "👥" : "👤"}</span>
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{r.name}</p>
                          <p style={{ fontSize: "11px", color: "#aaa", margin: 0 }}>{r.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Date & time */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Date</label>
                <input type="date" value={bookForm.date} onChange={e => setBookForm(f => ({ ...f, date: e.target.value }))} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Time</label>
                <input type="time" value={bookForm.time} onChange={e => setBookForm(f => ({ ...f, time: e.target.value }))} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Duration */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Duration</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {[30, 45, 60, 90].map(d => (
                  <button key={d} onClick={() => setBookForm(f => ({ ...f, durationMins: d }))}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", border: bookForm.durationMins === d ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: bookForm.durationMins === d ? "#eaf5ef" : "#fff", fontSize: "13px", fontWeight: 700, color: bookForm.durationMins === d ? "#2d6a4f" : "#555", cursor: "pointer" }}>
                    {d}m
                  </button>
                ))}
              </div>
            </div>

            {/* Type */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Type</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {["In Person", "Online"].map(t => (
                  <button key={t} onClick={() => setBookForm(f => ({ ...f, type: t }))}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", border: bookForm.type === t ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: bookForm.type === t ? "#eaf5ef" : "#fff", fontSize: "13px", fontWeight: 700, color: bookForm.type === t ? "#2d6a4f" : "#555", cursor: "pointer" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {bookError && (
              <div style={{ backgroundColor: "#fef2f2", borderRadius: "10px", padding: "10px 14px", marginBottom: "14px" }}>
                <p style={{ fontSize: "13px", color: "#dc2626", margin: 0 }}>{bookError}</p>
              </div>
            )}

            <button
              onClick={bookSession}
              disabled={booking || !bookTarget || !bookForm.date || !bookForm.time}
              style={{ width: "100%", backgroundColor: booking || !bookTarget || !bookForm.date ? "#e5e5e5" : "#2d6a4f", color: booking || !bookTarget || !bookForm.date ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}
            >
              {booking ? "Booking..." : bookTarget?.type === "group" ? `Book Group Session (1 credit)` : "Book Session"}
            </button>
            <button onClick={() => { setShowBook(false); setBookTarget(null); setBookSearch(""); }} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
