import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const TIER_LABELS = {
  premium: { name: "Premium", price: "€19.99 every 4 weeks", emoji: "⭐" },
  premium_annual: { name: "Premium Annual", price: "€149/year", emoji: "⭐" },
  online: { name: "Online Coaching", price: "€149 every 4 weeks", emoji: "💻" },
  hybrid: { name: "Hybrid Coaching", price: "€249 every 4 weeks", emoji: "🏋️" },
  elite: { name: "Elite Coaching", price: "€999 every 4 weeks", emoji: "🏆" },
};

export default function SubscriptionSuccess() {
  const [searchParams] = useSearchParams();
  const tier = searchParams.get("tier") || "premium";
  const tierInfo = TIER_LABELS[tier] || TIER_LABELS.premium;

  const [userData, setUserData] = useState(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      // Poll Firestore briefly to confirm the webhook has fired
      let attempts = 0;
      const check = async () => {
        const snap = await getDoc(doc(db, "users", u.uid));
        const data = snap.data() || {};
        setUserData(data);
        if (data.subscription === tier || attempts >= 8) {
          setVerified(true);
        } else {
          attempts++;
          setTimeout(check, 1500);
        }
      };
      check();
    });
    return () => unsub();
  }, [tier]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1.5rem",
      textAlign: "center",
    }}>

      <div style={{
        width: 80,
        height: 80,
        borderRadius: "50%",
        backgroundColor: "rgba(255,255,255,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "36px",
        marginBottom: "20px",
      }}>
        {tierInfo.emoji}
      </div>

      <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: "0 0 8px", lineHeight: 1.2 }}>
        You're in.
      </h1>
      <p style={{ fontSize: "16px", color: "#9fe1cb", margin: "0 0 6px", fontWeight: 600 }}>
        {tierInfo.name} is now active.
      </p>
      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", margin: "0 0 32px" }}>
        {tierInfo.price}. Cancel anytime in your profile.
      </p>

      {!verified ? (
        <div style={{
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: "14px",
          padding: "16px 20px",
          marginBottom: "24px",
          maxWidth: 320,
          width: "100%",
        }}>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: 0 }}>
            Activating your account...
          </p>
        </div>
      ) : (
        <div style={{
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: "14px",
          padding: "16px 20px",
          marginBottom: "24px",
          maxWidth: 320,
          width: "100%",
        }}>
          <p style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 700, margin: "0 0 4px" }}>
            All set
          </p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: 0 }}>
            Your {tierInfo.name} features are unlocked and ready to use.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", maxWidth: 320 }}>
        <Link
          to="/dashboard"
          style={{
            display: "block",
            backgroundColor: "#fff",
            color: "#1a3a2a",
            fontSize: "15px",
            fontWeight: 700,
            padding: "14px",
            borderRadius: "12px",
            textDecoration: "none",
          }}
        >
          Go to Dashboard
        </Link>
        {(tier === "premium" || tier === "premium_annual") && (
          <Link
            to="/my-workouts"
            style={{
              display: "block",
              backgroundColor: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              padding: "13px",
              borderRadius: "12px",
              textDecoration: "none",
            }}
          >
            Build Your First Workout
          </Link>
        )}
        {(tier === "online" || tier === "hybrid" || tier === "elite") && (
          <Link
            to="/check-in"
            style={{
              display: "block",
              backgroundColor: "rgba(255,255