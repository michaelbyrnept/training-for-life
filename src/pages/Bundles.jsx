import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

const SELF_DIRECTED_TIERS = [
  {
    id: "premium",
    name: "Premium",
    price: "€19.99",
    period: "every 4 weeks",
    priceId: "price_1Tn3fsPojX8gToKVeUfENsCZ",
    successTier: "premium",
    badge: null,
    bestFor: "Self-motivated people who want the best tools to train on their own terms.",
    features: [
      "Unlimited custom workouts and programmes",
      "Full workout history and personal bests",
      "Capability Score and progress tracking",
      "Coach-published templates",
    ],
  },
  {
    id: "premium_annual",
    name: "Premium Annual",
    price: "€149",
    period: "per year",
    priceId: "price_1Tn40bPojX8gToKVOEJmvZyI",
    successTier: "premium_annual",
    badge: "Save €111",
    bestFor: "Same as Premium monthly, billed once a year. Saves you €111.",
    features: [
      "Everything in Premium",
      "Billed once — no monthly charge",
      "Equivalent to €2.87 per week",
    ],
  },
];

const COACHING_TIERS = [
  {
    id: "online",
    name: "Online Coaching",
    price: "€149",
    period: "every 4 weeks",
    priceId: "price_1Tn3ngPojX8gToKV9Dl3G76f",
    successTier: "online",
    badge: null,
    bestFor: "People who want expert direction without going near a gym with a stranger.",
    features: [
      "Weekly Friday check-in — you report in, Michael adapts your plan",
      "Personal Sunday video from Michael: exactly what to focus on next week",
      "Fully personalised programming, updated every week",
      "Everything in Premium included",
    ],
    dark: false,
  },
  {
    id: "hybrid",
    name: "Hybrid Coaching",
    price: "€249",
    period: "every 4 weeks",
    priceId: "price_1Tn3uQPojX8gToKVImRx15ZL",
    successTier: "hybrid",
    badge: "Most Popular",
    bestFor: "South Dublin clients who want online accountability plus the option to train in person.",
    features: [
      "Everything in Online Coaching",
      "Optional monthly in-person session with Michael",
      "Faster results — in-person form checks and adjustments",
      "Priority response time",
    ],
    dark: false,
  },
  {
    id: "elite",
    name: "Elite Coaching",
    price: "€999",
    period: "every 4 weeks",
    priceId: "price_1Tn3w6PojX8gToKVtG5WeC7f",
    successTier: "elite",
    badge: "Exclusive",
    bestFor: "Professionals who want to move fast and have zero guesswork left in their training.",
    features: [
      "Daily check-ins — Michael is available every day",
      "Unlimited in-person sessions",
      "Michael manages everything — programming, nutrition, recovery",
      "Same-day response, always",
      "Priority booking and direct phone access",
    ],
    dark: true,
  },
];

function cleanText(str) {
  if (!str) return str;
  return str.replace(/\s*—\s*/g, ", ").replace(/\s*–\s*/g, ", ");
}

function BundleCard({ bundle, buying, onBuy }) {
  const sessionCount = bundle.sessionCredits || bundle.sessions || null;
  const perSession = sessionCount && bundle.price
    ? (bundle.price / sessionCount).toFixed(0)
    : null;
  const isBuying = buying === bundle.id;
  const isStarter = sessionCount === 6;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: bundle.popular
          ? "0 4px 16px rgba(45,106,79,0.18)"
          : "0 2px 8px rgba(0,0,0,0.06)",
        border: bundle.popular ? `2px solid ${THEME.accent}` : "2px solid #f0ede9",
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
          fontSize: "13px",
          fontWeight: 700,
          padding: "3px 10px",
          borderRadius: "0 0 8px 8px",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
        }}>
          Best Value
        </div>
      )}
      {isStarter && !bundle.popular && (
        <div style={{
          position: "absolute",
          top: -1,
          left: 20,
          background: "#e8f5ee",
          color: THEME.accent,
          fontSize: "13px",
          fontWeight: 700,
          padding: "3px 10px",
          borderRadius: "0 0 8px 8px",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          border: `1px solid ${THEME.light}`,
          borderTop: "none",
        }}>
          Great Starting Point
        </div>
      )}

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginTop: (bundle.popular || isStarter) ? "10px" : 0,
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: "17px", fontWeight: 700, color: THEME.dark }}>
            {cleanText(bundle.name)}
          </h3>
          {bundle.description && (
            <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#666", lineHeight: 1.45 }}>
              {cleanText(bundle.description)}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {sessionCount && (
              <span style={{
                fontSize: "12px",
                color: THEME.accent,
                fontWeight: 700,
                background: "#eaf5ef",
                padding: "3px 8px",
                borderRadius: "6px",
              }}>
                {sessionCount} session{sessionCount !== 1 ? "s" : ""}
              </span>
            )}
            {perSession && (
              <span style={{ fontSize: "12px", color: "#999" }}>
                €{perSession} per session
              </span>
            )}
            {bundle.validity && (
              <span style={{ fontSize: "12px", color: "#999" }}>
                Valid {bundle.validity}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "16px" }}>
          <div style={{ fontSize: "28px", fontWeight: 800, color: THEME.dark, lineHeight: 1 }}>
            €{bundle.price}
          </div>
        </div>
      </div>

      <button
        onClick={() => onBuy(bundle)}
        disabled={!!buying}
        style={{
          marginTop: "16px",
          width: "100%",
          padding: "14px",
          background: isBuying ? "#ccc" : bundle.popular ? THEME.dark : THEME.accent,
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
}

export default function Bundles() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [buyingSub, setBuyingSub] = useState(null);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") === "inperson" ? "inperson" : "memberships");

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
        const snap = await getDocs(collection(db, "sessionBundles"));
        setBundles(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((b) => b.isActive !== false)
            .sort((a, b) => (a.price || 0) - (b.price || 0))
        );
      } finally {
        setLoading(false);
      }
    }
    if (user) loadBundles();
  }, [user]);

  async function handleBuySub(tier) {
    setBuyingSub(tier.id);
    try {
      const functions = getFunctions(undefined, "us-central1");
      const createCheckoutSession = httpsCallable(functions, "createCheckoutSession");
      const origin = window.location.origin;
      const { data } = await createCheckoutSession({
        type: "subscription",
        priceId: tier.priceId,
        successUrl: `${origin}/subscription/success?tier=${tier.successTier}`,
        cancelUrl: `${origin}/bundles`,
      });
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setBuyingSub(null);
    }
  }

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
        <p style={{ color: THEME.dark, opacity: 0.5 }}>Loading...</p>
      </div>
    );
  }

  // 6-session bundle is the recommended starter; everything else goes in the main list
  const starterBundles = bundles.filter((b) => {
    const count = b.sessionCredits || b.sessions || 0;
    return count === 6;
  });
  const packBundles = bundles.filter((b) => {
    const count = b.sessionCredits || b.sessions || 0;
    return count !== 6;
  });

  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: THEME.dark, padding: "20px 20px 0" }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", color: THEME.light, fontSize: "14px", cursor: "pointer", padding: "0 0 16px", display: "flex", alignItems: "center", gap: "6px" }}
        >
          ← Back
        </button>
        <h1 style={{ margin: "0 0 4px", fontSize: "26px", fontWeight: 800, color: "#fff" }}>
          Work with Michael
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>
          Choose how you want to train.
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "12px", padding: "4px" }}>
          {[
            { key: "memberships", label: "Memberships" },
            { key: "inperson", label: "In-Person Sessions" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: "10px",
                background: activeTab === tab.key ? "#fff" : "transparent",
                color: activeTab === tab.key ? THEME.dark : "rgba(255,255,255,0.6)",
                border: "none",
                borderRadius: "9px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ height: 20 }} />
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 40px" }}>

        {/* MEMBERSHIPS TAB */}
        {activeTab === "memberships" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* Self-directed section */}
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa", margin: "0 0 4px" }}>Train independently</p>
              <p style={{ fontSize: "13px", color: "#888", margin: "0 0 14px" }}>All the tools. You make the decisions.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {SELF_DIRECTED_TIERS.map((tier) => {
                  const isLoading = buyingSub === tier.id;
                  return (
                    <div key={tier.id} style={{ background: "#fff", borderRadius: "16px", padding: "18px", border: "1.5px solid #e5e5e5", position: "relative" }}>
                      {tier.badge && (
                        <span style={{ position: "absolute", top: 14, right: 14, background: "#eaf5ef", color: THEME.accent, fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "20px" }}>
                          {tier.badge}
                        </span>
                      )}
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "6px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: THEME.dark }}>{tier.name}</h3>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "12px" }}>
                          <span style={{ fontSize: "22px", fontWeight: 800, color: THEME.dark }}>{tier.price}</span>
                          <span style={{ fontSize: "11px", color: "#aaa", marginLeft: "4px" }}>{tier.period}</span>
                        </div>
                      </div>
                      <p style={{ fontSize: "12px", color: "#888", margin: "0 0 12px", lineHeight: 1.5 }}>{tier.bestFor}</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
                        {tier.features.map((f) => (
                          <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginTop: 2, flexShrink: 0 }}>
                              <circle cx="7" cy="7" r="7" fill="#eaf5ef"/>
                              <path d="M4 7l2 2 4-4" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span style={{ fontSize: "13px", color: "#444" }}>{f}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => handleBuySub(tier)}
                        disabled={!!buyingSub}
                        style={{ width: "100%", padding: "12px", background: isLoading ? "#ccc" : THEME.accent, color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: isLoading ? "not-allowed" : "pointer" }}
                      >
                        {isLoading ? "Redirecting..." : "Get started"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Coached by Michael section */}
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa", margin: "0 0 4px" }}>Coached by Michael</p>
              <p style={{ fontSize: "13px", color: "#888", margin: "0 0 14px" }}>Michael does the thinking. You just show up and do the work.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {COACHING_TIERS.map((tier) => {
                  const isLoading = buyingSub === tier.id;
                  const isElite = tier.dark;
                  return (
                    <div
                      key={tier.id}
                      style={{
                        background: isElite ? "#111" : "#fff",
                        borderRadius: "16px",
                        padding: "20px",
                        border: isElite ? "none" : tier.badge === "Most Popular" ? `2px solid ${THEME.accent}` : "1.5px solid #e5e5e5",
                        position: "relative",
                        boxShadow: isElite ? "0 8px 32px rgba(0,0,0,0.25)" : tier.badge === "Most Popular" ? "0 4px 16px rgba(45,106,79,0.15)" : "none",
                      }}
                    >
                      {tier.badge && (
                        <div style={{
                          position: "absolute",
                          top: -1,
                          left: 20,
                          background: isElite ? "#c9a84c" : THEME.accent,
                          color: "#fff",
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: "0 0 8px 8px",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}>
                          {tier.badge}
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: tier.badge ? "10px" : 0, marginBottom: "6px" }}>
                        <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: isElite ? "#fff" : THEME.dark }}>{tier.name}</h3>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "12px" }}>
                          <span style={{ fontSize: "24px", fontWeight: 800, color: isElite ? "#fff" : THEME.dark }}>{tier.price}</span>
                          <span style={{ fontSize: "11px", color: isElite ? "rgba(255,255,255,0.4)" : "#aaa", marginLeft: "4px" }}>{tier.period}</span>
                        </div>
                      </div>
                      <p style={{ fontSize: "12px", color: isElite ? "rgba(255,255,255,0.55)" : "#888", margin: "0 0 14px", lineHeight: 1.5 }}>{tier.bestFor}</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                        {tier.features.map((f) => (
                          <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginTop: 2, flexShrink: 0 }}>
                              <circle cx="7" cy="7" r="7" fill={isElite ? "rgba(201,168,76,0.2)" : "#eaf5ef"}/>
                              <path d="M4 7l2 2 4-4" stroke={isElite ? "#c9a84c" : "#2d6a4f"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span style={{ fontSize: "13px", color: isElite ? "rgba(255,255,255,0.8)" : "#444" }}>{f}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => handleBuySub(tier)}
                        disabled={!!buyingSub}
                        style={{
                          width: "100%",
                          padding: "14px",
                          background: isLoading ? "#666" : isElite ? "#c9a84c" : tier.badge === "Most Popular" ? THEME.dark : THEME.accent,
                          color: isElite ? "#111" : "#fff",
                          border: "none",
                          borderRadius: "10px",
                          fontSize: "15px",
                          fontWeight: 700,
                          cursor: isLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        {isLoading ? "Redirecting..." : isElite ? "Apply for Elite" : "Get started"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* IN-PERSON TAB */}
        {activeTab === "inperson" && (
          <>
            {bundles.length === 0 && (
              <p style={{ textAlign: "center", color: THEME.dark, opacity: 0.5, padding: "40px 0" }}>
                No bundles available right now.
              </p>
            )}

            {starterBundles.length > 0 && (
              <>
                <div style={{ marginBottom: "14px" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: THEME.accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>Get Started</p>
                  <h2 style={{ margin: "2px 0 0", fontSize: "18px", fontWeight: 700, color: THEME.dark }}>Starter Bundle</h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
                  {starterBundles.map((bundle) => (
                    <BundleCard key={bundle.id} bundle={bundle} buying={buying} onBuy={handleBuy} />
                  ))}
                </div>
              </>
            )}

            {packBundles.length > 0 && (
              <>
                <div style={{ marginBottom: "14px" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: THEME.accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>All Options</p>
                  <h2 style={{ margin: "2px 0 0", fontSize: "18px", fontWeight: 700, color: THEME.dark }}>All Bundles</h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {packBundles.map((bundle) => (
                    <BundleCard key={bundle.id} bundle={bundle} buying={buying} onBuy={handleBuy} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <p style={{ textAlign: "center", fontSize: "12px", color: "#aaa", marginTop: "32px" }}>
          Secure checkout via Stripe.
        </p>
      </div>
    </div>
  );
}
