import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import PortalNav from "../components/PortalNav";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePhotoAngle, setActivePhotoAngle] = useState("front");
  const [darkMode, setDarkMode] = useState(false);
  const [units, setUnits] = useState("kg");
  const [showNicknameEdit, setShowNicknameEdit] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [assessmentData, setAssessmentData] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);

      const docSnap = await getDoc(doc(db, "users", u.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        setNewNickname(data.nickname || data.firstName || "");
        setUnits(data.units === "imperial" ? "lbs" : "kg");
      }

      const logsSnap = await getDocs(query(collection(db, "workoutLogs"), where("userId", "==", u.uid)));
      setWorkoutCount(logsSnap.size);

      const resultsSnap = await getDocs(query(collection(db, "assessmentResults"), where("email", "==", u.email)));
      if (!resultsSnap.empty) setAssessmentData(resultsSnap.docs[0].data());

      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const saveNickname = async () => {
    if (!newNickname.trim() || !user) return;
    setSaving(true);
    await updateDoc(doc(db, "users", user.uid), { nickname: newNickname.trim() });
    setUserData(prev => ({ ...prev, nickname: newNickname.trim() }));
    setShowNicknameEdit(false);
    setSaving(false);
  };

  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-IE", { month: "long", year: "numeric" })
    : "Recently";

  const displayName = userData?.nickname || userData?.firstName || "Member";

  const achievements = [
    { icon: "⭐", label: "Perfect Week\nJun W2", type: "perfect" },
    { icon: "✅", label: "Week\nJun W1", type: "complete" },
    { icon: "⭐", label: "Perfect Week\nMay W4", type: "perfect" },
    { icon: "✅", label: "Week\nMay W3", type: "complete" },
    { icon: "✅", label: "Week\nMay W2", type: "complete" },
  ];

  const achStyles = {
    perfect: { background: "linear-gradient(135deg, #fef9c3, #fde68a)", border: "2px solid #f59e0b" },
    complete: { background: "#eaf5ef", border: "2px solid #2d6a4f" },
    standard: { background: "linear-gradient(135deg, #dbeafe, #bfdbfe)", border: "2px solid #3b82f6" },
    missed: { background: "#f5f5f5", border: "1.5px solid #e5e5e5", opacity: 0.5 },
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "80px" }}>
      <PortalNav />
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "100px" }}>
      <PortalNav />

      {/* HEADER */}
      <div style={{
        background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)",
        padding: "16px 20px 48px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
            Profile
          </p>
          <Link to="/dashboard" style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", fontWeight: 600, textDecoration: "none" }}>
            Done
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              border: "3px solid rgba(255,255,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "28px", fontWeight: 700, color: "#fff",
            }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{
              position: "absolute", bottom: 0, right: 0,
              width: 26, height: 26, borderRadius: "50%",
              background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", border: "2px solid #2d6a4f",
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 10l2-1 5-5-1-1-5 5-1 2zM8 2l1 1" stroke="#2d6a4f" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>{displayName}</p>
            <p style={{ fontSize: "12px", color: "#9fe1cb", margin: "0 0 6px" }}>{user?.email}</p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", margin: 0 }}>Member since {memberSince}</p>
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "20px", padding: "5px 14px",
            fontSize: "12px", fontWeight: 700, color: "#9fe1cb",
          }}>
            ⭐ {userData?.subscription === "premium" ? "Premium Member" : "Free Member"}
          </div>
        </div>
      </div>

      {/* White curve */}
      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      {/* STATS ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", padding: "0 16px", marginTop: 4 }}>
        {[
          { value: workoutCount, label: "Workouts" },
          { value: "🔥 0", label: "Week Streak" },
          { value: `⭐ ${assessmentData?.capabilityScore ?? "—"}`, label: "Cap. Score" },
        ].map((s, i) => (
          <div key={i} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 10px", textAlign: "center" }}>
            <p style={{ fontSize: "20px", fontWeight: 700, color: "#111", margin: "0 0 3px" }}>{s.value}</p>
            <p style={{ fontSize: "10px", color: "#888", fontWeight: 600, margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ACHIEVEMENT WALL */}
      <div style={{ padding: "16px 16px 0" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>
          Achievement Wall
        </p>
      </div>
      <div style={{ display: "flex", gap: "10px", overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
        {achievements.map((a, i) => (
          <div key={i} style={{ flexShrink: 0, width: 72, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "22px", ...achStyles[a.type],
            }}>
              {a.icon}
            </div>
            <p style={{ fontSize: "9px", fontWeight: 700, color: "#666", textAlign: "center", lineHeight: 1.3, margin: 0, whiteSpace: "pre-line" }}>
              {a.label}
            </p>
          </div>
        ))}
        <div style={{ flexShrink: 0, width: 72, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f0f0f0", border: "1.5px dashed #ccc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
            🏆
          </div>
          <p style={{ fontSize: "9px", color: "#aaa", textAlign: "center", lineHeight: 1.3, margin: 0 }}>More to earn</p>
        </div>
      </div>

      {/* PROGRESS PHOTOS */}
      <div style={{ padding: "16px 16px 0" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>
          Progress Photos
        </p>
        <div style={{ display: "flex", gap: "0", background: "#e5e5e5", borderRadius: "10px", padding: "3px", marginBottom: "12px" }}>
          {["front", "side", "back"].map(angle => (
            <button key={angle} onClick={() => setActivePhotoAngle(angle)} style={{
              flex: 1, padding: "8px", borderRadius: "8px", border: "none",
              fontSize: "13px", fontWeight: 600, cursor: "pointer",
              backgroundColor: activePhotoAngle === angle ? "#fff" : "transparent",
              color: activePhotoAngle === angle ? "#2d6a4f" : "#888",
              textTransform: "capitalize",
            }}>
              {angle}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
        {/* Add new photo */}
        <div style={{ flexShrink: 0 }}>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "#aaa", textAlign: "center", marginBottom: "6px" }}>Today</p>
          <div style={{
            width: 110, height: 140, borderRadius: "12px",
            background: "#f0f0f0", border: "1.5px dashed #ccc",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: "6px", cursor: "pointer",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#ccc" strokeWidth="1.5"/>
              <path d="M12 8v8M8 12h8" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: "10px", color: "#aaa", fontWeight: 600 }}>Add photo</span>
          </div>
        </div>

        {/* Placeholder photo entries */}
        {["1 Jun", "1 May", "1 Apr"].map((date, i) => (
          <div key={i} style={{ flexShrink: 0 }}>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "#aaa", textAlign: "center", marginBottom: "6px" }}>{date}</p>
            <div style={{
              width: 110, height: 140, borderRadius: "12px",
              background: `linear-gradient(135deg, ${i === 0 ? "#2d6a4f, #1a3a2a" : i === 1 ? "#1a4a35, #2d6a4f" : "#064e3b, #065f46"})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>Photo</span>
            </div>
          </div>
        ))}
      </div>

      <button style={{
        margin: "10px 16px 0", background: "#2d6a4f", color: "#fff",
        border: "none", borderRadius: "12px", padding: "12px",
        fontSize: "14px", fontWeight: 700, cursor: "pointer", width: "calc(100% - 32px)",
        display: "block",
      }}>
        Compare Two Photos →
      </button>

      {/* CAPABILITY STANDARDS */}
      {userData?.capabilityStandards && (
        <div style={{ padding: "16px 16px 0" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>
            Capability Standards
          </p>
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { icon: "🏋️", label: "Bench Press", target: `${userData.capabilityStandards.bench}kg`, current: "—" },
              { icon: "💪", label: "Deadlift", target: `${userData.capabilityStandards.deadlift}kg`, current: "—" },
              { icon: "🏃", label: "5k Run", target: userData.capabilityStandards.run5k, current: "—" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>{s.icon}</span>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: 0 }}>{s.label}</p>
                    <p style={{ fontSize: "11px", color: "#888", margin: "1px 0 0" }}>Target: {s.target}</p>
                  </div>
                </div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#aaa" }}>{s.current}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONNECTED DEVICES */}
      <div style={{ padding: "16px 16px 0" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>
          Connected Devices
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { name: "Strava", icon: "🟠", status: "Coming soon" },
            { name: "Garmin", icon: "🔵", status: "Coming soon" },
            { name: "Apple Health", icon: "⚫", status: "Coming soon" },
          ].map(d => (
            <div key={d.name} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: 40, height: 40, borderRadius: "10px", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                  {d.icon}
                </div>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{d.name}</p>
                  <p style={{ fontSize: "12px", color: "#aaa", margin: "2px 0 0" }}>{d.status}</p>
                </div>
              </div>
              <button style={{ backgroundColor: "#f0f0f0", color: "#aaa", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 600, cursor: "not-allowed" }}>
                Soon
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SETTINGS */}
      <div style={{ padding: "16px 16px 0" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>
          Settings
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

          {/* Nickname */}
          <div style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px" }}>
            {showNicknameEdit ? (
              <div>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Nickname</p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    value={newNickname}
                    onChange={e => setNewNickname(e.target.value)}
                    style={{ flex: 1, padding: "10px 12px", borderRadius: "8px", border: "1.5px solid #2d6a4f", fontSize: "14px", outline: "none" }}
                  />
                  <button onClick={saveNickname} disabled={saving} style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 14px", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
                    {saving ? "..." : "Save"}
                  </button>
                  <button onClick={() => setShowNicknameEdit(false)} style={{ backgroundColor: "#f0f0f0", color: "#888", border: "none", borderRadius: "8px", padding: "10px 14px", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setShowNicknameEdit(true)}>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#111", margin: 0 }}>Nickname</p>
                  <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>Currently: {userData?.nickname || userData?.firstName}</p>
                </div>
                <span style={{ fontSize: "13px", color: "#aaa" }}>→</span>
              </div>
            )}
          </div>

          {/* Dark mode */}
          <div style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setDarkMode(!darkMode)}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#111", margin: 0 }}>Dark Mode</p>
              <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>Coming soon</p>
            </div>
            <div style={{ width: 44, height: 26, borderRadius: 13, background: darkMode ? "#2d6a4f" : "#e5e5e5", position: "relative", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", width: 20, height: 20, borderRadius: "50%", background: "#fff", top: 3, left: darkMode ? 21 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </div>
          </div>

          {/* Units */}
          <div style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setUnits(u => u === "kg" ? "lbs" : "kg")}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#111", margin: 0 }}>Units</p>
              <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>Currently: {units}</p>
            </div>
            <span style={{ fontSize: "13px", color: "#2d6a4f", fontWeight: 700 }}>{units === "kg" ? "Switch to lbs" : "Switch to kg"}</span>
          </div>

          {/* Retake assessment */}
          <Link to="/capability-score" style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none" }}>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "#111", margin: 0 }}>Retake Capability Assessment</p>
            <span style={{ fontSize: "13px", color: "#aaa" }}>→</span>
          </Link>

          {/* Logout */}
          <div style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={handleLogout}>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "#111", margin: 0 }}>Log Out</p>
            <span style={{ fontSize: "13px", color: "#aaa" }}>→</span>
          </div>

        </div>
      </div>

      {/* Delete account */}
      <div style={{ padding: "8px 16px 0" }}>
        <div style={{ backgroundColor: "#fef2f2", borderRadius: "14px", border: "0.5px solid #fecaca", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "#dc2626", margin: 0 }}>Delete Account</p>
          <span style={{ fontSize: "13px", color: "#dc2626" }}>→</span>
        </div>
      </div>

    </div>
  );
}
