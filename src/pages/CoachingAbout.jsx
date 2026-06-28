import { Link } from "react-router-dom";
import PortalNav from "../components/PortalNav";
import SEO from "../components/SEO";

export default function CoachingAbout() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", paddingBottom: "140px" }}>
      <SEO
        title="About Michael Byrne, Personal Trainer in Dublin | Training for Life"
        description="Michael Byrne is a personal trainer and coach based in South Dublin, Ireland. Learn about his approach to helping adults build strength, confidence and long-term physical capability."
        canonical="https://trainingforlife.ie/coaching/about"
      />
      <PortalNav />

      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "16px 20px 36px" }}>
        <Link to="/coaching" style={{ fontSize: "13px", fontWeight: 700, color: "#9fe1cb", textDecoration: "none" }}>
          ← Coaching
        </Link>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "16px 0 16px" }}>
          About Your Trainer
        </p>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 4px", lineHeight: 1.25 }}>
          Michael Byrne, Personal Trainer in South Dublin
        </h1>
      </div>

      <div style={{ height: 24, background: "#f7f5f2", borderRadius: "24px 24px 0 0", marginTop: -24 }} />

      <div style={{ padding: "0 16px" }}>
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "16px",
            border: "0.5px solid #e5e5e5",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <p style={{ fontSize: "14px", color: "#333", lineHeight: 1.7, margin: 0 }}>
            I'm Michael, a personal trainer and coach based in Ireland. I've spent my career working with people who want one thing above almost everything else: to stay capable in their own bodies, for as long as possible.
          </p>
          <p style={{ fontSize: "14px", color: "#333", lineHeight: 1.7, margin: 0 }}>
            I started Training For Life because most fitness advice is built for the wrong goal. It chases a look, a number on a scale, a short-term result. What actually matters, especially as we get older, is whether you can carry your own shopping, get up off the floor without thinking about it, and keep doing the things you love without your body holding you back.
          </p>
          <p style={{ fontSize: "14px", color: "#333", lineHeight: 1.7, margin: 0 }}>
            That's what I focus on. Not quick fixes, not fitness industry nonsense. Strength, mobility, and consistency, built up patiently, so it actually lasts.
          </p>
          <p style={{ fontSize: "14px", color: "#333", lineHeight: 1.7, margin: 0 }}>
            Whether you're just starting out, coming back after a break, or working with me directly, my approach is the same: meet you where you are, and build from there.
          </p>
        </div>

        <div style={{ marginTop: "16px", textAlign: "center" }}>
          <Link to="/coaching/philosophy" style={{ fontSize: "13px", fontWeight: 700, color: "#2d6a4f", textDecoration: "none" }}>
            See how I think about training →
          </Link>
        </div>
      </div>
    </div>
  );
}