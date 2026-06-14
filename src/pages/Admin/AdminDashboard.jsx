import { Link } from "react-router-dom";

const sections = [
  {
    to: "/admin/clients",
    label: "Clients",
    description: "View and manage all client profiles.",
    icon: "👥",
    highlight: true,
  },
  {
    to: "/admin/metrics",
    label: "Metrics Builder",
    description: "Define what clients track. No coding required.",
    icon: "📊",
    highlight: true,
  },
  {
    to: "/admin/exercises",
    label: "Exercise Library",
    description: "Add, edit and manage all exercises.",
    icon: "💪",
  },
  {
    to: "/admin/workouts",
    label: "Workout Builder",
    description: "Build workouts from your exercise library.",
    icon: "🏋️",
  },
  {
    to: "/admin/programmes",
    label: "Programme Builder",
    description: "Arrange workouts into weekly programmes.",
    icon: "📋",
  },
];

export default function AdminDashboard() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", padding: "2rem 1.25rem" }}>

      <div style={{ marginBottom: "2rem" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#2d6a4f", marginBottom: "4px" }}>
          Admin Panel
        </p>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#111", margin: 0 }}>
          Training for Life
        </h1>
        <p style={{ color: "#666", marginTop: "6px", fontSize: "15px" }}>
          Manage your content and clients from here.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {sections.map((section) => (
          <Link key={section.to} to={section.to} style={{ textDecoration: "none" }}>
            <div style={{
              backgroundColor: section.highlight ? "#1a3a2a" : "#fff",
              borderRadius: "16px",
              padding: "20px",
              border: section.highlight ? "none" : "0.5px solid #e5e5e5",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: section.highlight ? "rgba(255,255,255,0.12)" : "#eaf5ef",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                flexShrink: 0,
              }}>
                {section.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: "16px", color: section.highlight ? "#fff" : "#111", margin: 0 }}>
                  {section.label}
                </p>
                <p style={{ fontSize: "13px", color: section.highlight ? "#9fe1cb" : "#888", margin: "3px 0 0" }}>
                  {section.description}
                </p>
              </div>
              <div style={{ color: section.highlight ? "#9fe1cb" : "#2d6a4f", fontSize: "18px" }}>→</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}