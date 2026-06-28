import { useState, useEffect } from "react";
import { doc, getDoc, getDocs, collection, query, where, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { Link, useParams } from "react-router-dom";
import PortalNav from "../components/PortalNav";

// ─── helpers ──────────────────────────────────────────────────────────────────

function calcCurrentWeek(startedAt, totalWeeks) {
  if (!startedAt) return 1;
  const ms = Date.now() - new Date(startedAt).getTime();
  const weeks = Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
  return Math.min(totalWeeks, Math.max(1, weeks + 1));
}

function weeksCompleted(programme, logs) {
  // A week is complete when every workout in it has a log
  if (!programme?.weeks) return 0;
  let count = 0;
  for (const week of programme.weeks) {
    const allDone = (week.workouts || []).every((wId) =>
      logs.some((l) => l.workoutId === wId && l.weekId === `week-${week.weekNumber}` && l.programmeId === programme.id)
    );
    if (allDone && week.workouts?.length > 0) count++;
  }
  return count;
}

function sessionDone(workoutId, weekNumber, programmeId, logs) {
  return logs.some(
    (l) =>
      l.workoutId === workoutId &&
      l.weekId === `week-${weekNumber}` &&
      l.programmeId === programmeId
  );
}

// For repeating programmes: done this calendar week
function getCalendarWeekBounds() {
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

function sessionDoneThisCalendarWeek(workoutId, programmeId, logs) {
  const { monday, sunday } = getCalendarWeekBounds();
  return logs.some((l) => {
    if (l.workoutId !== workoutId || l.programmeId !== programmeId) return false;
    const d = new Date(l.completedAt);
    return d >= monday && d <= sunday;
  });
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function WeekBar({ total, current, done }) {
  return (
    <div style={{ display: "flex", gap: 3, marginTop: 12 }}>
      {Array.from({ length: total }, (_, i) => {
        const weekNum = i + 1;
        const isComplete = weekNum <= done;
        const isCurrent = weekNum === current;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: isCurrent ? 6 : 4,
              borderRadius: 3,
              backgroundColor: isComplete
                ? "#2d6a4f"
                : isCurrent
                ? "#9fe1cb"
                : "rgba(255,255,255,0.2)",
              transition: "all 0.3s ease",
              alignSelf: "flex-end",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ workout, index, weekNumber, programmeId, weekId, done, locked, repeating }) {
  const letter = String.fromCharCode(65 + index);
  const name = workout?.displayName || workout?.name || "Session";
  const exercises = workout?.exercises?.length ?? 0;
  const mins = workout?.estimatedTime ?? null;

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: 18,
        border: done ? "1.5px solid #2d6a4f" : "0.5px solid #e5e5e5",
        overflow: "hidden",
        opacity: locked ? 0.5 : 1,
      }}
    >
      {/* Colour accent */}
      <div style={{ height: 4, backgroundColor: done ? "#2d6a4f" : locked ? "#e5e5e5" : "#9fe1cb" }} />

      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
        {/* Letter badge */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            backgroundColor: done ? "#2d6a4f" : locked ? "#f0f0f0" : "#eaf5ef",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {done ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 9.5l4 4 6-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span style={{ fontSize: 14, fontWeight: 700, color: locked ? "#aaa" : "#2d6a4f" }}>
              {letter}
            </span>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: locked ? "#aaa" : "#111",
              margin: "0 0 3px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </p>
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
            {exercises} exercise{exercises !== 1 ? "s" : ""}
            {mins ? ` · ~${mins} min` : ""}
          </p>
        </div>

        {/* Action */}
        {locked ? (
          <span style={{ fontSize: 12, color: "#ccc", flexShrink: 0 }}>Locked</span>
        ) : done && !repeating ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", flexShrink: 0 }}>
            Done
          </span>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {done && repeating && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#2d6a4f" }}>Done</span>
            )}
            <Link
              to={`/programme/${programmeId}/${weekId}/${workout.id}`}
              style={{
                backgroundColor: done && repeating ? "#eaf5ef" : "#2d6a4f",
                color: done && repeating ? "#2d6a4f" : "#fff",
                fontSize: 13,
                fontWeight: 700,
                padding: "9px 18px",
                borderRadius: 10,
                textDecoration: "none",
              }}
            >
              {done && repeating ? "Go again →" : "Start →"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Week nav ─────────────────────────────────────────────────────────────────

function WeekNav({ viewing, total, current, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#fff",
        borderRadius: 14,
        border: "0.5px solid #e5e5e5",
        padding: "10px 16px",
        marginBottom: 16,
      }}
    >
      <button
        onClick={() => viewing > 1 && onChange(viewing - 1)}
        disabled={viewing <= 1}
        style={{
          background: "none",
          border: "none",
          fontSize: 20,
          color: viewing <= 1 ? "#ddd" : "#2d6a4f",
          cursor: viewing <= 1 ? "default" : "pointer",
          padding: "0 8px",
          lineHeight: 1,
        }}
      >
        ←
      </button>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: 0 }}>
          Week {viewing}
          {viewing === current && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 10,
                fontWeight: 700,
                backgroundColor: "#eaf5ef",
                color: "#2d6a4f",
                padding: "2px 8px",
                borderRadius: 20,
              }}
            >
              Current
            </span>
          )}
        </p>
        <p style={{ fontSize: 11, color: "#aaa", margin: "2px 0 0" }}>{total} weeks total</p>
      </div>
      <button
        onClick={() => viewing < total && onChange(viewing + 1)}
        disabled={viewing >= total}
        style={{
          background: "none",
          border: "none",
          fontSize: 20,
          color: viewing >= total ? "#ddd" : "#2d6a4f",
          cursor: viewing >= total ? "default" : "pointer",
          padding: "0 8px",
          lineHeight: 1,
        }}
      >
        →
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Programme() {
  const { id } = useParams();
  const [programme, setProgramme] = useState(null);
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [weekWorkouts, setWeekWorkouts] = useState([]);
  const [currentWeekNum, setCurrentWeekNum] = useState(1);
  const [viewingWeekNum, setViewingWeekNum] = useState(1);
  const [personalBests, setPersonalBests] = useState([]);
  const [startedAt, setStartedAt] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Load everything ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setLoading(false); return; }
      setUser(u);

      // 1. Programme
      const progSnap = await getDoc(doc(db, "programmes", id));
      if (!progSnap.exists()) { setLoading(false); return; }
      const prog = { id: progSnap.id, ...progSnap.data() };
      setProgramme(prog);

      const totalWeeks = prog.weeks?.length ?? 1;

      // 2. User profile — check/set startedAt
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const progress = userData.programmeProgress?.[id];

      let resolvedStartedAt = progress?.startedAt;
      if (!resolvedStartedAt) {
        resolvedStartedAt = new Date().toISOString();
        try {
          await updateDoc(doc(db, "users", u.uid), {
            [`programmeProgress.${id}.startedAt`]: resolvedStartedAt,
          });
        } catch {}
      }
      setStartedAt(resolvedStartedAt);

      // 3. Current week
      const weekNum = prog.repeating
        ? 1
        : calcCurrentWeek(resolvedStartedAt, totalWeeks);
      setCurrentWeekNum(weekNum);
      setViewingWeekNum(weekNum);

      // 4. Logs for this programme
      const logsSnap = await getDocs(
        query(
          collection(db, "workoutLogs"),
          where("userId", "==", u.uid),
          where("programmeId", "==", id)
        )
      );
      const userLogs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLogs(userLogs);

      // 5. Load workouts for current/only week (inline so we can chain PB load)
      const weekData = prog.weeks?.find((w) => w.weekNumber === weekNum);
      let loadedWorkouts = [];
      if (weekData?.workouts?.length) {
        const snaps = await Promise.all(
          weekData.workouts.map((wId) => getDoc(doc(db, "workouts", wId)))
        );
        loadedWorkouts = snaps.filter((s) => s.exists()).map((s) => ({ id: s.id, ...s.data() }));
        setWeekWorkouts(loadedWorkouts);
      }

      // 6. Personal bests for repeating programmes
      if (prog.repeating && loadedWorkouts.length > 0) {
        const exerciseIds = loadedWorkouts
          .flatMap((w) => (w.exercises || []).map((e) => e.exerciseId || e.id))
          .filter(Boolean);
        const uniqueIds = [...new Set(exerciseIds)];
        if (uniqueIds.length > 0) {
          const pbDocs = await Promise.all(
            uniqueIds.map((eid) => getDoc(doc(db, "users", u.uid, "personalBests", eid)))
          );
          setPersonalBests(
            pbDocs.filter((d) => d.exists()).map((d) => ({ id: d.id, ...d.data() }))
          );
        }
      }

      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  const loadWeekWorkouts = async (prog, weekNum) => {
    const weekData = prog.weeks?.find((w) => w.weekNumber === weekNum);
    if (!weekData?.workouts?.length) { setWeekWorkouts([]); return; }
    const snaps = await Promise.all(
      weekData.workouts.map((wId) => getDoc(doc(db, "workouts", wId)))
    );
    setWeekWorkouts(
      snaps
        .filter((s) => s.exists())
        .map((s) => ({ id: s.id, ...s.data() }))
    );
  };

  const handleWeekChange = async (newWeek) => {
    setViewingWeekNum(newWeek);
    if (programme) await loadWeekWorkouts(programme, newWeek);
  };

  // ── Loading / not found ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: 140 }}>
        <PortalNav />
        <div style={{ padding: "80px 20px", textAlign: "center", color: "#aaa" }}>Loading...</div>
      </div>
    );
  }

  if (!programme) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: 140 }}>
        <PortalNav />
        <div style={{ padding: "80px 20px", textAlign: "center", color: "#888" }}>Programme not found.</div>
      </div>
    );
  }

  const totalWeeks = programme.weeks?.length ?? 1;
  const isRepeating = programme.repeating === true;
  const isPremium = programme.free === false;
  const viewingWeekData = programme.weeks?.find((w) => w.weekNumber === viewingWeekNum);
  const weekId = `week-${viewingWeekNum}`;
  const doneCount = weeksCompleted(programme, logs);
  const progressPct = totalWeeks > 0 ? Math.round((doneCount / totalWeeks) * 100) : 0;

  // Repeating-specific stats
  const weeksOnProgramme = startedAt
    ? Math.max(1, Math.floor((Date.now() - new Date(startedAt).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1)
    : 1;
  const { monday: calMonday, sunday: calSunday } = getCalendarWeekBounds();
  const thisWeekSessions = logs.filter((l) => {
    const d = new Date(l.completedAt);
    return d >= calMonday && d <= calSunday;
  }).length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: 140 }}>
      <PortalNav />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)",
          padding: "16px 20px 40px",
        }}
      >
        <Link
          to="/training"
          style={{ fontSize: 13, color: "#9fe1cb", fontWeight: 600, textDecoration: "none" }}
        >
          ← Training
        </Link>

        <div style={{ marginTop: 16 }}>
          {/* Tag + level */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {programme.tag && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#9fe1cb",
                  backgroundColor: "rgba(255,255,255,0.12)",
                  padding: "3px 10px",
                  borderRadius: 20,
                }}
              >
                {programme.tag}
              </span>
            )}
            {programme.level && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.6)",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  padding: "3px 10px",
                  borderRadius: 20,
                }}
              >
                {programme.level}
              </span>
            )}
            {isPremium && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fbbf24",
                  backgroundColor: "rgba(251,191,36,0.15)",
                  padding: "3px 10px",
                  borderRadius: 20,
                }}
              >
                Premium
              </span>
            )}
          </div>

          {/* Name */}
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>
            {programme.name}
          </h1>

          {/* Description */}
          {programme.description && (
            <p
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 14,
                margin: "0 0 16px",
                lineHeight: 1.6,
              }}
            >
              {programme.description}
            </p>
          )}

          {/* Progress */}
          {!isRepeating && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, color: "#9fe1cb", fontWeight: 600 }}>
                  Week {currentWeekNum} of {totalWeeks}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  {progressPct}% complete
                </span>
              </div>
              <WeekBar total={totalWeeks} current={currentWeekNum} done={doneCount} />
            </div>
          )}

          {isRepeating && (
            <div style={{ display: "flex", gap: 20, marginTop: 4 }}>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 2px", lineHeight: 1 }}>
                  Week {weeksOnProgramme}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0 }}>on programme</p>
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 2px", lineHeight: 1 }}>
                  {logs.length}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0 }}>sessions done</p>
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#9fe1cb", margin: "0 0 2px", lineHeight: 1 }}>
                  {thisWeekSessions}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0 }}>this week</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* White curve */}
      <div
        style={{
          height: 24,
          background: "#f7f5f2",
          borderRadius: "24px 24px 0 0",
          marginTop: -24,
        }}
      />

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div style={{ padding: "0 16px" }}>

        {/* Week nav (structured programmes only) */}
        {!isRepeating && totalWeeks > 1 && (
          <WeekNav
            viewing={viewingWeekNum}
            total={totalWeeks}
            current={currentWeekNum}
            onChange={handleWeekChange}
          />
        )}

        {/* Week label */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#aaa",
            margin: "0 0 12px",
          }}
        >
          {isRepeating
            ? "This week's sessions"
            : viewingWeekData?.title
            ? viewingWeekData.title
            : `Week ${viewingWeekNum}`}
        </p>

        {/* Session cards */}
        {weekWorkouts.length === 0 ? (
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              border: "0.5px solid #e5e5e5",
              padding: "32px 20px",
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            <p style={{ fontSize: 15, color: "#aaa", margin: 0 }}>No sessions in this week yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {weekWorkouts.map((workout, index) => {
              const isLocked = viewingWeekNum > currentWeekNum;
              const isDone = isRepeating
                ? sessionDoneThisCalendarWeek(workout.id, id, logs)
                : sessionDone(workout.id, viewingWeekNum, id, logs);

              return (
                <SessionCard
                  key={workout.id}
                  workout={workout}
                  index={index}
                  weekNumber={viewingWeekNum}
                  programmeId={id}
                  weekId={weekId}
                  done={isDone}
                  locked={isLocked}
                  repeating={isRepeating}
                />
              );
            })}
          </div>
        )}

        {/* How it works (repeating) */}
        {isRepeating && (
          <div
            style={{
              backgroundColor: "#1a3a2a",
              borderRadius: 16,
              padding: "16px 18px",
              marginBottom: 20,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, color: "#9fe1cb", margin: "0 0 6px" }}>
              How this programme works
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, margin: 0 }}>
              Complete all sessions each week, in any order. When you hit the top of your rep range,
              the app will guide you to add weight next time. The structure stays the same. The
              weights change. That is how capability is built.
            </p>
          </div>
        )}

        {/* Personal bests — repeating programmes */}
        {isRepeating && personalBests.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#aaa",
                margin: "0 0 12px",
              }}
            >
              Your personal bests
            </p>

            {weekWorkouts.map((workout, wi) => {
              const exList = (workout.exercises || [])
                .map((ex) => {
                  const exId = ex.exerciseId || ex.id;
                  const pb = personalBests.find((p) => p.id === exId);
                  if (!pb) return null;
                  const name = ex.name || ex.displayName || pb.exerciseName || "Exercise";
                  return { name, pb };
                })
                .filter(Boolean);

              if (!exList.length) return null;

              return (
                <div
                  key={workout.id}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 14,
                    border: "0.5px solid #e5e5e5",
                    overflow: "hidden",
                    marginBottom: 10,
                  }}
                >
                  {/* Session label */}
                  <div
                    style={{
                      padding: "10px 16px 8px",
                      borderBottom: "0.5px solid #f0f0f0",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        backgroundColor: "#eaf5ef",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#2d6a4f",
                        flexShrink: 0,
                      }}
                    >
                      {String.fromCharCode(65 + wi)}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>
                      {workout.displayName || workout.name}
                    </p>
                  </div>

                  {/* Exercise rows */}
                  <div style={{ padding: "8px 16px" }}>
                    {exList.map(({ name, pb }) => {
                      const achievedDate = pb.achievedAt
                        ? new Date(pb.achievedAt?.toDate?.() ?? pb.achievedAt)
                        : null;
                      const daysAgo = achievedDate
                        ? Math.floor((Date.now() - achievedDate.getTime()) / (1000 * 60 * 60 * 24))
                        : null;
                      const timeLabel =
                        daysAgo === null
                          ? ""
                          : daysAgo === 0
                          ? "today"
                          : daysAgo === 1
                          ? "yesterday"
                          : `${daysAgo}d ago`;

                      return (
                        <div
                          key={name}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "7px 0",
                            borderBottom: "0.5px solid #f5f5f5",
                          }}
                        >
                          <p style={{ fontSize: 13, color: "#444", margin: 0 }}>{name}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {timeLabel && (
                              <span style={{ fontSize: 11, color: "#bbb" }}>{timeLabel}</span>
                            )}
                            <p
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: "#2d6a4f",
                                margin: 0,
                              }}
                            >
                              {pb.bestWeight ? `${pb.bestWeight}kg` : ""}
                              {pb.bestReps ? ` × ${pb.bestReps}` : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Stats row */}
        {!isRepeating && (
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 24,
            }}
          >
            {[
              { label: "Weeks", value: totalWeeks },
              {
                label: "Sessions / week",
                value: programme.weeks?.[0]?.workouts?.length ?? 0,
              },
              { label: "Weeks done", value: doneCount },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  backgroundColor: "#fff",
                  borderRadius: 14,
                  border: "0.5px solid #e5e5e5",
                  padding: "12px 14px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#111",
                    margin: "0 0 2px",
                    lineHeight: 1,
                  }}
                >
                  {value}
                </p>
                <p style={{ fontSize: 11, color: "#888", margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
