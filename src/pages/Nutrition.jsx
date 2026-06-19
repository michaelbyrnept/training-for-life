import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import PortalNav from "../components/PortalNav";

const USDA_API_KEY = import.meta.env.VITE_USDA_API_KEY;

const MACRO_COLORS = {
  calories: "#2d6a4f",
  protein: "#3b82f6",
  carbs: "#f59e0b",
  fat: "#ef4444",
  fibre: "#8b5cf6",
};

function MacroRing({ value, target, color, label, unit = "g", size = 80 }) {
  const pct = Math.min(value / (target || 1), 1);
  const r = (size / 2) - 6;
  const circ = 2 * Math.PI * r;
  const offset = circ - pct * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg style={{ width: size, height: size, transform: "rotate(-90deg)", display: "block" }} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f0f0" strokeWidth="5"/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.6s ease" }}/>
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: size > 70 ? "14px" : "11px", fontWeight: 700, color: "#111", lineHeight: 1 }}>{value}</span>
          <span style={{ fontSize: "9px", color: "#888" }}>{unit}</span>
        </div>
      </div>
      <p style={{ fontSize: "10px", fontWeight: 700, color: "#555", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
      <p style={{ fontSize: "10px", color: "#aaa", margin: 0 }}>/ {target}{unit}</p>
    </div>
  );
}

function BarcodeScanner({ onResult, onClose }) {
  const [manualBarcode, setManualBarcode] = useState("");
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useState(null);
  const [videoEl, setVideoEl] = useState(null);
  const readerRef = useState(null);

  const startScan = async () => {
    setScanning(true);
    setError("");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const codeReader = new BrowserMultiFormatReader();
      readerRef[0] = codeReader;
      const videoElement = document.getElementById("barcode-video");
      codeReader.decodeFromVideoDevice(null, videoElement, (result, err) => {
        if (result) {
          codeReader.reset();
          setScanning(false);
          lookupBarcode(result.getText());
        }
      });
    } catch (e) {
      console.error(e);
      setError("Camera not available. Please type the barcode below.");
      setScanning(false);
    }
  };

  const stopScan = () => {
    if (readerRef[0]) {
      try { readerRef[0].reset(); } catch (e) {}
    }
    setScanning(false);
  };

  const lookupBarcode = async (barcode) => {
    setSearching(true);
    setError("");
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const nutriments = p.nutriments || {};
        onResult({
          name: p.product_name || p.product_name_en || "Unknown Product",
          brand: p.brands || "",
          calories: Math.round(nutriments["energy-kcal_100g"] || nutriments["energy-kcal"] || 0),
          protein: Math.round((nutriments.proteins_100g || 0) * 10) / 10,
          carbs: Math.round((nutriments.carbohydrates_100g || 0) * 10) / 10,
          fat: Math.round((nutriments.fat_100g || 0) * 10) / 10,
          fibre: Math.round((nutriments.fiber_100g || 0) * 10) / 10,
          serving: p.serving_size || "100g",
          barcode,
          per100g: true,
        });
      } else {
        setError("Product not found. Try searching by name instead.");
      }
    } catch (e) {
      setError("Could not connect. Check your internet connection.");
    }
    setSearching(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Scan Barcode</h2>
        <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>Point your camera at the barcode on the packaging</p>

        {/* Camera view */}
        {scanning ? (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", backgroundColor: "#000", aspectRatio: "4/3" }}>
              <video id="barcode-video" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ width: "60%", height: "30%", border: "2px solid #4ade80", borderRadius: "8px", boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)" }} />
              </div>
            </div>
            <button onClick={stopScan} style={{ width: "100%", backgroundColor: "#f0f0f0", color: "#555", border: "none", borderRadius: "12px", padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginTop: "10px" }}>
              Stop Scanning
            </button>
          </div>
        ) : (
          <button onClick={startScan} disabled={searching} style={{ width: "100%", backgroundColor: "#1a3a2a", color: "#fff", border: "none", borderRadius: "12px", padding: "16px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            📷 Scan with Camera
          </button>
        )}

        {searching && (
          <div style={{ textAlign: "center", padding: "12px", backgroundColor: "#eaf5ef", borderRadius: "10px", marginBottom: "12px" }}>
            <p style={{ fontSize: "13px", color: "#2d6a4f", fontWeight: 700, margin: 0 }}>Looking up product...</p>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: "12px", color: "#aaa", margin: "0 0 10px" }}>or enter barcode manually</p>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="number"
            placeholder="e.g. 5000112548175"
            value={manualBarcode}
            onChange={e => setManualBarcode(e.target.value)}
            style={{ flex: 1, padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none" }}
          />
          <button onClick={() => lookupBarcode(manualBarcode)} disabled={!manualBarcode || searching} style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "10px", padding: "12px 16px", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
            {searching ? "..." : "Search"}
          </button>
        </div>

        {error && <p style={{ fontSize: "13px", color: "#dc2626", margin: "10px 0 0", backgroundColor: "#fef2f2", padding: "10px 12px", borderRadius: "8px" }}>{error}</p>}

        <button onClick={() => { stopScan(); onClose(); }} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "16px", padding: "6px" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function FoodSearch({ onAdd, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("100");

  const search = async (q) => {
    const term = q ?? query;
    if (!term.trim() || term.trim().length < 3) return;
    setSearching(true);

    let foods = [];

    try {
      const offRes = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=24&fields=product_name,brands,nutriments`
      );
      const offData = await offRes.json();
      foods = (offData.products || [])
        .filter(p =>
          p.product_name &&
          p.product_name.trim().length > 2 &&
          p.nutriments &&
          (p.nutriments["energy-kcal_100g"] || p.nutriments["energy-kcal"] || 0) > 0 &&
          /^[\x20-\x7E\u00C0-\u024F\s]+$/.test(p.product_name)
        )
        .slice(0, 10)
        .map(p => ({
          product_name: toTitleCase(p.product_name.trim()),
          brands: p.brands ? toTitleCase(p.brands.split(",")[0].trim()) : "",
          nutriments: {
            "energy-kcal_100g": Math.round(p.nutriments["energy-kcal_100g"] || p.nutriments["energy-kcal"] || 0),
            proteins_100g: Math.round((p.nutriments.proteins_100g || 0) * 10) / 10,
            carbohydrates_100g: Math.round((p.nutriments.carbohydrates_100g || 0) * 10) / 10,
            fat_100g: Math.round((p.nutriments.fat_100g || 0) * 10) / 10,
            fiber_100g: Math.round((p.nutriments.fiber_100g || p.nutriments.fibers_100g || 0) * 10) / 10,
          }
        }));
    } catch (e) {
      console.log("Open Food Facts unavailable");
    }

    if (foods.length < 4) {
      try {
        const usdaRes = await fetch(
          `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(term)}&dataType=SR%20Legacy,Foundation&pageSize=8&api_key=${USDA_API_KEY}`
        );
        const usdaData = await usdaRes.json();
        const usdaFoods = (usdaData.foods || []).slice(0, 6).map(f => {
          const nutrients = f.foodNutrients || [];
          const get = (id) => Math.round((nutrients.find(n => n.nutrientId === id)?.value || 0) * 10) / 10;
          return {
            product_name: toTitleCase(f.description),
            brands: "Whole food",
            nutriments: {
              "energy-kcal_100g": get(1008),
              proteins_100g: get(1003),
              carbohydrates_100g: get(1005),
              fat_100g: get(1004),
              fiber_100g: get(1079),
            }
          };
        });
        foods = [...foods, ...usdaFoods];
      } catch (e) {
        console.log("USDA unavailable");
      }
    }

    setResults(foods.slice(0, 12));
    setSearching(false);
  };

  const toTitleCase = (str) =>
    str.replace(/\b\w/g, txt => txt.toUpperCase());

  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); return; }
    const timer = setTimeout(() => search(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  const addFood = () => {
    if (!selected) return;
    const n = selected.nutriments || {};
    const multiplier = parseFloat(amount) / 100;
    onAdd({
      name: selected.product_name,
      brand: selected.brands || "",
      calories: Math.round((n["energy-kcal_100g"] || 0) * multiplier),
      protein: Math.round((n.proteins_100g || 0) * multiplier * 10) / 10,
      carbs: Math.round((n.carbohydrates_100g || 0) * multiplier * 10) / 10,
      fat: Math.round((n.fat_100g || 0) * multiplier * 10) / 10,
      fibre: Math.round((n.fiber_100g || 0) * multiplier * 10) / 10,
      amount: `${amount}g`,
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 16px" }}>Search Food</h2>

        <div style={{ position: "relative", marginBottom: "12px" }}>
          <input
            type="text"
            placeholder="e.g. chicken breast, banana, Greek yogurt..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null); }}
            style={{ width: "100%", padding: "12px 14px", paddingRight: searching ? "40px" : "14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box" }}
            autoFocus
          />
          {searching && (
            <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: "#aaa" }}>
              ...
            </div>
          )}
        </div>

        {!selected && results.map((product, i) => (
          <div key={i} onClick={() => setSelected(product)} style={{ padding: "12px 14px", borderRadius: "10px", border: "0.5px solid #e5e5e5", marginBottom: "8px", cursor: "pointer", backgroundColor: "#fff" }}>
            <p style={{ fontWeight: 700, fontSize: "14px", color: "#111", margin: "0 0 2px" }}>{product.product_name}</p>
            <p style={{ fontSize: "12px", color: "#888", margin: "0 0 4px" }}>{product.brands || "Whole food"}</p>
            <div style={{ display: "flex", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: "#2d6a4f", fontWeight: 700 }}>{product.nutriments?.["energy-kcal_100g"] || 0} kcal</span>
              <span style={{ fontSize: "11px", color: "#888" }}>P: {product.nutriments?.proteins_100g || 0}g</span>
              <span style={{ fontSize: "11px", color: "#888" }}>C: {product.nutriments?.carbohydrates_100g || 0}g</span>
              <span style={{ fontSize: "11px", color: "#888" }}>F: {product.nutriments?.fat_100g || 0}g</span>
            </div>
          </div>
        ))}

        {!selected && !searching && query.length >= 3 && results.length === 0 && (
          <p style={{ textAlign: "center", fontSize: "13px", color: "#aaa", padding: "20px 0" }}>No results found. Try a different search term.</p>
        )}

        {selected && (
          <div>
            <div style={{ backgroundColor: "#eaf5ef", borderRadius: "12px", padding: "14px", marginBottom: "16px" }}>
              <p style={{ fontWeight: 700, fontSize: "15px", color: "#111", margin: "0 0 4px" }}>{selected.product_name}</p>
              <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>{selected.brands}</p>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Amount (grams)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #2d6a4f", fontSize: "16px", fontWeight: 700, outline: "none", textAlign: "center", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              {["30", "50", "100", "150", "200"].map(a => (
                <button key={a} onClick={() => setAmount(a)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: amount === a ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: amount === a ? "#eaf5ef" : "#f7f5f2", color: amount === a ? "#2d6a4f" : "#888", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
                  {a}g
                </button>
              ))}
            </div>
            <button onClick={addFood} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "8px" }}>
              Add to Log
            </button>
            <button onClick={() => setSelected(null)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer" }}>
              Back to results
            </button>
          </div>
        )}

        <button onClick={onClose} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", marginTop: "8px" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Nutrition() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [nutritionTargets, setNutritionTargets] = useState(null);
  const [todayLog, setTodayLog] = useState({ breakfast: [], lunch: [], dinner: [], snacks: [] });
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeMeal, setActiveMeal] = useState(null);
  const [addingTo, setAddingTo] = useState(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);
      const docSnap = await getDoc(doc(db, "users", u.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        if (data.nutritionTargets) setNutritionTargets(data.nutritionTargets);
      }
      const logRef = doc(db, "nutritionLogs", `${u.uid}_${today}`);
      const logSnap = await getDoc(logRef);
      if (logSnap.exists()) setTodayLog(logSnap.data().meals || { breakfast: [], lunch: [], dinner: [], snacks: [] });
      setLoading(false);
    });
    return () => unsub();
  }, [navigate]);

  const saveLog = async (newLog) => {
    if (!user) return;
    await setDoc(doc(db, "nutritionLogs", `${user.uid}_${today}`), {
      userId: user.uid,
      date: today,
      meals: newLog,
      updatedAt: new Date().toISOString(),
    });
  };

  const addFoodToMeal = (meal, food) => {
    const newLog = { ...todayLog, [meal]: [...(todayLog[meal] || []), { ...food, id: Date.now() }] };
    setTodayLog(newLog);
    saveLog(newLog);
    setShowScanner(false);
    setShowSearch(false);
    setAddingTo(null);
  };

  const removeFoodFromMeal = (meal, foodId) => {
    const newLog = { ...todayLog, [meal]: todayLog[meal].filter(f => f.id !== foodId) };
    setTodayLog(newLog);
    saveLog(newLog);
  };

  const getTotals = () => {
    const all = Object.values(todayLog).flat();
    return {
      calories: all.reduce((s, f) => s + (f.calories || 0), 0),
      protein: Math.round(all.reduce((s, f) => s + (f.protein || 0), 0) * 10) / 10,
      carbs: Math.round(all.reduce((s, f) => s + (f.carbs || 0), 0) * 10) / 10,
      fat: Math.round(all.reduce((s, f) => s + (f.fat || 0), 0) * 10) / 10,
      fibre: Math.round(all.reduce((s, f) => s + (f.fibre || 0), 0) * 10) / 10,
    };
  };

  const totals = getTotals();
  const meals = [
    { id: "breakfast", label: "Breakfast", icon: "🌅" },
    { id: "lunch", label: "Lunch", icon: "☀️" },
    { id: "dinner", label: "Dinner", icon: "🌙" },
    { id: "snacks", label: "Snacks", icon: "🍎" },
  ];

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>Nutrition</p>
          <Link to="/nutrition/calculator" style={{ fontSize: "12px", fontWeight: 700, color: "#9fe1cb", textDecoration: "none", backgroundColor: "rgba(255,255,255,0.12)", padding: "6px 12px", borderRadius: "20px" }}>
            My Targets →
          </Link>
        </div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>
          {new Date().toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" })}
        </h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
          {nutritionTargets ? `${nutritionTargets.calories} kcal target` : "Set up your nutrition targets"}
        </p>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      {/* NO TARGETS YET */}
      {!nutritionTargets && (
        <div style={{ margin: "0 16px 16px", backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "20px", textAlign: "center" }}>
          <p style={{ fontSize: "32px", margin: "0 0 10px" }}>🥗</p>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Calculate your nutrition targets</h2>
          <p style={{ fontSize: "14px", color: "#888", margin: "0 0 16px", lineHeight: 1.6 }}>
            Get personalised calorie and macro targets based on your body, goals and lifestyle.
          </p>
          <Link to="/nutrition/calculator" style={{ display: "block", backgroundColor: "#2d6a4f", color: "#fff", borderRadius: "12px", padding: "13px", fontSize: "14px", fontWeight: 700, textDecoration: "none" }}>
            Calculate My Targets →
          </Link>
        </div>
      )}

      {/* MACRO RINGS */}
      {nutritionTargets && (
        <div style={{ margin: "0 16px 16px" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 2px" }}>Calories Today</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                  <span style={{ fontSize: "32px", fontWeight: 700, color: "#2d6a4f", lineHeight: 1 }}>{totals.calories}</span>
                  <span style={{ fontSize: "14px", color: "#aaa" }}>/ {nutritionTargets.calories} kcal</span>
                </div>
                <p style={{ fontSize: "12px", color: "#888", margin: "4px 0 0" }}>
                  {Math.max(0, nutritionTargets.calories - totals.calories)} kcal remaining
                </p>
              </div>
              <MacroRing value={totals.calories} target={nutritionTargets.calories} color="#2d6a4f" label="Total" unit="kcal" size={90} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-around", paddingTop: "12px", borderTop: "0.5px solid #f0f0f0" }}>
              <MacroRing value={totals.protein} target={nutritionTargets.protein} color="#3b82f6" label="Protein" size={68} />
              <MacroRing value={totals.carbs} target={nutritionTargets.carbs} color="#f59e0b" label="Carbs" size={68} />
              <MacroRing value={totals.fat} target={nutritionTargets.fat} color="#ef4444" label="Fat" size={68} />
              <MacroRing value={totals.fibre} target={nutritionTargets.fibre} color="#8b5cf6" label="Fibre" size={68} />
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD BUTTONS */}
      <div style={{ padding: "0 16px 16px", display: "flex", gap: "8px" }}>
        <button onClick={() => { setShowScanner(true); setAddingTo(activeMeal || "snacks"); }} style={{ flex: 1, backgroundColor: "#1a3a2a", color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
          📷 Scan Barcode
        </button>
        <button onClick={() => { setShowSearch(true); setAddingTo(activeMeal || "snacks"); }} style={{ flex: 1, backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "12px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
          🔍 Search Food
        </button>
      </div>

      {/* MEAL SECTIONS */}
      {meals.map(meal => {
        const mealFoods = todayLog[meal.id] || [];
        const mealCals = mealFoods.reduce((s, f) => s + (f.calories || 0), 0);
        const isActive = activeMeal === meal.id;

        return (
          <div key={meal.id} style={{ margin: "0 16px 12px" }}>
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "0.5px solid #e5e5e5", overflow: "hidden" }}>
              <div onClick={() => setActiveMeal(isActive ? null : meal.id)} style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }}>{meal.icon}</span>
                  <div>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{meal.label}</p>
                    <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>
                      {mealFoods.length > 0 ? `${mealCals} kcal · ${mealFoods.length} items` : "Nothing logged yet"}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button onClick={(e) => { e.stopPropagation(); setAddingTo(meal.id); setShowSearch(true); }} style={{ backgroundColor: "#eaf5ef", color: "#2d6a4f", border: "none", borderRadius: "8px", padding: "6px 10px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                    + Add
                  </button>
                  <span style={{ fontSize: "12px", color: "#aaa" }}>{isActive ? "▾" : "▸"}</span>
                </div>
              </div>

              {isActive && (
                <div style={{ borderTop: "0.5px solid #f0f0f0" }}>
                  {mealFoods.length === 0 ? (
                    <div style={{ padding: "16px", textAlign: "center" }}>
                      <p style={{ fontSize: "13px", color: "#aaa", margin: "0 0 10px" }}>Nothing logged for {meal.label.toLowerCase()} yet</p>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                        <button onClick={() => { setAddingTo(meal.id); setShowScanner(true); }} style={{ backgroundColor: "#f0f0f0", color: "#555", border: "none", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                          📷 Scan
                        </button>
                        <button onClick={() => { setAddingTo(meal.id); setShowSearch(true); }} style={{ backgroundColor: "#eaf5ef", color: "#2d6a4f", border: "none", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                          🔍 Search
                        </button>
                      </div>
                    </div>
                  ) : (
                    mealFoods.map((food) => (
                      <div key={food.id} style={{ padding: "10px 16px", borderBottom: "0.5px solid #f5f5f5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: "13px", fontWeight: 600, color: "#111", margin: 0 }}>{food.name}</p>
                          <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                            <span style={{ fontSize: "11px", color: "#2d6a4f", fontWeight: 700 }}>{food.calories} kcal</span>
                            <span style={{ fontSize: "11px", color: "#888" }}>P:{food.protein}g</span>
                            <span style={{ fontSize: "11px", color: "#888" }}>C:{food.carbs}g</span>
                            <span style={{ fontSize: "11px", color: "#888" }}>F:{food.fat}g</span>
                          </div>
                          {food.amount && <p style={{ fontSize: "10px", color: "#aaa", margin: "2px 0 0" }}>{food.amount}</p>}
                        </div>
                        <button onClick={() => removeFoodFromMeal(meal.id, food.id)} style={{ background: "none", border: "none", color: "#dc2626", fontSize: "16px", cursor: "pointer", padding: "4px 8px" }}>✕</button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* DAILY SUMMARY */}
      {nutritionTargets && Object.values(todayLog).flat().length > 0 && (
        <div style={{ margin: "0 16px 16px", backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "16px" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#9fe1cb", margin: "0 0 10px" }}>Daily Summary</p>
          {[
            { label: "Calories", value: totals.calories, target: nutritionTargets.calories, unit: "kcal", color: "#4ade80" },
            { label: "Protein", value: totals.protein, target: nutritionTargets.protein, unit: "g", color: "#60a5fa" },
            { label: "Carbs", value: totals.carbs, target: nutritionTargets.carbs, unit: "g", color: "#fbbf24" },
            { label: "Fat", value: totals.fat, target: nutritionTargets.fat, unit: "g", color: "#f87171" },
            { label: "Fibre", value: totals.fibre, target: nutritionTargets.fibre, unit: "g", color: "#a78bfa" },
          ].map(item => (
            <div key={item.label} style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{item.label}</span>
                <span style={{ fontSize: "12px", color: "#fff", fontWeight: 700 }}>{item.value} / {item.target}{item.unit}</span>
              </div>
              <div style={{ height: "4px", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "2px" }}>
                <div style={{ height: "4px", backgroundColor: item.color, borderRadius: "2px", width: `${Math.min((item.value / item.target) * 100, 100)}%`, transition: "width 0.4s ease" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {showScanner && (
        <BarcodeScanner
          onResult={(food) => { if (addingTo) addFoodToMeal(addingTo, food); }}
          onClose={() => { setShowScanner(false); setAddingTo(null); }}
        />
      )}

      {showSearch && (
        <FoodSearch
          onAdd={(food) => addFoodToMeal(addingTo || "snacks", food)}
          onClose={() => { setShowSearch(false); setAddingTo(null); }}
        />
      )}
    </div>
  );
}