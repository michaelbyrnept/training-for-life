import { Link } from "react-router-dom";
import PortalNav from "../components/PortalNav";

const blocks = [
  {
    icon: "🙋",
    title: "Who it's for",
    body: "Anyone weighing up whether 1:1, online, or hybrid coaching is the right next step. There's no obligation, and it's just as useful if you're not sure where to start.",
  },
  {
    icon: "💬",
    title: "What happens on the call",
    body: "We'll talk through where you're at, what you're working toward, and whether coaching makes sense for you right now. If it doesn't, that's a completely fine outcome.",
  },
  {
    icon: "✅",
    title: "What to expect afterwards",
    body: "No follow-up pressure. If you want to move forward, I'll walk you through the options. If not, you'll keep full access to the free app either way.",
  },
];

export default function CoachingBook() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <PortalNav />

      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 36px" }}>
        <Link to="/coaching" style={{ fontSize: "13px", fontWeight: 700, color: "#9fe1cb", textDecoration: "none" }}>
          ← Coaching
        </Link>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "16px 0 16px" }}>
          Book a Consultation
        </p>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 4px", lineHeight: 1.25 }}>
          Let's have a conversation.
        </h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
          No pressure, no obligation, just a chance to talk things through.
        </p>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      <div style={{ padding: "0 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {blocks.map((b) => (
            <div
              key={b.title}
              style={{
                backgroundColor: "#fff",
                borderRadius: "16px",
                border: "0.5px solid #e5e5e5",
                padding: "16px",
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: "22px", flexShrink: 0 }}>{b.icon}</span>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>{b.title}</p>
                <p style={{ fontSize: "13px", color: "#666", lineHeight: 1.6, margin: 0 }}>{b.body}</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          to="/consultation"
          style={{
            display: "block",
            textAlign: "center",
            backgroundColor: "#2d6a4f",
            color: "#fff",
            fontSize: "15px",
            fontWeight: 700,
            padding: "16px",
            borderRadius: "12px",
            textDecoration: "none",
            marginTop: "20px",
          }}
        >
          Book a Consultation
        </Link>

        <p style={{ fontSize: "12px", color: "#aaa", textAlign: "center", margin: "12px 0 0" }}>
          Not the right time? The free app is always here.
        </p>
      </div>
    </div>
  );
}