import { useState } from "react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { auth, db } from "../firebase";

const BREVO_API_KEY = import.meta.env.VITE_BREVO_API_KEY;
const BREVO_LIST_ID = Number(import.meta.env.VITE_BREVO_LIST_ID);

async function subscribeToBrevo(firstName, email) {
  try {
    await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        email,
        attributes: { FIRSTNAME: firstName },
        listIds: [BREVO_LIST_ID],
        updateEnabled: true,
      }),
    });
  } catch (e) {
    console.error("Brevo subscription error:", e);
  }
}

export default function Register() {
const [searchParams] = useSearchParams();
const [firstName, setFirstName] = useState(searchParams.get("first_name") || "");
const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleRegister = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const parts = (user.displayName || "").split(" ");
        const first = parts[0] || "";
        await setDoc(userRef, {
          firstName: first,
          email: user.email.toLowerCase(),
          subscription: "free",
          marketingConsent: false,
          createdAt: new Date().toISOString(),
        });
        navigate("/onboarding");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError("Google sign-in failed. Please try again.");
      }
    }
    setGoogleLoading(false);
  };

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
        marketingConsent,
        createdAt: new Date().toISOString(),
      });

      // Only subscribe to Brevo if they opted in
      if (marketingConsent) {
        await subscribeToBrevo(firstName, email.toLowerCase());
      }

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
      <div style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)", padding: "28px 24px 52px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 10px", textAlign: "center" }}>
          Training for Life
        </p>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.2, textAlign: "center" }}>
          Build a body that keeps<br />working for decades.
        </h1>
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px", flexWrap: "wrap" }}>
          {["Free 3-Day Programme", "Capability Score", "No credit card"].map(tag => (
            <span key={tag} style={{ background: "rgba(255,255,255,0.12)", color: "#9fe1cb", fontSize: "11px", fontWeight: 600, borderRadius: "20px", padding: "4px 10px", border: "1px solid rgba(159,225,203,0.25)" }}>
              {tag}
            </span>
          ))}
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
            onClick={handleGoogleRegister}
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

          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e5e5" }} />
            <span style={{ fontSize: "12px", color: "#aaa", fontWeight: 600 }}>or sign up with email</span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e5e5" }} />
          </div>

          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>First Name</label>
              <input
                type="text"
                placeholder="e.g. Michael"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                style={{ width: "100%", padding: "13px 14px", borderRadius: "10px", border: "1px solid #e5e5e5", fontSize: "15px", color: "#111", backgroundColor: "#fafafa", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Email Address</label>
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
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#555", display: "block", marginBottom: "6px" }}>Password</label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: "100%", padding: "13px 14px", borderRadius: "10px", border: "1px solid #e5e5e5", fontSize: "15px", color: "#111", backgroundColor: "#fafafa", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Marketing consent */}
            <div
              onClick={() => setMarketingConsent(c => !c)}
              style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px 14px", borderRadius: "10px", backgroundColor: marketingConsent ? "#eaf5ef" : "#f7f5f2", border: `1.5px solid ${marketingConsent ? "#2d6a4f" : "#e5e5e5"}`, cursor: "pointer", transition: "all 0.2s ease" }}
            >
              <div style={{ width: 20, height: 20, borderRadius: "5px", backgroundColor: marketingConsent ? "#2d6a4f" : "#fff", border: `2px solid ${marketingConsent ? "#2d6a4f" : "#ccc"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                {marketingConsent && (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M1.5 5.5l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <p style={{ fontSize: "12px", color: "#555", margin: 0, lineHeight: 1.5 }}>
                I'd like to receive training tips, programme updates and coaching advice from Michael Byrne. You can unsubscribe at any time.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: loading ? "#aaa" : "#2d6a4f", color: "#fff", border: "none", borderRadius: "12px", padding: "15px", fontSize: "15px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", marginTop: "6px", width: "100%" }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>

          </form>

          <p style={{ textAlign: "center", fontSize: "13px", color: "#888", margin: "20px 0 0" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "#2d6a4f", fontWeight: 700, textDecoration: "none" }}>Log in</Link>
          </p>

        </div>

        <p style={{ fontSize: "11px", color: "#aaa", textAlign: "center", margin: "20px 0 0", maxWidth: "320px", lineHeight: 1.6 }}>
          By creating an account you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}
