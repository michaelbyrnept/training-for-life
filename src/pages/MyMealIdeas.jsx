import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import PortalNav from "../components/PortalNav";

const MEAL_SLOTS = [
  { id: "breakfast", label: "Breakfast", icon: "🌅" },
  { id: "lunch", label: "Lunch", icon: "☀️" },
  { id: "dinner", label: "Dinner", icon: "🌙" },
  { id: "snack", label: "Snack", icon: "🍎" },
];

const TYPE_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

export default function MyMealIdeas() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [calorieTarget, setCalorieTarget] = useState(null);
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState({ breakfast: null, lunch: null, dinner: null, snack: null });
  const [pickingFor, setPickingFor] = useState(null); // which slot is being picked
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);

      const { doc, getDoc } = await import("firebase/firestore");
      const userSnap = await getDoc(doc(db, "users", u.uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        setCalorieTarget(data.nutritionTargets?.calories || null);
      }

      const mealsSnap = await getDocs(query(collection(db, "meals"), where("published", "==", true)));
      setMeals(mealsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const totalCalories = Object.values(slots).reduce((sum, m) => sum + (m?.totals?.calories || 0), 0);
  const totalProtein = Object.values(slots).reduce((sum, m) => {
    const v = m?.totals?.protein || 0;
    return Math.round((sum + v) * 10) / 10;
  }, 0);

  const getStatus = () => {
    if (!calorieTarget || totalCalories === 0) return null;
    const diff = totalCalories - calorieTarget;
    if (Math.abs(diff) <= calorieTarget * 0.05) return { label: "Looking good", color: "#166534", bg: "#dcfce7", icon: "✓" };
    if (diff < 0) return { label: `${Math.abs(diff)} kcal under`, color: "#0369a1", bg: "#e0f2fe", icon: "↓" };
    return { label: `${diff} kcal over`, color: "#b45309", bg: "#fef3c7", icon: "↑" };
  };

  const status = getStatus();

  const filteredMeals = meals.filter(m => filterType === "all" || m.type === filterType);

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "100px" }}>
      <PortalNav />
      <p style={{ textAlign: "center", color: "#888", padding: "3rem" }}>Loading...</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "120px" }}>
      <PortalNav />

      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 28px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>Meal Ideas</p>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>Build Your Day</h1>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", margin: 0 }}>
          Browse meal ideas from your coach and see how they fit your goals. This is for inspiration only.
        </p>

        {/* Calorie tracker */}
        <div style={{ marginTop: "16px", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "14px", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <div>
              <p style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1 }}>{totalCalories} kcal</p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: "2px 0 0" }}>
                {calorieTarget ? `of ${calorieTarget} kcal goal · P: ${totalProtein}g` : `P: ${totalProtein}g protein`}
              </p>
            </div>
            {status && (
              <span style={{ fontSize: "12px", fontWeight: 700, color: status.color, backgroundColor: status.bg, padding: "5px 10px", borderRadius: "10px" }}>
                {status.icon} {status.label}
              </span>
            )}
          </div>
          {calorieTarget && totalCalories > 0 && (
            <div style={{ height: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, Math.round(totalCalories / calorieTarget * 100))}%`, height: "100%", backgroundColor: totalCalories > calorieTarget * 1.1 ? "#f87171" : "#4ade80", borderRadius: 3, transition: "width 0.3s" }} />
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {/* My day slots */}
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px" }}>My day</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
          {MEAL_SLOTS.map(slot => {
            const chosen = slots[slot.id];
            return (
              <div key={slot.id} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: "18px" }}>{slot.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "12px", fontWeight: 700, color: "#aaa", margin: "0 0 1px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{slot.label}</p>
                      {chosen ? (
                        <>
                          <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chosen.name}</p>
                          <p style={{ fontSize: "11px", color: "#2d6a4f", fontWeight: 700, margin: "1px 0 0" }}>{chosen.totals?.calories || 0} kcal · P: {chosen.totals?.protein || 0}g</p>
                        </>
                      ) : (
                        <p style={{ fontSize: "13px", color: "#ccc", margin: 0 }}>No idea chosen yet</p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    {chosen && (
                      <button onClick={() => setSlots(s => ({ ...s, [slot.id]: null }))} style={{ background: "none", border: "none", color: "#dc2626", fontSize: "16px", cursor: "pointer", padding: "4px 6px" }}>✕</button>
                    )}
                    <button onClick={() => setPickingFor(slot.id)} style={{ backgroundColor: chosen ? "#f0f0f0" : "#eaf5ef", color: chosen ? "#555" : "#2d6a4f", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                      {chosen ? "Change" : "+ Pick"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Disclaimer */}
        <div style={{ backgroundColor: "#fffbeb", borderRadius: "12px", padding: "12px 14px", marginBottom: "20px", display: "flex", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>ℹ️</span>
          <p style={{ fontSize: "12px", color: "#92400e", margin: 0, lineHeight: 1.5 }}>
            These are meal ideas your coach has shared for inspiration. They are not a prescribed meal plan. For personalised nutrition advice, consult a registered dietitian.
          </p>
        </div>

        {/* Meal ideas library */}
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px" }}>Meal ideas</p>

        {/* Type filter */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px", overflowX: "auto" }}>
          {["all", "breakfast", "lunch", "dinner", "snack"].map(t => (
            <button key={t} onClick={() => setFilterType(t)} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: "20px", border: "none", backgroundColor: filterType === t ? "#1a3a2a" : "#f0f0f0", color: filterType === t ? "#fff" : "#555", fontSize: "12px", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>

        {filteredMeals.length === 0 ? (
          <div style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "28px", margin: "0 0 10px" }}>🍽️</p>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>No meal ideas yet</p>
            <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Your coach hasn't published any meal ideas yet. Check back soon.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filteredMeals.map(meal => {
              const t = meal.totals || {};
              const isInSlot = Object.values(slots).some(s => s?.id === meal.id);
              return (
                <div key={meal.id} style={{ backgroundColor: "#fff", borderRadius: "14px", border: isInSlot ? "1.5px solid #2d6a4f" : "0.5px solid #e5e5e5", padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                        <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{meal.name}</p>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "2px 7px", borderRadius: "8px", textTransform: "capitalize" }}>{meal.type}</span>
                        {isInSlot && <span style={{ fontSize: "10px", fontWeight: 700, color: "#166534", backgroundColor: "#dcfce7", padding: "2px 7px", borderRadius: "8px" }}>Added</span>}
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f" }}>{t.calories || 0} kcal</span>
                        <span style={{ fontSize: "12px", color: "#3b82f6" }}>P: {t.protein || 0}g</span>
                        <span style={{ fontSize: "12px", color: "#888" }}>C: {t.carbs || 0}g</span>
                        <span style={{ fontSize: "12px", color: "#888" }}>F: {t.fat || 0}g</span>
                      </div>
                      {meal.description && <p style={{ fontSize: "12px", color: "#888", margin: "4px 0 0" }}>{meal.description}</p>}
                    </div>
                  </div>

                  {/* Ingredients preview */}
                  {meal.ingredients && meal.ingredients.length > 0 && (
                    <div style={{ backgroundColor: "#f7f5f2", borderRadius: "8px", padding: "8px 10px", marginBottom: "10px" }}>
                      <p style={{ fontSize: "11px", color: "#888", margin: "0 0 4px", fontWeight: 700 }}>Ingredients</p>
                      {meal.ingredients.slice(0, 4).map((ing, i) => (
                        <p key={i} style={{ fontSize: "12px", color: "#555", margin: "1px 0" }}>{ing.name} — {ing.amount}g</p>
                      ))}
                      {meal.ingredients.length > 4 && <p style={{ fontSize: "11px", color: "#aaa", margin: "2px 0 0" }}>+{meal.ingredients.length - 4} more</p>}
                    </div>
                  )}

                  {/* Add to slot buttons */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {MEAL_SLOTS.filter(s => filterType === "all" ? true : s.id === filterType || s.id === meal.type).map(slot => (
                      <button
                        key={slot.id}
                        onClick={() => setSlots(s => ({ ...s, [slot.id]: meal }))}
                        style={{ padding: "6px 12px", borderRadius: "8px", border: "none", backgroundColor: slots[slot.id]?.id === meal.id ? "#dcfce7" : "#eaf5ef", color: slots[slot.id]?.id === meal.id ? "#166534" : "#2d6a4f", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                      >
                        {slots[slot.id]?.id === meal.id ? `✓ ${slot.label}` : `+ ${slot.label}`}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Meal picker sheet */}
      {pickingFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>
              Pick idea for {MEAL_SLOTS.find(s => s.id === pickingFor)?.label}
            </h2>
            <p style={{ fontSize: "12px", color: "#888", margin: "0 0 14px" }}>For inspiration only, not a prescribed meal plan.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {meals
                .filter(m => m.type === pickingFor || pickingFor === "snack" ? m.type === "snack" : true)
                .map(meal => {
                  const t = meal.totals || {};
                  return (
                    <div
                      key={meal.id}
                      onClick={() => { setSlots(s => ({ ...s, [pickingFor]: meal })); setPickingFor(null); }}
                      style={{ backgroundColor: "#f7f5f2", borderRadius: "12px", padding: "14px", cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{meal.name}</p>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f" }}>{t.calories || 0} kcal</span>
                      </div>
                      <div style={{ display: "flex", gap: "10px", marginTop: "2px" }}>
                        <span style={{ fontSize: "11px", color: "#3b82f6" }}>P: {t.protein || 0}g</span>
                        <span style={{ fontSize: "11px", color: "#888" }}>C: {t.carbs || 0}g</span>
                        <span style={{ fontSize: "11px", color: "#888" }}>F: {t.fat || 0}g</span>
                      </div>
                    </div>
                  );
                })}
            </div>

            <button onClick={() => setPickingFor(null)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "14px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
