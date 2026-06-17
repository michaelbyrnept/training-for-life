export default function ResultsStrength({ highestCategory }) {
  return (
    <div style={{ backgroundColor: "#eaf5ef", borderRadius: "24px", padding: "28px", border: "0.5px solid #86efac" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <span style={{ fontSize: "28px" }}>🏆</span>
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#2d6a4f", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>Strongest Area</p>
          <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#1a3a2a", margin: 0 }}>{highestCategory.name}</h3>
        </div>
      </div>
      <p style={{ fontSize: "14px", color: "#2d6a4f", lineHeight: 1.6, margin: 0 }}>
        This is one of your strongest areas right now and provides a solid foundation for your long-term health, capability and independence.
      </p>
    </div>
  );
}
