import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import PortalNav from "../components/PortalNav";
import SEO from "../components/SEO";
import { auth, db, functions } from "../firebase";

const TIERS = [
  {
    id: "free",
    icon: "🏋️",
    title: "Free App",
    subtitle: "You're already using this",
    badge: "Included",
    badgeColor: "#2d6a4f",
    badgeBg: "#eaf5ef",
    features: ["Exercise library", "Structured workouts", "Basic tracking"],
    cta: null,
    subscribeTier: null,
  },
  {
    id: "premium",
    icon: "⭐",
    title: "Premium Membership",
    subtitle: "More programmes, same app",
    badge: "€19.99/mo",
    badgeColor: "#854d0e",
    badgeBg: "#fffbeb",
    features: ["All training programmes", "Habit and progress tracking", "Meal recommendations and grocery lists", "Educational content"],
    cta: { label: "Subscribe", action: "subscribe" },
    subscribeTier: "premium",
  },
  {
    id: "online",
    icon: "💻",
    title: "Online Coaching",
    subtitle: "Anywhere, fully remote",
    badge: "€149/mo",
    badgeColor: "#2d6a4f",
    badgeBg: "#eaf5ef",
    features: ["Weekly Friday check-in", "Personal Sunday video review from Michael", "Your next week planned out", "Everything in Premium"],
    cta: { label: "Subscribe", action: "subscribe" },
    secondaryCta: { label: "Book a consultation first", to: "/coaching/book" },
    subscribeTier: "online",
  },
  {
    id: "hybrid",
    icon: "🤝",
    title: "Hybrid Coaching",
    subtitle: "Online + optional in person",
    badge: "From €199/mo",
    badgeColor: "#2d6a4f",
    badgeBg: "#eaf5ef",
    features: ["Everything in Online Coaching", "Personalised adjustments", "Optional monthly in-person session"],
    cta: { label: "Book a consultation", to: "/coaching/book" },
    subscribeTier: null,
  },
  {
    id: "in-person",
    icon: "🏆",
    title: "In-Person Coaching",
    subtitle: "South Dublin, 1:1, 1:2 or small group",
    badge: "From €55/session",
    badgeColor: "#2d6a4f",
    badgeBg: "#eaf5ef",
    features: ["Starter Package (6 sessions)", "Fully personalised, in person", "1:1, 1:2 and small group options"],
    cta: { label: "Book a consultation", to: "/coaching/book" },
    subscribeTier: null,
  },
];

function TierCard({ tier, userSub, onSubscribe, checkoutLoading }) {
  const isCurrentPlan = userSub === tier.id ||
    (tier.id === "premium" && userSub === "premium_trial");
  const isLoading = checkoutLoading === tier.subscribeTier;

  return (
    <div style={{
      backgroundColor: "#fff",
      borderRadius: "16px",
      border: isCurrentPlan ? "2px solid #2d6a4f" : "0.5px solid #e5e5e5",
      padding: "16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
        <div style={{
          width: 44, height: 44, borderRadius: "12px",
          backgroundColor: "#f7f5f2",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "20px", flexShrink: 0,
        }}>
          {tier.icon}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{tier.title}</p>
          <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>{tier.subtitle}</p>
        </div>
        {isCurrentPlan && (
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", backgroundColor: "#eaf5ef", padding: "4px 10px", borderRadius: "20px", whiteSpace: "nowrap" }}>
            Your plan
          </span>
        )}
      </div>

      <span style={{
        display: "inline-block",
        fontSize: "11px", fontWeight: 700,
        color: tier.badgeColor, backgroundColor: tier.badgeBg,
        padding: "4px 10px", borderRadius: "20px", marginBottom: "12px",
      }}>
        {tier.badge}
      </span>

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
        {tier.features.map((f) => (
          <li key={f} style={{ fontSize: "13px", color: "#555", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#2d6a4f", flexShrink: 0 }} />
            {f}
          </li>
        ))}
      </ul>

      {!isCurrentPlan && tier.cta && (
        <>
          {tier.cta.action === "subscribe" ? (
            <button
              onClick={() => onSubscribe(tier.subscribeTier)}
              disabled={!!checkoutLoading}
              style={{
                display: "block", width: "100%", textAlign: "center",
                backgroundColor: isLoading ? "#aaa" : "#2d6a4f",
                color: "#fff", fontSize: "13px", fontWeight: 700,
                padding: "10px", borderRadius: "10px",
                border: "none", cursor: checkoutLoading ? "default" : "pointer",
                marginBottom: tier.secondaryCta ? "8px" : 0,
              }}
            >
              {isLoading ? "Loading checkout..." : `${tier.cta.label} — ${tier.badge}`}
            </button>
          ) : (
            <Link
              to={tier.cta.to}
              style={{
                display: "block", textAlign: "center",
                backgroundColor: "#2d6a4f", color: "#fff",
                fontSize: "13px", fontWeight: 700,
                padding: "10px", borderRadius: "10px", textDecoration: "none",
                marginBottom: tier.secondaryCta ? "8px" : 0,
              }}
            >
              {tier.cta.label}
            </Link>
          )}

          {tier.secondaryCta && (
            <Link
              to={tier.secondaryCta.to}
              style={{
                display: "block", textAlign: "center",
                backgroundColor: "#f7f5f2", color: "#2d6a4f",
                fontSize: "12px", fontWeight: 600,
                padding: "9px", borderRadius: "10px", textDecoration: "none",
              }}
            >
              {tier.secondaryCta.label}
            </Link>
          )}
        </>
      )}
    </div>
  );
}

export default function CoachingSupport() {
  const [userData, setUserData] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) setUserData(snap.data());
    });
    return () => unsub();
  }, []);

  const handleSubscribe = async (tier) => {
    setCheckoutLoading(tier);
    setCheckoutError("");
    try {
      const fn = httpsCallable(functions, "createCheckoutSession");
      const result = await fn({ tier });
      window.location.href = result.data.url;
    } catch (err) {
      console.error(err);
      setCheckoutError("Something went wrong. Please try again.");
      setCheckoutLoading(null);
    }
  };

  const userSub = userData?.subscription || "free";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <SEO
        title="Personal Training Packages and Online Coaching Ireland | Training for Life"
        description="Compare personal training options from Training for Life. Online coaching from €149/month, hybrid coaching from €199/month, and in-person sessions in South Dublin from €55. Find the right fit."
        canonical="https://trainingforlife.ie/coaching/support"
      />
      <PortalNav />

      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 36px" }}>
        <Link to="/coaching" style={{ fontSize: "13px", fontWeight: 700, color: "#9fe1cb", textDecoration: "none" }}>
          ← Coaching
        </Link>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "16px 0 16px" }}>
          Coaching Options &amp; Pricing
        </p>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 4px", lineHeight: 1.25 }}>
          Personal training and online coaching options.
        </h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
          In-person in South Dublin or online anywhere in Ireland. Start free and go further whenever you're ready.
        </p>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      {checkoutError && (
        <div style={{ margin: "0 16px 12px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "12px 16px" }}>
          <p style={{ fontSize: "13px", color: "#dc2626", fontWeight: 600, margin: 0 }}>{checkoutError}</p>
        </div>
      )}

      <div style={{ padding: "0 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {TIERS.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              userSub={userSub}
              onSubscribe={handleSubscribe}
              checkoutLoading={checkoutLoading}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
