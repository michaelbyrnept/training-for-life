import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

/**
 * StravaCallback
 * Strava redirects here after OAuth approval: /strava/callback?code=xxx&scope=xxx
 * Exchanges the code via Cloud Function and redirects to /integrations.
 */
export default function StravaCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("connecting"); // connecting | success | error
  const [error, setError] = useState(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    if (errorParam === "access_denied") {
      navigate("/integrations?strava=denied");
      return;
    }

    if (!code) {
      navigate("/integrations?strava=error");
      return;
    }

    const exchange = async () => {
      try {
        const fn = httpsCallable(functions, "stravaExchangeToken");
        await fn({ code });
        setStatus("success");
        setTimeout(() => navigate("/integrations?strava=connected"), 1200);
      } catch (err) {
        console.error("Strava exchange error:", err);
        setError(err.message || "Something went wrong.");
        setStatus("error");
      }
    };

    exchange();
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#0f0f0f",
      color: "#fff",
      fontFamily: "sans-serif",
      gap: "1rem",
    }}>
      {status === "connecting" && (
        <>
          <div style={{ fontSize: "2rem" }}>🔗</div>
          <p style={{ color: "#aaa" }}>Connecting your Strava account...</p>
        </>
      )}
      {status === "success" && (
        <>
          <div style={{ fontSize: "2rem" }}>✅</div>
          <p>Strava connected! Redirecting...</p>
        </>
      )}
      {status === "error" && (
        <>
          <div style={{ fontSize: "2rem" }}>❌</div>
          <p style={{ color: "#f87171" }}>Failed to connect Strava.</p>
          {error && <p style={{ color: "#aaa", fontSize: "0.875rem" }}>{error}</p>}
          <button
            onClick={() => navigate("/integrations")}
            style={{
              marginTop: "1rem",
              padding: "0.625rem 1.5rem",
              background: "#FC4C02",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Back to Integrations
          </button>
        </>
      )}
    </div>
  );
}
