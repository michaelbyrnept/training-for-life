import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, getDocs, collection, query, where } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import PortalNav from "../components/PortalNav";

const USDA_API_KEY = import.meta.env.VITE_USDA_API_KEY;

// Common PT foods — show instantly before any API call
const QUICK_PICKS = [
  { product_name: "Chicken Breast (Cooked)", brands: "Whole food", nutriments: { "energy-kcal_100g": 165, proteins_100g: 31, carbohydrates_100g: 0, fat_100g: 3.6, fiber_100g: 0 } },
  { product_name: "Oats (Dry)", brands: "Whole food", nutriments: { "energy-kcal_100g": 389, proteins_100g: 17, carbohydrates_100g: 66, fat_100g: 7, fiber_100g: 10 } },
  { product_name: "Eggs (Whole)", brands: "Whole food", nutriments: { "energy-kcal_100g": 155, proteins_100g: 13, carbohydrates_100g: 1.1, fat_100g: 11, fiber_100g: 0 } },
  { product_name: "Greek Yogurt (Plain)", brands: "Whole food", nutriments: { "energy-kcal_100g": 97, proteins_100g: 9, carbohydrates_100g: 4, fat_100g: 5, fiber_100g: 0 } },
  { product_name: "Brown Rice (Cooked)", brands: "Whole food", nutriments: { "energy-kcal_100g": 123, proteins_100g: 2.7, carbohydrates_100g: 26, fat_100g: 1, fiber_100g: 1.8 } },
  { product_name: "White Rice (Cooked)", brands: "Whole food", nutriments: { "energy-kcal_100g": 130, proteins_100g: 2.7, carbohydrates_100g: 28, fat_100g: 0.3, fiber_100g: 0.4 } },
  { product_name: "Banana", brands: "Whole food", nutriments: { "energy-kcal_100g": 89, proteins_100g: 1.1, carbohydrates_100g: 23, fat_100g: 0.3, fiber_100g: 2.6 } },
  { product_name: "Salmon (Cooked)", brands: "Whole food", nutriments: { "energy-kcal_100g": 208, proteins_100g: 20, carbohydrates_100g: 0, fat_100g: 13, fiber_100g: 0 } },
  { product_name: "Sweet Potato (Cooked)", brands: "Whole food", nutriments: { "energy-kcal_100g": 86, proteins_100g: 1.6, carbohydrates_100g: 20, fat_100g: 0.1, fiber_100g: 3 } },
  { product_name: "Broccoli", brands: "Whole food", nutriments: { "energy-kcal_100g": 34, proteins_100g: 2.8, carbohydrates_100g: 7, fat_100g: 0.4, fiber_100g: 2.6 } },
  { product_name: "Cottage Cheese", brands: "Whole food", nutriments: { "energy-kcal_100g": 98, proteins_100g: 11, carbohydrates_100g: 3, fat_100g: 4, fiber_100g: 0 } },
  { product_name: "Tuna (Tinned in Water)", brands: "Whole food", nutriments: { "energy-kcal_100g": 116, proteins_100g: 26, carbohydrates_100g: 0, fat_100g: 1, fiber_100g: 0 } },
  { product_name: "Turkey Mince (Raw)", brands: "Whole food", nutriments: { "energy-kcal_100g": 150, proteins_100g: 19, carbohydrates_100g: 0, fat_100g: 8, fiber_100g: 0 } },
  { product_name: "Beef Mince 5% Fat (Cooked)", brands: "Whole food", nutriments: { "energy-kcal_100g": 175, proteins_100g: 28, carbohydrates_100g: 0, fat_100g: 7, fiber_100g: 0 } },
  { product_name: "Pasta (Cooked)", brands: "Whole food", nutriments: { "energy-kcal_100g": 158, proteins_100g: 5.8, carbohydrates_100g: 31, fat_100g: 0.9, fiber_100g: 1.8 } },
  { product_name: "Whey Protein (Powder)", brands: "Supplement", nutriments: { "energy-kcal_100g": 400, proteins_100g: 80, carbohydrates_100g: 10, fat_100g: 7, fiber_100g: 0 } },
  { product_name: "Almonds", brands: "Whole food", nutriments: { "energy-kcal_100g": 579, proteins_100g: 21, carbohydrates_100g: 22, fat_100g: 50, fiber_100g: 12.5 } },
  { product_name: "Peanut Butter", brands: "Whole food", nutriments: { "energy-kcal_100g": 588, proteins_100g: 25, carbohydrates_100g: 20, fat_100g: 50, fiber_100g: 6 } },
  { product_name: "Avocado", brands: "Whole food", nutriments: { "energy-kcal_100g": 160, proteins_100g: 2, carbohydrates_100g: 9, fat_100g: 15, fiber_100g: 6.7 } },
  { product_name: "Sourdough Bread", brands: "Whole food", nutriments: { "energy-kcal_100g": 269, proteins_100g: 9, carbohydrates_100g: 51, fat_100g: 3, fiber_100g: 2.4 } },
  { product_name: "Olive Oil", brands: "Whole food", nutriments: { "energy-kcal_100g": 884, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 100, fiber_100g: 0 } },
  { product_name: "Cheddar Cheese", brands: "Whole food", nutriments: { "energy-kcal_100g": 403, proteins_100g: 25, carbohydrates_100g: 1.3, fat_100g: 33, fiber_100g: 0 } },
  { product_name: "Milk (Full Fat)", brands: "Whole food", nutriments: { "energy-kcal_100g": 61, proteins_100g: 3.2, carbohydrates_100g: 4.8, fat_100g: 3.3, fiber_100g: 0 } },
  { product_name: "Apple", brands: "Whole food", nutriments: { "energy-kcal_100g": 52, proteins_100g: 0.3, carbohydrates_100g: 14, fat_100g: 0.2, fiber_100g: 2.4 } },
  { product_name: "Blueberries", brands: "Whole food", nutriments: { "energy-kcal_100g": 57, proteins_100g: 0.7, carbohydrates_100g: 14, fat_100g: 0.3, fiber_100g: 2.4 } },
  { product_name: "Spinach (Raw)", brands: "Whole food", nutriments: { "energy-kcal_100g": 23, proteins_100g: 2.9, carbohydrates_100g: 3.6, fat_100g: 0.4, fiber_100g: 2.2 } },
  { product_name: "Quinoa (Cooked)", brands: "Whole food", nutriments: { "energy-kcal_100g": 120, proteins_100g: 4.4, carbohydrates_100g: 22, fat_100g: 1.9, fiber_100g: 2.8 } },
];

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
  const [scannedFood, setScannedFood] = useState(null);
  const [amount, setAmount] = useState("100");
  const controlsRef = useRef(null);

  const startScan = async () => {
    setScanning(true);
    setError("");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const codeReader = new BrowserMultiFormatReader();
      const videoElement = document.getElementById("barcode-video");
      const controls = await codeReader.decodeFromVideoDevice(
        undefined,
        videoElement,
        (result, err) => {
          if (result) {
            controlsRef.current?.stop();
            setScanning(false);
            lookupBarcode(result.getText());
          }
        }
      );
      controlsRef.current = controls;
    } catch (e) {
      console.error(e);
      setError("Camera not available. Please type the barcode below.");
      setScanning(false);
    }
  };

  const stopScan = () => {
    try { controlsRef.current?.stop(); } catch (e) {}
    controlsRef.current = null;
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
        setScannedFood({
          name: p.product_name || p.product_name_en || "Unknown Product",
          brand: p.brands || "",
          calories100g: Math.round(nutriments["energy-kcal_100g"] || nutriments["energy-kcal"] || 0),
          protein100g: Math.round((nutriments.proteins_100g || 0) * 10) / 10,
          carbs100g: Math.round((nutriments.carbohydrates_100g || 0) * 10) / 10,
          fat100g: Math.round((nutriments.fat_100g || 0) * 10) / 10,
          fibre100g: Math.round((nutriments.fiber_100g || 0) * 10) / 10,
          serving: p.serving_size || "100g",
          barcode,
        });
        setAmount("100");
      } else {
        setError("Product not found. Try searching by name instead.");
      }
    } catch (e) {
      setError("Could not connect. Check your internet connection.");
    }
    setSearching(false);
  };

  const confirmLog = () => {
    if (!scannedFood) return;
    const m = parseFloat(amount) / 100;
    onResult({
      name: scannedFood.name,
      brand: scannedFood.brand,
      calories: Math.round(scannedFood.calories100g * m),
      protein: Math.round(scannedFood.protein100g * m * 10) / 10,
      carbs: Math.round(scannedFood.carbs100g * m * 10) / 10,
      fat: Math.round(scannedFood.fat100g * m * 10) / 10,
      fibre: Math.round(scannedFood.fibre100g * m * 10) / 10,
      amount: `${amount}g`,
      barcode: scannedFood.barcode,
    });
  };

  if (searching) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 48, height: 48, border: "4px solid #e5e5e5", borderTopColor: "#2d6a4f", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ fontSize: "16px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>Looking up product...</p>
      </div>
    );
  }

  if (scannedFood) {
    const m = parseFloat(amount || "100") / 100;
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
        <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
          <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{scannedFood.name}</h2>
          {scannedFood.brand && <p style={{ fontSize: "13px", color: "#888", margin: "0 0 16px" }}>{scannedFood.brand}</p>}

          <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Amount (grams)</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #2d6a4f", fontSize: "22px", fontWeight: 700, outline: "none", textAlign: "center", boxSizing: "border-box", marginBottom: "8px" }}
          />
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            {["30", "50", "100", "150", "200"].map(a => (
              <button key={a} onClick={() => setAmount(a)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: amount === a ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: amount === a ? "#eaf5ef" : "#f7f5f2", color: amount === a ? "#2d6a4f" : "#888", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
                {a}g
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", marginBottom: "20px" }}>
            {[
              { label: "Calories", value: Math.round(scannedFood.calories100g * m) },
              { label: "Protein", value: `${Math.round(scannedFood.protein100g * m * 10) / 10}g` },
              { label: "Carbs", value: `${Math.round(scannedFood.carbs100g * m * 10) / 10}g` },
              { label: "Fat", value: `${Math.round(scannedFood.fat100g * m * 10) / 10}g` },
            ].map(({ label, value }) => (
              <div key={label} style={{ backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "10px 8px", textAlign: "center" }}>
                <p style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{value}</p>
                <p style={{ fontSize: "11px", color: "#888", margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>

          <button onClick={confirmLog} style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "16px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>
            Log this
          </button>
          <button onClick={() => { setScannedFood(null); setError(""); }} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer", padding: "6px" }}>
            Scan again
          </button>
        </div>
      </div>
    );
  }

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
  const [apiResults, setApiResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("100");

  const toTitleCase = (str) => str.replace(/\b\w/g, txt => txt.toUpperCase());

  const cleanUsdaName = (desc) => {
    // "Chicken, broilers or fryers, breast..." -> "Chicken Breast"
    const parts = desc.split(",").map(s => s.trim()).filter(Boolean);
    const meaningful = parts.slice(0, 2).join(", ");
    return toTitleCase(meaningful.toLowerCase());
  };

  const search = async (term) => {
    if (!term || term.trim().length < 2) return;
    setSearching(true);
    let results = [];

    // USDA \u2014 whole foods, Foundation + SR Legacy (high quality, English only)
    try {
      const usdaRes = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(term)}&dataType=Foundation,SR%20Legacy&pageSize=8&api_key=${USDA_API_KEY}`
      );
      const usdaData = await usdaRes.json();
      const usdaFoods = (usdaData.foods || []).slice(0, 6).map(f => {
        const nutrients = f.foodNutrients || [];
        const get = (id) => Math.round((nutrients.find(n => n.nutrientId === id)?.value || 0) * 10) / 10;
        return {
          product_name: cleanUsdaName(f.description),
          brands: "Whole food",
          nutriments: {
            "energy-kcal_100g": get(1008),
            proteins_100g: get(1003),
            carbohydrates_100g: get(1005),
            fat_100g: get(1004),
            fiber_100g: get(1079),
          }
        };
      }).filter(f => f.nutriments["energy-kcal_100g"] > 0);
      results = [...results, ...usdaFoods];
    } catch (e) { /* USDA unavailable */ }

    // Open Food Facts \u2014 Ireland + UK products only, English language
    try {
      const offRes = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,nutriments&lc=en&countries_tags_en=ireland,united-kingdom`
      );
      const offData = await offRes.json();
      const offFoods = (offData.products || [])
        .filter(p =>
          p.product_name &&
          p.product_name.trim().length > 2 &&
          p.nutriments &&
          (p.nutriments["energy-kcal_100g"] || 0) > 0 &&
          /^[a-zA-Z0-9\s\-&'(),%.+*]+$/.test(p.product_name.trim())
        )
        .slice(0, 6)
        .map(p => ({
          product_name: toTitleCase(p.product_name.trim()),
          brands: p.brands ? toTitleCase(p.brands.split(",")[0].trim()) : "Branded",
          nutriments: {
            "energy-kcal_100g": Math.round(p.nutriments["energy-kcal_100g"] || p.nutriments["energy-kcal"] || 0),
            proteins_100g: Math.round((p.nutriments.proteins_100g || 0) * 10) / 10,
            carbohydrates_100g: Math.round((p.nutriments.carbohydrates_100g || 0) * 10) / 10,
            fat_100g: Math.round((p.nutriments.fat_100g || 0) * 10) / 10,
            fiber_100g: Math.round((p.nutriments.fiber_100g || p.nutriments.fibers_100g || 0) * 10) / 10,
          }
        }));
      results = [...results, ...offFoods];
    } catch (e) { /* OFT unavailable */ }

    setApiResults(results.slice(0, 12));
    setSearching(false);
  };

  useEffect(() => {
    if (query.trim().length < 2) { setApiResults([]); return; }
    const timer = setTimeout(() => search(query.trim()), 600);
    return () => clearTimeout(timer);
  }, [query]);

  const matchedQuickPicks = query.trim().length >= 1
    ? QUICK_PICKS.filter(p => p.product_name.toLowerCase().includes(query.toLowerCase()))
    : QUICK_PICKS;

  // Deduplicate: quick pick names take priority over API results
  const quickPickNames = new Set(matchedQuickPicks.map(p => p.product_name.toLowerCase()));
  const filteredApi = apiResults.filter(r => !quickPickNames.has(r.product_name.toLowerCase()));

  const displayResults = query.trim().length >= 2
    ? [...matchedQuickPicks.slice(0, 4), ...filteredApi]
    : matchedQuickPicks;

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
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111", margin: "0 0 16px" }}>Search Food</h2>

        <div style={{ position: "relative", marginBottom: "16px" }}>
          <input
            type="text"
            placeholder="e.g. chicken breast, oats, Greek yogurt..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null); }}
            style={{ width: "100%", padding: "12px 40px 12px 14px", borderRadius: "10px", border: "1.5px solid #e5e5e5", fontSize: "15px", outline: "none", boxSizing: "border-box" }}
            autoFocus
          />
          <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: "#aaa" }}>
            {searching ? "..." : "\uD83D\uDD0D"}
          </div>
        </div>

        {!selected && (
          <>
            {query.trim().length === 0 && (
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Common Foods</p>
            )}
            {query.trim().length >= 2 && matchedQuickPicks.length > 0 && (
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Common Foods</p>
            )}
            {displayResults.map((product, i) => {
              const isQuickPick = matchedQuickPicks.includes(product);
              const showApiLabel = i === matchedQuickPicks.slice(0, 4).length && filteredApi.length > 0 && query.trim().length >= 2;
              return (
                <div key={i}>
                  {showApiLabel && <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "12px 0 8px" }}>Search Results</p>}
                  <div onClick={() => setSelected(product)} style={{ padding: "12px 14px", borderRadius: "10px", border: `0.5px solid ${isQuickPick ? "#e5e5e5" : "#e5e5e5"}`, marginBottom: "8px", cursor: "pointer", backgroundColor: isQuickPick ? "#f7f5f2" : "#fff" }}>
                    <p style={{ fontWeight: 700, fontSize: "14px", color: "#111", margin: "0 0 2px" }}>{product.product_name}</p>
                    <p style={{ fontSize: "11px", color: "#888", margin: "0 0 4px" }}>{product.brands}</p>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <span style={{ fontSize: "11px", color: "#2d6a4f", fontWeight: 700 }}>{product.nutriments?.["energy-kcal_100g"] || 0} kcal</span>
                      <span style={{ fontSize: "11px", color: "#888" }}>P: {product.nutriments?.proteins_100g || 0}g</span>
                      <span style={{ fontSize: "11px", color: "#888" }}>C: {product.nutriments?.carbohydrates_100g || 0}g</span>
                      <span style={{ fontSize: "11px", color: "#888" }}>F: {product.nutriments?.fat_100g || 0}g</span>
                    </div>
                    <p style={{ fontSize: "10px", color: "#aaa", margin: "2px 0 0" }}>per 100g</p>
                  </div>
                </div>
              );
            })}
            {query.trim().length >= 2 && !searching && displayResults.length === 0 && (
              <p style={{ textAlign: "center", fontSize: "13px", color: "#aaa", padding: "20px 0" }}>No results found. Try a different term.</p>
            )}
          </>
        )}

        {selected && (
          <div>
            <div style={{ backgroundColor: "#eaf5ef", borderRadius: "12px", padding: "14px", marginBottom: "16px" }}>
              <p style={{ fontWeight: 700, fontSize: "15px", color: "#111", margin: "0 0 2px" }}>{selected.product_name}</p>
              <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>{selected.brands} \u00B7 per 100g</p>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Amount (grams)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #2d6a4f", fontSize: "22px", fontWeight: 700, outline: "none", textAlign: "center", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              {["30", "50", "100", "150", "200"].map(a => (
                <button key={a} onClick={() => setAmount(a)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: amount === a ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: amount === a ? "#eaf5ef" : "#f7f5f2", color: amount === a ? "#2d6a4f" : "#888", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
                  {a}g
                </button>
              ))}
            </div>
            {/* Preview macros for selected amount */}
            {amount && (() => {
              const n = selected.nutriments || {};
              const m = parseFloat(amount) / 100;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                  {[
                    { label: "Kcal", value: Math.round((n["energy-kcal_100g"] || 0) * m), color: "#2d6a4f" },
                    { label: "Protein", value: `${Math.round((n.proteins_100g || 0) * m * 10) / 10}g`, color: "#3b82f6" },
                    { label: "Carbs", value: `${Math.round((n.carbohydrates_100g || 0) * m * 10) / 10}g`, color: "#f59e0b" },
                    { label: "Fat", value: `${Math.round((n.fat_100g || 0) * m * 10) / 10}g`, color: "#ef4444" },
                  ].map(s => (
                    <div key={s.label} style={{ backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
                      <p style={{ fontSize: "16px", fontWeight: 700, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                      <p style={{ fontSize: "10px", color: "#aaa", margin: "3px 0 0" }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}
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
  const [recommendedMeals, setRecommendedMeals] = useState([]);
  const [mealTypeFilter, setMealTypeFilter] = useState("all");
  const [viewingMeal, setViewingMeal] = useState(null);
  const [mealAddTarget, setMealAddTarget] = useState("lunch");

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

      // Load recommended meals
      const mealsSnap = await getDocs(query(collection(db, "meals"), where("published", "==", true)));
      setRecommendedMeals(mealsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

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
          <div style={{ display: "flex", gap: "8px" }}>
            {(user?.uid === "wKbgHNtTMtS01BQ4ddfAwTQaIgA3" || (userData?.subscription && userData.subscription !== "free")) && (
              <Link to="/nutrition/grocery-list" style={{ fontSize: "12px", fontWeight: 700, color: "#9fe1cb", textDecoration: "none", backgroundColor: "rgba(255,255,255,0.12)", padding: "6px 12px", borderRadius: "20px" }}>
                🛒 Grocery List
              </Link>
            )}
            <Link to="/nutrition/calculator" style={{ fontSize: "12px", fontWeight: 700, color: "#9fe1cb", textDecoration: "none", backgroundColor: "rgba(255,255,255,0.12)", padding: "6px 12px", borderRadius: "20px" }}>
              My Targets →
            </Link>
          </div>
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

      {/* MEAL RECOMMENDATIONS */}
      {(() => {
        const isPaid = user?.uid === "wKbgHNtTMtS01BQ4ddfAwTQaIgA3" || (userData?.subscription && userData.subscription !== "free");
        if (!isPaid) {
          return (
            <div style={{ padding: "0 16px 16px" }}>
              <div style={{ backgroundColor: "#1a3a2a", borderRadius: "16px", padding: "20px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -20, right: -20, fontSize: "80px", opacity: 0.08 }}>🍽️</div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>Premium Feature</p>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>Meal Plans + Grocery Lists</h3>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: "0 0 14px", lineHeight: 1.5 }}>
                  Get coach-recommended meals built around your targets, and auto-generate your weekly shopping list.
                </p>
                <Link to="/coaching" style={{ display: "inline-block", backgroundColor: "#4ade80", color: "#1a3a2a", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 700, textDecoration: "none" }}>
                  Upgrade to unlock →
                </Link>
              </div>
            </div>
          );
        }
        return (
          <div style={{ padding: "0 16px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#111", margin: 0 }}>Meal Ideas</p>
              <Link to="/nutrition/grocery-list" style={{ fontSize: "12px", fontWeight: 700, color: "#2d6a4f", textDecoration: "none" }}>
                Grocery List →
              </Link>
            </div>
            {recommendedMeals.length === 0 ? (
              <div style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "24px 20px", textAlign: "center" }}>
                <p style={{ fontSize: "24px", margin: "0 0 8px" }}>🍽️</p>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Meal ideas coming soon</p>
                <p style={{ fontSize: "13px", color: "#888", margin: 0, lineHeight: 1.5 }}>Your coach is building your meal library. Check back soon.</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: "8px", marginBottom: "12px", overflowX: "auto", paddingBottom: "2px" }}>
                  {["all", "breakfast", "lunch", "dinner", "snack"].map(t => (
                    <button key={t} onClick={() => setMealTypeFilter(t)} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: "20px", border: "none", backgroundColor: mealTypeFilter === t ? "#1a3a2a" : "#f0f0f0", color: mealTypeFilter === t ? "#fff" : "#555", fontSize: "12px", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                      {t === "all" ? "All" : t}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {recommendedMeals
                    .filter(m => mealTypeFilter === "all" || m.type === mealTypeFilter)
                    .map(meal => {
                      const t = meal.totals || {};
                      return (
                        <div key={meal.id} onClick={() => { setViewingMeal(meal); setMealAddTarget(meal.type === "breakfast" ? "breakfast" : meal.type === "dinner" ? "dinner" : meal.type === "snack" ? "snacks" : "lunch"); }} style={{ backgroundColor: "#fff", borderRadius: "14px", border: "0.5px solid #e5e5e5", padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                              <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0 }}>{meal.name}</p>
                              <span style={{ fontSize: "10px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "2px 7px", borderRadius: "8px", textTransform: "capitalize" }}>{meal.type}</span>
                            </div>
                            <div style={{ display: "flex", gap: "10px" }}>
                              <span style={{ fontSize: "12px", fontWeight: 700, color: "#2d6a4f" }}>{t.calories || 0} kcal</span>
                              <span style={{ fontSize: "12px", color: "#3b82f6", fontWeight: 600 }}>P: {t.protein || 0}g</span>
                              <span style={{ fontSize: "12px", color: "#888" }}>C: {t.carbs || 0}g</span>
                              <span style={{ fontSize: "12px", color: "#888" }}>F: {t.fat || 0}g</span>
                            </div>
                          </div>
                          <span style={{ fontSize: "16px", color: "#2d6a4f" }}>→</span>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        );
      })()}

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

      {/* MEAL DETAIL SHEET */}
      {viewingMeal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setViewingMeal(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", padding: "20px 20px 40px", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e5e5e5", borderRadius: 2, margin: "0 auto 16px" }} />
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{viewingMeal.name}</h2>
                {viewingMeal.description && <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>{viewingMeal.description}</p>}
              </div>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "4px 10px", borderRadius: "10px", textTransform: "capitalize", flexShrink: 0 }}>{viewingMeal.type}</span>
            </div>
            {/* Totals */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
              {[
                { label: "Kcal", value: viewingMeal.totals?.calories || 0, color: "#2d6a4f" },
                { label: "Protein", value: `${viewingMeal.totals?.protein || 0}g`, color: "#3b82f6" },
                { label: "Carbs", value: `${viewingMeal.totals?.carbs || 0}g`, color: "#f59e0b" },
                { label: "Fat", value: `${viewingMeal.totals?.fat || 0}g`, color: "#ef4444" },
              ].map(s => (
                <div key={s.label} style={{ backgroundColor: "#f7f5f2", borderRadius: "10px", padding: "10px", textAlign: "center" }}>
                  <p style={{ fontSize: "18px", fontWeight: 700, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: "10px", color: "#aaa", margin: "3px 0 0" }}>{s.label}</p>
                </div>
              ))}
            </div>
            {/* Ingredients */}
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Ingredients</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
              {(viewingMeal.ingredients || []).map((ing, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", backgroundColor: "#f7f5f2", borderRadius: "10px" }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "#111", margin: 0 }}>{ing.name}</p>
                    <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>{ing.amount}g</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{ing.calories} kcal</p>
                    <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>P:{ing.protein}g</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Add to meal target picker */}
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#555", margin: "0 0 8px" }}>Add to:</p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              {[{ id: "breakfast", label: "Breakfast" }, { id: "lunch", label: "Lunch" }, { id: "dinner", label: "Dinner" }, { id: "snacks", label: "Snacks" }].map(m => (
                <button key={m.id} onClick={() => setMealAddTarget(m.id)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: mealAddTarget === m.id ? "2px solid #2d6a4f" : "1px solid #e5e5e5", backgroundColor: mealAddTarget === m.id ? "#eaf5ef" : "#f7f5f2", color: mealAddTarget === m.id ? "#2d6a4f" : "#888", fontWeight: 700, fontSize: "11px", cursor: "pointer" }}>
                  {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                (viewingMeal.ingredients || []).forEach(ing => {
                  addFoodToMeal(mealAddTarget, {
                    name: ing.name,
                    calories: ing.calories,
                    protein: ing.protein,
                    carbs: ing.carbs,
                    fat: ing.fat,
                    fibre: ing.fibre || 0,
                    amount: `${ing.amount}g`,
                    id: Date.now() + Math.random(),
                  });
                });
                setViewingMeal(null);
              }}
              style={{ width: "100%", backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "8px" }}
            >
              Add All to {mealAddTarget.charAt(0).toUpperCase() + mealAddTarget.slice(1)}
            </button>
            <button onClick={() => setViewingMeal(null)} style={{ width: "100%", background: "none", border: "none", fontSize: "13px", color: "#aaa", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
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