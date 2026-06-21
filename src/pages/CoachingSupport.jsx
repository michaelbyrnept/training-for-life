import { Link } from "react-router-dom";
import PortalNav from "../components/PortalNav";

const tiers = [
  {
    icon: "🏋️",
    title: "Free App",
    subtitle: "You're already using this",
    badge: "Included",
    badgeColor: "#2d6a4f",
    badgeBg: "#eaf5ef",
    features: ["Exercise library", "Structured workouts", "Basic tracking"],
    cta: null,
  },
  {
    icon: "⭐",
    title: "Premium Membership",
    subtitle: "More programmes, same app",
    badge: "€19.99/mo · Coming Soon",
    badgeColor: "#854d0e",
    badgeBg: "#fffbeb",
    features: ["All training programmes", "Habit & progress tracking", "Educational content"],
    cta: { label: "Join the waitlist", to: "/training" },
  },
  {
    icon: "💻",
    title: "Online Coaching",
    subtitle: "Anywhere, fully remote",
    badge: "From €149/mo",
    badgeColor: "#2d6a4f",
    badgeBg: "#eaf5ef",
    features: ["Everything in Premium", "Regular check-ins", "Direct access to Michael"],
   cta: { label: "Book a consultation", to: "/coaching/book" },
  },
  {
    icon: "🤝",
    title: "Hybrid Coaching",
    subtitle: "Online + optional in person",
    badge: "From €199/mo",
    badgeColor: "#2d6a4f",
    badgeBg: "#eaf5ef",
    features: ["Everything in Online Coaching", "Personalised adjustments", "Optional monthly in-person session"],
    cta: { label: "Book a consultation", to: "/coaching/book" },
  },
  {
    icon: "🏆",
    title: "In-Person Coaching",
    subtitle: "South Dublin, 1:1, 1:2 or small group",
    badge: "From €55/session",
    badgeColor: "#2d6a4f",
    badgeBg: "#eaf5ef",
    features: ["Starter Package (6 sessions)", "Fully personalised, in person", "1:1, 1:2 & small group options"],
    cta: { label: "Book a consultation", to: "/coaching/book" },
  },
];

function TierCard({ tier }) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: "16px",
        border: "0.5px solid #e5e5e5",
        padding: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "12px",
            backgroundColor: "#f7f5f2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            flexShrink: 0,
          }}
        >
          {tier.icon}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>{tier.title}</p>
          <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>{tier.subtitle}</p>
        </div>
      </div>

      <span
        style={{
          display: "inline-block",
          fontSize: "11px",
          fontWeight: 700,
          color: tier.badgeColor,
          backgroundColor: tier.badgeBg,
          padding: "4px 10px",
          borderRadius: "20px",
          marginBottom: "12px",
        }}
      >
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

      {tier.cta && (
        <Link
          to={tier.cta.to}
          style={{
            display: "block",
            textAlign: "center",
            backgroundColor: "#2d6a4f",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 700,
            padding: "10px",
            borderRadius: "10px",
            textDecoration: "none",
          }}
        >
          {tier.cta.label}
        </Link>
      )}
    </div>
  );
}

export default function CoachingSupport() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <PortalNav />

      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 36px" }}>
        <Link to="/coaching" style={{ fontSize: "13px", fontWeight: 700, color: "#9fe1cb", textDecoration: "none" }}>
          ← Coaching
        </Link>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "16px 0 16px" }}>
          Ways I Can Help
        </p>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 4px", lineHeight: 1.25 }}>
          Find the right level of support.
        </h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
          No pressure. Start free, go further whenever you're ready.
        </p>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      <div style={{ padding: "0 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {tiers.map((tier) => (
            <TierCard key={tier.title} tier={tier} />
          ))}
        </div>
      </div>
    </div>
  );
}