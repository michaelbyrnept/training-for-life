import { useState, useEffect } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import PortalNav from "../components/PortalNav";
import PremiumGate from "../components/PremiumGate";
import { useFeatures } from "../hooks/useFeatures";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function sessionCount(programme) {
  return DAYS.filter((d) => programme.weekTemplate?.[d]).length;
}

function completionPercent(programme) {
  const total = (programme.weeks || 1) * sessionCount(programme);
  if (total === 0) return 0;
  const done = (programme.completedSessions || []).length;
  return Math.min(100, Math.round((done / total) * 100));
}

export default function MyProgrammes() {
  const navigate = useNavigate();
  const features = useFeatures();
  const [user, setUser] = useState(null);
  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGate, setShowGate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);
      await load(u.uid);
    });
    return () => unsub();
  }, []);

  const load = async (uid) => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users", uid, "userProgrammes"));
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const at = a.createdAt?.seconds ?? 0;
          const bt = b.createdAt?.seconds ?? 0;
          return bt - at;
        });
      setProgrammes(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleCreate = () => {
    if (!features.isPremium) { setShowGate(true); return; }
    navigate("/my-programmes/new");
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "users", user.uid, "userProgrammes", id));
      setProgrammes((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error(e);
    }
    setDeletingId(null);
    setConfirmDelete(null);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "52px 20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 4px" }}>
              My Programmes
            </p>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: 0 }}>Training Plans</h1>
          </div>
          <button
            onClick={handleCreate}
            style={{ backgroundColor: "#9fe1cb", color: "#1a3a2a", border: "none", borderRadius: 12, padding: "10px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            + New
          </button>
        </div>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {/* Tab strip */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <Link to="/my-workouts" style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 12, backgroundColor: "#f0f0f0", color: "#888", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
            Workouts
          </Link>
          <div style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 12, backgroundColor: "#1a3a2a", color: "#fff", fontWeight: 700, fontSize: 14 }}>
            Programmes
          </div>
        </div>

        {!features.isPremium && (
          <div style={{ backgroundColor: "#fffbeb", border: "1.5px solid #f59e0b", borderRadius: 14, padding: "16px 18px", marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#b45309", margin: "0 0 4px" }}>Premium feature</p>
            <p style={{ fontSize: 13, color: "#78350f", margin: "0 0 10px" }}>
              Custom training programmes are available on Premium. Build a plan once, follow it every week.
            </p>
            <button onClick={() => setShowGate(true)} style={{ backgroundColor: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Upgrade to Premium
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2].map((i) => <div key={i} style={{ height: 110, backgroundColor: "#e5e5e5", borderRadius: 16, opacity: 0.5 }} />)}
          </div>
        ) : programmes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontSize: 40, margin: "0 0 12px" }}>📋</p>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No programmes yet</p>
            <p style={{ fontSize: 14, color: "#888", margin: "0 0 24px" }}>Build a multi-week plan from your saved workouts.</p>
            <button onClick={handleCreate} style={{ backgroundColor: "#1a3a2a", color: "#fff", border: "none", borderRadius: 12, padding: "13px 24px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              Create your first programme
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {programmes.map((prog) => {
              const pct = completionPercent(prog);
              const sessions = sessionCount(prog);
              const done = (prog.completedSessions || []).length;
              return (
                <div key={prog.id} style={{ backgroundColor: "#fff", borderRadius: 16, border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
                  <div onClick={() => navigate(`/my-programmes/${prog.id}`)} style={{ padding: "16px 18px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 3px" }}>{prog.name}</p>
                        <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                          {prog.weeks} week{prog.weeks !== 1 ? "s" : ""} &middot; {sessions} session{sessions !== 1 ? "s" : ""}/week
                        </p>
                      </div>
                      {prog.isActive && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "4px 10px", borderRadius: 20, flexShrink: 0, marginLeft: 10 }}>
                          Active
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div style={{ backgroundColor: "#f0f0f0", borderRadius: 6, height: 6, marginBottom: 6 }}>
                      <div style={{ backgroundColor: "#2d6a4f", borderRadius: 6, height: "100%", width: `${pct}%`, transition: "width 0.3s" }} />
                    </div>
                    <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                      {done} of {prog.weeks * sessions} sessions complete &middot; {pct}%
                    </p>
                  </div>

                  <div style={{ display: "flex", borderTop: "0.5px solid #f0f0f0" }}>
                    <Link
                      to={`/my-programmes/${prog.id}/edit`}
                      style={{ flex: 1, padding: "12px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#2d6a4f", textDecoration: "none" }}
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => setConfirmDelete(prog.id)}
                      style={{ flex: 1, padding: "12px", border: "none", background: "none", fontSize: 13, fontWeight: 600, color: "#dc2626", cursor: "pointer", borderLeft: "0.5px solid #f0f0f0" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirm sheet */}
      {confirmDelete && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "24px 20px 40px" }}>
            <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2, margin: "0 auto 20px" }} />
            <p style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Delete programme?</p>
            <p style={{ fontSize: 14, color: "#888", margin: "0 0 24px" }}>This will remove the programme and all progress. Your workouts stay saved.</p>
            <button
              onClick={() => handleDelete(confirmDelete)}
              disabled={!!deletingId}
              style={{ width: "100%", backgroundColor: "#dc2626", color: "#fff", border: "none", borderRadius: 14, padding: "15px", fontWeight: 700, fontSize: 16, cursor: "pointer", marginBottom: 10 }}
            >
              {deletingId ? "Deleting..." : "Delete"}
            </button>
            <button
              onClick={() => setConfirmDelete(null)}
              style={{ width: "100%", backgroundColor: "#f7f5f2", color: "#111", border: "none", borderRadius: 14, padding: "15px", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showGate && <PremiumGate onClose={() => setShowGate(false)} feature="custom programmes" />}
      <PortalNav active="training" />
    </div>
  );
}
