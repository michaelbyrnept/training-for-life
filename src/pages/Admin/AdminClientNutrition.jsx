import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { Link, useParams } from "react-router-dom";

const QUICK_PICKS = [
  { name: "Chicken Breast (Cooked)", per100: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fibre: 0 } },
  { name: "Oats (Dry)", per100: { calories: 389, protein: 17, carbs: 66, fat: 7, fibre: 10 } },
  { name: "Eggs (Whole)", per100: { calories: 155, protein: 13, carbs: 1.1, fat: 11, fibre: 0 } },
  { name: "Greek Yogurt (Plain)", per100: { calories: 97, protein: 9, carbs: 4, fat: 5, fibre: 0 } },
  { name: "Brown Rice (Cooked)", per100: { calories: 123, protein: 2.7, carbs: 26, fat: 1, fibre: 1.8 } },
  { name: "White Rice (Cooked)", per100: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fibre: 0.4 } },
  { name: "Banana", per100: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fibre: 2.6 } },
  { name: "Salmon (Cooked)", per100: { calories: 208, protein: 20, carbs: 0, fat: 13, fibre: 0 } },
  { name: "Sweet Potato (Cooked)", per100: { calories: 86, protein: 1.6, carbs: 20, fat: 0.1, fibre: 3 } },
  { name: "Broccoli", per100: { calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fibre: 2.6 } },
  { name: "Cottage Cheese", per100: { calories: 98, protein: 11, carbs: 3, fat: 4, fibre: 0 } },
  { name: "Tuna (Tinned in Water)", per100: { calories: 116, protein: 26, carbs: 0, fat: 1, fibre: 0 } },
  { name: "Turkey Mince (Raw)", per100: { calories: 150, protein: 19, carbs: 0, fat: 8, fibre: 0 } },
  { name: "Beef Mince 5% Fat", per100: { calories: 175, protein: 28, carbs: 0, fat: 7, fibre: 0 } },
  { name: "Pasta (Cooked)", per100: { calories: 158, protein: 5.8, carbs: 31, fat: 0.9, fibre: 1.8 } },
  { name: "Whey Protein (Powder)", per100: { calories: 400, protein: 80, carbs: 10, fat: 7, fibre: 0 } },
  { name: "Almonds", per100: { calories: 579, protein: 21, carbs: 22, fat: 50, fibre: 12.5 } },
  { name: "Peanut Butter", per100: { calories: 588, protein: 25, carbs: 20, fat: 50, fibre: 6 } },
  { name: "Avocado", per100: { calories: 160, protein: 2, carbs: 9, fat: 15, fibre: 6.7 } },
  { name: "Sourdough Bread", per100: { calories: 269, protein: 9, carbs: 51, fat: 3, fibre: 2.4 } },
  { name: "Milk (Full Fat)", per100: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fibre: 0 } },
  { name: "Cheddar Cheese", per100: { calories: 403, protein: 25, carbs: 1.3, fat: 33, fibre: 0 } },
];

const MEALS = [
  { id: "breakfast", label: "Breakfast", icon: "🌅" },
  { id: "lunch", label: "Lunch", icon: "☀️" },
  { id: "dinner", label: "Dinner", icon: "🌙" },
  { id: "snacks", label: "Snacks", icon: "🍎" },
];

function getTotals(log) {
  const all = Object.values(log).flat();
  return {
    calories: all.reduce((s, f) => s + (f.calories || 0), 0),
    protein: Math.round(all.reduce((s, f) => s + (f.protein || 0), 0) * 10) / 10,
    carbs: Math.round(all.reduce((s, f) => s + (f.carbs || 0), 0) * 10) / 10,
    fat: Math.round(all.reduce((s, f) => s + (f.fat || 0), 0) * 10) / 10,
  };
}

export default function AdminClientNutrition() {
  const { clientUid } = useParams();
  const [client, setClient] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [log, setLog] = useState({ breakfast: [], lunch: [], dinner: [], snacks: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add food sheet state
  const [addingTo, setAddingTo] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("100");
  const [customName, setCustomName] = useState("");
  const [customCals, setCustomCals] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customFat, setCustomFat] = useState("");
  const [mode, setMode] = useState("pick"); // "pick" | "custom"

  useEffect(() => {
    loadClient();
  }, [clientUid]);

  useEffect(() => {
    if (client) loadLog();
  }, [date, client]);

  const loadClient = async () => {
    const snap = await getDoc(doc(db, "users", clientUid));
    if (snap.exists()) setClient({ uid: clientUid, ...snap.data() });
    setLoading(false);
  };

  const loadLog = async () => {
    const logRef = doc(db, "nutritionLogs", `${clientUid}_${date}`);
    const logSnap = await getDoc(logRef);
    if (logSnap.exists()) {
      setLog(logSnap.data().meals || { breakfast: [], lunch: [], dinner: [], snacks: [] });
    } else {
      setLog({ breakfast: [], lunch: [], dinner: [], snacks: [] });
    }
  };

  const saveLog = async (newLog) => {
    setSaving(true);
    await setDoc(doc(db, "nutritionLogs", `${clientUid}_${date}`), {
      userId: clientUid,
      date,
      meals: newLog,
      updatedAt: new Date().toISOString(),
      adminEdited: true,
    });
    setSaving(false);
  };

  const addFood = () => {
    if (mode === "custom") {
      if (!customName.trim() || !customCals) return;
      const food = {
        id: Date.now(),
        name: customName.trim(),
        calories: Math.round(Number(customCals)),
        protein: Math.round(Number(customProtein) * 10) / 10 || 0,
        carbs: Math.round(Number(customCarbs) * 10) / 10 || 0,
        fat: Math.round(Number(customFat) * 10) / 10 || 0,
        fibre: 0,
        amount: "custom",
        addedByCoach: true,
      };
      const newLog = { ...log, [addingTo]: [...(log[addingTo] || []), food] };
      setLog(newLog);
      saveLog(newLog);
    } else {
      if (!selected || !amount) return;
      const m = parseFloat(amount) / 100;
      const p = selected.per100;
      const food = {
        id: Date.now(),
        name: selected.name,
        calories: Math.round((p.calories || 0) * m),
        protein: Math.round((p.protein || 0) * m * 10) / 10,
        carbs: Math.round((p.carbs || 0) * m * 10) / 10,
        fat: Math.round((p.fat || 0) * m * 10) / 10,
        fibre: Math.round((p.fibre || 0) * m * 10) / 10,
        amount: `${amount}g`,
        addedByCoach: true,
      };
      const newLog = { ...log, [addingTo]: [...(log[addingTo] || []), food] };
      setLog(newLog);
      saveLog(newLog);
    }
    closeSheet();
  };

  const removeFood = (meal, foodId) => {
    const newLog = { ...log, [meal]: log[meal].filter(f => f.id !== foodId) };
    setLog(newLog);
    saveLog(newLog);
  };

  const openSheet = (mealId) => {
    setAddingTo(mealId);
    setSelected(null);
    setSearch("");
    setAmount("100");
    setCustomName("");
    setCustomCals("");
    setCustomProtein("");
    setCustomCarbs("");
    setCustomFat("");
    setMode("pick");
  };

  const closeSheet = () => {
    setAddingTo(null);
    setSelected(null);
    setSearch("");
    setMode("pick");
  };

  const totals = getTotals(log);
  const targets = client?.nutritionTargets || {};
  const filteredPicks = QUICK_PICKS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  // Date navigation
  const changeDate = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    const newDate = d.toISOString().split("T")[0];
    if (newDate <= new Date().toISOString().split("T")[0]) setDate(newDate);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 24px" }}>
        <Link to="/admin/nutrition" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>← Nutrition</Link>
      </div>
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 28px" }}>
        <Link to="/admin/nutrition" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>← Nutrition</Link>
        <div style={{ marginTop: "12px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: 0 }}>{client?.displayName || client?.email}</h1>
          {targets.calories && (
            <p style={{ fontSize: "12px", color: "#9fe1cb", margin: "2px 0 0" }}>
              Target: {targets.calories} kcal · P: {targets.protein || "?"}g
            </p>
          )}
        </div>

        {/* Date nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", marginTop: "16px" }}>
          <button onClick={() => changeDate(-1)} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: "8px", width: 32, height: 32, fontSize: "16px", cursor: "pointer" }}>‹</button>
          <p style={{ color: "#fff", fontWeight: 700, fontSize: "14px", margin: 0 }}>{date === new Date().toISOString().split("T")[0] ? "Today" : date}</p>
          <button onClick={() => changeDate(1)} disabled={date >= new Date().toISOString().split("T")[0]} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: date >= new Date().toISOString().split("T")[0] ? "rgba(255,255,255,0.3)" : "#fff", borderRadius: "8px", width: 32, height: 32, fontSize: "16px", cursor: "pointer" }}>›</button>
        </div>

        {/* Totals */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", marginTop: "16px" }}>
          {[
            { label: "Kcal", value: totals.calories, target: targets.calories, color: "#4ade80" },
            { label: "Protein", value: `${totals.protein}g`, target: targets.protein ? `${targets.protein}g` : null, color: "#60a5fa" },
            { label: "Carbs", value: `${totals.carbs}g`, color: "#fbbf24" },
            { label: "Fat", value: `${totals.fat}g`, color: "#f87171" },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "10px", padding: "8px", textAlign: "center" }}>
              <p style={{ fontSize: "16px", fontWeight: 700, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
              {s.target && <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>/ {s.target}</p>}
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Meal sections */}
      <div style={{ padding: "16px" }}>
        {saving && (
          <div style={{ backgroundColor: "#eaf5ef", borderRadius: "10px", padding: "8px 14px", marginBottom: "12px", textAlign: "center" }}>
            <p style={{ fontSize: "12px", color: "#2d6a4f", fontWeight: 700, margin: 0 }}>Saving...</p>
          </div>
        )}

        {MEALS.map(meal => {
          const foods = log[meal.id] || [];
          const mealCals = foods.reduce((s, f) => s + (f.calories || 0), 0);
          return (
            <div key={meal.id} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: foods.length > 0 ? "10px" : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>{meal.icon}</span>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{meal.label}</p>
                  {mealCals > 0 && <span style={{ fontSize: "12px", color: "#2d6a4f", fontWeight: 700 }}>{mealCals} kcal</span>}
                </div>
                <button onClick={() => openSheet(meal.id)} style={{ backgroundColor: "#eaf5ef", color: "#2d6a4f", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                  + Add
                </button>
              </div>

              {foods.map(food => (
                <div key={food.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", backgroundColor: "#f7f5f2", borderRadius: "8px", marginBottom: "6px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "#111", margin: 0 }}>{food.name}</p>
                      {food.addedByCoach && <span style={{ fontSize: "9px", color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "1px 5px", borderRadius: "4px", fontWeight: 700 }}>Coach</span>}
                    </div>
                    <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>{food.amount} · {food.calories} kcal · P:{food.protein}g</p>
                  </div>
                  <button onClick={() => removeFood(meal.id, food.id)} style={{ background: "none", border: "none", color: "#dc2626", fontSize: "16px", cursor: "pointer", padding: "4px 6px" }}>✕</button>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Add food sheet */}
      {addingTo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: 0 }}>
                Add to {MEALS.find(m => m.id === addingTo)?.label}
              </h2>
              {/* Toggle pick/custom */}
              <div style={{ display: "flex", backgroundColor: "#f0f0f0", borderRadius: "8px", padding: "2px" }}>
                {["pick", "custom"].map(m => (
                  <button key={m} onClick={() => { setMode(m); setSelected(null); }} style={{ padding: "5px 10px", borderRadius: "6px", border: "none", backgroundColor: mode === m ? "#fff" : "transparent", color: mode === m ? "#111" : "#888", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                    {m === "pick" ? "Quick pick" : "Custom"}
                  </button>
                ))}
              </div>
            </div>

            {mode === "pick" ? (
              !selected ? (
                <>
                  <input
                    type="text"
                    placeholder="Search foods..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box", marginBottom: "10px" }}
                    autoFocus
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {filteredPicks.map((food, i) => (
                      <div key={i} onClick={() => setSelected(food)} style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: "#f7f5f2", cursor: "pointer" }}>
                        <p style={{ fontSize: "14px", fontWeight: 600, color: "#111", margin: "0 0 2px" }}>{food.name}</p>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <span style={{ fontSize: "11px", color: "#2d6a4f", fontWeight: 700 }}>{food.per100.calories} kcal</span>
                          <span style={{ fontSize: "11px", color: "#888" }}>P: {food.per100.protein}g</span>
                          <span style={{ fontSize: "11px", color: "#aaa" }}>per 100g</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ backgroundColor: "#eaf5ef", borderRadius: "12px", padding: "12px 14px", marginBottom: "14px" }}>
                    <p style={{ fontWeight: 700, fontSize: "15px", color: "#111", margin: "0 0 2px" }}>{selected.name}</p>
                    <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>per 100g: {selected.per100.calories} kcal, P:{selected.per100.protein}g</p>
                  </div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Amount (grams)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #2d6a4f", fontSize: "22px", fontWeight: 700, outline: "none", textAlign: "center", boxSizing: "border-box", marginBottom: "8px" }} />
                  <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                    {["50", "80", "100", "150", "200"].map(a => (
                      <button key={a} onClick={() => setAmount(a)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: amount === a ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: amount === a ? "#eaf5ef" : "#f7f5f2", color: amount === a ? "#2d6a4f" : "#888", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>{a}g</button>
                    ))}
                  </div>
                  {amount && (() => {
                    const m = parseFloat(amount) / 100;
                    const p = selected.per100;
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                        {[
                          { label: "Kcal", value: Math.round(p.calories * m), color: "#2d6a4f" },
                          { label: "Protein", value: `${Math.round(p.protein * m * 10) / 10}g`, color: "#3b82f6" },
                          { label: "Carbs", value: `${Math.round(p.carbs * m * 10) / 10}g`, color: "#f59e0b" },
                          { label: "Fat", value: `${Math.round(p.fat * m * 10) / 10}g`, color: "#ef4444" },
                        ].map(s => (
                          <div key={s.label} style={{ backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
                            <p style={{ fontSize: "16px", fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                            <p style={{ fontSize: "10px", color: "#aaa", margin: "3px 0 0" }}>{s.label}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <button onClick={addFood} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "8px" }}>
                    Add Food
                  </button>
                  <button onClick={() => setSelected(null)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer" }}>Back</button>
                </div>
              )
            ) : (
              /* Custom food entry */
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "4px" }}>Food name</label>
                  <input type="text" placeholder="e.g. Protein Bar" value={customName} onChange={e => setCustomName(e.target.value)} style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { label: "Calories (kcal)", val: customCals, set: setCustomCals },
                    { label: "Protein (g)", val: customProtein, set: setCustomProtein },
                    { label: "Carbs (g)", val: customCarbs, set: setCustomCarbs },
                    { label: "Fat (g)", val: customFat, set: setCustomFat },
                  ].map(f => (
                    <div key={f.label}>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#888", display: "block", marginBottom: "4px" }}>{f.label}</label>
                      <input type="number" value={f.val} onChange={e => f.set(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "16px", fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
                    </div>
                  ))}
                </div>
                <button onClick={addFood} disabled={!customName.trim() || !customCals} style={{ width: "100%", backgroundColor: !customName.trim() || !customCals ? "#e5e5e5" : "#2d6a4f", color: !customName.trim() || !customCals ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginTop: "4px" }}>
                  Add Food
                </button>
              </div>
            )}

            <button onClick={closeSheet} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "12px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
