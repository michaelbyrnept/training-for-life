import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import PortalNav from "../components/PortalNav";

const FALLBACKS = [
  "linear-gradient(135deg, #1a3a2a 0%, #2d6a4f 100%)",
  "linear-gradient(135deg, #1a3329 0%, #3a7d5a 100%)",
  "linear-gradient(135deg, #0d2b1f 0%, #1e5c3a 100%)",
  "linear-gradient(135deg, #162a20 0%, #2a6048 100%)",
];

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

export default function Training() {
  const navigate = useNavigate();
  const [programmes, setProgrammes] = useState([]);
  const [userData, setUserData] = useState(null);
  const [user, setUser] = useState(null);
  const [weeklyLogs, setWeeklyLogs] = useState({ strength: 0, cardio: 0, mobility: 0 });
  const [loading, setLoading] = useState(true);
  const [selectingType, setSelectingType] = useState(null);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUser(u);
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const uData = userSnap.exists() ? userSnap.data() : {};
      setUserData(uData);

      const snap = await getDocs(collection(db, "programmes"));
      const allProgrammes = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.published);
      setProgrammes(allProgrammes);

      const { monday, sunday } = getWeekRange();
      const logsSnap = await getDocs(collection(db, "workoutLogs"));
      const myLogs = logsSnap.docs.map(d => d.data()).filter(l => {
        if (l.userId !== u.uid) return false;
        const d = new Date(l.completedAt);
        return d >= monday && d <= sunday;
      });

      const strengthCount = uData.strengthProgrammeId ? myLogs.filter(l => l.programmeId === uData.strengthProgrammeId).length : 0;
      const cardioCount = uData.cardioProgrammeId ? myLogs.filter(l => l.programmeId === uData.cardioProgrammeId).length : 0;
      setWeeklyLogs({ strength: strengthCount, cardio: cardioCount, mobility: 0 });

      const classSnap = await getDocs(collection(db, "classes"));
const today = new Date();
today.setHours(0, 0, 0, 0);
const classData = classSnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(c => {
    if (c.published === false || !c.date) return false;
    const classDate = new Date(c.date + "T12:00:00");
    return classDate >= today;
  })
  .sort((a, b) => new Date(a.date) - new Date(b.date))
  .slice(0, 10);
setClasses(classData);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const selectProgramme = async (type, programmeId) => {
    if (!user) return;
    const field = type === "strength" ? "strengthProgrammeId" : "cardioProgrammeId";
    await updateDoc(doc(db, "users", user.uid), { [field]: programmeId });
    setUserData(prev => ({ ...prev, [field]: programmeId }));
    setSelectingType(null);
  };

  const strengthProgramme = programmes.find(p => p.id === userData?.strengthProgrammeId);
  const cardioProgramme = programmes.find(p => p.id === userData?.cardioProgrammeId);
  const isPremium = userData?.subscription === "premium" || userData?.subscription === "hybrid" || userData?.subscription === "in-person" || user?.uid === "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";
  const strengthOptions = programmes.filter(p => p.tag !== "cardio" && p.tag !== "walk");
  const cardioOptions = programmes.filter(p => p.tag === "cardio" || p.tag === "walk" || p.repeating);

  const weekStatus = [
    { type: "strength", icon: "🏋️", label: "Strength", done: weeklyLogs.strength, target: WEEKLY_TARGETS.strength, programme: strengthProgramme },
    { type: "cardio", icon: "🏃", label: "Cardio", done: weeklyLogs.cardio, target: WEEKLY_TARGETS.cardio, programme: cardioProgramme },
    { type: "mobility", icon: "🧘", label: "Mobility", done: weeklyLogs.mobility, target: WEEKLY_TARGETS.mobility, programme: null, comingSoon: true },
  ];

  const totalDone = weeklyLogs.strength + weeklyLogs.cardio + weeklyLogs.mobility;
  const totalTarget = WEEKLY_TARGETS.strength + WEEKLY_TARGETS.cardio + WEEKLY_TARGETS.mobility;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <PortalNav />

      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 36px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 16px" }}>Training</p>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>This Week</h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>{totalDone} of {totalTarget} sessions complete</p>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      {/* MY WEEK */}
      <div style={{ padding: "0 16px 16px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>My Week</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {weekStatus.map(item => {
            const remaining = item.target - item.done;
            const complete = item.done >= item.target;
            return (
              <div key={item.type} style={{ backgroundColor: "#fff", borderRadius: "16px", border: `0.5px solid ${complete ? "#86efac" : "#e5e5e5"}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "20px" }}>{item.icon}</span>
                      <div>
                        <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{item.label}</p>
                        <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>
                          {item.comingSoon ? "Coming soon" : complete ? "Week complete" : `${remaining} more this week`}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {Array.from({ length: item.target }).map((_, i) => (
                        <div key={i} style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: i < item.done ? "#2d6a4f" : "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {i < item.done && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      ))}
                    </div>
                  </div>
                  {!item.comingSoon && (
                    item.programme ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "10px 12px" }}>
                        <div>
                          <p style={{ fontSize: "12px", fontWeight: 700, color: "#111", margin: 0 }}>{item.programme.name}</p>
                          <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>Active programme</p>
                        </div>
                        <button onClick={() => setSelectingType(item.type)} style={{ background: "none", border: "none", fontSize: "12px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer", padding: 0 }}>Change</button>
                      </div>
                    ) : (
                      <button onClick={() => setSelectingType(item.type)} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1.5px dashed #e5e5e5", background: "none", fontSize: "13px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer" }}>
                        + Select {item.label} Programme
                      </button>
                    )
                  )}
                </div>
                {!item.comingSoon && (
                  <div style={{ height: "3px", backgroundColor: "#f0f0f0" }}>
                    <div style={{ height: "3px", backgroundColor: complete ? "#4ade80" : "#2d6a4f", width: `${Math.min((item.done / item.target) * 100, 100)}%`, transition: "width 0.4s ease" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CLASSES */}
      {classes.length > 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>Upcoming Classes</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {classes.map(cls => {
              const isStrength = cls.type === "strength";
              const isConditioning = cls.type === "conditioning";
              const icon = isStrength ? "🏋️" : isConditioning ? "🔥" : "🚴";
              const color = isStrength ? "#2d6a4f" : isConditioning ? "#b45309" : "#0369a1";
              const bg = isStrength ? "#eaf5ef" : isConditioning ? "#fffbeb" : "#e0f2fe";
              const dateLabel = new Date(cls.date + "T12:00:00").toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "short" });
              const cardContent = (
                <div style={{ backgroundColor: "#fff", borderRadius: "14px", border: `0.5px solid ${isStrength ? "#86efac" : "#e5e5e5"}`, padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "12px", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>{icon}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{cls.title}</p>
                    <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>{dateLabel} · {cls.time} · {cls.duration} min</p>
                  </div>
                  {isStrength ? (
                    <div style={{ backgroundColor: color, color: "#fff", fontSize: "12px", fontWeight: 700, padding: "6px 12px", borderRadius: "8px" }}>Log →</div>
                  ) : (
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", backgroundColor: "#f0f0f0", padding: "4px 10px", borderRadius: "20px" }}>
                      {isConditioning ? "Surprise" : "Spin"}
                    </span>
                  )}
                </div>
              );
              return isStrength ? (
                <Link key={cls.id} to={`/class/${cls.id}`} style={{ textDecoration: "none", display: "block" }}>{cardContent}</Link>
              ) : (
                <div key={cls.id}>{cardContent}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI RUNNING PLAN */}
      <div style={{ padding: "0 16px 16px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>AI Tools</p>
        {isPremium ? (
          <Link to="/ai-running-plan" style={{ textDecoration: "none", display: "block" }}>
            <div style={{ background: "linear-gradient(135deg, #0d2b1f 0%, #1a3a2a 50%, #2d6a4f 100%)", borderRadius: "16px", padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: 52, height: 52, borderRadius: "14px", backgroundColor: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", flexShrink: 0 }}>🤖</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: "0 0 3px" }}>AI Running Plan</p>
                <p style={{ fontSize: "12px", color: "#9fe1cb", margin: 0 }}>Personalised to your goals, fitness and race date</p>
              </div>
              <div style={{ backgroundColor: "#4ade80", color: "#1a3a2a", fontSize: "12px", fontWeight: 700, padding: "6px 12px", borderRadius: "8px", flexShrink: 0 }}>Generate →</div>
            </div>
          </Link>
        ) : (
          <div style={{ background: "linear-gradient(135deg, #0d2b1f 0%, #1a3a2a 50%, #2d6a4f 100%)", borderRadius: "16px", padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px", opacity: 0.7 }}>
            <div style={{ width: 52, height: 52, borderRadius: "14px", backgroundColor: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", flexShrink: 0 }}>🤖</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: "0 0 3px" }}>AI Running Plan</p>
              <p style={{ fontSize: "12px", color: "#9fe1cb", margin: 0 }}>Personalised to your goals, fitness and race date</p>
            </div>
            <div style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "6px 12px", borderRadius: "8px", flexShrink: 0 }}>🔒 Premium</div>
          </div>
        )}
      </div>

      {/* ALL PROGRAMMES */}
      <div style={{ padding: "0 16px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>All Programmes</p>
        {loading ? (
          <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>Loading...</p>
        ) : programmes.length === 0 ? (
          <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>No programmes available yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {programmes.map((p, i) => (
              <ProgrammeCard key={p.id} programme={p} fallback={FALLBACKS[i % FALLBACKS.length]} isPremiumUser={isPremium} />
            ))}
          </div>
        )}
      </div>

      {/* COMING SOON */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", margin: 0 }}>Coming Soon</p>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309", backgroundColor: "#fffbeb", padding: "3px 10px", borderRadius: "20px" }}>Premium · €19.99/mo</span>
        </div>
        <ComingSoonSection user={user} userData={userData} />
      </div>

      {/* PROGRAMME SELECTOR SHEET */}
      {selectingType && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setSelectingType(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "75vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Select {selectingType === "strength" ? "Strength" : "Cardio"} Programme</h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>
              {selectingType === "strength" ? "Any session from this programme counts toward your 3 weekly strength sessions." : "Any session from this programme counts toward your 2 weekly cardio sessions."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {(selectingType === "strength" ? strengthOptions : cardioOptions).map(p => {
                const isLocked = p.free === false && !isPremium;
                const isSelected = selectingType === "strength" ? userData?.strengthProgrammeId === p.id : userData?.cardioProgrammeId === p.id;
                return (
                  <div key={p.id} onClick={() => !isLocked && selectProgramme(selectingType, p.id)} style={{ padding: "14px 16px", borderRadius: "14px", border: `1.5px solid ${isSelected ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: isSelected ? "#eaf5ef" : "#fff", cursor: isLocked ? "not-allowed" : "pointer", opacity: isLocked ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: isSelected ? "#2d6a4f" : "#111", margin: 0 }}>{p.name}</p>
                      <p style={{ fontSize: "12px", color: "#888", margin: "3px 0 0" }}>{p.description}</p>
                      {isLocked && <p style={{ fontSize: "11px", color: "#b45309", fontWeight: 700, margin: "4px 0 0" }}>Premium only</p>}
                    </div>
                    {isSelected && (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginLeft: 12 }}>
                        <circle cx="10" cy="10" r="9" fill="#2d6a4f"/>
                        <path d="M5 10l4 4 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setSelectingType(null)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "16px", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ComingSoonSection({ user, userData }) {
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
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "16px", marginBottom: "12px" }}>
      <p style={{ fontSize: "13px", color: "#9fe1cb", margin: "0 0 14px", lineHeight: 1.6 }}>
        Premium programmes are dropping soon. One subscription unlocks everything.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {[
          { icon: "🏋️", name: "Capability Full Body", sub: "Premium strength with full exercise swap library", tag: "Strength" },
          { icon: "🍑", name: "Glute Builder", sub: "Glute-focused with quad work and upper body", tag: "Strength" },
          { icon: "💪", name: "Bro Split", sub: "Upper / Lower / Push / Pull / Legs with gym swaps", tag: "Strength" },
          { icon: "🏃", name: "5k Foundation", sub: "Get your first 5k from any starting point", tag: "Running" },
          { icon: "🏅", name: "10k Builder", sub: "Step up your distance and pace", tag: "Running" },
          { icon: "🎽", name: "Half Marathon", sub: "16 week structured plan", tag: "Running" },
          { icon: "🏆", name: "Coach to Marathon", sub: "52 weeks. One goal. Cross the finish line.", tag: "Running" },
        ].map((item, i) => (
          <div key={i} style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "12px", padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "22px", flexShrink: 0 }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0 }}>{item.name}</p>
                <span style={{ fontSize: "10px", fontWeight: 700, color: item.tag === "Running" ? "#60a5fa" : "#9fe1cb", backgroundColor: "rgba(255,255,255,0.08)", padding: "1px 7px", borderRadius: "10px" }}>{item.tag}</span>
              </div>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: 0 }}>{item.sub}</p>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", backgroundColor: "rgba(255,255,255,0.08)", padding: "4px 10px", borderRadius: "20px", flexShrink: 0 }}>Soon</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "16px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px", textAlign: "center" }}>
        <p style={{ fontSize: "13px", color: "#fff", fontWeight: 700, margin: "0 0 4px" }}>Founding Member Price</p>
        <p style={{ fontSize: "28px", fontWeight: 700, color: "#4ade80", margin: "0 0 4px", lineHeight: 1 }}>€19.99<span style={{ fontSize: "14px", color: "#9fe1cb" }}>/month</span></p>
        <p style={{ fontSize: "12px", color: "#9fe1cb", margin: "0 0 12px" }}>Unlock all programmes, past and future</p>
        <button onClick={handleNotify} disabled={saving || notified} style={{ width: "100%", backgroundColor: notified ? "#4ade80" : "#2d6a4f", borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 700, color: notified ? "#1a3a2a" : "#fff", border: "none", cursor: notified ? "default" : "pointer", transition: "all 0.3s ease" }}>
          {saving ? "Saving..." : notified ? "✓ You're on the list!" : "Notify me when available"}
        </button>
      </div>
    </div>
  );
}

function getAnimation(tag, name) {
  const t = (tag || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (t === "walk" || n.includes("walk")) return { emoji: "🚶", speed: "8s" };
  if (t === "cardio" || n.includes("run") || n.includes("5k") || n.includes("10k") || n.includes("marathon")) return { emoji: "🏃", speed: "3s" };
  if (t === "spin" || n.includes("cycle") || n.includes("spin")) return { emoji: "🚴", speed: "4s" };
  return { emoji: "🏋️", speed: null };
}

function ProgrammeCard({ programme: p, fallback, isPremiumUser }) {
  const isLocked = p.free === false && !isPremiumUser;
  const anim = getAnimation(p.tag, p.name);
  const isMoving = anim.speed !== null;
  return (
    <Link to={isLocked ? "#" : `/programme/${p.id}`} style={{ textDecoration: "none", display: "block", opacity: isLocked ? 0.75 : 1 }}>
      <div style={{ borderRadius: "16px", overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <div style={{ height: "160px", background: fallback, backgroundSize: "cover", backgroundPosition: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 60%)" }} />
          {isMoving ? (
            <div style={{ position: "absolute", top: "50%", transform: "translateY(-60%)", fontSize: "40px", animation: `moveAcross ${anim.speed} linear infinite`, whiteSpace: "nowrap" }}>
              {anim.emoji}
            </div>
          ) : (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -60%)", fontSize: "40px", animation: "liftPulse 1.2s ease-in-out infinite" }}>
              {anim.emoji}
            </div>
          )}
          <div style={{ position: "absolute", top: "12px", left: "12px", backgroundColor: isLocked ? "#854d0e" : "#2d6a4f", color: "#fff", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 10px", borderRadius: "20px" }}>
            {isLocked ? "🔒 Premium" : p.tag || "Free"}
          </div>
          <div style={{ position: "absolute", bottom: "12px", left: "14px", right: "14px" }}>
            <h2 style={{ color: "#fff", fontSize: "20px", fontWeight: 700, margin: 0, lineHeight: 1.2, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>{p.name}</h2>
          </div>
        </div>
        <div style={{ padding: "14px 16px 16px" }}>
          <p style={{ color: "#555", fontSize: "14px", margin: "0 0 12px", lineHeight: 1.5 }}>{p.description}</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "12px" }}>
              <span style={{ fontSize: "12px", color: "#888" }}>● {p.weeks?.length || 0} weeks</span>
              <span style={{ fontSize: "12px", color: "#888" }}>{p.level}</span>
            </div>
            <div style={{ backgroundColor: isLocked ? "#854d0e" : "#2d6a4f", color: "#fff", fontSize: "13px", fontWeight: 600, padding: "7px 14px", borderRadius: "8px" }}>
              {isLocked ? "Unlock →" : "View →"}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}