export default function ResultsNextStep({ nextStep }) {
  return (
    <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", borderRadius: "24px", padding: "28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <span style={{ fontSize: "28px" }}>📈</span>
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#9fe1cb", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>Next Step</p>
          <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: 0 }}>Your Action Plan</h3>
        </div>
      </div>
      <p style={{ fontSize: "14px", color: "#9fe1cb", lineHeight: 1.6, margin: 0 }}>
        {nextStep}
      </p>
    </div>
  );
}
