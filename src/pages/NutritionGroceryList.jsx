import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, getDocs, collection, query, where } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import PortalNav from "../components/PortalNav";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };
const SLOTS = ["breakfast", "lunch", "dinner", "snack"];

function getWeekMonday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

export default function NutritionGroceryList() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [meals, setMeals] = useState([]);
  const [plan, setPlan] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("planner"); // "planner" | "list"
  const [checked, setChecked] = useState({});
  const [pickerSlot, setPickerSlot] = useState(null); // { day, slot }
  const [mealTypeFilter, setMealTypeFilter] = useState("all");

  const weekOf = getWeekMonday();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);

      const [mealsSnap, planSnap] = await Promise.all([
        getDocs(query(collection(db, "meals"), where("published", "==", true))),
        getDoc(doc(db, "mealPlans", `${u.uid}_${weekOf}`)),
      ]);

      setMeals(mealsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (planSnap.exists()) {
        setPlan(planSnap.data().slots || {});
        setChecked(planSnap.data().checked || {});
      }
      setLoading(false);
    });
    return () => unsub();
  }, [navigate]);

  const savePlan = async (newPlan, newChecked) => {
    if (!user) return;
    await setDoc(doc(db, "mealPlans", `${user.uid}_${weekOf}`), {
      userId: user.uid,
      weekOf,
      slots: newPlan,
      checked: newChecked || checked,
      updatedAt: new Date().toISOString(),
    });
  };

  const assignMeal = (day, slot, mealId) => {
    const key = `${day}_${slot}`;
    const newPlan = { ...plan, [key]: mealId };
    setPlan(newPlan);
    savePlan(newPlan);
    setPickerSlot(null);
  };

  const clearSlot = (day, slot) => {
    const key = `${day}_${slot}`;
    const newPlan = { ...plan };
    delete newPlan[key];
    setPlan(newPlan);
    savePlan(newPlan);
  };

  const toggleCheck = (key) => {
    const newChecked = { ...checked, [key]: !checked[key] };
    setChecked(newChecked);
    savePlan(plan, newChecked);
  };

  // Build grocery list from plan
  const groceryList = (() => {
    const map = {};
    Object.values(plan).forEach(mealId => {
      const meal = meals.find(m => m.id === mealId);
      if (!meal) return;
      (meal.ingredients || []).forEach(ing => {
        const key = ing.name.toLowerCase();
        if (map[key]) {
          map[key].amount += ing.amount;
          map[key].calories += ing.calories;
          map[key].protein += ing.protein;
        } else {
          map[key] = { name: ing.name, amount: ing.amount, calories: ing.calories, protein: ing.protein };
        }
      });
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const assignedMealCount = Object.keys(plan).length;
  const filteredPickerMeals = mealTypeFilter === "all" ? meals : meals.filter(m => m.type === mealTypeFilter);

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "100px" }}>
      <PortalNav />
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "120px" }}>
      <PortalNav />

      {/* HEADER */}
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 40px" }}>
        <Link to="/nutrition" style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, textDecoration: "none" }}>← Nutrition</Link>
        <div style={{ marginTop: "12px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>Grocery List</h1>
          <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
            Week of {new Date(weekOf + "T12:00:00").toLocaleDateString("en-IE", { day: "numeric", month: "long" })} · {assignedMealCount} meals planned
          </p>
        </div>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      <div style={{ padding: "0 16px 16px" }}>
        {/* Tab toggle */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {[{ id: "planner", label: "Meal Planner" }, { id: "list", label: `Shopping List${groceryList.length > 0 ? ` (${groceryList.length})` : ""}` }].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id)} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", backgroundColor: view === tab.id ? "#1a3a2a" : "#f0f0f0", color: view === tab.id ? "#fff" : "#555", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* PLANNER VIEW */}
        {view === "planner" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {DAYS.map(day => (
              <div key={day} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
                <div style={{ backgroundColor: "#f7f5f2", padding: "10px 14px", borderBottom: "0.5px solid #e5e5e5" }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: 0, textTransform: "capitalize" }}>{day}</p>
                </div>
                <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {SLOTS.map(slot => {
                    const key = `${day}_${slot}`;
                    const mealId = plan[key];
                    const meal = meals.find(m => m.id === mealId);
                    return (
                      <div key={slot} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "capitalize", width: "60px", flexShrink: 0 }}>{slot}</span>
                        {meal ? (
                          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#eaf5ef", borderRadius: "8px", padding: "8px 10px" }}>
                            <div>
                              <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a4a35", margin: 0 }}>{meal.name}</p>
                              <p style={{ fontSize: "11px", color: "#2d6a4f", margin: "2px 0 0" }}>{meal.totals?.calories || 0} kcal · P:{meal.totals?.protein || 0}g</p>
                            </div>
                            <button onClick={() => clearSlot(day, slot)} style={{ background: "none", border: "none", color: "#888", fontSize: "14px", cursor: "pointer", padding: "2px 6px" }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={() => { setPickerSlot({ day, slot }); setMealTypeFilter(slot === "snack" ? "snack" : "all"); }} style={{ flex: 1, padding: "8px 10px", backgroundColor: "#f7f5f2", border: "1.5px dashed #e5e5e5", borderRadius: "8px", fontSize: "12px", color: "#aaa", cursor: "pointer", textAlign: "left" }}>
                            + Add meal
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SHOPPING LIST VIEW */}
        {view === "list" && (
          <>
            {groceryList.length === 0 ? (
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "32px", textAlign: "center" }}>
                <p style={{ fontSize: "28px", margin: "0 0 10px" }}>🛒</p>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No meals planned yet</p>
                <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>Add meals to your planner and your shopping list will appear here automatically.</p>
                <button onClick={() => setView("planner")} style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "12px 24px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
                  Go to Planner
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: "13px", color: "#888", margin: "0 0 12px" }}>Based on {assignedMealCount} planned meals. Tap to check off as you shop.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {groceryList.map((item) => {
                    const isChecked = checked[item.name.toLowerCase()];
                    return (
                      <div key={item.name} onClick={() => toggleCheck(item.name.toLowerCase())} style={{ backgroundColor: "#fff", borderRadius: "12px", border: "0.5px solid #e5e5e5", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", opacity: isChecked ? 0.5 : 1 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${isChecked ? "#2d6a4f" : "#e5e5e5"}`, backgroundColor: isChecked ? "#2d6a4f" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                          {isChecked && <span style={{ color: "#fff", fontSize: "13px", lineHeight: 1 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0, textDecoration: isChecked ? "line-through" : "none" }}>{item.name}</p>
                          <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>
                            {item.amount}g total · {item.calories} kcal · {Math.round(item.protein * 10) / 10}g protein
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {checked && Object.values(checked).some(Boolean) && (
                  <button onClick={() => { const newChecked = {}; setChecked(newChecked); savePlan(plan, newChecked); }} style={{ width: "100%", marginTop: "14px", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>
                    Clear all checkmarks
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* MEAL PICKER SHEET */}
      {pickerSlot && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setPickerSlot(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>
              {DAY_LABELS[pickerSlot.day]} {pickerSlot.slot.charAt(0).toUpperCase() + pickerSlot.slot.slice(1)}
            </h2>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 14px" }}>Pick a meal from your library</p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", overflowX: "auto" }}>
              {["all", ...["breakfast", "lunch", "dinner", "snack"]].map(t => (
                <button key={t} onClick={() => setMealTypeFilter(t)} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: "20px", border: "none", backgroundColor: mealTypeFilter === t ? "#1a3a2a" : "#f0f0f0", color: mealTypeFilter === t ? "#fff" : "#555", fontSize: "11px", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                  {t === "all" ? "All" : t}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredPickerMeals.map(meal => (
                <div key={meal.id} onClick={() => assignMeal(pickerSlot.day, pickerSlot.slot, meal.id)} style={{ padding: "12px 14px", borderRadius: "12px", border: "0.5px solid #e5e5e5", cursor: "pointer", backgroundColor: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{meal.name}</p>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "2px 7px", borderRadius: "8px", textTransform: "capitalize" }}>{meal.type}</span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#2d6a4f" }}>{meal.totals?.calories || 0} kcal</span>
                    <span style={{ fontSize: "12px", color: "#888" }}>P: {meal.totals?.protein || 0}g</span>
                    <span style={{ fontSize: "12px", color: "#888" }}>C: {meal.totals?.carbs || 0}g</span>
                  </div>
                </div>
              ))}
              {filteredPickerMeals.length === 0 && (
                <p style={{ textAlign: "center", fontSize: "13px", color: "#aaa", padding: "20px 0" }}>No {mealTypeFilter === "all" ? "" : mealTypeFilter} meals in your library yet.</p>
              )}
            </div>
            <button onClick={() => setPickerSlot(null)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "12px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
