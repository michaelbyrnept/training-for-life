import { Link } from "react-router-dom";
import PortalNav from "../components/PortalNav";
import SEO from "../components/SEO";

const links = [
  {
    to: "/coaching/about",
    icon: "👋",
    title: "About Michael",
    subtitle: "Who I am and why I do this",
  },
  {
    to: "/coaching/philosophy",
    icon: "🧭",
    title: "Our Philosophy",
    subtitle: "What Training For Life stands for",
  },
  {
    to: "/coaching/support",
    icon: "🪜",
    title: "Ways I Can Help",
    subtitle: "From the free app to in-person coaching",
  },
  {
  to: "/coaching/book",
  icon: "📞",
  title: "Book a Consultation",
  subtitle: "No pressure, just a conversation",
},
];

export default function CoachingOverview() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <SEO
        title="Personal Training and Online Coaching Ireland | Training for Life"
        description="Explore personal training and online coaching options with Michael Byrne. In-person training in South Dublin and remote online coaching for clients anywhere in Ireland."
        canonical="https://trainingforlife.ie/coaching"
      />
      <PortalNav />

      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 36px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 16px" }}>
          Personal Training &amp; Online Coaching
        </p>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>
          Personal training in Dublin and online across Ireland.
        </h1>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0 }}>
          In-person, online, or hybrid — find the option that works for you.
        </p>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      <div style={{ padding: "0 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {links.map((item) => (
            <Link key={item.to} to={item.to} style={{ textDecoration: "none" }}>
              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "16px",
                  border: "0.5px solid #e5e5e5",
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "12px",
                    backgroundColor: "#eaf5ef",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "22px",
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: 0 }}>
                    {item.title}
                  </p>
                  <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0" }}>
                    {item.subtitle}
                  </p>
                </div>
                <span style={{ fontSize: "16px", color: "#ccc" }}>›</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}