export default function ResultsHero({ totalScore, category }) {
  const circumference = 2 * Math.PI * 54;
  const pct = totalScore / 65;
  const dashOffset = circumference - pct * circumference;

  const categoryColors = {
    Thriving: { bg: "#4ade80", text: "#1a3a2a" },
    Advancing: { bg: "#86efac", text: "#1a3a2a" },
    Building: { bg: "#fcd34d", text: "#78350f" },
    Foundation: { bg: "#fb923c", text: "#431407" },
    "At Risk": { bg: "#f87171", text: "#450a0a" },
  };
  const col = categoryColors[category] || { bg: "#4ade80", text: "#1a3a2a" };

  return (
    <div style={{ background: "linear-gradient(160deg, #0d2b1f 0%, #1a3a2a 50%, #2d6a4f 100%)", borderRadius: "24px", padding: "40px 32px", color: "#fff", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
      <div style={{ position: "absolute", bottom: -60, left: -20, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />

      <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 20px" }}>
        Capability Assessment Complete
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: "32px", marginBottom: "28px" }}>
        {/* Score ring */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8"/>
            <circle cx="64" cy="64" r="54" fill="none" stroke={col.bg} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 1.5s ease" }}/>
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "36px", fontWeight: 700, color: "#fff", lineHeight: 1 }}>{totalScore}</span>
            <span style={{ fontSize: "13px", color: "#9fe1cb", fontWeight: 600 }}>/ 65</span>
          </div>
        </div>

        <div>
          <h1 style={{ fontSize: "32px", fontWeight: 700, color: "#fff", margin: "0 0 12px", lineHeight: 1.2 }}>
            Your Capability Score
          </h1>
          <span style={{ display: "inline-block", backgroundColor: col.bg, color: col.text, fontSize: "14px", fontWeight: 700, padding: "6px 16px", borderRadius: "20px" }}>
            {category}
          </span>
        </div>
      </div>

      <div style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px 16px" }}>
        <p style={{ fontSize: "13px", color: "#9fe1cb", margin: 0, lineHeight: 1.6 }}>
          Your score reflects your current strength, mobility, energy, confidence and long-term capability. This is your starting point.
        </p>
      </div>
    </div>
  );
}
