import { useState, useEffect } from "react";
import { doc, getDoc, getDocs, collection, query, where, updateDoc, addDoc, orderBy, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { getAuth } from "firebase/auth";
import { Link, useParams, useNavigate } from "react-router-dom";

const TIERS = [
  { id: "free", label: "Free", color: "#888", bg: "#f0f0f0" },
  { id: "premium", label: "Premium", color: "#b45309", bg: "#fffbeb" },
  { id: "premium_trial", label: "Trial", color: "#7c3aed", bg: "#f5f3ff" },
  { id: "online", label: "Online", color: "#0369a1", bg: "#e0f2fe" },
  { id: "hybrid", label: "Hybrid", color: "#0891b2", bg: "#ecfeff" },
  { id: "in-person", label: "In-Person", color: "#2d6a4f", bg: "#eaf5ef" },
];

function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

function tierInfo(tier) { return TIERS.find(t => t.id === tier) || TIERS[0]; }
function getInitials(name) { if (!name) return "?"; return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2); }
function timeAgo(dateStr) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
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

function ActionBtn({ label, icon, onClick, primary }) {
  return (
    <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "12px 8px", borderRadius: "14px", border: `1.5px solid ${primary ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: primary ? "#eaf5ef" : "#fff", cursor: "pointer", width: "100%" }}>
      <span style={{ fontSize: "20px" }}>{icon}</span>
      <span style={{ fontSize: "11px", fontWeight: 700, color: primary ? "#2d6a4f" : "#555", textAlign: "center", lineHeight: 1.2 }}>{label}</span>
    </button>
  );
}

function MiniGraph({ data, color = "#2d6a4f", height = 60 }) {
  if (!data || data.length < 2) return null;
  const clean = data.filter(d => d.value != null && !isNaN(d.value));
  if (clean.length < 2) return null;
  const vals = clean.map(d => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const width = 280;
  const pad = 8;
  const coords = clean.map((d, i) => ({
    x: pad + (i / (clean.length - 1)) * (width - pad * 2),
    y: height - pad - ((d.value - min) / range) * (height - pad * 2),
  }));
  const pts = coords.map(c => `${c.x},${c.y}`).join(" ");
  const fillPts = `${coords[0].x},${height} ${pts} ${coords[coords.length - 1].x},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`g${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#g${color.replace("#","")})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {coords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r="3" fill={color} stroke="#fff" strokeWidth="1.5"/>)}
    </svg>
  );
}

function BarGraph({ data, color = "#4ade80", height = 80 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const width = 280;
  const slotW = (width - 16) / data.length;
  const barW = Math.max(Math.floor(slotW - 4), 4);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block" }}>
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * (height - 24), d.value > 0 ? 3 : 0);
        const x = 8 + i * slotW + (slotW - barW) / 2;
        const y = height - 18 - barH;
        const isLast = i === data.length - 1;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH || 2} rx={3} fill={color} opacity={isLast ? 1 : 0.45}/>
            <text x={x + barW / 2} y={height - 2} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.5)">{d.label}</text>
            {d.value > 0 && <text x={x + barW / 2} y={Math.max(y - 3, 10)} textAnchor="middle" fontSize="9" fill={isLast ? color : "rgba(255,255,255,0.7)"} fontWeight="700">{d.value}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function MultiLineGraph({ data, keys, colors, height = 90 }) {
  if (!data || data.length < 2) return null;
  const width = 280;
  const pad = 8;
  const min = 0;
  const max = 10;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block" }}>
      {keys.map((key, ki) => {
        const coords = data.map((d, i) => ({
          x: pad + (i / (data.length - 1)) * (width - pad * 2),
          y: height - pad - ((d[key] || 0) / max) * (height - pad * 2),
        }));
        const pts = coords.map(c => `${c.x},${c.y}`).join(" ");
        return (
          <g key={key}>
            <polyline points={pts} fill="none" stroke={colors[ki]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
            {coords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r="2.5" fill={colors[ki]} stroke="#fff" strokeWidth="1"/>)}
          </g>
        );
      })}
    </svg>
  );
}

export default function AdminClientProfile() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [programmes, setProgrammes] = useState([]);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [workouts, setWorkouts] = useState({});
  const [capabilityScore, setCapabilityScore] = useState(null);
  const [allScores, setAllScores] = useState([]);
  const [nutritionLogs, setNutritionLogs] = useState([]);
  const [weightLogs, setWeightLogs] = useState([]);
  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("weekly-review");
  const [showTierSheet, setShowTierSheet] = useState(false);
  const [showProgrammeSheet, setShowProgrammeSheet] = useState(null);
  const [showNoteSheet, setShowNoteSheet] = useState(false);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [checkIns, setCheckIns] = useState([]);
  const [viewingCheckIn, setViewingCheckIn] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [resendStatus, setResendStatus] = useState("");
  const [resetEmailStatus, setResetEmailStatus] = useState("");
  const [copyLinkStatus, setCopyLinkStatus] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [editingNutrition, setEditingNutrition] = useState(false);
  const [nutritionForm, setNutritionForm] = useState({ calories: "", protein: "", carbs: "", fat: "" });
  const [exercises, setExercises] = useState({});

  // Wallet state
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [bundlePurchases, setBundlePurchases] = useState([]);
  const [sessionBundles, setSessionBundles] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [showPurchaseSheet, setShowPurchaseSheet] = useState(false);
  const [showAdjustSheet, setShowAdjustSheet] = useState(false);
  const [showMarkSessionSheet, setShowMarkSessionSheet] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({ bundleId: "", paymentMethod: "cash", reference: "", note: "" });
  const [adjustForm, setAdjustForm] = useState({ amount: "", reason: "coach_adjustment", description: "" });
  const [markSessionForm, setMarkSessionForm] = useState({ outcome: "completed", description: "" });
  const [walletSaving, setWalletSaving] = useState(false);

  // Sessions state
  const [clientSessions, setClientSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [showSessionBookSheet, setShowSessionBookSheet] = useState(false);
  const [showCoachSessionSheet, setShowCoachSessionSheet] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [showSessionOutcomeSheet, setShowSessionOutcomeSheet] = useState(false);
  const [selectedClientSession, setSelectedClientSession] = useState(null);
  const [sessionBookForm, setSessionBookForm] = useState({ date: "", time: "", durationMins: 60, type: "in-person", notes: "" });
  const [sessionOutcomeForm, setSessionOutcomeForm] = useState({ outcome: "completed", notes: "", sessionRevenue: "" });
  const [sessionsSaving, setSessionsSaving] = useState(false);

  const ADMIN_UID = "wKbgHNtTMtS01BQ4ddfAwTQaIgA3";

  const SESSION_OUTCOME_OPTIONS = [
    { value: "completed",      label: "Completed",             emoji: "✅", credits: -1 },
    { value: "no_show",        label: "No Show",               emoji: "🚫", credits: -1 },
    { value: "late_cancelled", label: "Late Cancelled",        emoji: "⚠️", credits: -1 },
    { value: "cancelled",      label: "Cancelled with Notice", emoji: "❌", credits: 0  },
  ];

  const SESSION_STATUS_STYLES = {
    scheduled:      { color: "#0369a1", bg: "#e0f2fe", label: "Scheduled" },
    completed:      { color: "#166534", bg: "#dcfce7", label: "Completed" },
    no_show:        { color: "#9a3412", bg: "#fee2e2", label: "No Show" },
    late_cancelled: { color: "#92400e", bg: "#fef3c7", label: "Late Cancel" },
    cancelled:      { color: "#6b7280", bg: "#f3f4f6", label: "Cancelled" },
  };

  function getClientSessionRate() {
    const sorted = [...bundlePurchases]
      .filter(p => p.sessionCredits > 0 && p.pricePaid > 0)
      .sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
    if (!sorted.length) return 60;
    return Math.round((sorted[0].pricePaid / sorted[0].sessionCredits) * 100) / 100;
  }

  function formatSessionDateTime(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" })
      + " at "
      + d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
  }

  useEffect(() => { loadAll(); }, [uid]);
  useEffect(() => { if (activeTab === "wallet") loadWallet(); }, [activeTab, uid]);
  useEffect(() => { if (activeTab === "sessions") loadClientSessions(); }, [activeTab, uid]);
  useEffect(() => { if (activeTab === "timeline") loadTimeline(); }, [activeTab, uid]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        const data = { uid, ...userSnap.data() };
        setClient(data);
        setNutritionForm({
          calories: data.nutritionTargets?.calories || "",
          protein: data.nutritionTargets?.protein || "",
          carbs: data.nutritionTargets?.carbs || "",
          fat: data.nutritionTargets?.fat || "",
        });
      }

      const [progSnap, logsSnap, workoutsSnap, notesSnap, weightSnap, exercisesSnap] = await Promise.all([
        getDocs(collection(db, "programmes")),
        getDocs(collection(db, "workoutLogs")),
        getDocs(collection(db, "workouts")),
        getDocs(collection(db, "clientNotes")),
        getDocs(query(collection(db, "weightLogs"), where("userId", "==", uid))),
        getDocs(collection(db, "exercises")),
      ]);

      setProgrammes(progSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.published));

      const myLogs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(l => l.userId === uid)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
      setWorkoutLogs(myLogs);

      const wkMap = {};
      workoutsSnap.docs.forEach(d => { wkMap[d.id] = d.data(); });
      setWorkouts(wkMap);

      const exMap = {};
      exercisesSnap.docs.forEach(d => { exMap[d.id] = d.data(); });
      setExercises(exMap);

      setNotes(notesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(n => n.clientId === uid)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

      setWeightLogs(weightSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(a.date) - new Date(b.date)));

      const userData = userSnap.data();
      if (userData?.email) {
        const [scoreSnap, consultSnap, nutritionSnap] = await Promise.all([
          getDocs(query(collection(db, "assessmentResults"), where("email", "==", userData.email))),
          getDocs(query(collection(db, "consultations"), where("email", "==", userData.email.toLowerCase()))),
          getDocs(collection(db, "nutritionLogs")),
        ]);

        const scores = scoreSnap.docs.map(d => d.data()).sort((a, b) => new Date(a.assessmentDate) - new Date(b.assessmentDate));
        setAllScores(scores);
        if (scores.length > 0) setCapabilityScore(scores[scores.length - 1]);

        if (!consultSnap.empty) {
          setConsultation(consultSnap.docs[0].data());
        }

        const myNutrition = nutritionSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(l => l.userId === uid)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 30);
        setNutritionLogs(myNutrition);
      }
      const checkInSnap = await getDocs(query(collection(db, "checkIns"), where("userId", "==", uid)));
      setCheckIns(checkInSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)));

    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const updateTier = async (tier) => {
    setSaving(true);
    await updateDoc(doc(db, "users", uid), { subscription: tier });
    setClient(prev => ({ ...prev, subscription: tier }));
    setShowTierSheet(false);
    setSaving(false);
  };

  const assignProgramme = async (type, programmeId) => {
    setSaving(true);
    const field = type === "strength" ? "strengthProgrammeId" : "cardioProgrammeId";
    await updateDoc(doc(db, "users", uid), { [field]: programmeId });
    setClient(prev => ({ ...prev, [field]: programmeId }));
    setShowProgrammeSheet(null);
    setSaving(false);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    const noteData = { clientId: uid, note: newNote.trim(), createdAt: new Date().toISOString() };
    const ref = await addDoc(collection(db, "clientNotes"), noteData);
    setNotes(prev => [{ id: ref.id, ...noteData }, ...prev]);
    setNewNote("");
    setShowNoteSheet(false);
    setSaving(false);
  };

  const saveNutritionTargets = async () => {
    setSaving(true);
    const targets = {
      calories: Number(nutritionForm.calories),
      protein: Number(nutritionForm.protein),
      carbs: Number(nutritionForm.carbs),
      fat: Number(nutritionForm.fat),
    };
    await updateDoc(doc(db, "users", uid), { nutritionTargets: targets });
    setClient(prev => ({ ...prev, nutritionTargets: targets }));
    setEditingNutrition(false);
    setSaving(false);
  };

  const sendReply = async (checkInId) => {
    if (!replyText.trim() && !videoUrl.trim()) return;
    setSendingReply(true);
    const update = {
      coachReply: replyText.trim(),
      coachVideoUrl: videoUrl.trim() || null,
      replyAt: new Date().toISOString(),
      replyRead: false,
    };
    await updateDoc(doc(db, "checkIns", checkInId), update);
    setCheckIns(prev => prev.map(c => c.id === checkInId ? { ...c, ...update } : c));
    if (viewingCheckIn?.id === checkInId) setViewingCheckIn(prev => ({ ...prev, ...update }));
    setReplyText("");
    setVideoUrl("");
    setSendingReply(false);
  };

  const callPasswordReset = async (email) => {
    const res = await fetch("https://us-central1-trainingforlife-1422f.cloudfunctions.net/sendPasswordReset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error("Failed");
  };

  const sendWelcomeEmail = async () => {
    if (!client.email) return;
    setResendStatus("sending");
    try {
      await callPasswordReset(client.email);
      await updateDoc(doc(db, "users", uid), { welcomeSent: true, welcomeSentAt: new Date().toISOString() });
      setClient(prev => ({ ...prev, welcomeSent: true, welcomeSentAt: new Date().toISOString() }));
      setResendStatus("sent");
      setTimeout(() => setResendStatus(""), 3000);
    } catch (e) {
      setResendStatus("error");
      setTimeout(() => setResendStatus(""), 3000);
    }
  };

  const sendResetEmail = async () => {
    if (!client.email) return;
    setResetEmailStatus("sending");
    try {
      await callPasswordReset(client.email);
      setResetEmailStatus("sent");
      setTimeout(() => setResetEmailStatus(""), 3000);
    } catch (e) {
      setResetEmailStatus("error");
      setTimeout(() => setResetEmailStatus(""), 3000);
    }
  };

  const copyResetLink = async () => {
    if (!client.email) return;
    setCopyLinkStatus("loading");
    try {
      const idToken = await getAuth().currentUser.getIdToken();
      const res = await fetch("https://us-central1-trainingforlife-1422f.cloudfunctions.net/adminGenerateResetLink", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
        body: JSON.stringify({ email: client.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await navigator.clipboard.writeText(data.link);
      setCopyLinkStatus("copied");
      setTimeout(() => setCopyLinkStatus(""), 3000);
    } catch (e) {
      setCopyLinkStatus("error");
      setTimeout(() => setCopyLinkStatus(""), 3000);
    }
  };

  const deleteClient = async () => {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const idToken = await getAuth().currentUser.getIdToken();
      const res = await fetch("https://us-central1-trainingforlife-1422f.cloudfunctions.net/adminDeleteClient", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
        body: JSON.stringify({ uid }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      navigate("/admin/clients");
    } catch (e) {
      setDeleteError(e.message || "Delete failed. Try again.");
      setDeleteLoading(false);
    }
  };

  // ── WALLET ──────────────────────────────────────────────────────────────
  const loadWallet = async () => {
    setWalletLoading(true);
    try {
      const [txSnap, purchaseSnap, bundleSnap] = await Promise.all([
        getDocs(query(collection(db, "walletTransactions"), where("clientId", "==", uid))),
        getDocs(query(collection(db, "bundlePurchases"), where("clientId", "==", uid))),
        getDocs(collection(db, "sessionBundles")),
      ]);
      const txs = txSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setWalletTransactions(txs);
      setBundlePurchases(purchaseSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt)));
      setSessionBundles(bundleSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(b => b.isActive !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    } catch (e) { console.error(e); }
    setWalletLoading(false);
  };

  const computeBalance = () => walletTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const addBundlePurchase = async () => {
    if (!purchaseForm.bundleId) return;
    const bundle = sessionBundles.find(b => b.id === purchaseForm.bundleId);
    if (!bundle) return;
    setWalletSaving(true);
    try {
      const now = new Date().toISOString();
      const expiresAt = bundle.expiryDays
        ? new Date(Date.now() + bundle.expiryDays * 86400000).toISOString()
        : null;
      const gracePeriodEndsAt = expiresAt && bundle.gracePeriodDays
        ? new Date(new Date(expiresAt).getTime() + (bundle.gracePeriodDays || 7) * 86400000).toISOString()
        : null;

      // Compute current balance before adding
      const currentBalance = computeBalance();
      const balanceAfter = currentBalance + bundle.sessionCredits;

      // Create wallet transaction first
      const txData = {
        clientId: uid,
        amount: bundle.sessionCredits,
        reason: "bundle_purchase",
        description: `+${bundle.sessionCredits} credits — ${bundle.name} (€${bundle.price})`,
        performedByUserId: "admin",
        balanceAfter,
        bundlePurchaseId: null,
        sessionId: null,
        isAutomatic: false,
        createdAt: now,
      };
      const txRef = await addDoc(collection(db, "walletTransactions"), txData);

      // Create bundle purchase record
      const purchaseData = {
        clientId: uid,
        bundleId: purchaseForm.bundleId,
        bundleName: bundle.name,
        sessionCredits: bundle.sessionCredits,
        pricePaid: bundle.price,
        paymentMethod: purchaseForm.paymentMethod,
        paymentReference: purchaseForm.reference.trim() || null,
        purchasedAt: now,
        expiresAt,
        gracePeriodEndsAt,
        status: "active",
        walletTransactionId: txRef.id,
        notes: purchaseForm.note.trim() || null,
        createdAt: now,
      };
      const purchaseRef = await addDoc(collection(db, "bundlePurchases"), purchaseData);

      // Update tx with bundlePurchaseId
      await updateDoc(doc(db, "walletTransactions", txRef.id), { bundlePurchaseId: purchaseRef.id });

      // Update local state
      const newTx = { id: txRef.id, ...txData, bundlePurchaseId: purchaseRef.id };
      setWalletTransactions(prev => [newTx, ...prev]);
      setBundlePurchases(prev => [{ id: purchaseRef.id, ...purchaseData }, ...prev]);
      setPurchaseForm({ bundleId: "", paymentMethod: "cash", reference: "", note: "" });
      setShowPurchaseSheet(false);
    } catch (e) { console.error(e); }
    setWalletSaving(false);
  };

  const addManualAdjustment = async () => {
    if (!adjustForm.amount || !adjustForm.description.trim()) return;
    setWalletSaving(true);
    try {
      const currentBalance = computeBalance();
      const delta = Number(adjustForm.amount);
      const balanceAfter = currentBalance + delta;
      const now = new Date().toISOString();
      const txData = {
        clientId: uid,
        amount: delta,
        reason: adjustForm.reason,
        description: adjustForm.description.trim(),
        performedByUserId: "admin",
        balanceAfter,
        bundlePurchaseId: null,
        sessionId: null,
        isAutomatic: false,
        createdAt: now,
      };
      const ref = await addDoc(collection(db, "walletTransactions"), txData);
      setWalletTransactions(prev => [{ id: ref.id, ...txData }, ...prev]);
      setAdjustForm({ amount: "", reason: "coach_adjustment", description: "" });
      setShowAdjustSheet(false);
    } catch (e) { console.error(e); }
    setWalletSaving(false);
  };

  const markSession = async () => {
    if (!markSessionForm.description.trim()) return;
    setWalletSaving(true);
    try {
      const DEDUCT_OUTCOMES = ["completed", "no_show", "late_cancelled"];
      const deduct = DEDUCT_OUTCOMES.includes(markSessionForm.outcome);
      const currentBalance = computeBalance();
      if (deduct && currentBalance < 1) {
        alert("Cannot deduct: client has 0 credits. Add a bundle first.");
        setWalletSaving(false);
        return;
      }
      const delta = deduct ? -1 : 0;
      const REASON_MAP = {
        completed: "session_completed",
        no_show: "no_show",
        late_cancelled: "late_cancellation",
        cancelled: "cancelled",
      };
      const LABEL_MAP = {
        completed: "Session completed",
        no_show: "No show",
        late_cancelled: "Late cancellation",
        cancelled: "Cancelled (no charge)",
      };
      const balanceAfter = currentBalance + delta;
      const now = new Date().toISOString();
      const txData = {
        clientId: uid,
        amount: delta,
        reason: REASON_MAP[markSessionForm.outcome] || "session_completed",
        description: `${LABEL_MAP[markSessionForm.outcome] || "Session"} — ${markSessionForm.description.trim()}`,
        performedByUserId: "admin",
        balanceAfter,
        bundlePurchaseId: null,
        sessionId: null,
        isAutomatic: false,
        creditDeducted: deduct,
        createdAt: now,
      };
      if (deduct) {
        const ref = await addDoc(collection(db, "walletTransactions"), txData);
        setWalletTransactions(prev => [{ id: ref.id, ...txData }, ...prev]);
      }
      setMarkSessionForm({ outcome: "completed", description: "" });
      setShowMarkSessionSheet(false);
    } catch (e) { console.error(e); }
    setWalletSaving(false);
  };

  // ── TIMELINE ─────────────────────────────────────────────────────────────
  const loadTimeline = async () => {
    setTimelineLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, "clientTimeline"),
        where("clientId", "==", uid),
        orderBy("detectedAt", "desc")
      ));
      setTimeline(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setTimelineLoading(false);
  };

  // ── SESSIONS ────────────────────────────────────────────────────────────
  const loadClientSessions = async () => {
    setSessionsLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "sessions"), where("clientId", "==", uid)));
      setClientSessions(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
            const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date);
            return db2 - da;
          })
      );
    } catch (e) { console.error(e); }
    setSessionsLoading(false);
  };

  const bookClientSession = async () => {
    if (!sessionBookForm.date || !sessionBookForm.time) return;
    setSessionsSaving(true);
    try {
      const dateTime = new Date(`${sessionBookForm.date}T${sessionBookForm.time}`);
      await addDoc(collection(db, "sessions"), {
        clientId: uid,
        clientName: client?.nickname || client?.firstName || client?.email || uid,
        date: Timestamp.fromDate(dateTime),
        durationMins: Number(sessionBookForm.durationMins),
        type: sessionBookForm.type,
        status: "scheduled",
        notes: sessionBookForm.notes.trim() || null,
        walletTxId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setShowSessionBookSheet(false);
      setSessionBookForm({ date: "", time: "", durationMins: 60, type: "in-person", notes: "" });
      await loadClientSessions();
    } catch (e) { console.error(e); }
    setSessionsSaving(false);
  };

  const markClientSessionOutcome = async () => {
    if (!selectedClientSession) return;
    setSessionsSaving(true);
    try {
      const opt = SESSION_OUTCOME_OPTIONS.find(o => o.value === sessionOutcomeForm.outcome);
      const credits = opt?.credits ?? 0;
      let walletTxId = null;
      if (credits !== 0) {
        const REASON_MAP = { completed: "session_completed", no_show: "no_show", late_cancelled: "late_cancellation" };
        const txRef = await addDoc(collection(db, "walletTransactions"), {
          clientId: uid,
          amount: credits,
          reason: REASON_MAP[sessionOutcomeForm.outcome] || "session_completed",
          description: sessionOutcomeForm.notes.trim() ||
            `${opt?.label} — ${formatSessionDateTime(selectedClientSession.date)}`,
          performedByUserId: ADMIN_UID,
          sessionId: selectedClientSession.id,
          bundlePurchaseId: null,
          isAutomatic: false,
          creditDeducted: true,
          createdAt: new Date().toISOString(),
        });
        walletTxId = txRef.id;
      }
      await updateDoc(doc(db, "sessions", selectedClientSession.id), {
        status: sessionOutcomeForm.outcome,
        walletTxId,
        outcomeNotes: sessionOutcomeForm.notes.trim() || null,
        sessionRevenue: credits !== 0 ? Number(sessionOutcomeForm.sessionRevenue) || 0 : 0,
        updatedAt: new Date().toISOString(),
      });
      setShowSessionOutcomeSheet(false);
      setSelectedClientSession(null);
      setSessionOutcomeForm({ outcome: "completed", notes: "" });
      await loadClientSessions();
    } catch (e) { console.error(e); }
    setSessionsSaving(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 24px" }}>
        <Link to="/admin/clients" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>← Clients</Link>
      </div>
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
    </div>
  );

  if (!client) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 24px" }}>
        <Link to="/admin/clients" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>← Clients</Link>
      </div>
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Client not found.</p>
    </div>
  );

  const tier = tierInfo(client.subscription || "free");
  const displayName = client.nickname || client.firstName || client.email?.split("@")[0] || "Unknown";
  const strengthProgramme = programmes.find(p => p.id === client.strengthProgrammeId);
  const cardioProgramme = programmes.find(p => p.id === client.cardioProgrammeId);
  const { monday, sunday } = getWeekRange();
  const thisWeekLogs = workoutLogs.filter(l => { const d = new Date(l.completedAt); return d >= monday && d <= sunday; });
  const strengthOptions = programmes.filter(p => p.tag !== "cardio" && p.tag !== "walk");
  const cardioOptions = programmes.filter(p => p.tag === "cardio" || p.tag === "walk" || p.repeating);

  // Nutrition stats
  const nutritionTargets = client.nutritionTargets || {};
  const recentNutrition = nutritionLogs.slice(0, 7);
  const avgProtein = recentNutrition.length > 0
    ? Math.round(recentNutrition.reduce((s, d) => {
        const foods = Object.values(d.meals || {}).flat();
        return s + foods.reduce((sum, f) => sum + (f.protein || 0), 0);
      }, 0) / recentNutrition.length)
    : 0;
  const avgCalories = recentNutrition.length > 0
    ? Math.round(recentNutrition.reduce((s, d) => {
        const foods = Object.values(d.meals || {}).flat();
        return s + foods.reduce((sum, f) => sum + (f.calories || 0), 0);
      }, 0) / recentNutrition.length)
    : 0;

  const TABS = ["weekly-review", "sessions", "timeline", "wallet", "overview", "training", "nutrition", "metrics", "check-ins", "notes"];

  // ── Weekly review computed values ──
  const getWM = (d) => { const dt = new Date(d); const day = dt.getDay(); dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1)); dt.setHours(0,0,0,0); return dt.toISOString().split("T")[0]; };
  const weekBars = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (7 - i) * 7);
    const mon = getWM(d);
    const count = workoutLogs.filter(l => getWM(l.completedAt) === mon).length;
    return { label: i === 7 ? "Now" : `W${i - 7}`, value: count };
  });
  const activeWeeks = weekBars.filter(w => w.value > 0).length;
  const avgSessions = (weekBars.reduce((s, w) => s + w.value, 0) / 8).toFixed(1);
  let streak = 0;
  for (let i = weekBars.length - 1; i >= 0; i--) { if (weekBars[i].value > 0) streak++; else break; }
  const ciTrend = checkIns.filter(c => !c.coachInitiated && c.answers).slice(0, 8).reverse();
  const wins = checkIns.filter(c => !c.coachInitiated && c.answers?.win).slice(0, 4);
  const prMap = {};
  workoutLogs.forEach(log => {
    Object.entries(log.logs || {}).forEach(([exId, sets]) => {
      if (!Array.isArray(sets)) return;
      sets.filter(s => s.done && parseFloat(s.weight) > 0).forEach(s => {
        const w = parseFloat(s.weight);
        if (!prMap[exId] || w > prMap[exId].weight) {
          prMap[exId] = { weight: w, reps: s.reps, date: log.completedAt, name: exercises[exId]?.name || null };
        }
      });
    });
  });
  const topPRs = Object.values(prMap).filter(p => p.name).sort((a, b) => b.weight - a.weight).slice(0, 6);
  const weightChange = weightLogs.length >= 2
    ? (weightLogs[weightLogs.length - 1].weight - weightLogs[0].weight).toFixed(1)
    : null;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 28px" }}>
        <Link to="/admin/clients" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>← Clients</Link>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "14px" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: tier.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 700, color: tier.color, flexShrink: 0 }}>
            {getInitials(displayName)}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>{displayName}</h1>
            <p style={{ fontSize: "13px", color: "#9fe1cb", margin: "0 0 6px" }}>{client.email}</p>
            {(client.adminCreated || client.createdByAdmin) && (
              <button onClick={sendWelcomeEmail} disabled={resendStatus === "sending"} style={{ background: "none", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "20px", padding: "4px 10px", fontSize: "11px", fontWeight: 700, color: resendStatus === "sent" ? "#4ade80" : resendStatus === "error" ? "#f87171" : client.welcomeSent ? "#9fe1cb" : "#f7c948", cursor: "pointer" }}>
                {resendStatus === "sending" ? "Sending..." : resendStatus === "sent" ? "✓ Welcome sent" : resendStatus === "error" ? "Failed" : client.welcomeSent ? "Resend welcome email" : "Send welcome email"}
              </button>
            )}
          </div>
          <div onClick={() => setShowTierSheet(true)} style={{ backgroundColor: tier.bg, color: tier.color, fontSize: "12px", fontWeight: 700, padding: "6px 12px", borderRadius: "20px", cursor: "pointer" }}>
            {tier.label}
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
          {[
            { label: "Sessions", value: workoutLogs.length },
            { label: "This week", value: thisWeekLogs.length },
            { label: "Last active", value: workoutLogs.length > 0 ? timeAgo(workoutLogs[0].completedAt) : "Never" },
            { label: "Score", value: capabilityScore ? `${capabilityScore.capabilityScore}/65` : "—" },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, textAlign: "center" }}>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: "10px", color: "#9fe1cb", margin: "3px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Password reset actions */}
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button
            onClick={sendResetEmail}
            disabled={resetEmailStatus === "sending"}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: "12px",
              border: "1.5px solid rgba(159,225,203,0.4)",
              backgroundColor: resetEmailStatus === "sent" ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.08)",
              color: resetEmailStatus === "sent" ? "#4ade80" : resetEmailStatus === "error" ? "#f87171" : "#9fe1cb",
              fontSize: "12px",
              fontWeight: 700,
              cursor: resetEmailStatus === "sending" ? "default" : "pointer",
              letterSpacing: "0.02em",
            }}
          >
            {resetEmailStatus === "sending" ? "Sending..." : resetEmailStatus === "sent" ? "Reset sent" : resetEmailStatus === "error" ? "Failed" : "Send Reset Email"}
          </button>
          <button
            onClick={copyResetLink}
            disabled={copyLinkStatus === "loading"}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: "12px",
              border: "1.5px solid rgba(159,225,203,0.4)",
              backgroundColor: copyLinkStatus === "copied" ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.08)",
              color: copyLinkStatus === "copied" ? "#4ade80" : copyLinkStatus === "error" ? "#f87171" : "#9fe1cb",
              fontSize: "12px",
              fontWeight: 700,
              cursor: copyLinkStatus === "loading" ? "default" : "pointer",
              letterSpacing: "0.02em",
            }}
          >
            {copyLinkStatus === "loading" ? "Generating..." : copyLinkStatus === "copied" ? "Copied!" : copyLinkStatus === "error" ? "Failed" : "Copy Reset Link"}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", backgroundColor: "#fff", borderBottom: "0.5px solid #e5e5e5", overflowX: "auto" }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ flexShrink: 0, padding: "12px 14px", border: "none", backgroundColor: "transparent", fontSize: "13px", fontWeight: 700, color: activeTab === tab ? "#2d6a4f" : "#aaa", cursor: "pointer", borderBottom: activeTab === tab ? "2px solid #2d6a4f" : "2px solid transparent", textTransform: "capitalize" }}>
            {tab === "weekly-review" ? "Weekly Review" : tab === "check-ins" ? "Check-ins" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px" }}>

        {/* ── WEEKLY REVIEW TAB ── */}
        {activeTab === "weekly-review" && (
          <>
            {/* Scorecard */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              {[
                { label: "This week", value: weekBars[7].value, unit: "sessions" },
                { label: "Streak", value: streak, unit: "wks", highlight: streak >= 4 },
                { label: "Avg / wk", value: avgSessions, unit: "" },
              ].map(s => (
                <div key={s.label} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 10px", textAlign: "center" }}>
                  <p style={{ fontSize: "26px", fontWeight: 700, color: s.highlight ? "#f59e0b" : "#2d6a4f", margin: 0, lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: "10px", color: "#aaa", margin: "4px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Consistency bar chart */}
            <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "16px", marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>Consistency</p>
                  <p style={{ fontSize: "11px", color: "#9fe1cb", margin: 0 }}>Sessions per week, last 8 weeks</p>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#4ade80", backgroundColor: "rgba(74,222,128,0.15)", padding: "4px 10px", borderRadius: "20px" }}>
                  {activeWeeks}/8 active
                </span>
              </div>
              <BarGraph data={weekBars} color="#4ade80" />
            </div>

            {/* Check-in trends */}
            {ciTrend.length >= 2 && (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Check-in Trends</p>
                  <span style={{ fontSize: "11px", color: "#aaa" }}>Last {ciTrend.length} weeks</span>
                </div>
                <MultiLineGraph
                  data={ciTrend.map(c => ({ training: c.answers.training, energy: c.answers.energy, sleep: c.answers.sleep, stress: c.answers.stress }))}
                  keys={["training", "energy", "sleep", "stress"]}
                  colors={["#2d6a4f", "#f59e0b", "#3b82f6", "#ef4444"]}
                />
                <div style={{ display: "flex", gap: "12px", marginTop: "10px", flexWrap: "wrap" }}>
                  {[{ label: "Training", color: "#2d6a4f" }, { label: "Energy", color: "#f59e0b" }, { label: "Sleep", color: "#3b82f6" }, { label: "Stress", color: "#ef4444" }].map(item => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: item.color }} />
                      <span style={{ fontSize: "11px", color: "#888" }}>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", marginTop: "12px" }}>
                  {["training", "energy", "sleep", "stress"].map((key, i) => {
                    const avg = (ciTrend.reduce((s, c) => s + (c.answers[key] || 0), 0) / ciTrend.length).toFixed(1);
                    const colors = ["#2d6a4f", "#f59e0b", "#3b82f6", "#ef4444"];
                    return (
                      <div key={key} style={{ backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
                        <p style={{ fontSize: "20px", fontWeight: 700, color: colors[i], margin: 0, lineHeight: 1 }}>{avg}</p>
                        <p style={{ fontSize: "10px", color: "#aaa", margin: "3px 0 0", textTransform: "capitalize" }}>{key}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Wins */}
            {wins.length > 0 && (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Recent Wins</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {wins.map((w, i) => (
                    <div key={i} style={{ backgroundColor: "#eaf5ef", borderRadius: "12px", padding: "12px 14px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                      <span style={{ fontSize: "16px", flexShrink: 0 }}>🏆</span>
                      <div>
                        <p style={{ fontSize: "14px", color: "#1a4a35", lineHeight: 1.5, margin: "0 0 4px", fontStyle: "italic" }}>"{w.answers.win}"</p>
                        <p style={{ fontSize: "11px", color: "#888", margin: 0 }}>
                          {new Date(w.weekOf + "T12:00:00").toLocaleDateString("en-IE", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Personal Records */}
            {topPRs.length > 0 && (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Personal Records</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {topPRs.map((pr, i) => (
                    <div key={i} style={{ backgroundColor: i === 0 ? "#1a3a2a" : "#f7f5f2", borderRadius: "12px", padding: "14px 12px" }}>
                      <p style={{ fontSize: "10px", fontWeight: 700, color: i === 0 ? "#9fe1cb" : "#888", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.name}</p>
                      <p style={{ fontSize: "24px", fontWeight: 700, color: i === 0 ? "#fff" : "#2d6a4f", margin: 0, lineHeight: 1 }}>{pr.weight}<span style={{ fontSize: "13px", fontWeight: 400 }}>kg</span></p>
                      {pr.reps && <p style={{ fontSize: "11px", color: i === 0 ? "#9fe1cb" : "#888", margin: "4px 0 0" }}>x{pr.reps} reps</p>}
                      <p style={{ fontSize: "10px", color: i === 0 ? "rgba(159,225,203,0.6)" : "#aaa", margin: "3px 0 0" }}>{timeAgo(pr.date)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weight trend */}
            {weightLogs.length > 0 && (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Body Weight</p>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "22px", fontWeight: 700, color: "#2d6a4f", margin: 0, lineHeight: 1 }}>{weightLogs[weightLogs.length - 1].weight}kg</p>
                    {weightChange !== null && parseFloat(weightChange) !== 0 && (
                      <p style={{ fontSize: "12px", fontWeight: 700, color: parseFloat(weightChange) < 0 ? "#2d6a4f" : "#ef4444", margin: "3px 0 0" }}>
                        {parseFloat(weightChange) > 0 ? "+" : ""}{weightChange}kg total
                      </p>
                    )}
                  </div>
                </div>
                <MiniGraph data={weightLogs.map(l => ({ value: l.weight, date: l.date }))} color="#3b82f6" />
              </div>
            )}

            {/* Capability score */}
            {allScores.length > 0 && (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Capability Score</p>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "3px 10px", borderRadius: "10px" }}>
                    {allScores[allScores.length - 1].category}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: allScores.length >= 2 ? "12px" : 0 }}>
                  <p style={{ fontSize: "52px", fontWeight: 700, color: "#2d6a4f", margin: 0, lineHeight: 1 }}>{allScores[allScores.length - 1].capabilityScore}</p>
                  <div>
                    <p style={{ fontSize: "13px", color: "#555", margin: 0 }}>out of 65</p>
                    {allScores.length >= 2 && (() => {
                      const delta = allScores[allScores.length - 1].capabilityScore - allScores[0].capabilityScore;
                      return (
                        <p style={{ fontSize: "13px", fontWeight: 700, color: delta >= 0 ? "#2d6a4f" : "#ef4444", margin: "4px 0 0" }}>
                          {delta >= 0 ? "+" : ""}{delta} from first test
                        </p>
                      );
                    })()}
                  </div>
                </div>
                {allScores.length >= 2 && <MiniGraph data={allScores.map(s => ({ value: s.capabilityScore, date: s.assessmentDate }))} />}
              </div>
            )}

            {workoutLogs.length === 0 && checkIns.length === 0 && weightLogs.length === 0 && (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "32px", textAlign: "center" }}>
                <p style={{ fontSize: "28px", margin: "0 0 10px" }}>📊</p>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No data yet</p>
                <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Data will appear here as {displayName} starts logging sessions and check-ins.</p>
              </div>
            )}
          </>
        )}

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <>
            {/* PAR-Q */}
            {client.parQComplete && (
              <div style={{ backgroundColor: client.parQFlag ? "#fffbeb" : "#eaf5ef", borderRadius: "16px", border: `0.5px solid ${client.parQFlag ? "#fcd34d" : "#86efac"}`, padding: "14px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "24px" }}>{client.parQFlag ? "⚠️" : "✅"}</span>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: client.parQFlag ? "#b45309" : "#2d6a4f", margin: 0 }}>
                    {client.parQFlag ? "PAR-Q Flag -- follow up required" : "PAR-Q complete -- all clear"}
                  </p>
                  <p style={{ fontSize: "12px", color: "#888", margin: "3px 0 0" }}>
                    {client.parQDate ? new Date(client.parQDate).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }) : ""}
                  </p>
                </div>
              </div>
            )}

            {/* Consultation */}
            {consultation && (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Consultation Form</p>
                {[
                  { label: "What they want help with", value: consultation.helpWith },
                  { label: "What feels most limiting", value: consultation.limiting },
                  { label: "What they want to feel capable of", value: consultation.capable },
                  { label: "Pain or injuries", value: consultation.pain },
                  { label: "Anything else", value: consultation.other },
                ].filter(i => i.value).map(item => (
                  <div key={item.label} style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "0.5px solid #f5f5f5" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 3px" }}>{item.label}</p>
                    <p style={{ fontSize: "14px", color: "#111", margin: 0, lineHeight: 1.5 }}>{item.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Profile */}
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Profile</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Gender", value: client.gender ? client.gender.charAt(0).toUpperCase() + client.gender.slice(1) : "Not set" },
                  { label: "Date of birth", value: client.dob ? new Date(client.dob).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }) : "Not set" },
                  { label: "Age", value: client.dob ? `${new Date().getFullYear() - new Date(client.dob).getFullYear()} years` : "Not set" },
                  { label: "Height", value: client.height ? `${client.height}${client.units === "imperial" ? "ft" : "cm"}` : "Not set" },
                  { label: "Weight", value: client.weightPrivate ? "Prefer not to say" : client.weight ? `${client.weight}${client.units === "imperial" ? "lbs" : "kg"}` : "Not set" },
                  { label: "Goal weight", value: client.noGoalWeight ? "No goal" : client.goalWeight ? `${client.goalWeight}${client.units === "imperial" ? "lbs" : "kg"}` : "Not set" },
                  { label: "Primary goal", value: client.goal ? client.goal.charAt(0).toUpperCase() + client.goal.slice(1) : "Not set" },
                  { label: "Training days", value: client.daysPerWeek ? `${client.daysPerWeek}x per week` : "Not set" },
                  { label: "Joined", value: client.createdAt ? new Date(client.createdAt).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" }) : "Unknown" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "0.5px solid #f5f5f5" }}>
                    <span style={{ fontSize: "13px", color: "#888" }}>{item.label}</span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#111" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Capability standards */}
            {client.capabilityStandards && (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Capability Standards</p>
                <div style={{ display: "flex", gap: "10px", marginBottom: capabilityScore ? "12px" : 0 }}>
                  {[
                    { icon: "🏋️", label: "Bench", value: `${client.capabilityStandards.bench}kg` },
                    { icon: "💪", label: "Deadlift", value: `${client.capabilityStandards.deadlift}kg` },
                    { icon: "🏃", label: "5k", value: client.capabilityStandards.run5k },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, backgroundColor: "#eaf5ef", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
                      <p style={{ fontSize: "18px", margin: "0 0 4px" }}>{s.icon}</p>
                      <p style={{ fontSize: "16px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{s.value}</p>
                      <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>{s.label}</p>
                    </div>
                  ))}
                </div>
                {capabilityScore && (
                  <div style={{ padding: "10px 12px", backgroundColor: "#f7f5f2", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", color: "#555" }}>Capability Score</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "18px", fontWeight: 700, color: "#2d6a4f" }}>{capabilityScore.capabilityScore} / 65</span>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "2px 8px", borderRadius: "10px" }}>{capabilityScore.category}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── TRAINING TAB ── */}
        {activeTab === "training" && (
          <>
            {/* Programmes */}
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Programmes</p>
              {[
                { label: "Strength", prog: strengthProgramme, type: "strength" },
                { label: "Cardio", prog: cardioProgramme, type: "cardio" },
              ].map(item => (
                <div key={item.type} style={{ marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: 0 }}>{item.label}</p>
                    <button onClick={() => setShowProgrammeSheet(item.type)} style={{ background: "none", border: "none", fontSize: "12px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer", padding: 0 }}>
                      {item.prog ? "Change" : "Assign"}
                    </button>
                  </div>
                  {item.prog ? (
                    <div style={{ backgroundColor: "#eaf5ef", borderRadius: "10px", padding: "10px 12px" }}>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#1a4a35", margin: 0 }}>{item.prog.name}</p>
                    </div>
                  ) : (
                    <div onClick={() => setShowProgrammeSheet(item.type)} style={{ padding: "10px", borderRadius: "10px", border: "1.5px dashed #e5e5e5", textAlign: "center", cursor: "pointer" }}>
                      <p style={{ fontSize: "12px", color: "#aaa", margin: 0 }}>No {item.label.toLowerCase()} programme assigned</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* All sessions */}
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>
                All Sessions ({workoutLogs.length})
              </p>
              {workoutLogs.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#aaa", textAlign: "center", padding: "20px 0" }}>No sessions logged yet</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                  {workoutLogs.map(log => {
                    const workout = workouts[log.workoutId];
                    const totalSets = Object.values(log.logs || {}).reduce((s, sets) => {
                      if (Array.isArray(sets)) return s + sets.filter(x => x.done).length;
                      return s;
                    }, 0);
                    const totalVolume = Object.values(log.logs || {}).reduce((total, sets) => {
                      if (!Array.isArray(sets)) return total;
                      return total + sets.reduce((s, x) => s + ((parseFloat(x.weight) || 0) * (parseInt(x.reps) || 0)), 0);
                    }, 0);
                    return (
                      <div key={log.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "0.5px solid #f5f5f5" }}>
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{workout?.name || log.workoutId}</p>
                          <p style={{ fontSize: "11px", color: "#aaa", margin: "2px 0 0" }}>
                            {new Date(log.completedAt).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: "12px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{Math.round(totalVolume).toLocaleString()}kg</p>
                          <p style={{ fontSize: "11px", color: "#aaa", margin: "2px 0 0" }}>{totalSets} sets</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── NUTRITION TAB ── */}
        {activeTab === "nutrition" && (
          <>
            {/* Targets */}
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Daily Targets</p>
                <button onClick={() => setEditingNutrition(!editingNutrition)} style={{ background: "none", border: "none", fontSize: "12px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer", padding: 0 }}>
                  {editingNutrition ? "Cancel" : "Edit"}
                </button>
              </div>

              {editingNutrition ? (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    {[
                      { label: "Calories", key: "calories", unit: "kcal" },
                      { label: "Protein", key: "protein", unit: "g" },
                      { label: "Carbs", key: "carbs", unit: "g" },
                      { label: "Fat", key: "fat", unit: "g" },
                    ].map(f => (
                      <div key={f.key}>
                        <p style={{ fontSize: "11px", fontWeight: 700, color: "#555", margin: "0 0 4px" }}>{f.label} ({f.unit})</p>
                        <input
                          type="number"
                          value={nutritionForm[f.key]}
                          onChange={e => setNutritionForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                          style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "15px", fontWeight: 700, boxSizing: "border-box", textAlign: "center" }}
                        />
                      </div>
                    ))}
                  </div>
                  <button onClick={saveNutritionTargets} disabled={saving} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
                    {saving ? "Saving..." : "Save Targets"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {[
                    { label: "Calories", value: nutritionTargets.calories, unit: "kcal", avg: avgCalories },
                    { label: "Protein", value: nutritionTargets.protein, unit: "g", avg: avgProtein },
                    { label: "Carbs", value: nutritionTargets.carbs, unit: "g" },
                    { label: "Fat", value: nutritionTargets.fat, unit: "g" },
                  ].map(f => (
                    <div key={f.label} style={{ backgroundColor: "#f7f5f2", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
                      <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>{f.label}</p>
                      <p style={{ fontSize: "20px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{f.value || "—"}<span style={{ fontSize: "11px", color: "#aaa", fontWeight: 400 }}> {f.value ? f.unit : ""}</span></p>
                      {f.avg > 0 && <p style={{ fontSize: "11px", color: f.avg >= (f.value * 0.9) ? "#2d6a4f" : "#dc2626", margin: "3px 0 0", fontWeight: 700 }}>avg {f.avg}{f.unit}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent food logs */}
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Recent Food Logs</p>
              {nutritionLogs.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#aaa", textAlign: "center", padding: "20px 0" }}>No nutrition logged yet</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                  {nutritionLogs.map(log => {
                    const allFoods = Object.values(log.meals || {}).flat();
                    const totalCals = Math.round(allFoods.reduce((s, f) => s + (f.calories || 0), 0));
                    const totalProtein = Math.round(allFoods.reduce((s, f) => s + (f.protein || 0), 0));
                    const hitProtein = nutritionTargets.protein && totalProtein >= nutritionTargets.protein;
                    return (
                      <div key={log.id} style={{ padding: "12px 0", borderBottom: "0.5px solid #f5f5f5" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                          <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: 0 }}>
                            {new Date(log.date).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" })}
                          </p>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#555" }}>{totalCals} kcal</span>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: hitProtein ? "#2d6a4f" : "#dc2626", backgroundColor: hitProtein ? "#eaf5ef" : "#fef2f2", padding: "2px 8px", borderRadius: "10px" }}>
                              {totalProtein}g protein
                            </span>
                          </div>
                        </div>
                        {/* Meal breakdown */}
                        {Object.entries(log.meals || {}).map(([meal, foods]) => {
                          if (!foods || foods.length === 0) return null;
                          return (
                            <div key={meal} style={{ marginBottom: "4px" }}>
                              <p style={{ fontSize: "10px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>{meal}</p>
                              {foods.map((food, i) => (
                                <p key={i} style={{ fontSize: "12px", color: "#555", margin: "0 0 1px" }}>
                                  {food.name} -- {Math.round(food.calories || 0)} kcal, {Math.round(food.protein || 0)}g protein
                                </p>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── METRICS TAB ── */}
        {activeTab === "metrics" && (
          <>
            {/* Weight graph */}
            {weightLogs.length > 0 && (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Body Weight</p>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "18px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{weightLogs[weightLogs.length - 1].weight}kg</p>
                      <p style={{ fontSize: "10px", color: "#aaa", margin: 0 }}>current</p>
                    </div>
                    {client.goalWeight && !client.noGoalWeight && (
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "18px", fontWeight: 700, color: "#888", margin: 0 }}>{client.goalWeight}kg</p>
                        <p style={{ fontSize: "10px", color: "#aaa", margin: 0 }}>goal</p>
                      </div>
                    )}
                  </div>
                </div>
                <MiniGraph data={weightLogs.map(l => ({ value: l.weight, date: l.date }))} color="#3b82f6" />
              </div>
            )}

            {/* Capability score history */}
            {allScores.length > 0 && (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Capability Score History</p>
                {allScores.length >= 2 ? (
                  <>
                    <MiniGraph data={allScores.map(s => ({ value: s.capabilityScore, date: s.assessmentDate }))} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                      <span style={{ fontSize: "10px", color: "#aaa" }}>{new Date(allScores[0].assessmentDate).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</span>
                      <span style={{ fontSize: "10px", color: "#aaa" }}>{new Date(allScores[allScores.length - 1].assessmentDate).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "12px 0" }}>
                    <p style={{ fontSize: "36px", fontWeight: 700, color: "#2d6a4f", margin: "0 0 4px" }}>{allScores[0].capabilityScore}</p>
                    <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>{allScores[0].category} -- {new Date(allScores[0].assessmentDate).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                )}
                <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                  {allScores.map((s, i) => (
                    <div key={i} style={{ backgroundColor: "#f7f5f2", borderRadius: "8px", padding: "8px 10px", textAlign: "center" }}>
                      <p style={{ fontSize: "16px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{s.capabilityScore}</p>
                      <p style={{ fontSize: "10px", color: "#aaa", margin: 0 }}>{new Date(s.assessmentDate).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sessions over time */}
            {workoutLogs.length > 1 && (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Training Volume Over Time</p>
                <MiniGraph data={[...workoutLogs].reverse().slice(0, 20).map(log => {
                  const vol = Object.values(log.logs || {}).reduce((total, sets) => {
                    if (!Array.isArray(sets)) return total;
                    return total + sets.reduce((s, x) => s + ((parseFloat(x.weight) || 0) * (parseInt(x.reps) || 0)), 0);
                  }, 0);
                  return { value: Math.round(vol), date: log.completedAt };
                })} color="#7c3aed" />
              </div>
            )}

            {weightLogs.length === 0 && allScores.length === 0 && workoutLogs.length === 0 && (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "32px", textAlign: "center" }}>
                <p style={{ fontSize: "13px", color: "#aaa", margin: 0 }}>No metrics data yet</p>
              </div>
            )}
          </>
        )}

        {/* ── CHECK-INS TAB ── */}
        {activeTab === "check-ins" && (
          <>
            {viewingCheckIn ? (
              <div>
                <button onClick={() => { setViewingCheckIn(null); setReplyText(""); }} style={{ background: "none", border: "none", fontSize: "13px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer", padding: "0 0 16px", display: "block" }}>← Back to check-ins</button>

                <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "16px", marginBottom: "12px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>
                    Week of {new Date(viewingCheckIn.weekOf + "T12:00:00").toLocaleDateString("en-IE", { day: "numeric", month: "long" })}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    {["training", "energy", "sleep", "stress"].map(key => {
                      const val = viewingCheckIn.answers[key];
                      const color = val <= 3 ? "#f87171" : val <= 5 ? "#fcd34d" : "#4ade80";
                      return (
                        <div key={key} style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "10px", padding: "12px", textAlign: "center" }}>
                          <p style={{ fontSize: "28px", fontWeight: 700, color, margin: 0, lineHeight: 1 }}>{val}</p>
                          <p style={{ fontSize: "11px", color: "#9fe1cb", margin: "4px 0 0", textTransform: "capitalize" }}>{key}</p>
                        </div>
                      );
                    })}
                  </div>
                  {["pain", "win", "struggle", "other"].map(key => {
                    const labels = { pain: "Pain or niggles", win: "Biggest win", struggle: "Struggled with", other: "Anything else" };
                    const val = viewingCheckIn.answers[key];
                    if (!val) return null;
                    return (
                      <div key={key} style={{ marginBottom: "10px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>{labels[key]}</p>
                        <p style={{ fontSize: "14px", color: "#fff", margin: 0, lineHeight: 1.5 }}>{val}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Reply section */}
                <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>
                    {viewingCheckIn.coachReply || viewingCheckIn.coachVideoUrl ? "Your Reply" : "Send Reply"}
                  </p>

                  {/* Show existing video */}
                  {viewingCheckIn.coachVideoUrl && (
                    <div style={{ marginBottom: "12px" }}>
                      <p style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Video Response</p>
                      <div style={{ borderRadius: "12px", overflow: "hidden", backgroundColor: "#000", aspectRatio: "16/9", marginBottom: "6px" }}>
                        <iframe
                          src={`https://www.youtube.com/embed/${getYouTubeId(viewingCheckIn.coachVideoUrl)}`}
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ display: "block" }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Show existing text reply */}
                  {viewingCheckIn.coachReply && (
                    <div style={{ marginBottom: "12px" }}>
                      <p style={{ fontSize: "15px", color: "#111", lineHeight: 1.6, margin: "0 0 4px" }}>{viewingCheckIn.coachReply}</p>
                      <p style={{ fontSize: "11px", color: "#aaa", margin: 0 }}>
                        Sent {viewingCheckIn.replyAt ? new Date(viewingCheckIn.replyAt).toLocaleDateString("en-IE", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : ""}
                        {viewingCheckIn.replyRead ? " · Read" : " · Unread"}
                      </p>
                    </div>
                  )}

                  {(viewingCheckIn.coachReply || viewingCheckIn.coachVideoUrl) && (
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#aaa", margin: "0 0 10px" }}>Update reply:</p>
                  )}

                  {/* Video URL input */}
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>YouTube Video URL (optional)</p>
                  <input
                    type="text"
                    placeholder="https://youtube.com/watch?v=... (Unlisted)"
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #ddd", fontSize: "13px", color: "#111", boxSizing: "border-box", marginBottom: "10px", outline: "none" }}
                  />

                  {/* Text reply */}
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>Text reply (optional)</p>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder={`Write your coaching feedback for ${displayName}...`}
                    rows={4}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "1.5px solid #2d6a4f", fontSize: "15px", outline: "none", boxSizing: "border-box", resize: "none", lineHeight: 1.6 }}
                  />
                  <button onClick={() => sendReply(viewingCheckIn.id)} disabled={sendingReply || (!replyText.trim() && !videoUrl.trim())} style={{ width: "100%", backgroundColor: sendingReply || (!replyText.trim() && !videoUrl.trim()) ? "#e5e5e5" : "#2d6a4f", color: sendingReply || (!replyText.trim() && !videoUrl.trim()) ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "13px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginTop: "10px" }}>
                    {sendingReply ? "Sending..." : viewingCheckIn.coachReply || viewingCheckIn.coachVideoUrl ? "Update Reply" : "Send Reply →"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {checkIns.length === 0 ? (
                  <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "32px", textAlign: "center" }}>
                    <p style={{ fontSize: "28px", margin: "0 0 10px" }}>📋</p>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No check-ins yet</p>
                    <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Check-ins appear here every Sunday for in-person and hybrid clients.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {checkIns.map(c => {
                      const hasReply = !!c.coachReply;
                      const unread = hasReply && !c.replyRead;
                      return (
                        <div key={c.id} onClick={() => { setViewingCheckIn(c); setReplyText(c.coachReply || ""); setVideoUrl(c.coachVideoUrl || ""); }} style={{ backgroundColor: "#fff", borderRadius: "14px", border: `0.5px solid ${unread ? "#86efac" : "#e5e5e5"}`, padding: "14px 16px", cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                            <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>
                              Week of {new Date(c.weekOf + "T12:00:00").toLocaleDateString("en-IE", { day: "numeric", month: "long" })}
                            </p>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              {c.coachVideoUrl && <span style={{ fontSize: "11px", fontWeight: 700, color: "#0369a1", backgroundColor: "#e0f2fe", padding: "2px 8px", borderRadius: "10px" }}>🎥 Video</span>}
                              <span style={{ fontSize: "11px", fontWeight: 700, color: hasReply ? "#2d6a4f" : "#b45309", backgroundColor: hasReply ? "#eaf5ef" : "#fffbeb", padding: "3px 8px", borderRadius: "10px" }}>
                                {hasReply ? (unread ? "Unread" : "Replied") : "Needs reply"}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "16px" }}>
                            {["training", "energy", "sleep", "stress"].map(key => (
                              <div key={key} style={{ textAlign: "center" }}>
                                <p style={{ fontSize: "18px", fontWeight: 700, color: c.answers[key] <= 5 ? "#dc2626" : "#2d6a4f", margin: 0 }}>{c.answers[key]}</p>
                                <p style={{ fontSize: "10px", color: "#aaa", margin: "2px 0 0", textTransform: "capitalize" }}>{key}</p>
                              </div>
                            ))}
                          </div>
                          {c.answers.win && <p style={{ fontSize: "12px", color: "#555", margin: "8px 0 0", fontStyle: "italic" }}>"{c.answers.win}"</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── SESSIONS TAB ── */}
        {activeTab === "sessions" && (
          <>
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <button
                onClick={() => setShowSessionBookSheet(true)}
                style={{ flex: 1, backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "13px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
              >
                + Book Session
              </button>
              <button
                onClick={() => setShowCoachSessionSheet(true)}
                style={{ flex: 1, backgroundColor: "#1a3a2a", color: "#9fe1cb", border: "none", borderRadius: "12px", padding: "13px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
              >
                Start Session
              </button>
            </div>

            {sessionsLoading ? (
              <p style={{ textAlign: "center", color: "#888", padding: "40px" }}>Loading sessions...</p>
            ) : clientSessions.length === 0 ? (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "32px", textAlign: "center" }}>
                <p style={{ fontSize: "28px", margin: "0 0 10px" }}>📅</p>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No sessions yet</p>
                <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Book the first session for this client.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {clientSessions.map(session => {
                  const st = SESSION_STATUS_STYLES[session.status] || SESSION_STATUS_STYLES.scheduled;
                  return (
                    <div key={session.id} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "6px" }}>
                        <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>
                          {formatSessionDateTime(session.date)}
                        </p>
                        <span style={{ backgroundColor: st.bg, color: st.color, fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "20px", marginLeft: "8px", whiteSpace: "nowrap" }}>
                          {st.label}
                        </span>
                      </div>
                      <p style={{ fontSize: "12px", color: "#888", margin: "0 0 10px" }}>
                        {session.durationMins} min · {session.type}
                        {session.notes ? ` · ${session.notes}` : ""}
                      </p>
                      {session.status === "scheduled" && (
                        <button
                          onClick={() => { setSelectedClientSession(session); setSessionOutcomeForm({ outcome: "completed", notes: "", sessionRevenue: getClientSessionRate() }); setShowSessionOutcomeSheet(true); }}
                          style={{ width: "100%", padding: "9px", borderRadius: "10px", border: "none", background: "#1a3a2a", fontSize: "13px", color: "#fff", cursor: "pointer", fontWeight: 700 }}
                        >
                          Mark Outcome
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* BOOK SESSION SHEET */}
            {showSessionBookSheet && (
              <div onClick={e => { if (e.target === e.currentTarget) setShowSessionBookSheet(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
                <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
                  <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Book Session</h2>
                  <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>{client?.nickname || client?.firstName || client?.email}</p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Date</label>
                      <input type="date" value={sessionBookForm.date} onChange={e => setSessionBookForm(f => ({ ...f, date: e.target.value }))} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Time</label>
                      <input type="time" value={sessionBookForm.time} onChange={e => setSessionBookForm(f => ({ ...f, time: e.target.value }))} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", boxSizing: "border-box" }} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Duration</label>
                      <select value={sessionBookForm.durationMins} onChange={e => setSessionBookForm(f => ({ ...f, durationMins: Number(e.target.value) }))} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", backgroundColor: "#fff" }}>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>60 min</option>
                        <option value={90}>90 min</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Type</label>
                      <select value={sessionBookForm.type} onChange={e => setSessionBookForm(f => ({ ...f, type: e.target.value }))} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", backgroundColor: "#fff" }}>
                        <option value="in-person">In Person</option>
                        <option value="online">Online</option>
                      </select>
                    </div>
                  </div>

                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Notes (optional)</label>
                  <textarea value={sessionBookForm.notes} onChange={e => setSessionBookForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." rows={2} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", resize: "none", marginBottom: "20px", boxSizing: "border-box" }} />

                  <button onClick={bookClientSession} disabled={sessionsSaving || !sessionBookForm.date || !sessionBookForm.time} style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "none", backgroundColor: (!sessionBookForm.date || !sessionBookForm.time) ? "#ccc" : "#1a3a2a", color: "#fff", fontSize: "16px", fontWeight: 700, cursor: "pointer" }}>
                    {sessionsSaving ? "Booking..." : "Book Session"}
                  </button>
                  <button onClick={() => setShowSessionBookSheet(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "12px", padding: "6px" }}>Cancel</button>
                </div>
              </div>
            )}

            {/* MARK OUTCOME SHEET */}
            {showSessionOutcomeSheet && selectedClientSession && (
              <div onClick={e => { if (e.target === e.currentTarget) { setShowSessionOutcomeSheet(false); setSelectedClientSession(null); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
                <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
                  <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Mark Outcome</h2>
                  <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>{formatSessionDateTime(selectedClientSession.date)}</p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                    {SESSION_OUTCOME_OPTIONS.map(opt => {
                      const selected = sessionOutcomeForm.outcome === opt.value;
                      return (
                        <div key={opt.value} onClick={() => setSessionOutcomeForm(f => ({ ...f, outcome: opt.value }))} style={{ padding: "14px 16px", borderRadius: "14px", cursor: "pointer", border: `1.5px solid ${selected ? "#1a3a2a" : "#e5e5e5"}`, backgroundColor: selected ? "#eaf5ef" : "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "18px" }}>{opt.emoji}</span>
                            <div>
                              <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{opt.label}</p>
                              <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>{opt.credits === 0 ? "No credit deducted" : "1 credit deducted"}</p>
                            </div>
                          </div>
                          {selected && <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#1a3a2a", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: "12px" }}>✓</span></div>}
                        </div>
                      );
                    })}
                  </div>

                  {SESSION_OUTCOME_OPTIONS.find(o => o.value === sessionOutcomeForm.outcome)?.credits !== 0 && (
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Session Rate (€)</label>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "15px", color: "#555", fontWeight: 700 }}>€</span>
                        <input type="number" value={sessionOutcomeForm.sessionRevenue} onChange={e => setSessionOutcomeForm(f => ({ ...f, sessionRevenue: e.target.value }))} style={{ width: "100%", padding: "12px 12px 12px 28px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", boxSizing: "border-box" }} />
                      </div>
                      <p style={{ fontSize: "11px", color: "#aaa", margin: "4px 0 0" }}>Auto-set from client's bundle. Change for grandfathered rates.</p>
                    </div>
                  )}

                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Notes (optional)</label>
                  <textarea value={sessionOutcomeForm.notes} onChange={e => setSessionOutcomeForm(f => ({ ...f, notes: e.target.value }))} placeholder="Add a note..." rows={2} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", resize: "none", marginBottom: "20px", boxSizing: "border-box" }} />

                  <button onClick={markClientSessionOutcome} disabled={sessionsSaving} style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "none", backgroundColor: "#1a3a2a", color: "#fff", fontSize: "16px", fontWeight: 700, cursor: "pointer" }}>
                    {sessionsSaving ? "Saving..." : "Confirm Outcome"}
                  </button>
                  <button onClick={() => { setShowSessionOutcomeSheet(false); setSelectedClientSession(null); }} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "12px", padding: "6px" }}>Cancel</button>
                </div>
              </div>
            )}

            {/* COACH SESSION PICKER SHEET */}
            {showCoachSessionSheet && (() => {
              const assignedProgrammes = [
                client.strengthProgrammeId && programmes.find(p => p.id === client.strengthProgrammeId),
                client.cardioProgrammeId && programmes.find(p => p.id === client.cardioProgrammeId),
              ].filter(Boolean);

              return (
                <div onClick={e => { if (e.target === e.currentTarget) setShowCoachSessionSheet(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
                  <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
                    <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
                    <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Start Coach Session</h2>
                    <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>Pick a workout for {client?.nickname || client?.firstName}</p>

                    {assignedProgrammes.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "24px 0" }}>
                        <p style={{ fontSize: "14px", color: "#888" }}>No programme assigned to this client yet.</p>
                        <p style={{ fontSize: "13px", color: "#aaa" }}>Assign a strength or cardio programme from the Training tab first.</p>
                      </div>
                    ) : (
                      assignedProgrammes.map(prog => {
                        const workoutIds = [...new Set((prog.weeks || []).flatMap(w => w.workouts || []).filter(Boolean))];
                        return (
                          <div key={prog.id} style={{ marginBottom: "20px" }}>
                            <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#2d6a4f", margin: "0 0 8px" }}>
                              {prog.name}
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {workoutIds.map(wid => {
                                const wData = workouts[wid];
                                if (!wData) return null;
                                return (
                                  <button
                                    key={wid}
                                    onClick={() => {
                                      setShowCoachSessionSheet(false);
                                      navigate(`/admin/session/${uid}/${prog.id}/${wid}`);
                                    }}
                                    style={{
                                      width: "100%", padding: "14px 16px", borderRadius: "14px",
                                      border: "0.5px solid #e5e5e5", backgroundColor: "#f7f5f2",
                                      textAlign: "left", cursor: "pointer",
                                      display: "flex", alignItems: "center", justifyContent: "space-between",
                                    }}
                                  >
                                    <div>
                                      <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>
                                        {wData.displayName || wData.name || wid}
                                      </p>
                                      {wData.exercises?.length > 0 && (
                                        <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>
                                          {wData.exercises.length} exercises
                                        </p>
                                      )}
                                    </div>
                                    <span style={{ color: "#2d6a4f", fontSize: "16px" }}>→</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}

                    <button onClick={() => setShowCoachSessionSheet(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "8px", padding: "6px" }}>Cancel</button>
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* ── TIMELINE TAB ── */}
        {activeTab === "timeline" && (() => {
          const CATEGORY_META = {
            workout:     { icon: "🏋️", color: "#2d6a4f", bg: "#eaf5ef" },
            session:     { icon: "📅", color: "#0369a1", bg: "#e0f2fe" },
            weight:      { icon: "⚖️", color: "#7c3aed", bg: "#f5f3ff" },
            strength:    { icon: "💪", color: "#dc2626", bg: "#fef2f2" },
            habit:       { icon: "🔥", color: "#f59e0b", bg: "#fffbeb" },
            anniversary: { icon: "🎯", color: "#e11d48", bg: "#fff1f2" },
            coaching:    { icon: "🏆", color: "#059669", bg: "#ecfdf5" },
            custom:      { icon: "⭐", color: "#6366f1", bg: "#eef2ff" },
          };

          function fmtDate(ts) {
            if (!ts) return "";
            const d = ts.toDate ? ts.toDate() : new Date(ts);
            return d.toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" });
          }

          if (timelineLoading) return (
            <p style={{ textAlign: "center", color: "#888", padding: "40px 0", fontSize: "14px" }}>Loading timeline...</p>
          );

          if (timeline.length === 0) return (
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "40px 20px", textAlign: "center" }}>
              <p style={{ fontSize: "32px", margin: "0 0 12px" }}>🏁</p>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No milestones yet</p>
              <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Milestones will appear here as {displayName} logs workouts and makes progress.</p>
            </div>
          );

          return (
            <div style={{ position: "relative", paddingLeft: "32px" }}>
              {/* Vertical line */}
              <div style={{ position: "absolute", left: "13px", top: "8px", bottom: "8px", width: "2px", backgroundColor: "#e5e5e5", borderRadius: "2px" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {timeline.map((entry, i) => {
                  const cat = entry.category || entry.type || "custom";
                  const meta = CATEGORY_META[cat] || CATEGORY_META.custom;
                  const isFirst = i === 0;
                  return (
                    <div key={entry.id} style={{ position: "relative" }}>
                      {/* Dot on the line */}
                      <div style={{
                        position: "absolute", left: "-26px", top: "14px",
                        width: "12px", height: "12px", borderRadius: "50%",
                        backgroundColor: isFirst ? meta.color : "#e5e5e5",
                        border: `2px solid ${isFirst ? meta.color : "#d0d0d0"}`,
                        zIndex: 1,
                      }} />

                      <div style={{
                        backgroundColor: "#fff",
                        borderRadius: "14px",
                        border: isFirst ? `1.5px solid ${meta.color}` : "0.5px solid #e5e5e5",
                        padding: "14px 16px",
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: "10px",
                            backgroundColor: meta.bg, display: "flex",
                            alignItems: "center", justifyContent: "center",
                            fontSize: "18px", flexShrink: 0,
                          }}>
                            {meta.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "2px" }}>
                              <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>
                                {entry.title}
                              </p>
                              {entry.priority === "high" && (
                                <span style={{ fontSize: "10px", fontWeight: 700, color: "#dc2626", backgroundColor: "#fef2f2", padding: "2px 7px", borderRadius: "10px" }}>
                                  High priority
                                </span>
                              )}
                            </div>
                            {entry.description && (
                              <p style={{ fontSize: "13px", color: "#555", margin: "2px 0 4px", lineHeight: 1.5 }}>
                                {entry.description}
                              </p>
                            )}
                            <p style={{ fontSize: "11px", color: "#bbb", margin: 0 }}>
                              {fmtDate(entry.detectedAt)}
                              {entry.category && (
                                <span style={{ marginLeft: "8px", color: meta.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "10px" }}>
                                  {cat}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── WALLET TAB ── */}
        {activeTab === "wallet" && (
          <>
            {walletLoading ? (
              <p style={{ textAlign: "center", color: "#888", padding: "40px" }}>Loading wallet...</p>
            ) : (() => {
              const balance = walletTransactions.reduce((s, tx) => s + (tx.amount || 0), 0);
              const activePurchases = bundlePurchases.filter(p => p.status === "active");
              const soonestExpiry = activePurchases
                .filter(p => p.expiresAt)
                .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))[0];

              return (
                <>
                  {/* Balance Card */}
                  <div style={{ backgroundColor: "#1a3a2a", borderRadius: "20px", padding: "24px 20px", marginBottom: "12px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Session Credits</p>
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ fontSize: "64px", fontWeight: 700, color: balance > 0 ? "#4ade80" : "#f87171", margin: 0, lineHeight: 1 }}>{balance}</p>
                        <p style={{ fontSize: "14px", color: "#9fe1cb", margin: "6px 0 0" }}>credits remaining</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {soonestExpiry && (
                          <>
                            <p style={{ fontSize: "12px", color: "#9fe1cb", margin: 0 }}>Expires</p>
                            <p style={{ fontSize: "14px", fontWeight: 700, color: (() => {
                              const days = Math.ceil((new Date(soonestExpiry.expiresAt) - Date.now()) / 86400000);
                              return days < 7 ? "#f87171" : days < 14 ? "#fcd34d" : "#4ade80";
                            })(), margin: "2px 0 0" }}>
                              {new Date(soonestExpiry.expiresAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                            <p style={{ fontSize: "11px", color: "#9fe1cb", margin: "2px 0 0" }}>
                              {(() => {
                                const days = Math.ceil((new Date(soonestExpiry.expiresAt) - Date.now()) / 86400000);
                                return days <= 0 ? "Expired" : `${days} day${days !== 1 ? "s" : ""} left`;
                              })()}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Credit dots */}
                    {balance > 0 && balance <= 20 && (
                      <div style={{ display: "flex", gap: "6px", marginTop: "16px", flexWrap: "wrap" }}>
                        {Array.from({ length: Math.min(balance, 20) }).map((_, i) => (
                          <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#4ade80" }} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Action Buttons */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                    <ActionBtn label="Add Bundle" icon="📦" onClick={() => setShowPurchaseSheet(true)} primary />
                    <ActionBtn label="Mark Session" icon="✓" onClick={() => setShowMarkSessionSheet(true)} />
                    <ActionBtn label="Adjust Credits" icon="±" onClick={() => setShowAdjustSheet(true)} />
                  </div>

                  {/* Active Bundle Purchases */}
                  {bundlePurchases.length > 0 && (
                    <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px", marginBottom: "12px" }}>
                      <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>
                        Bundle Purchases
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                        {bundlePurchases.map(purchase => {
                          const expired = purchase.expiresAt && new Date(purchase.expiresAt) < new Date();
                          const daysLeft = purchase.expiresAt
                            ? Math.ceil((new Date(purchase.expiresAt) - Date.now()) / 86400000)
                            : null;
                          return (
                            <div key={purchase.id} style={{ padding: "12px 0", borderBottom: "0.5px solid #f5f5f5" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{purchase.bundleName}</p>
                                  <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
                                    {new Date(purchase.purchasedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}
                                    {" · "}{purchase.paymentMethod?.replace("_", " ")}
                                    {purchase.paymentReference ? ` · ${purchase.paymentReference}` : ""}
                                  </p>
                                  {purchase.expiresAt && (
                                    <p style={{ fontSize: "11px", color: expired ? "#dc2626" : daysLeft < 7 ? "#b45309" : "#888", margin: "3px 0 0", fontWeight: expired || daysLeft < 7 ? 700 : 400 }}>
                                      {expired ? "Expired" : `Expires ${new Date(purchase.expiresAt).toLocaleDateString("en-IE", { day: "numeric", month: "short" })} (${daysLeft}d left)`}
                                    </p>
                                  )}
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "12px" }}>
                                  <p style={{ fontSize: "16px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>€{purchase.pricePaid}</p>
                                  <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>{purchase.sessionCredits} sessions</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ledger */}
                  <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>
                      Transaction Ledger ({walletTransactions.length})
                    </p>
                    {walletTransactions.length === 0 ? (
                      <p style={{ fontSize: "13px", color: "#aaa", textAlign: "center", padding: "20px 0" }}>No transactions yet. Add a bundle purchase to start.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                        {walletTransactions.map(tx => {
                          const isCredit = tx.amount > 0;
                          return (
                            <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "0.5px solid #f5f5f5" }}>
                              <div style={{ flex: 1, marginRight: "12px" }}>
                                <p style={{ fontSize: "13px", color: "#111", margin: 0, lineHeight: 1.4 }}>{tx.description}</p>
                                <p style={{ fontSize: "11px", color: "#aaa", margin: "3px 0 0" }}>
                                  {new Date(tx.createdAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                                <span style={{ fontSize: "16px", fontWeight: 700, color: isCredit ? "#2d6a4f" : "#dc2626" }}>
                                  {isCredit ? "+" : ""}{tx.amount}
                                </span>
                                <span style={{ fontSize: "12px", color: "#888", minWidth: "24px", textAlign: "right" }}>{tx.balanceAfter ?? "—"}</span>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "10px", gap: "10px" }}>
                          <span style={{ fontSize: "11px", color: "#aaa" }}>Balance</span>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#111" }}>{balance}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ADD BUNDLE PURCHASE SHEET */}
                  {showPurchaseSheet && (
                    <div onClick={e => { if (e.target === e.currentTarget) setShowPurchaseSheet(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
                      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "85vh", overflowY: "auto" }}>
                        <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
                        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 20px" }}>Add Bundle Purchase</h2>

                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                          <div>
                            <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Select Bundle *</p>
                            {sessionBundles.length === 0 ? (
                              <div style={{ padding: "14px", backgroundColor: "#fffbeb", borderRadius: "10px", border: "1px solid #fcd34d" }}>
                                <p style={{ fontSize: "13px", color: "#b45309", margin: 0 }}>No bundles configured. <Link to="/admin/bundles" style={{ color: "#2d6a4f", fontWeight: 700 }}>Create bundles first →</Link></p>
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {sessionBundles.map(b => (
                                  <div key={b.id} onClick={() => setPurchaseForm(p => ({ ...p, bundleId: b.id }))} style={{ padding: "14px 16px", borderRadius: "12px", border: `1.5px solid ${purchaseForm.bundleId === b.id ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: purchaseForm.bundleId === b.id ? "#eaf5ef" : "#fff", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                      <p style={{ fontSize: "14px", fontWeight: 700, color: purchaseForm.bundleId === b.id ? "#2d6a4f" : "#111", margin: 0 }}>{b.name}</p>
                                      <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>{b.sessionCredits} sessions · {b.expiryDays ? `${b.expiryDays}d expiry` : "No expiry"}</p>
                                    </div>
                                    <p style={{ fontSize: "18px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>€{b.price}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Payment Method *</p>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                              {[
                                { id: "cash", label: "Cash" },
                                { id: "revolut", label: "Revolut" },
                                { id: "bank_transfer", label: "Bank Transfer" },
                                { id: "stripe", label: "Stripe" },
                                { id: "complimentary", label: "Complimentary" },
                              ].map(m => (
                                <div key={m.id} onClick={() => setPurchaseForm(p => ({ ...p, paymentMethod: m.id }))} style={{ padding: "10px 14px", borderRadius: "10px", border: `1.5px solid ${purchaseForm.paymentMethod === m.id ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: purchaseForm.paymentMethod === m.id ? "#eaf5ef" : "#fff", cursor: "pointer", textAlign: "center" }}>
                                  <p style={{ fontSize: "13px", fontWeight: 700, color: purchaseForm.paymentMethod === m.id ? "#2d6a4f" : "#111", margin: 0 }}>{m.label}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>Reference (optional)</p>
                            <input type="text" value={purchaseForm.reference} onChange={e => setPurchaseForm(p => ({ ...p, reference: e.target.value }))} placeholder="Revolut ref, receipt no., etc." style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "14px", color: "#111", outline: "none", boxSizing: "border-box" }} />
                          </div>

                          <div>
                            <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>Note (optional)</p>
                            <input type="text" value={purchaseForm.note} onChange={e => setPurchaseForm(p => ({ ...p, note: e.target.value }))} placeholder="Any additional notes..." style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "14px", color: "#111", outline: "none", boxSizing: "border-box" }} />
                          </div>
                        </div>

                        <button onClick={addBundlePurchase} disabled={walletSaving || !purchaseForm.bundleId} style={{ width: "100%", backgroundColor: walletSaving || !purchaseForm.bundleId ? "#e5e5e5" : "#2d6a4f", color: walletSaving || !purchaseForm.bundleId ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginTop: "20px", marginBottom: "10px" }}>
                          {walletSaving ? "Adding..." : "Add Bundle & Credit Wallet"}
                        </button>
                        <button onClick={() => setShowPurchaseSheet(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* MARK SESSION SHEET */}
                  {showMarkSessionSheet && (
                    <div onClick={e => { if (e.target === e.currentTarget) setShowMarkSessionSheet(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
                      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
                        <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
                        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>Mark Session</h2>
                        <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>Current balance: <strong style={{ color: "#2d6a4f" }}>{balance} credits</strong></p>

                        <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Outcome *</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                          {[
                            { id: "completed", label: "Completed", desc: "Deducts 1 credit", deducts: true },
                            { id: "no_show", label: "No Show", desc: "Deducts 1 credit", deducts: true },
                            { id: "late_cancelled", label: "Late Cancellation", desc: "Deducts 1 credit (< 24hr notice)", deducts: true },
                            { id: "cancelled", label: "Cancelled", desc: "No credit deducted (sufficient notice)", deducts: false },
                          ].map(o => (
                            <div key={o.id} onClick={() => setMarkSessionForm(p => ({ ...p, outcome: o.id }))} style={{ padding: "12px 14px", borderRadius: "12px", border: `1.5px solid ${markSessionForm.outcome === o.id ? (o.deducts ? "#2d6a4f" : "#0369a1") : "#e5e5e5"}`, backgroundColor: markSessionForm.outcome === o.id ? (o.deducts ? "#eaf5ef" : "#e0f2fe") : "#fff", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{o.label}</p>
                                <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>{o.desc}</p>
                              </div>
                              {o.deducts && <span style={{ fontSize: "12px", fontWeight: 700, color: "#dc2626", backgroundColor: "#fef2f2", padding: "3px 8px", borderRadius: "10px" }}>-1</span>}
                            </div>
                          ))}
                        </div>

                        <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>Description * <span style={{ fontWeight: 400, color: "#aaa" }}>(e.g. Mon 23 Jun 6am)</span></p>
                        <input type="text" value={markSessionForm.description} onChange={e => setMarkSessionForm(p => ({ ...p, description: e.target.value }))} placeholder="Mon 23 Jun 6am" style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "14px", color: "#111", outline: "none", boxSizing: "border-box", marginBottom: "16px" }} />

                        <button onClick={markSession} disabled={walletSaving || !markSessionForm.description.trim()} style={{ width: "100%", backgroundColor: walletSaving || !markSessionForm.description.trim() ? "#e5e5e5" : "#2d6a4f", color: walletSaving || !markSessionForm.description.trim() ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>
                          {walletSaving ? "Saving..." : "Record Session"}
                        </button>
                        <button onClick={() => setShowMarkSessionSheet(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* MANUAL ADJUSTMENT SHEET */}
                  {showAdjustSheet && (
                    <div onClick={e => { if (e.target === e.currentTarget) setShowAdjustSheet(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
                      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
                        <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
                        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>Manual Adjustment</h2>
                        <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>Current balance: <strong style={{ color: "#2d6a4f" }}>{balance} credits</strong></p>

                        <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>Amount * <span style={{ fontWeight: 400, color: "#aaa" }}>(use negative to deduct, e.g. -2)</span></p>
                        <input type="number" value={adjustForm.amount} onChange={e => setAdjustForm(p => ({ ...p, amount: e.target.value }))} placeholder="+1 or -1" style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "14px", color: "#111", outline: "none", boxSizing: "border-box", marginBottom: "12px" }} />

                        <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Reason *</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                          {[
                            { id: "complimentary", label: "Complimentary" },
                            { id: "coach_adjustment", label: "Correction" },
                            { id: "refund", label: "Refund" },
                            { id: "expiry_deduction", label: "Expiry Deduction" },
                          ].map(r => (
                            <div key={r.id} onClick={() => setAdjustForm(p => ({ ...p, reason: r.id }))} style={{ padding: "10px 12px", borderRadius: "10px", border: `1.5px solid ${adjustForm.reason === r.id ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: adjustForm.reason === r.id ? "#eaf5ef" : "#fff", cursor: "pointer", textAlign: "center" }}>
                              <p style={{ fontSize: "13px", fontWeight: 700, color: adjustForm.reason === r.id ? "#2d6a4f" : "#111", margin: 0 }}>{r.label}</p>
                            </div>
                          ))}
                        </div>

                        <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>Description *</p>
                        <input type="text" value={adjustForm.description} onChange={e => setAdjustForm(p => ({ ...p, description: e.target.value }))} placeholder="Reason for this adjustment..." style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "14px", color: "#111", outline: "none", boxSizing: "border-box", marginBottom: "16px" }} />

                        <button onClick={addManualAdjustment} disabled={walletSaving || !adjustForm.amount || !adjustForm.description.trim()} style={{ width: "100%", backgroundColor: walletSaving || !adjustForm.amount || !adjustForm.description.trim() ? "#e5e5e5" : "#2d6a4f", color: walletSaving || !adjustForm.amount || !adjustForm.description.trim() ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>
                          {walletSaving ? "Saving..." : "Apply Adjustment"}
                        </button>
                        <button onClick={() => setShowAdjustSheet(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* ── NOTES TAB ── */}
        {activeTab === "notes" && (
          <>
            <button onClick={() => setShowNoteSheet(true)} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "13px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginBottom: "12px" }}>
              + Add Coaching Note
            </button>
            {notes.length === 0 ? (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "32px", textAlign: "center" }}>
                <p style={{ fontSize: "28px", margin: "0 0 10px" }}>📝</p>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No notes yet</p>
                <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Add coaching notes, observations or reminders.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {notes.map(note => (
                  <div key={note.id} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px" }}>
                    <p style={{ fontSize: "14px", color: "#111", lineHeight: 1.6, margin: "0 0 8px" }}>{note.note}</p>
                    <p style={{ fontSize: "11px", color: "#aaa", margin: 0 }}>
                      {new Date(note.createdAt).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── DANGER ZONE ── */}
        <div style={{ margin: "24px 0 0", padding: "16px", borderRadius: "14px", border: "1.5px solid #fecaca", backgroundColor: "#fff" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "#dc2626", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Danger zone</p>
          <button onClick={() => setShowDeleteConfirm(true)} style={{ width: "100%", backgroundColor: "#fef2f2", color: "#dc2626", border: "1.5px solid #fecaca", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
            Delete account
          </button>
        </div>
      </div>

      {/* DELETE CONFIRM SHEET */}
      {showDeleteConfirm && (
        <div onClick={(e) => { if (e.target === e.currentTarget) { setShowDeleteConfirm(false); setDeleteError(""); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <p style={{ fontSize: "20px", textAlign: "center", margin: "0 0 8px" }}>🗑️</p>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 8px", textAlign: "center" }}>Delete {client.firstName}?</h2>
            <p style={{ fontSize: "13px", color: "#666", textAlign: "center", margin: "0 0 20px", lineHeight: 1.5 }}>This removes their Firebase Auth account and profile. It cannot be undone.</p>
            {deleteError && <p style={{ fontSize: "13px", color: "#dc2626", textAlign: "center", margin: "0 0 12px" }}>{deleteError}</p>}
            <button onClick={deleteClient} disabled={deleteLoading} style={{ width: "100%", backgroundColor: deleteLoading ? "#aaa" : "#dc2626", color: "#fff", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: deleteLoading ? "not-allowed" : "pointer", marginBottom: "10px" }}>
              {deleteLoading ? "Deleting..." : "Yes, delete account"}
            </button>
            <button onClick={() => { setShowDeleteConfirm(false); setDeleteError(""); }} style={{ width: "100%", background: "none", border: "none", fontSize: "14px", color: "#888", cursor: "pointer", padding: "8px" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* TIER SHEET */}
      {showTierSheet && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowTierSheet(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 16px" }}>Change Tier</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {TIERS.map(t => {
                const isCurrent = (client.subscription || "free") === t.id;
                return (
                  <div key={t.id} onClick={() => !saving && !isCurrent && updateTier(t.id)} style={{ padding: "14px 16px", borderRadius: "14px", border: `1.5px solid ${isCurrent ? t.color : "#e5e5e5"}`, backgroundColor: isCurrent ? t.bg : "#fff", cursor: isCurrent ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: isCurrent ? t.color : "#111", margin: 0 }}>{t.label}</p>
                    </div>
                    {isCurrent && <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill={t.color}/><path d="M5 10l4 4 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowTierSheet(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "16px", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* PROGRAMME SELECTOR SHEET */}
      {showProgrammeSheet && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowProgrammeSheet(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "75vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 16px" }}>Assign {showProgrammeSheet === "strength" ? "Strength" : "Cardio"} Programme</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {(showProgrammeSheet === "strength" ? strengthOptions : cardioOptions).map(p => {
                const isSelected = showProgrammeSheet === "strength" ? client.strengthProgrammeId === p.id : client.cardioProgrammeId === p.id;
                return (
                  <div key={p.id} onClick={() => assignProgramme(showProgrammeSheet, p.id)} style={{ padding: "14px 16px", borderRadius: "14px", border: `1.5px solid ${isSelected ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: isSelected ? "#eaf5ef" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: isSelected ? "#2d6a4f" : "#111", margin: 0 }}>{p.name}</p>
                      <p style={{ fontSize: "12px", color: "#888", margin: "3px 0 0" }}>{p.description}</p>
                    </div>
                    {isSelected && <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginLeft: 12 }}><circle cx="10" cy="10" r="9" fill="#2d6a4f"/><path d="M5 10l4 4 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowProgrammeSheet(null)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "16px", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ADD NOTE SHEET */}
      {showNoteSheet && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowNoteSheet(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 16px" }}>Add Note</h2>
            <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a coaching note, observation or reminder..." rows={5} autoFocus style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "1.5px solid #2d6a4f", fontSize: "15px", outline: "none", boxSizing: "border-box", resize: "none", lineHeight: 1.6 }} />
            <button onClick={addNote} disabled={saving || !newNote.trim()} style={{ width: "100%", backgroundColor: saving || !newNote.trim() ? "#e5e5e5" : "#2d6a4f", color: saving || !newNote.trim() ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginTop: "12px", marginBottom: "8px" }}>
              {saving ? "Saving..." : "Save Note"}
            </button>
            <button onClick={() => setShowNoteSheet(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}