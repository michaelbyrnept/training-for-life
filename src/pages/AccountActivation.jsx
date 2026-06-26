import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { auth, functions } from "../firebase";

const S = {
  page: { minHeight: "100vh", backgroundColor: "#f7f5f2", display: "flex", flexDirection: "column" },
  header: {
    background: "linear-gradient(160deg, #1a3a2a 0%, #2d6a4f 100%)",
    padding: "48px 24px 64px",
    textAlign: "center",
  },
  eyebrow: { fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 10px" },
  h1: { fontSize: 26, fontWeight: 700, color: "#fff", margin: "0 0 8px", lineHeight: 1.2 },
  subtitle: { fontSize: 14, color: "#9fe1cb", margin: 0 },
  body: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px", marginTop: -24 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: "28px 24px 32px", width: "100%", maxWidth: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" },
  label: { fontSize: 12, fontWeight: 700, color: "#555", display: "block", marginBottom: 6 },
  input: (error) => ({
    width: "100%",
    padding: "13px 14px",
    borderRadius: 10,
    border: `1px solid ${error ? "#fecaca" : "#e5e5e5"}`,
    fontSize: 15,
    color: "#111",
    backgroundColor: "#fafafa",
    outline: "none",
    boxSizing: "border-box",
  }),
  btn: (disabled) => ({
    backgroundColor: disabled ? "#aaa" : "#2d6a4f",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    width: "100%",
    marginTop: 6,
  }),
  error: { backgroundColor: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: 10, padding: "12px 14px", marginBottom: 16 },
  success: { backgroundColor: "#eaf5ef", border: "0.5px solid #b7e5cc", borderRadius: 10, padding: "12px 14px", marginBottom: 16 },
  hint: { fontSize: 12, color: "#999", margin: "4px 0 0" },
};

function StrengthBar({ password }) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= score - 1 ? colors[score - 1] : "#e5e5e5" }} />
        ))}
      </div>
      <p style={{ ...S.hint, color: colors[score - 1] || "#999" }}>{labels[score - 1] || "Enter a password"}</p>
    </div>
  );
}

export default function AccountActivation() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [tokenState, setTokenState] = useState("loading"); // loading | valid | invalid | expired | used
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // ── Validate token on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!token || token.length !== 64 || !/^[0-9a-f]+$/.test(token)) {
      setTokenState("invalid");
      return;
    }
    // We validate the token server-side only when the form is submitted.
    // For the loading state, we just do a lightweight check via a peek function.
    // Since we don't have a dedicated "peek" endpoint, we trust the URL format
    // and show the form. The server will reject bad/expired tokens on submit.
    setTokenState("valid");
  }, [token]);

  // ── Form validation ───────────────────────────────────────────────────────
  function validate() {
    const errs = {};
    if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match.";
    if (!agreedToTerms) errs.terms = "You must accept the terms to continue.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const activateFn = httpsCallable(functions, "activateAccount");
      const { data } = await activateFn({ token, password });

      // Sign in immediately using the custom token from the server
      await signInWithCustomToken(auth, data.customToken);

      navigate("/dashboard", { replace: true });
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("already been used")) {
        setTokenState("used");
      } else if (msg.includes("expired")) {
        setTokenState("expired");
      } else if (msg.includes("invalid") || msg.includes("not-found")) {
        setTokenState("invalid");
      } else {
        setError(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  function renderHeader(title, sub) {
    return (
      <div style={S.header}>
        <p style={S.eyebrow}>Training for Life</p>
        <h1 style={S.h1}>{title}</h1>
        <p style={S.subtitle}>{sub}</p>
      </div>
    );
  }

  if (tokenState === "loading") {
    return (
      <div style={S.page}>
        {renderHeader("Activating your account", "One moment...")}
        <div style={S.body}>
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
              <div style={{ width: 36, height: 36, border: "3px solid #eaf5ef", borderTop: "3px solid #2d6a4f", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tokenState === "invalid") {
    return (
      <div style={S.page}>
        {renderHeader("Link not valid", "This activation link is not recognised.")}
        <div style={S.body}>
          <div style={S.card}>
            <div style={S.error}>
              <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>
                This activation link is invalid or has already been used. If you think this is a mistake, please contact your coach.
              </p>
            </div>
            <Link to="/login" style={{ display: "block", textAlign: "center", fontSize: 14, color: "#2d6a4f", fontWeight: 700, textDecoration: "none", marginTop: 8 }}>
              Go to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (tokenState === "expired") {
    return (
      <div style={S.page}>
        {renderHeader("Link expired", "This activation link is no longer valid.")}
        <div style={S.body}>
          <div style={S.card}>
            <div style={S.error}>
              <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>
                Activation links expire after 30 days. Please contact Michael at Training for Life to receive a fresh link.
              </p>
            </div>
            <a href="mailto:michael@trainingforlife.ie" style={{ display: "block", textAlign: "center", fontSize: 14, color: "#2d6a4f", fontWeight: 700, textDecoration: "none", marginTop: 8 }}>
              Contact Michael
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (tokenState === "used") {
    return (
      <div style={S.page}>
        {renderHeader("Already activated", "Your account has already been set up.")}
        <div style={S.body}>
          <div style={S.card}>
            <div style={S.success}>
              <p style={{ fontSize: 13, color: "#166534", margin: 0 }}>
                This account is already active. Log in with your email and password.
              </p>
            </div>
            <Link to="/login" style={{ display: "block", textAlign: "center", fontSize: 14, color: "#2d6a4f", fontWeight: 700, textDecoration: "none", marginTop: 8 }}>
              Log in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {renderHeader(
        firstName ? `Welcome back${firstName ? ", " + firstName : ""}` : "Welcome back",
        "Set a password to activate your Training for Life account."
      )}

      <div style={S.body}>
        <div style={S.card}>

          {error && (
            <div style={S.error}>
              <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <div>
              <label style={S.label}>New Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: "" })); }}
                  required
                  style={{ ...S.input(fieldErrors.password), paddingRight: 48 }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 12, padding: 0 }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <StrengthBar password={password} />
              {fieldErrors.password && <p style={{ ...S.hint, color: "#dc2626" }}>{fieldErrors.password}</p>}
            </div>

            <div>
              <label style={S.label}>Confirm Password</label>
              <input
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(p => ({ ...p, confirmPassword: "" })); }}
                required
                style={S.input(fieldErrors.confirmPassword)}
                autoComplete="new-password"
              />
              {fieldErrors.confirmPassword && <p style={{ ...S.hint, color: "#dc2626" }}>{fieldErrors.confirmPassword}</p>}
            </div>

            <div
              onClick={() => { setAgreedToTerms(a => !a); setFieldErrors(p => ({ ...p, terms: "" })); }}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
                borderRadius: 10,
                backgroundColor: agreedToTerms ? "#eaf5ef" : "#f7f5f2",
                border: `1.5px solid ${fieldErrors.terms ? "#fecaca" : agreedToTerms ? "#2d6a4f" : "#e5e5e5"}`,
                cursor: "pointer",
              }}
            >
              <div style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: agreedToTerms ? "#2d6a4f" : "#fff", border: `2px solid ${agreedToTerms ? "#2d6a4f" : "#ccc"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                {agreedToTerms && (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M1.5 5.5l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <p style={{ fontSize: 12, color: "#555", margin: 0, lineHeight: 1.5 }}>
                I agree to the{" "}
                <Link to="/privacy-policy" target="_blank" style={{ color: "#2d6a4f", fontWeight: 700 }} onClick={e => e.stopPropagation()}>
                  Privacy Policy
                </Link>
                {" "}and Terms of Service.
              </p>
            </div>
            {fieldErrors.terms && <p style={{ ...S.hint, color: "#dc2626", marginTop: -8 }}>{fieldErrors.terms}</p>}

            <button type="submit" disabled={submitting} style={S.btn(submitting)}>
              {submitting ? "Activating your account..." : "Activate account"}
            </button>

          </form>

          <p style={{ textAlign: "center", fontSize: 12, color: "#aaa", margin: "20px 0 0", lineHeight: 1.6 }}>
            Already activated?{" "}
            <Link to="/login" style={{ color: "#2d6a4f", fontWeight: 700, textDecoration: "none" }}>Log in here</Link>
          </p>

        </div>

        <p style={{ fontSize: 11, color: "#aaa", textAlign: "center", margin: "16px 0 0", maxWidth: 320, lineHeight: 1.6 }}>
          This link was generated for your email address by Training for Life. If you did not expect this, you can ignore it.
        </p>
      </div>
    </div>
  );
}
