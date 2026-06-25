import { useState } from "react";
import { Link } from "react-router-dom";
import PortalNav from "../components/PortalNav";
import SEO from "../components/SEO";

const principles = [
  {
    icon: "🌱",
    title: "Fitness should improve your life, not consume it.",
    body: "Training fits around your life, not the other way round. No two-hour gym sessions, no rigid plans you can't sustain. Just enough, consistently, to make everything else easier.",
  },
  {
    icon: "🔁",
    title: "Consistency beats perfection.",
    body: "A missed session isn't a failure. Showing up most weeks, for years, will always beat a flawless month followed by burnout. We're playing a long game here.",
  },
  {
    icon: "💪",
    title: "Strength matters at every age.",
    body: "Strength isn't about lifting heavy for its own sake. It's what lets you carry your shopping, get up off the floor, and keep doing the things you love, at 35 or at 75.",
  },
  {
    icon: "🧍",
    title: "Independence and capability come first.",
    body: "The goal isn't a number on a scale or a look in the mirror. It's staying capable in your own body, for as long as possible.",
  },
  {
    icon: "🪴",
    title: "Sustainable habits, not short-term fixes.",
    body: "Anyone can push hard for six weeks. The real work is building something that still holds up a year, five years, twenty years from now.",
  },
];

function PrincipleCard({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(!open)}
      style={{
        backgroundColor: "#fff",
        borderRadius: "16px",
        border: "0.5px solid #e5e5e5",
        padding: "16px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "22px", flexShrink: 0 }}>{item.icon}</span>
        <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0, flex: 1, lineHeight: 1.4 }}>
          {item.title}
        </p>
        <span style={{ fontSize: "14px", color: "#ccc", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s ease" }}>
          ›
        </span>
      </div>
      {open && (
        <p style={{ fontSize: "13px", color: "#666", lineHeight: 1.6, margin: "12px 0 0", paddingLeft: "34px" }}>
          {item.body}
        </p>
      )}
    </div>
  );
}

export default function CoachingPhilosophy() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <SEO
        title="Our Personal Training Philosophy | Training for Life Dublin"
        description="Discover the Training for Life approach to personal training. Sustainable strength, mobility and consistency over extreme short-term goals. Based in South Dublin, coaching clients across Ireland."
        canonical="https://trainingforlife.ie/coaching/philosophy"
      />
      <PortalNav />

      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 36px" }}>
        <Link to="/coaching" style={{ fontSize: "13px", fontWeight: 700, color: "#9fe1cb", textDecoration: "none" }}>
          ← Coaching
        </Link>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "16px 0 16px" }}>
          Our Approach to Training
        </p>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 4px", lineHeight: 1.25 }}>
          Sustainable personal training that actually lasts.
        </h1>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      <div style={{ padding: "0 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {principles.map((item) => (
            <PrincipleCard key={item.title} item={item} />
          ))}
        </div>

        <div style={{ marginTop: "16px", textAlign: "center" }}>
          <Link to="/coaching/support" style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f", textDecoration: "none" }}>
            See ways I can help →
          </Link>
        </div>
      </div>
    </div>
  );
}