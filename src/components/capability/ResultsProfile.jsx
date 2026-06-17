export default function ResultsProfile({ strengthScore, mobilityScore, energyScore, confidenceScore, consistencyScore, futureCapabilityScore }) {
  const bars = [
    { label: "Strength", value: strengthScore, max: 10, icon: "🏋️" },
    { label: "Mobility", value: mobilityScore, max: 10, icon: "🧘" },
    { label: "Energy", value: energyScore, max: 10, icon: "⚡" },
    { label: "Confidence", value: confidenceScore, max: 10, icon: "💪" },
    { label: "Consistency", value: consistencyScore, max: 10, icon: "🔥" },
    { label: "Future Capability", value: futureCapabilityScore, max: 15, icon: "🎯" },
  ];

  const getBarColor = (pct) => {
    if (pct >= 0.8) return "#4ade80";
    if (pct >= 0.6) return "#86efac";
    if (pct >= 0.4) return "#fcd34d";
    return "#fb923c";
  };

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "24px", padding: "32px", border: "0.5px solid #e5e5e5" }}>
      <p style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 6px" }}>Breakdown</p>
      <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#111", margin: "0 0 24px" }}>Your Capability Profile</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {bars.map(bar => {
          const pct = bar.value / bar.max;
          const color = getBarColor(pct);
          return (
            <div key={bar.label}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>{bar.icon}</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#111" }}>{bar.label}</span>
                </div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: color === "#4ade80" ? "#2d6a4f" : color === "#86efac" ? "#2d6a4f" : color === "#fcd34d" ? "#b45309" : "#dc2626" }}>
                  {bar.value}/{bar.max}
                </span>
              </div>
              <div style={{ height: "8px", backgroundColor: "#f0f0f0", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "8px", backgroundColor: color, borderRadius: "4px", width: `${pct * 100}%`, transition: "width 1s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
