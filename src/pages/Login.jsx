import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState(""); // "sending" | "sent" | "error"
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      if (err.code === "auth/invalid-credential") {
        setError("Incorrect email or password. Please try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotStatus("sending");
    try {
      const res = await fetch("https://sendpasswordreset-2dksgd24ea-uc.a.run.app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (!res.ok) throw new Error("Failed");
      setForgotStatus("sent");
    } catch (err) {
      setForgotStatus("error");
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate("/dashboard");
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError("Google sign-in failed. Please try again.");
      }
    }
    setGoogleLoading(false);
  };

  if (showForgot) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "48px 24px 64px" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 10px" }}>Training for Life</p>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: "0 0 8px", lineHeight: 1.2 }}>Reset password</h1>
            <p style={{ fontSize: "14px", color: "#9fe1cb", margin: 0 }}>We'll email you a reset link</p>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px", marginTop: -24 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "28px 24px 32px", width: "100%", maxWidth: "420px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
            {forgotStatus === "sent" ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>✉️</div>
                <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", margin: "0 0 6px" }}>Check your email</p>
                <p style={{ fontSize: "13px", color: "#666", margin: "0 0 20px" }}>We sent a reset link to {forgotEmail}</p>
                <button onClick={() => { setShowForgot(false); setForgotStatus(""); }} style={{ backgroundColor: "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "13px", fontSize: "15px", fontWeight: 700, cursor: "pointer", width: "100%" }}>Back to login</button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {forgotStatus === "error" && (
                  <div style={{ backgroundColor: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: "10px", padding: "12px 14px" }}>
                    <p style={{ fontSize: "13px", color: "#dc2626", margin: 0 }}>Couldn't send reset email. Check the address and try again.</p>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Email Address</label>
                  <input type="email" placeholder="your@email.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required style={{ width: "100%", padding: "13px 14px", borderRadius: "10px", border: "1px solid #e5e5e5", fontSize: "15px", color: "#111", backgroundColor: "#fafafa", outline: "none", boxSizing: "border-box" }} />
                </div>
                <button type="submit" disabled={forgotStatus === "sending"} style={{ backgroundColor: forgotStatus === "sending" ? "#aaa" : "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: forgotStatus === "sending" ? "not-allowed" : "pointer", width: "100%" }}>
                  {forgotStatus === "sending" ? "Sending..." : "Send reset link"}
                </button>
                <button type="button" onClick={() => setShowForgot(false)} style={{ background: "none", border: "none", fontSize: "13px", color: "#888", cursor: "pointer", textAlign: "center" }}>Back to login</button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "48px 24px 64px" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 10px" }}>
            Training for Life
          </p>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: "0 0 8px", lineHeight: 1.2 }}>
            Welcome back
          </h1>
          <p style={{ fontSize: "14px", color: "#9fe1cb", margin: 0 }}>
            Log in to continue your journey
          </p>
        </div>
      </div>

      {/* Form card */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px", marginTop: -24 }}>
        <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "28px 24px 32px", width: "100%", maxWidth: "420px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>

          {error && (
            <div style={{ backgroundColor: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
              <p style={{ fontSize: "13px", color: "#dc2626", margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Google Sign-In */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", width: "100%", padding: "13px", borderRadius: "12px", border: "1.5px solid #e5e5e5", backgroundColor: "#fff", fontSize: "15px", fontWeight: 600, color: "#111", cursor: googleLoading ? "not-allowed" : "pointer", marginBottom: "16px" }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
              <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
              <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
              <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
            </svg>
            {googleLoading ? "Signing in..." : "Continue with Google"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e5e5" }} />
            <span style={{ fontSize: "12px", color: "#aaa", fontWeight: 600 }}>or</span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e5e5" }} />
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: "100%", padding: "13px 14px", borderRadius: "10px", border: "1px solid #e5e5e5", fontSize: "15px", color: "#111", backgroundColor: "#fafafa", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#555" }}>Password</label>
                <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email); }} style={{ background: "none", border: "none", fontSize: "12px", color: "#2d6a4f", fontWeight: 600, cursor: "pointer", padding: 0 }}>
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: "100%", padding: "13px 14px", borderRadius: "10px", border: "1px solid #e5e5e5", fontSize: "15px", color: "#111", backgroundColor: "#fafafa", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: loading ? "#aaa" : "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", marginTop: "6px", width: "100%" }}
            >
              {loading ? "Logging in..." : "Log In"}
            </button>

          </form>

          <p style={{ textAlign: "center", fontSize: "13px", color: "#888", margin: "20px 0 0" }}>
            Don't have an account?{" "}
            <Link to="/register" style={{ color: "#2d6a4f", fontWeight: 700, textDecoration: "none" }}>
              Create one free
            </Link>
          </p>

          <p style={{ textAlign: "center", fontSize: "13px", margin: "12px 0 0" }}>
            <Link to="/capability-score" style={{ color: "#aaa", textDecoration: "none" }}>
              Take the Capability Assessment first
            </Link>
          </p>

        </div>
      </div>

    </div>
  );
}
