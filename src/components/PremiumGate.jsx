/**
 * PremiumGate — full-screen upgrade prompt.
 *
 * Shown when a free user hits a Premium-only limit (e.g. saving a second workout).
 * The message and benefit list adapt to the reason it was triggered.
 *
 * Props:
 *   reason: "workout_limit" | "generic"
 *   onClose: () => void
 *   onUpgrade: () => void  (optional — overrides default Stripe checkout)
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useFeatures } from "../hooks/useFeatures";
import { useUserProfile } from "../hooks/useUserProfile";

const PREMIUM_MONTHLY_PRICE_ID = "price_1Tn3fsPojX8gToKVeUfENsCZ";

const REASONS = {
  workout_limit: {
    icon: "💪",
    title: "Unlock Unlimited Workouts",
    subtitle: "You've built your first custom workout. Premium lets you build as many as you need.",
    benefits: [
      "Unlimited saved workouts",
      "Build workouts around your life",
      "Full workout history, forever",
      "Personal bests tracked automatically",
      "Capability Score and progress trends",
      "Coach-published template workouts",
    ],
    cta: "Upgrade to Premium",
  },
  generic: {
    icon: "⭐",
    title: "This is a Premium Feature",
    subtitle: "Upgrade to get the full Training for Life experience.",
    benefits: [
      "Unlimited saved workouts",
      "Full workout history",
      "Personal bests tracking",
      "Capability Score",
      "Coach templates",
      "Priority support",
    ],
    cta: "Upgrade to Premium",
  },
};

export default function PremiumGate({ reason = "generic", onClose, onUpgrade }) {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const hadTrial = profile?.hadTrial === true;
  const trialExpired = hadTrial && profile?.subscriptionStatus === "expired_trial";

  // Override content for post-trial users
  const baseContent = REASONS[reason] || REASONS.generic;
  const content = trialExpired ? {
    ...baseContent,
    icon: "⭐",
    title: "Your Trial Is Up",
    subtitle: "Upgrade to Premium to keep your custom workouts, progress tracking, and everything else you've been using.",
    cta: "Upgrade to Premium",
  } : baseContent;

  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (onUpgrade) { onUpgrade(); return; }
    setLoading(true);
    try {
      const fns = getFunctions(undefined, "us-central1");
      const createCheckoutSession = httpsCallable(fns, "createCheckoutSession");
      const origin = window.location.origin;
      const { data } = await createCheckoutSession({
        type: "subscription",
        priceId: PREMIUM_MONTHLY_PRICE_ID,
        successUrl: `${origin}/subscription/success?tier=premium`,
        cancelUrl: `${origin}${window.location.pathname}`,
      });
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.55)",
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "24px 24px 0 0",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          paddingBottom: "calc(32px + env(safe-area-inset-bottom))",
        }}
      >
        {/* Drag handle */}
        <div style={{ padding: "16px 0 0", display: "flex", justifyContent: "center" }}>
          <div style={{ width: 36, height: 4, backgroundColor: "#e5e5e5", borderRadius: 2 }} />
        </div>

        {/* Hero section */}
        <div
          style={{
            background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)",
            margin: "16px 16px 0",
            borderRadius: "20px",
            padding: "28px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "20px",
              backgroundColor: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              margin: "0 auto 16px",
            }}
          >
            {content.icon}
          </div>
          <p
            style={{
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#9fe1cb",
              margin: "0 0 8px",
            }}
          >
            Premium
          </p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 10px", lineHeight: 1.2 }}>
            {content.title}
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: 0, lineHeight: 1.5 }}>
            {content.subtitle}
          </p>
        </div>

        {/* Price callout */}
        <div style={{ padding: "20px 16px 0" }}>
          <div
            style={{
              backgroundColor: "#f7f5f2",
              borderRadius: "16px",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: "0 0 2px" }}>
                Training for Life Premium
              </p>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                Cancel anytime
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: "#1a3a2a", margin: 0 }}>
                €19.99
              </p>
              <p style={{ fontSize: 11, color: "#888", margin: 0 }}>per 4 weeks</p>
            </div>
          </div>
        </div>

        {/* Benefits list */}
        <div style={{ padding: "20px 16px 0" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#aaa",
              margin: "0 0 12px",
            }}
          >
            What's included
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {content.benefits.map((benefit) => (
              <div key={benefit} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: "#eaf5ef",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p style={{ fontSize: 14, color: "#111", margin: 0, fontWeight: 500 }}>{benefit}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA buttons */}
        <div style={{ padding: "24px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={handleUpgrade}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              backgroundColor: "#2d6a4f",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading ? "Redirecting to checkout..." : `${content.cta} for €19.99/month`}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "14px",
                border: "none",
                backgroundColor: "transparent",
                color: "#888",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Maybe later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
