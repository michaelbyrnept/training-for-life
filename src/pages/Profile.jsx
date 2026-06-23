import { useState, useEffect, useRef } from "react";
import { auth, db, storage, functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { doc, getDoc, updateDoc, collection, getDocs, query, where, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate, Link } from "react-router-dom";
import PortalNav from "../components/PortalNav";

function normalizeDate(val) {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (val.toDate) return val.toDate().toISOString();
  if (val.seconds) return new Date(val.seconds * 1000).toISOString();
  return null;
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  date.setHours(0, 0, 0, 0);
  return date;
}

function computeWeeklyAchievements(logs) {
  const COMPLETE_THRESHOLD = 4;
  const PERFECT_THRESHOLD = 6;
  const weeks = {};
  logs.forEach(l => {
    if (!l.completedAt) return;
    const key = getMonday(l.completedAt).toISOString().split("T")[0];
    weeks[key] = (weeks[key] || 0) + 1;
  });
  const currentWeekKey = getMonday(new Date()).toISOString().split("T")[0];
  return Object.keys(weeks)
    .filter(key => key !== currentWeekKey)
    .map(key => ({ key, count: weeks[key] }))
    .filter(({ count }) => count >= COMPLETE_THRESHOLD)
    .sort((a, b) => new Date(b.key) - new Date(a.key))
    .slice(0, 8)
    .map(({ key, count }) => {
      const monday = new Date(key);
      const weekLabel = `${monday.toLocaleDateString("en-IE", { month: "short" })} W${Math.ceil(monday.getDate() / 7)}`;
      const isPerfect = count >= PERFECT_THRESHOLD;
      return { icon: isPerfect ? "⭐" : "✅", label: `${isPerfect ? "Perfect Week" : "Week"}\n${weekLabel}`, type: isPerfect ? "perfect" : "complete" };
    });
}

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
  const [photos, setPhotos] = useState({ front: [], side: [], back: [] });
  const [uploading, setUploading] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const fileInputRef = useRef(null);

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

      const resultsSnap = await getDocs(query(collection(db, "assessmentResults"), where("email", "==", u.email)));
      if (!resultsSnap.empty) setAssessmentData(resultsSnap.docs[0].data());

      const logsSnap = await getDocs(query(collection(db, "workoutLogs"), where("userId", "==", u.uid)));
      const logsData = logsSnap.docs
        .map(d => ({ id: d.id, ...d.data(), completedAt: normalizeDate(d.data().completedAt) }))
        .filter(l => l.completedAt);
      setWorkoutCount(logsData.length);
      setAchievements(computeWeeklyAchievements(logsData));

      const photosSnap = await getDocs(query(collection(db, "progressPhotos"), where("userId", "==", u.uid)));
      const grouped = { front: [], side: [], back: [] };
      photosSnap.docs.forEach(d => {
        const p = { id: d.id, ...d.data() };
        if (grouped[p.angle]) grouped[p.angle].push(p);
      });
      Object.keys(grouped).forEach(angle => grouped[angle].sort((a, b) => new Date(b.date) - new Date(a.date)));
      setPhotos(grouped);

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

  const handleCancelSubscription = async () => {
    if (!cancelConfirm) {
      setCancelConfirm(true);
      setTimeout(() => setCancelConfirm(false), 4000);
      return;
    }
    setCancelLoading(true);
    try {
      const fn = httpsCallable(functions, "cancelSubscription");
      await fn();
      setUserData(prev => ({ ...prev, subscriptionCancelAtPeriodEnd: true }));
    } catch (err) {
      console.error(err);
      alert("Could not cancel subscription. Please try again.");
    }
    setCancelLoading(false);
    setCancelConfirm(false);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const date = new Date().toISOString().split("T")[0];
      const storageRef = ref(storage, `progressPhotos/${user.uid}/${Date.now()}_${activePhotoAngle}.jpg`);
      await uploadBytes(storageRef, file);
      const photoUrl = await getDownloadURL(storageRef);
      const docRef = await addDoc(collection(db, "progressPhotos"), {
        userId: user.uid, angle: activePhotoAngle, photoUrl, date, uploadedAt: new Date().toISOString(),
      });
      setPhotos(prev => ({ ...prev, [activePhotoAngle]: [{ id: docRef.id, photoUrl, date }, ...prev[activePhotoAngle]] }));
    } catch (err) {
      console.error(err);
      alert("Upload failed. Please try again.");
    }
    setUploading(false);
    e.target.value = "";
  };

  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-IE", { month: "long", year: "numeric" })
    : "Recently";

  const displayName = userData?.nickname || userData?.firstName || "Member";

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
            ⭐ {
              userData?.subscription === "premium" || userData?.subscription === "premium_trial" ? "Premium Member"
              : userData?.subscription === "online" ? "Online Coaching"
              : userData?.subscription === "hybrid" ? "Hybrid Coaching"
              : userData?.subscription === "in-person" ? "In-Person Coaching"
              : "Free Member"
            }
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
        {achievements.length === 0 && (
          <p style={{ fontSize: "12px", color: "#aaa", padding: "8px 0" }}>Complete your first week to start earning badges here.</p>
        )}
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

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />

      <div style={{ display: "flex", gap: "10px", overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
        <div style={{ flexShrink: 0 }}>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "#aaa", textAlign: "center", marginBottom: "6px" }}>Add new</p>
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            style={{
              width: 110, height: 140, borderRadius: "12px",
              background: "#f0f0f0", border: "1.5px dashed #ccc",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "6px", cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? (
              <span style={{ fontSize: "10px", color: "#aaa", fontWeight: 600 }}>Uploading...</span>
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#ccc" strokeWidth="1.5"/>
                  <path d="M12 8v8M8 12h8" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: "10px", color: "#aaa", fontWeight: 600 }}>Add photo</span>
              </>
            )}
          </div>
        </div>

        {photos[activePhotoAngle].length === 0 ? (
          <div style={{ flexShrink: 0, width: 110, height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontSize: "11px", color: "#bbb", textAlign: "center", padding: "0 8px" }}>No {activePhotoAngle} photos yet</p>
          </div>
        ) : (
          photos[activePhotoAngle].map((p) => (
            <div key={p.id} style={{ flexShrink: 0 }}>
              <p style={{ fontSize: "10px", fontWeight: 700, color: "#aaa", textAlign: "center", marginBottom: "6px" }}>
                {new Date(p.date).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}
              </p>
              <div style={{ width: 110, height: 140, borderRadius: "12px", overflow: "hidden", backgroundColor: "#000" }}>
                <img src={p.photoUrl} alt={`${p.angle} progress photo`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            </div>
          ))
        )}
      </div>

      <button onClick={() => setShowCompare(true)} disabled={photos[activePhotoAngle].length < 2} style={{
        margin: "10px 16px 0", background: "#2d6a4f", color: "#fff",
        border: "none", borderRadius: "12px", padding: "12px",
        fontSize: "14px", fontWeight: 700, cursor: "pointer", width: "calc(100% - 32px)",
        display: "block", opacity: photos[activePhotoAngle].length < 2 ? 0.5 : 1,
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

      {/* SUBSCRIPTION */}
      {userData?.subscription && userData.subscription !== "free" && (
        <div style={{ padding: "16px 16px 0" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaa", marginBottom: "10px" }}>
            Subscription
          </p>
          <div style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>
                {userData.subscription === "premium" || userData.subscription === "premium_trial"
                  ? "Premium Membership"
                  : userData.subscription === "online"
                  ? "Online Coaching"
                  : userData.subscription === "hybrid"
                  ? "Hybrid Coaching"
                  : "In-Person Coaching"}
              </p>
              <span style={{
                fontSize: "11px", fontWeight: 700,
                color: userData.subscriptionCancelAtPeriodEnd ? "#dc2626" : "#2d6a4f",
                backgroundColor: userData.subscriptionCancelAtPeriodEnd ? "#fef2f2" : "#eaf5ef",
                padding: "4px 10px", borderRadius: "20px",
              }}>
                {userData.subscriptionCancelAtPeriodEnd ? "Cancelling" : "Active"}
              </span>
            </div>
            {userData.subscriptionPeriodEnd && (
              <p style={{ fontSize: "12px", color: "#888", margin: "0 0 12px" }}>
                {userData.subscriptionCancelAtPeriodEnd
                  ? `Access ends ${new Date(userData.subscriptionPeriodEnd).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}`
                  : `Next billing: ${new Date(userData.subscriptionPeriodEnd).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}`}
              </p>
            )}
            {!userData.subscriptionCancelAtPeriodEnd && (
              <button
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
                style={{
                  width: "100%",
                  backgroundColor: cancelConfirm ? "#dc2626" : "#f0f0f0",
                  color: cancelConfirm ? "#fff" : "#888",
                  border: "none", borderRadius: "8px",
                  padding: "10px", fontSize: "13px", fontWeight: 700,
                  cursor: cancelLoading ? "default" : "pointer",
                  opacity: cancelLoading ? 0.6 : 1,
                }}
              >
                {cancelLoading ? "Cancelling..." : cancelConfirm ? "Tap again to confirm" : "Cancel subscription"}
              </button>
            )}
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

      {showCompare && (
        <ComparePhotosModal photos={photos[activePhotoAngle]} angle={activePhotoAngle} onClose={() => setShowCompare(false)} />
      )}

    </div>
  );
}

function ComparePhotosModal({ photos, angle, onClose }) {
  const [selected, setSelected] = useState([]);
  const toggleSelect = (id) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };
  const photoA = photos.find(p => p.id === selected[0]);
  const photoB = photos.find(p => p.id === selected[1]);

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: "0 0 4px", textTransform: "capitalize" }}>Compare {angle} Photos</h2>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px" }}>Select two photos to compare side by side.</p>

        {photoA && photoB ? (
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {[photoA, photoB].map(p => (
              <div key={p.id} style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#888", textAlign: "center", marginBottom: 6 }}>
                  {new Date(p.date).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <div style={{ borderRadius: 12, overflow: "hidden", backgroundColor: "#000", aspectRatio: "3/4" }}>
                  <img src={p.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
            {photos.map(p => {
              const isSelected = selected.includes(p.id);
              return (
                <div key={p.id} onClick={() => toggleSelect(p.id)} style={{ position: "relative", borderRadius: 10, overflow: "hidden", backgroundColor: "#000", aspectRatio: "3/4", cursor: "pointer", border: isSelected ? "3px solid #2d6a4f" : "3px solid transparent" }}>
                  <img src={p.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <p style={{ position: "absolute", bottom: 4, left: 0, right: 0, textAlign: "center", fontSize: 10, color: "#fff", fontWeight: 700, textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
                    {new Date(p.date).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}
                  </p>
                  {isSelected && (
                    <div style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", backgroundColor: "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {photoA && photoB && (
          <button onClick={() => setSelected([])} style={{ width: "100%", background: "#f7f5f2", border: "none", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, color: "#2d6a4f", cursor: "pointer", marginBottom: 10 }}>
            Choose different photos
          </button>
        )}
        <button onClick={onClose} style={{ width: "100%", background: "none", border: "none", fontSize: 13, color: "#aaa", cursor: "pointer", padding: 6 }}>Close</button>
      </div>
    </div>
  );
}