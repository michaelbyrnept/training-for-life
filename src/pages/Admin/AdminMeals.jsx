import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

const QUICK_PICKS = [
  { name: "Chicken Breast", per100: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fibre: 0 } },
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
  { name: "Olive Oil", per100: { calories: 884, protein: 0, carbs: 0, fat: 100, fibre: 0 } },
  { name: "Avocado", per100: { calories: 160, protein: 2, carbs: 9, fat: 15, fibre: 6.7 } },
  { name: "Spinach (Raw)", per100: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fibre: 2.2 } },
  { name: "Sourdough Bread", per100: { calories: 269, protein: 9, carbs: 51, fat: 3, fibre: 2.4 } },
  { name: "Milk (Full Fat)", per100: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fibre: 0 } },
  { name: "Cheddar Cheese", per100: { calories: 403, protein: 25, carbs: 1.3, fat: 33, fibre: 0 } },
  { name: "Quinoa (Cooked)", per100: { calories: 120, protein: 4.4, carbs: 22, fat: 1.9, fibre: 2.8 } },
  { name: "Blueberries", per100: { calories: 57, protein: 0.7, carbs: 14, fat: 0.3, fibre: 2.4 } },
];

function calcTotals(ingredients) {
  return ingredients.reduce((acc, ing) => ({
    calories: Math.round((acc.calories || 0) + (ing.calories || 0)),
    protein: Math.round(((acc.protein || 0) + (ing.protein || 0)) * 10) / 10,
    carbs: Math.round(((acc.carbs || 0) + (ing.carbs || 0)) * 10) / 10,
    fat: Math.round(((acc.fat || 0) + (ing.fat || 0)) * 10) / 10,
    fibre: Math.round(((acc.fibre || 0) + (ing.fibre || 0)) * 10) / 10,
  }), {});
}

export default function AdminMeals() {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [saving, setSaving] = useState(false);

  // Builder state
  const [form, setForm] = useState({ name: "", type: "lunch", description: "" });
  const [ingredients, setIngredients] = useState([]);
  const [showIngSheet, setShowIngSheet] = useState(false);
  const [ingSearch, setIngSearch] = useState("");
  const [ingSelected, setIngSelected] = useState(null);
  const [ingAmount, setIngAmount] = useState("100");

  useEffect(() => { loadMeals(); }, []);

  const loadMeals = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "meals"));
    setMeals(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  };

  const openCreate = () => {
    setEditingMeal(null);
    setForm({ name: "", type: "lunch", description: "" });
    setIngredients([]);
    setShowBuilder(true);
  };

  const openEdit = (meal) => {
    setEditingMeal(meal);
    setForm({ name: meal.name, type: meal.type, description: meal.description || "" });
    setIngredients(meal.ingredients || []);
    setShowBuilder(true);
  };

  const saveMeal = async () => {
    if (!form.name.trim() || ingredients.length === 0) return;
    setSaving(true);
    const data = {
      name: form.name.trim(),
      type: form.type,
      description: form.description.trim(),
      ingredients,
      totals: calcTotals(ingredients),
      published: editingMeal ? editingMeal.published : false,
      updatedAt: new Date().toISOString(),
    };
    if (editingMeal) {
      await updateDoc(doc(db, "meals", editingMeal.id), data);
    } else {
      data.createdAt = new Date().toISOString();
      await addDoc(collection(db, "meals"), data);
    }
    setSaving(false);
    setShowBuilder(false);
    loadMeals();
  };

  const togglePublish = async (meal) => {
    await updateDoc(doc(db, "meals", meal.id), { published: !meal.published });
    loadMeals();
  };

  const deleteMeal = async (meal) => {
    if (!window.confirm(`Delete "${meal.name}"?`)) return;
    await deleteDoc(doc(db, "meals", meal.id));
    loadMeals();
  };

  const addIngredient = () => {
    if (!ingSelected || !ingAmount) return;
    const m = parseFloat(ingAmount) / 100;
    const p = ingSelected.per100;
    setIngredients(prev => [...prev, {
      name: ingSelected.name,
      amount: parseFloat(ingAmount),
      calories: Math.round((p.calories || 0) * m),
      protein: Math.round((p.protein || 0) * m * 10) / 10,
      carbs: Math.round((p.carbs || 0) * m * 10) / 10,
      fat: Math.round((p.fat || 0) * m * 10) / 10,
      fibre: Math.round((p.fibre || 0) * m * 10) / 10,
    }]);
    setIngSelected(null);
    setIngAmount("100");
    setIngSearch("");
    setShowIngSheet(false);
  };

  const removeIngredient = (i) => setIngredients(prev => prev.filter((_, idx) => idx !== i));

  const filteredMeals = filterType === "all" ? meals : meals.filter(m => m.type === filterType);
  const filteredPicks = QUICK_PICKS.filter(p => p.name.toLowerCase().includes(ingSearch.toLowerCase()));
  const builderTotals = calcTotals(ingredients);

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2" }}>
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 24px" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>← Admin</Link>
      </div>
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "40px" }}>
      <div style={{ backgroundColor: "#1a3a2a", padding: "20px 20px 28px" }}>
        <Link to="/admin" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>← Admin</Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: 0 }}>Meal Library</h1>
            <p style={{ fontSize: "13px", color: "#9fe1cb", margin: "4px 0 0" }}>{meals.length} meals · {meals.filter(m => m.published).length} published</p>
          </div>
          <button onClick={openCreate} style={{ backgroundColor: "#4ade80", color: "#1a3a2a", border: "none", borderRadius: "12px", padding: "10px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            + New Meal
          </button>
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "14px", overflowX: "auto" }}>
          {["all", ...MEAL_TYPES].map(t => (
            <button key={t} onClick={() => setFilterType(t)} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: "20px", border: "none", backgroundColor: filterType === t ? "#1a3a2a" : "#f0f0f0", color: filterType === t ? "#fff" : "#555", fontSize: "12px", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>

        {filteredMeals.length === 0 ? (
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "28px", margin: "0 0 10px" }}>🍽️</p>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No meals yet</p>
            <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Create meals your clients can browse and add to their log.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filteredMeals.map(meal => {
              const t = meal.totals || {};
              return (
                <div key={meal.id} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                        <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{meal.name}</p>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "2px 7px", borderRadius: "8px", textTransform: "capitalize" }}>{meal.type}</span>
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#2d6a4f" }}>{t.calories || 0} kcal</span>
                        <span style={{ fontSize: "12px", color: "#3b82f6" }}>P: {t.protein || 0}g</span>
                        <span style={{ fontSize: "12px", color: "#888" }}>C: {t.carbs || 0}g</span>
                        <span style={{ fontSize: "12px", color: "#888" }}>F: {t.fat || 0}g</span>
                      </div>
                      {meal.description && <p style={{ fontSize: "12px", color: "#888", margin: "6px 0 0" }}>{meal.description}</p>}
                      <p style={{ fontSize: "11px", color: "#aaa", margin: "4px 0 0" }}>{(meal.ingredients || []).length} ingredients</p>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <div onClick={() => togglePublish(meal)} style={{ padding: "5px 10px", borderRadius: "20px", backgroundColor: meal.published ? "#eaf5ef" : "#f0f0f0", cursor: "pointer" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: meal.published ? "#2d6a4f" : "#888" }}>
                          {meal.published ? "Published" : "Draft"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => openEdit(meal)} style={{ flex: 1, padding: "8px", backgroundColor: "#f7f5f2", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: 700, color: "#555", cursor: "pointer" }}>
                      Edit
                    </button>
                    <button onClick={() => togglePublish(meal)} style={{ flex: 1, padding: "8px", backgroundColor: meal.published ? "#fffbeb" : "#eaf5ef", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: 700, color: meal.published ? "#b45309" : "#2d6a4f", cursor: "pointer" }}>
                      {meal.published ? "Unpublish" : "Publish"}
                    </button>
                    <button onClick={() => deleteMeal(meal)} style={{ padding: "8px 12px", backgroundColor: "#fef2f2", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: 700, color: "#dc2626", cursor: "pointer" }}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MEAL BUILDER SHEET */}
      {showBuilder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#111", margin: "0 0 16px" }}>
              {editingMeal ? "Edit Meal" : "New Meal"}
            </h2>

            {/* Name */}
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>Meal Name</p>
            <input
              type="text"
              placeholder="e.g. Chicken Rice Bowl"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", fontWeight: 700, outline: "none", boxSizing: "border-box", marginBottom: "12px" }}
            />

            {/* Type */}
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>Meal Type</p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              {MEAL_TYPES.map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: form.type === t ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: form.type === t ? "#eaf5ef" : "#f7f5f2", color: form.type === t ? "#2d6a4f" : "#888", fontWeight: 700, fontSize: "12px", cursor: "pointer", textTransform: "capitalize" }}>
                  {t}
                </button>
              ))}
            </div>

            {/* Description (optional) */}
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 6px" }}>Description (optional)</p>
            <input
              type="text"
              placeholder="e.g. High protein, easy to prep"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "14px", outline: "none", boxSizing: "border-box", marginBottom: "16px" }}
            />

            {/* Ingredients */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: 0 }}>Ingredients</p>
              <button onClick={() => setShowIngSheet(true)} style={{ backgroundColor: "#eaf5ef", color: "#2d6a4f", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                + Add
              </button>
            </div>

            {ingredients.length === 0 ? (
              <div style={{ border: "1.5px dashed #e5e5e5", borderRadius: "10px", padding: "20px", textAlign: "center", marginBottom: "16px" }}>
                <p style={{ fontSize: "13px", color: "#aaa", margin: 0 }}>No ingredients yet. Click + Add above.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                {ingredients.map((ing, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "10px 12px" }}>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "#111", margin: 0 }}>{ing.name}</p>
                      <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>{ing.amount}g · {ing.calories} kcal · P:{ing.protein}g</p>
                    </div>
                    <button onClick={() => removeIngredient(i)} style={{ background: "none", border: "none", color: "#dc2626", fontSize: "16px", cursor: "pointer", padding: "4px 8px" }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Totals preview */}
            {ingredients.length > 0 && (
              <div style={{ backgroundColor: "#1a3a2a", borderRadius: "12px", padding: "12px 14px", marginBottom: "16px", display: "flex", justifyContent: "space-around" }}>
                {[
                  { label: "Kcal", value: builderTotals.calories || 0, color: "#4ade80" },
                  { label: "Protein", value: `${builderTotals.protein || 0}g`, color: "#60a5fa" },
                  { label: "Carbs", value: `${builderTotals.carbs || 0}g`, color: "#fbbf24" },
                  { label: "Fat", value: `${builderTotals.fat || 0}g`, color: "#f87171" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <p style={{ fontSize: "16px", fontWeight: 700, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                    <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", margin: "3px 0 0" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            <button onClick={saveMeal} disabled={saving || !form.name.trim() || ingredients.length === 0} style={{ width: "100%", backgroundColor: saving || !form.name.trim() || ingredients.length === 0 ? "#e5e5e5" : "#2d6a4f", color: saving || !form.name.trim() || ingredients.length === 0 ? "#aaa" : "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "8px" }}>
              {saving ? "Saving..." : editingMeal ? "Save Changes" : "Create Meal"}
            </button>
            <button onClick={() => setShowBuilder(false)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* INGREDIENT PICKER SHEET */}
      {showIngSheet && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 14px" }}>Add Ingredient</h2>

            {!ingSelected ? (
              <>
                <input
                  type="text"
                  placeholder="Search foods..."
                  value={ingSearch}
                  onChange={e => setIngSearch(e.target.value)}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box", marginBottom: "12px" }}
                  autoFocus
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {filteredPicks.map((food, i) => (
                    <div key={i} onClick={() => setIngSelected(food)} style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: "#f7f5f2", cursor: "pointer" }}>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "#111", margin: "0 0 2px" }}>{food.name}</p>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <span style={{ fontSize: "11px", color: "#2d6a4f", fontWeight: 700 }}>{food.per100.calories} kcal</span>
                        <span style={{ fontSize: "11px", color: "#888" }}>P: {food.per100.protein}g</span>
                        <span style={{ fontSize: "11px", color: "#888" }}>C: {food.per100.carbs}g</span>
                        <span style={{ fontSize: "11px", color: "#888" }}>F: {food.per100.fat}g</span>
                        <span style={{ fontSize: "10px", color: "#aaa" }}>per 100g</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div>
                <div style={{ backgroundColor: "#eaf5ef", borderRadius: "12px", padding: "14px", marginBottom: "16px" }}>
                  <p style={{ fontWeight: 700, fontSize: "15px", color: "#111", margin: "0 0 2px" }}>{ingSelected.name}</p>
                  <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>per 100g: {ingSelected.per100.calories} kcal, P:{ingSelected.per100.protein}g</p>
                </div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Amount (grams)</label>
                <input type="number" value={ingAmount} onChange={e => setIngAmount(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #2d6a4f", fontSize: "22px", fontWeight: 700, outline: "none", textAlign: "center", boxSizing: "border-box", marginBottom: "10px" }} />
                <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                  {["50", "80", "100", "150", "200"].map(a => (
                    <button key={a} onClick={() => setIngAmount(a)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: ingAmount === a ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: ingAmount === a ? "#eaf5ef" : "#f7f5f2", color: ingAmount === a ? "#2d6a4f" : "#888", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
                      {a}g
                    </button>
                  ))}
                </div>
                {ingAmount && (() => {
                  const m = parseFloat(ingAmount) / 100;
                  const p = ingSelected.per100;
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                      {[
                        { label: "Kcal", value: Math.round(p.calories * m), color: "#2d6a4f" },
                        { label: "Protein", value: `${Math.round(p.protein * m * 10) / 10}g`, color: "#3b82f6" },
                        { label: "Carbs", value: `${Math.round(p.carbs * m * 10) / 10}g`, color: "#f59e0b" },
                        { label: "Fat", value: `${Math.round(p.fat * m * 10) / 10}g`, color: "#ef4444" },
                      ].map(s => (
                        <div key={s.label} style={{ backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
                          <p style={{ fontSize: "16px", fontWeight: 700, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                          <p style={{ fontSize: "10px", color: "#aaa", margin: "3px 0 0" }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <button onClick={addIngredient} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "8px" }}>
                  Add Ingredient
                </button>
                <button onClick={() => setIngSelected(null)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer" }}>
                  Back
                </button>
              </div>
            )}
            <button onClick={() => { setShowIngSheet(false); setIngSelected(null); setIngSearch(""); }} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "8px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
