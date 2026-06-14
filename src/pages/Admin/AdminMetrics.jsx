import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";

const TIERS = [
  { id: "free", label: "Free", color: "#888", bg: "#f0f0f0" },
  { id: "premium", label: "Premium", color: "#b45309", bg: "#fffbeb" },
  { id: "personal", label: "In-Person", color: "#2d6a4f", bg: "#eaf5ef" },
];

const TYPES = [
  { id: "number", label: "Number", icon: "🔢" },
  { id: "photo", label: "Photo", icon: "📷" },
  { id: "text", label: "Text", icon: "✏️" },
  { id: "feeling", label: "Feeling (1-10)", icon: "😊" },
];

const ICONS = ["⚖️", "📏", "💪", "❤️", "🫁", "🏃", "🧘", "😴", "💧", "🔥", "📊", "🩺", "🧠", "⚡", "🎯"];

const EMPTY_METRIC = {
  name: "",
  unit: "",
  type: "number",
  tier: "free",
  icon: "📊",
  description: "",
  active: true,
  order: 0,
  showOnProgress: true,
  checkInType: "both", // weekly | monthly | both
};

export default function AdminMetrics() {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | metric object
  const [form, setForm] = useState(EMPTY_METRIC);
  const [saving, setSaving] = useState(false);
  const [filterTier, setFilterTier] = useState("all");

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "metrics"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    setMetrics(data);
    setLoading(false);
  };

  const openNew = () => {
    setForm({ ...EMPTY_METRIC, order: metrics.length });
    setEditing("new");
  };

  const openEdit = (metric) => {
    setForm({ ...metric });
    setEditing(metric);
  };

  const closeEditor = () => {
    setEditing(null);
    setForm(EMPTY_METRIC);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing === "new") {
        await addDoc(collection(db, "metrics"), form);
      } else {
        const { id, ...data } = form;
        await updateDoc(doc(db, "metrics", editing.id), data);
      }
      await loadMetrics();
      closeEditor();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const toggleActive = async (metric) => {
    await updateDoc(doc(db, "metrics", metric.id), { active: !metric.active });
    setMetrics(prev => prev.map(m => m.id === metric.id ? { ...m, active: !m.active } : m));
  };

  const deleteMetric = async (metric) => {
    if (!window.confirm(`Delete "${metric.name}"? This will not delete existing logged data.`)) return;
    await deleteDoc(doc(db, "metrics", metric.id));
    setMetrics(prev => prev.filter(m => m.id !== metric.id));
  };

  const moveOrder = async (metric, direction) => {
    const idx = metrics.findIndex(m => m.id === metric.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= metrics.length) return;
    const newMetrics = [...metrics];
    const temp = newMetrics[idx];
    newMetrics[idx] = newMetrics[swapIdx];
    newMetrics[swapIdx] = temp;
    setMetrics(newMetrics);
    await updateDoc(doc(db, "metrics", newMetrics[idx].id), { order: idx });
    await updateDoc(doc(db, "metrics", newMetrics[swapIdx].id), { order: swapIdx });
  };

  const filtered = filterTier === "all" ? metrics : metrics.filter(m => m.tier === filterTier);

  const tierInfo = (tier) => TIERS.find(t => t.id === tier) || TIERS[0];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 24px" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>
          Admin
        </Link>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "8px 0 4px" }}>Metrics Builder</h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
          Define what clients track. No coding required.
        </p>
      </div>

      <div style={{ padding: "20px 16px 0" }}>

        {/* TIER FILTER */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "auto", paddingBottom: "4px" }}>
          {[{ id: "all", label: "All" }, ...TIERS].map(t => (
            <button
              key={t.id}
              onClick={() => setFilterTier(t.id)}
              style={{ flexShrink: 0, padding: "7px 14px", borderRadius: "20px", border: "none", backgroundColor: filterTier === t.id ? "#1a3a2a" : "#fff", color: filterTier === t.id ? "#fff" : "#555", fontSize: "13px", fontWeight: 700, cursor: "pointer", border: filterTier === t.id ? "none" : "0.5px solid #e5e5e5" }}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={openNew}
            style={{ flexShrink: 0, marginLeft: "auto", padding: "7px 16px", borderRadius: "20px", border: "none", backgroundColor: "#2d6a4f", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
          >
            + New Metric
          </button>
        </div>

        {/* TIER LEGEND */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          {TIERS.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: t.color }} />
              <span style={{ fontSize: "11px", color: "#888", fontWeight: 600 }}>{t.label}</span>
            </div>
          ))}
        </div>

        {/* METRICS LIST */}
        {loading ? (
          <p style={{ textAlign: "center", color: "#888", padding: "2rem" }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5" }}>
            <p style={{ fontSize: "32px", margin: "0 0 12px" }}>📊</p>
            <p style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No metrics yet</p>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>Create your first metric to start tracking client progress.</p>
            <button onClick={openNew} style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "12px 20px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
              + Create Metric
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filtered.map((metric, idx) => {
              const tier = tierInfo(metric.tier);
              return (
                <div key={metric.id} style={{ backgroundColor: "#fff", borderRadius: "14px", border: `0.5px solid #e5e5e5`, overflow: "hidden", opacity: metric.active ? 1 : 0.5 }}>
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>

                    {/* Order controls */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <button onClick={() => moveOrder(metric, -1)} style={{ background: "none", border: "none", fontSize: "10px", color: "#ccc", cursor: "pointer", padding: "1px 4px", lineHeight: 1 }}>▲</button>
                      <button onClick={() => moveOrder(metric, 1)} style={{ background: "none", border: "none", fontSize: "10px", color: "#ccc", cursor: "pointer", padding: "1px 4px", lineHeight: 1 }}>▼</button>
                    </div>

                    {/* Icon */}
                    <div style={{ width: 42, height: 42, borderRadius: "10px", backgroundColor: tier.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
                      {metric.icon}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                        <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{metric.name}</p>
                        {metric.unit && <span style={{ fontSize: "11px", color: "#aaa" }}>{metric.unit}</span>}
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: tier.color, backgroundColor: tier.bg, padding: "2px 8px", borderRadius: "10px" }}>
                          {tier.label}
                        </span>
                        <span style={{ fontSize: "10px", color: "#888", backgroundColor: "#f0f0f0", padding: "2px 8px", borderRadius: "10px" }}>
                          {TYPES.find(t => t.id === metric.type)?.icon} {TYPES.find(t => t.id === metric.type)?.label}
                        </span>
                        <span style={{ fontSize: "10px", color: "#888", backgroundColor: "#f0f0f0", padding: "2px 8px", borderRadius: "10px" }}>
                          {metric.checkInType === "both" ? "Weekly + Monthly" : metric.checkInType === "weekly" ? "Weekly" : "Monthly"}
                        </span>
                        {!metric.active && <span style={{ fontSize: "10px", color: "#dc2626", backgroundColor: "#fef2f2", padding: "2px 8px", borderRadius: "10px" }}>Hidden</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                      <button onClick={() => toggleActive(metric)} style={{ padding: "6px 10px", borderRadius: "8px", border: "0.5px solid #e5e5e5", backgroundColor: "#f7f5f2", fontSize: "11px", fontWeight: 700, color: "#555", cursor: "pointer" }}>
                        {metric.active ? "Hide" : "Show"}
                      </button>
                      <button onClick={() => openEdit(metric)} style={{ padding: "6px 10px", borderRadius: "8px", border: "none", backgroundColor: "#eaf5ef", fontSize: "11px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer" }}>
                        Edit
                      </button>
                      <button onClick={() => deleteMetric(metric)} style={{ padding: "6px 10px", borderRadius: "8px", border: "none", backgroundColor: "#fef2f2", fontSize: "11px", fontWeight: 700, color: "#dc2626", cursor: "pointer" }}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SUMMARY */}
        {metrics.length > 0 && (
          <div style={{ marginTop: "20px", backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Summary</p>
            <div style={{ display: "flex", gap: "16px" }}>
              {TIERS.map(t => (
                <div key={t.id}>
                  <p style={{ fontSize: "20px", fontWeight: 700, color: t.color, margin: 0, lineHeight: 1 }}>
                    {metrics.filter(m => m.tier === t.id && m.active).length}
                  </p>
                  <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>{t.label}</p>
                </div>
              ))}
              <div>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "#111", margin: 0, lineHeight: 1 }}>
                  {metrics.filter(m => m.active).length}
                </p>
                <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>Total active</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EDITOR SHEET */}
      {editing !== null && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeEditor(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
        >
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 20px" }}>
              {editing === "new" ? "New Metric" : `Edit: ${form.name}`}
            </h2>

            {/* Name */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Metric Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Body Weight, Waist Circumference, Resting Heart Rate"
                style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Unit */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Unit</label>
              <input
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                placeholder="e.g. kg, cm, bpm, %, min"
                style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Description (shown to client)</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Measure first thing in the morning"
                style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Type */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "8px" }}>Input Type</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setForm(f => ({ ...f, type: t.id }))}
                    style={{ padding: "8px 14px", borderRadius: "10px", border: form.type === t.id ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: form.type === t.id ? "#eaf5ef" : "#fff", fontSize: "13px", fontWeight: 700, color: form.type === t.id ? "#2d6a4f" : "#555", cursor: "pointer" }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tier */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "8px" }}>Available To</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {TIERS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setForm(f => ({ ...f, tier: t.id }))}
                    style={{ flex: 1, padding: "10px 8px", borderRadius: "10px", border: form.tier === t.id ? `2px solid ${t.color}` : "1px solid #e5e5e5", backgroundColor: form.tier === t.id ? t.bg : "#fff", fontSize: "12px", fontWeight: 700, color: form.tier === t.id ? t.color : "#555", cursor: "pointer" }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: "11px", color: "#aaa", margin: "6px 0 0" }}>
                {form.tier === "free" && "All users see this metric"}
                {form.tier === "premium" && "Premium and in-person clients only"}
                {form.tier === "personal" && "In-person coaching clients only"}
              </p>
            </div>

            {/* Check-in type */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "8px" }}>Appears In</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {[
                  { id: "weekly", label: "Weekly only" },
                  { id: "monthly", label: "Monthly only" },
                  { id: "both", label: "Both" },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setForm(f => ({ ...f, checkInType: t.id }))}
                    style={{ flex: 1, padding: "10px 8px", borderRadius: "10px", border: form.checkInType === t.id ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: form.checkInType === t.id ? "#eaf5ef" : "#fff", fontSize: "12px", fontWeight: 700, color: form.checkInType === t.id ? "#2d6a4f" : "#555", cursor: "pointer" }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon picker */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "8px" }}>Icon</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {ICONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setForm(f => ({ ...f, icon }))}
                    style={{ width: 40, height: 40, borderRadius: "10px", border: form.icon === icon ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: form.icon === icon ? "#eaf5ef" : "#fff", fontSize: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Show on progress toggle */}
            <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", backgroundColor: "#f7f5f2", borderRadius: "12px" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>Show on Progress Page</p>
                <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>Clients see this in their progress dashboard</p>
              </div>
              <div
                onClick={() => setForm(f => ({ ...f, showOnProgress: !f.showOnProgress }))}
                style={{ width: 44, height: 26, borderRadius: "13px", backgroundColor: form.showOnProgress ? "#2d6a4f" : "#e5e5e5", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
              >
                <div style={{ position: "absolute", top: 3, left: form.showOnProgress ? 21 : 3, width: 20, height: 20, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s" }} />
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving || !form.name.trim()}
              style={{ width: "100%", backgroundColor: saving || !form.name.trim() ? "#e5e5e5" : "#2d6a4f", color: saving || !form.name.trim() ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: saving || !form.name.trim() ? "not-allowed" : "pointer", marginBottom: "10px" }}
            >
              {saving ? "Saving..." : editing === "new" ? "Create Metric" : "Save Changes"}
            </button>
            <button onClick={closeEditor} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}