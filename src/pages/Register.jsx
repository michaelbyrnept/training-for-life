import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { auth, db } from "../firebase";

export default function Register() {
  const [firstName, setFirstName] = useState("");
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", userCredential.user.uid), {
        firstName,
        email: email.toLowerCase(),
        subscription: "free",
        createdAt: new Date().toISOString(),
      });
      navigate("/onboarding");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else if (err.code === "auth/weak-password") {
        setError("Password must be at least 6 characters.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{
        background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)",
        padding: "48px 24px 64px",
        position: "relative",
      }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 10px" }}>
            Training for Life
          </p>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#fff", margin: "0 0 8px", lineHeight: 1.2 }}>
            Create your account
          </h1>
          <p style={{ fontSize: "14px", color: "#9fe1cb", margin: 0 }}>
            Start building capability today
          </p>
        </div>
      </div>

      {/* Form card */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px", marginTop: -24 }}>
        <div style={{
          backgroundColor: "#fff",
          borderRadius: "20px",
          padding: "28px 24px 32px",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}>

          {error && (
            <div style={{ backgroundColor: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
              <p style={{ fontSize: "13px", color: "#dc2626", margin: 0 }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>
                First Name
              </label>
              <input
                type="text"
                placeholder="e.g. Michael"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                style={{
                  width: "100%", padding: "13px 14px", borderRadius: "10px",
                  border: "1px solid #e5e5e5", fontSize: "15px", color: "#111",
                  backgroundColor: "#fafafa", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

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
                style={{
                  width: "100%", padding: "13px 14px", borderRadius: "10px",
                  border: "1px solid #e5e5e5", fontSize: "15px", color: "#111",
                  backgroundColor: "#fafafa", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>
                Password
              </label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: "100%", padding: "13px 14px", borderRadius: "10px",
                  border: "1px solid #e5e5e5", fontSize: "15px", color: "#111",
                  backgroundColor: "#fafafa", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: loading ? "#aaa" : "#2d6a4f",
                color: "#fff", border: "none", borderRadius: "12px",
                padding: "15px", fontSize: "15px", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer", marginTop: "6px",
                width: "100%",
              }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>

          </form>

          <p style={{ textAlign: "center", fontSize: "13px", color: "#888", margin: "20px 0 0" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "#2d6a4f", fontWeight: 700, textDecoration: "none" }}>
              Log in
            </Link>
          </p>

        </div>

        <p style={{ fontSize: "11px", color: "#aaa", textAlign: "center", margin: "20px 0 0", maxWidth: "320px", lineHeight: 1.6 }}>
          By creating an account you agree to our terms of service and privacy policy.
        </p>
      </div>

    </div>
  );
}