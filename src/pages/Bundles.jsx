import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";

const THEME = {
  dark: "#1a3a2a",
  accent: "#2d6a4f",
  light: "#9fe1cb",
  bg: "#f7f5f2",
};

export default function Bundles() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null); // bundleId currently being purchased

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { navigate("/login"); return; }
      setUser(u);
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    async function loadBundles() {
      try {
        const snap = await getDocs(
          query(collection(db, "sessionBundles"), where("isActive", "==", true), orderBy("price"))
        );
        setBundles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        // fallback: load all
        const snap = await getDocs(collection(db, "sessionBundles"));
        setBundles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } finally {
        setLoading(false);
      }
    }
    if (user) loadBundles();
  }, [user]);

  async function handleBuy(bundle) {
    setBuying(bundle.id);
    try {
      const functions = getFunctions(undefined, "us-central1");
      const createCheckoutSession = httpsCallable(functions, "createCheckoutSession");
      const origin = window.location.origin;
      const { data } = await createCheckoutSession({
        type: "bundle",
        bundleId: bundle.id,
        successUrl: `${origin}/bundles/success?bundle=${encodeURIComponent(bundle.name)}`,
        cancelUrl: `${origin}/bundles`,
      });
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setBuying(null);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: THEME.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: THEME.dark, opacity: 0.5 }}>Loading bundles...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: THEME.dark, padding: "20px 20px 28px" }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", color: THEME.light, fontSize: "14px", cursor: "pointer", padding: "0 0 16px", display: "flex", alignItems: "center", gap: "6px" }}
        >
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#fff" }}>Session Bundles</h1>
        <p style={{ margin: "6px 0 0", fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>
          Buy a block of sessions and use them whenever suits you.
        </p>
      </div>

      {/* Bundle cards */}
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: 480, margin: "0 auto" }}>
        {bundles.length === 0 && (
          <p style={{ textAlign: "center", color: THEME.dark, opacity: 0.5, padding: "40px 0" }}>
            No bundles available right now.
          </p>
        )}
        {bundles.map((bundle) => {
          const sessionCount = bundle.sessionCredits || bundle.sessions || null;
          const perSession = sessionCount && bundle.price
            ? (bundle.price / sessionCount).toFixed(0)
            : null;
          const isBuying = buying === bundle.id;
          return (
            <div
              key={bundle.id}
              style={{
                background: "#fff",
                borderRadius: "16px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                border: bundle.popular ? `2px solid ${THEME.accent}` : "2px solid transparent",
                position: "relative",
              }}
            >
              {bundle.popular && (
                <div style={{
                  position: "absolute",
                  top: -1,
                  left: 20,
                  background: THEME.accent,
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "0 0 8px 8px",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}>
                  Best Value
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: bundle.popular ? "8px" : 0 }}>
                <div>
                  <h2 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 700, color: THEME.dark }}>
                    {bundle.name}
                  </h2>
                  {bundle.description && (
                    <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#666", lineHeight: 1.4 }}>
                      {bundle.description}
                    </p>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    {sessionCount && (
                      <span style={{ fontSize: "13px", color: THEME.dark, fontWeight: 600 }}>
                        {sessionCount} session{sessionCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {perSession && (
                      <span style={{ fontSize: "12px", color: "#888" }}>
                        €{perSession}/session
                      </span>
                    )}
                    {bundle.validity && (
                      <span style={{ fontSize: "12px", color: "#888" }}>
                        Valid {bundle.validity}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "12px" }}>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: THEME.dark }}>
                    €{bundle.price}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleBuy(bundle)}
                disabled={!!buying}
                style={{
                  marginTop: "16px",
                  width: "100%",
                  padding: "14px",
                  background: isBuying ? "#ccc" : THEME.accent,
                  color: "#fff",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: isBuying ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                {isBuying ? "Redirecting..." : "Buy Now"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p style={{ textAlign: "center", fontSize: "12px", color: "#aaa", padding: "8px 16px 32px" }}>
        Secure checkout via Stripe. Sessions are added to your account immediately after payment.
      </p>
    </div>
  );
}
