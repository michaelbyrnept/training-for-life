import { useSearchParams, Link } from "react-router-dom";

export default function BundleSuccess() {
  const [searchParams] = useSearchParams();
  const bundleName = searchParams.get("bundle") || "your session bundle";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1.5rem",
      textAlign: "center",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: "50%",
        backgroundColor: "rgba(255,255,255,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "36px",
        marginBottom: "20px",
      }}>
        🎉
      </div>

      <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
        You're all set.
      </h1>
      <p style={{ fontSize: "16px", color: "#9fe1cb", margin: "0 0 6px", fontWeight: 600 }}>
        {bundleName} is confirmed.
      </p>
      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", margin: "0 0 32px", maxWidth: 300 }}>
        Your sessions have been added to your account. Book in whenever you're ready.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", maxWidth: 320 }}>
        <Link
          to="/dashboard"
          style={{
            display: "block",
            backgroundColor: "#fff",
            color: "#1a3a2a",
            fontSize: "15px",
            fontWeight: 700,
            padding: "14px",
            borderRadius: "12px",
            textDecoration: "none",
          }}
        >
          Go to Dashboard
        </Link>
        <Link
          to="/bundles"
          style={{
            display: "block",
            backgroundColor: "rgba(255,255,255,0.15)",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
            padding: "13px",
            borderRadius: "12px",
            textDecoration: "none",
          }}
        >
          Buy More Sessions
        </Link>
      </div>
    </div>
  );
}
