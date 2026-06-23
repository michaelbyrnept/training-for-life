export default function ResultsOpportunity({ lowestCategory, recommendation }) {
  return (
    <div style={{ backgroundColor: "#fffbeb", borderRadius: "24px", padding: "28px", border: "0.5px solid #fcd34d" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <span style={{ fontSize: "28px" }}>🎯</span>
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#b45309", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>Biggest Opportunity</p>
          <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#78350f", margin: 0 }}>{lowestCategory.name}</h3>
        </div>
      </div>
      <p style={{ fontSize: "14px", color: "#92400e", lineHeight: 1.6, margin: 0 }}>
        {recommendation}
      </p>
    </div>
  );
}
