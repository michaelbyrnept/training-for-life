import { useState, useEffect } from "react";
import {
  collection, getDocs, addDoc, updateDoc, doc, query, orderBy, serverTimestamp
} from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "revolut", label: "Revolut" },
  { id: "bank_transfer", label: "Bank Transfer" },
  { id: "stripe", label: "Stripe" },
  { id: "complimentary", label: "Complimentary" },
];

const DEFAULT_BUNDLES = [
  { name: "Single Session",          sessionCredits: 1,  price: 60,   expiryDays: 14,  gracePeriodDays: 3,  description: "One personal training session. Valid for 14 days.",                    sortOrder: 0 },
  { name: "3 Session Bundle",        sessionCredits: 3,  price: 180,  expiryDays: 42,  gracePeriodDays: 7,  description: "3 personal training sessions. Valid for 6 weeks.",                   sortOrder: 1 },
  { name: "6 Session Bundle",        sessionCredits: 6,  price: 329,  expiryDays: 70,  gracePeriodDays: 7,  description: "6 personal training sessions. Valid for 10 weeks.",                  sortOrder: 2 },
  { name: "10 Session Bundle",       sessionCredits: 10, price: 550,  expiryDays: 112, gracePeriodDays: 14, description: "10 sessions at our discounted rate. Valid for 16 weeks.",            sortOrder: 3 },
  { name: "12 Session Bundle",       sessionCredits: 12, price: 660,  expiryDays: 126, gracePeriodDays: 14, description: "12 personal training sessions. Valid for 18 weeks.",                 sortOrder: 4 },
  { name: "15 Session Bundle",       sessionCredits: 15, price: 825,  expiryDays: 168, gracePeriodDays: 14, description: "15 sessions — great for consistent training. Valid for 24 weeks.",  sortOrder: 5 },
  { name: "20 Session Bundle",       sessionCredits: 20, price: 1100, expiryDays: 210, gracePeriodDays: 14, description: "20 sessions — maximum commitment, best value. Valid for 30 weeks.", sortOrder: 6 },
];

function expiryLabel(days) {
  if (!days) return "No expiry";
  if (days % 7 === 0) return `${days / 7} week${days / 7 !== 1 ? "s" : ""}`;
  return `${days} days`;
}

export default function AdminBundles() {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBundle, setEditingBundle] = useState(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const emptyForm = {
    name: "", sessionCredits: "", price: "", expiryDays: "",
    gracePeriodDays: "7", description: "", isActive: true, sortOrder: 0,
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadBundles(); }, []);

  const loadBundles = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "sessionBundles"), orderBy("sortOrder")));
      setBundles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      // Fallback if no index yet
      const snap = await getDocs(collection(db, "sessionBundles"));
      setBundles(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    }
    setLoading(false);
  };

  const openNew = () => {
    setEditingBundle(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (bundle) => {
    setEditingBundle(bundle);
    setForm({
      name: bundle.name || "",
      sessionCredits: bundle.sessionCredits || "",
      price: bundle.price || "",
      expiryDays: bundle.expiryDays || "",
      gracePeriodDays: bundle.gracePeriodDays ?? "7",
      description: bundle.description || "",
      isActive: bundle.isActive !== false,
      sortOrder: bundle.sortOrder || 0,
    });
    setShowForm(true);
  };

  const saveBundle = async () => {
    if (!form.name.trim() || !form.sessionCredits || !form.price) return;
    setSaving(true);
    const data = {
      name: form.name.trim(),
      sessionCredits: Number(form.sessionCredits),
      price: Number(form.price),
      expiryDays: form.expiryDays ? Number(form.expiryDays) : null,
      gracePeriodDays: Number(form.gracePeriodDays) || 7,
      description: form.description.trim(),
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
      updatedAt: new Date().toISOString(),
    };
    try {
      if (editingBundle) {
        await updateDoc(doc(db, "sessionBundles", editingBundle.id), data);
        setBundles(prev => prev.map(b => b.id === editingBundle.id ? { ...b, ...data } : b));
      } else {
        data.createdAt = new Date().toISOString();
        const ref = await addDoc(collection(db, "sessionBundles"), data);
        setBundles(prev => [...prev, { id: ref.id, ...data }].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
      }
      setShowForm(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const toggleActive = async (bundle) => {
    await updateDoc(doc(db, "sessionBundles", bundle.id), { isActive: !bundle.isActive, updatedAt: new Date().toISOString() });
    setBundles(prev => prev.map(b => b.id === bundle.id ? { ...b, isActive: !b.isActive } : b));
  };

  const seedDefaults = async () => {
    if (bundles.length > 0) return;
    setSeeding(true);
    for (const b of DEFAULT_BUNDLES) {
      const data = { ...b, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await addDoc(collection(db, "sessionBundles"), data);
    }
    await loadBundles();
    setSeeding(false);
  };

  const activeBundles = bundles.filter(b => b.isActive !== false);
  const inactiveBundles = bundles.filter(b => b.isActive === false);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>

      {/* HEADER */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 28px" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>← Admin</Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: 0 }}>Session Bundles</h1>
            <p style={{ fontSize: "13px", color: "#9fe1cb", margin: "4px 0 0" }}>{activeBundles.length} active bundle{activeBundles.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={openNew} style={{ backgroundColor: "#4ade80", color: "#1a3a2a", border: "none", borderRadius: "20px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            + New Bundle
          </button>
        </div>
      </div>

      <div style={{ padding: "16px" }}>

        {loading ? (
          <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
        ) : bundles.length === 0 ? (
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "28px", margin: "0 0 10px" }}>📦</p>
            <p style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No bundles yet</p>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 20px" }}>Set up your session bundle catalogue.</p>
            <button onClick={seedDefaults} disabled={seeding} style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "12px 24px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginBottom: "10px", display: "block", width: "100%" }}>
              {seeding ? "Creating..." : "Seed Default Bundles (1, 3, 6, 10, 12, 15, 20 sessions)"}
            </button>
            <button onClick={openNew} style={{ background: "none", border: "1.5px solid #2d6a4f", borderRadius: "12px", padding: "12px 24px", fontSize: "14px", fontWeight: 700, color: "#2d6a4f", cursor: "pointer", width: "100%" }}>
              Create Manually
            </button>
          </div>
        ) : (
          <>
            {/* Active Bundles */}
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Active</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {activeBundles.map(bundle => (
                <BundleCard key={bundle.id} bundle={bundle} onEdit={openEdit} onToggle={toggleActive} />
              ))}
              {activeBundles.length === 0 && (
                <p style={{ fontSize: "13px", color: "#aaa", textAlign: "center", padding: "16px" }}>No active bundles</p>
              )}
            </div>

            {inactiveBundles.length > 0 && (
              <>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Inactive</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {inactiveBundles.map(bundle => (
                    <BundleCard key={bundle.id} bundle={bundle} onEdit={openEdit} onToggle={toggleActive} inactive />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* BUNDLE FORM SHEET */}
      {showForm && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 20px" }}>
              {editingBundle ? "Edit Bundle" : "New Bundle"}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Bundle Name" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. 12 Session Bundle"
                  style={inputStyle}
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Sessions Credited" required>
                  <input
                    type="number"
                    value={form.sessionCredits}
                    onChange={e => setForm(p => ({ ...p, sessionCredits: e.target.value }))}
                    placeholder="12"
                    min="1"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Price (€)" required>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    placeholder="540"
                    min="0"
                    step="0.01"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Expiry (days)" hint="Leave blank for no expiry">
                  <input
                    type="number"
                    value={form.expiryDays}
                    onChange={e => setForm(p => ({ ...p, expiryDays: e.target.value }))}
                    placeholder="126"
                    min="1"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Grace Period (days)">
                  <input
                    type="number"
                    value={form.gracePeriodDays}
                    onChange={e => setForm(p => ({ ...p, gracePeriodDays: e.target.value }))}
                    placeholder="7"
                    min="0"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Display Order">
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={e => setForm(p => ({ ...p, sortOrder: e.target.value }))}
                  placeholder="0"
                  min="0"
                  style={inputStyle}
                />
              </Field>

              <Field label="Description (shown to client)">
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Best value for committed clients..."
                  rows={2}
                  style={{ ...inputStyle, resize: "none" }}
                />
              </Field>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", backgroundColor: "#f7f5f2", borderRadius: "12px" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>Active</p>
                  <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>Inactive bundles are hidden from clients</p>
                </div>
                <div
                  onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                  style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: form.isActive ? "#2d6a4f" : "#e5e5e5", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
                >
                  <div style={{ position: "absolute", top: 2, left: form.isActive ? 22 : 2, width: 20, height: 20, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
              </div>
            </div>

            <button onClick={saveBundle} disabled={saving || !form.name.trim() || !form.sessionCredits || !form.price} style={{ width: "100%", backgroundColor: saving || !form.name.trim() || !form.sessionCredits || !form.price ? "#e5e5e5" : "#2d6a4f", color: saving || !form.name.trim() || !form.sessionCredits || !form.price ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginTop: "20px", marginBottom: "10px" }}>
              {saving ? "Saving..." : editingBundle ? "Save Changes" : "Create Bundle"}
            </button>
            <button onClick={() => setShowForm(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BundleCard({ bundle, onEdit, onToggle, inactive }) {
  const pricePerSession = bundle.sessionCredits > 0 ? (bundle.price / bundle.sessionCredits).toFixed(0) : "—";

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: `0.5px solid ${inactive ? "#e5e5e5" : "#e5e5e5"}`, padding: "16px", opacity: inactive ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ flex: 1, marginRight: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: 0 }}>{bundle.name}</h3>
            {inactive && <span style={{ fontSize: "10px", fontWeight: 700, color: "#aaa", backgroundColor: "#f0f0f0", padding: "2px 8px", borderRadius: "10px" }}>INACTIVE</span>}
          </div>
          {bundle.description && <p style={{ fontSize: "12px", color: "#888", margin: 0, lineHeight: 1.4 }}>{bundle.description}</p>}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: "22px", fontWeight: 700, color: "#2d6a4f", margin: 0, lineHeight: 1 }}>€{bundle.price}</p>
          <p style={{ fontSize: "11px", color: "#aaa", margin: "2px 0 0" }}>€{pricePerSession}/session</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
        <Tag icon="🎫" label={`${bundle.sessionCredits} session${bundle.sessionCredits !== 1 ? "s" : ""}`} color="#2d6a4f" bg="#eaf5ef" />
        <Tag icon="⏱️" label={expiryLabel(bundle.expiryDays)} color="#0369a1" bg="#e0f2fe" />
        {bundle.gracePeriodDays > 0 && <Tag icon="🕐" label={`${bundle.gracePeriodDays}d grace`} color="#888" bg="#f7f5f2" />}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={() => onEdit(bundle)} style={{ flex: 1, backgroundColor: "#f7f5f2", color: "#111", border: "none", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
          Edit
        </button>
        <button onClick={() => onToggle(bundle)} style={{ flex: 1, backgroundColor: inactive ? "#eaf5ef" : "#fff5f5", color: inactive ? "#2d6a4f" : "#dc2626", border: `1px solid ${inactive ? "#86efac" : "#fca5a5"}`, borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
          {inactive ? "Activate" : "Deactivate"}
        </button>
      </div>
    </div>
  );
}

function Tag({ icon, label, color, bg }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: bg, color, fontSize: "12px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px" }}>
      {icon} {label}
    </span>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>
        {label}{required && <span style={{ color: "#dc2626" }}> *</span>}
        {hint && <span style={{ fontSize: "11px", fontWeight: 400, color: "#aaa", marginLeft: "6px" }}>({hint})</span>}
      </p>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1.5px solid #e5e5e5",
  fontSize: "15px",
  color: "#111",
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "#fff",
};
