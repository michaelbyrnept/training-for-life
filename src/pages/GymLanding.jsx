import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

const THEME = {
  dark: "#1a3a2a",
  accent: "#2d6a4f",
  light: "#9fe1cb",
  bg: "#f7f5f2",
};

const steps = [
  {
    number: "01",
    title: "Get your Capability Score",
    desc: "5 quick questions. Find out exactly where your body stands right now.",
  },
  {
    number: "02",
    title: "Complete 3 guided workouts",
    desc: "Short, focused sessions designed for real people with real lives.",
  },
  {
    number: "03",
    title: "See what's possible",
    desc: "Rescore and get a clear picture of what 90 days of coaching could change.",
  },
];

export default function GymLanding() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/programme/capability-programme");
      }
    });
    return () => unsub();
  }, [navigate]);

  return (
    <div
      style={{ background: THEME.bg, minHeight: "100dvh" }}
      className="flex flex-col"
    >
      {/* Header */}
      <div
        style={{ background: THEME.dark }}
        className="flex flex-col items-center justify-center px-6 py-10"
      >
        <p
          style={{ color: THEME.light, letterSpacing: "0.15em" }}
          className="text-xs font-semibold uppercase mb-3"
        >
          Training For Life
        </p>
        <h1
          className="text-3xl font-bold text-white text-center leading-snug"
        >
          3 Days That Show You<br />
          What Your Body Can Do
        </h1>
        <p
          style={{ color: "#b8d8cc" }}
          className="text-sm text-center mt-4 leading-relaxed max-w-xs"
        >
          A free program. No sales pitch. Just training that reveals where you
          are and where you could go.
        </p>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-0 px-6 pt-8 pb-4 flex-1">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-4 mb-6">
            <div className="flex flex-col items-center">
              <div
                style={{
                  background: THEME.accent,
                  color: "#fff",
                  minWidth: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {step.number}
              </div>
              {i < steps.length - 1 && (
                <div
                  style={{ width: 2, background: "#d1e7dc", flex: 1, minHeight: 28, marginTop: 4 }}
                />
              )}
            </div>
            <div className="pb-2">
              <p className="font-semibold text-base" style={{ color: THEME.dark }}>
                {step.title}
              </p>
              <p className="text-sm text-zinc-500 mt-0.5 leading-relaxed">
                {step.desc}
              </p>
            </div>
          </div>
        ))}

        {/* Social proof */}
        <div
          style={{ background: "#eaf5ef", borderLeft: `3px solid ${THEME.accent}` }}
          className="rounded-r-lg px-4 py-3 mb-6"
        >
          <p className="text-sm text-zinc-600 italic leading-relaxed">
            "I expected a generic workout. What I got was the first honest look at
            my fitness in years."
          </p>
          <p className="text-xs font-semibold mt-1" style={{ color: THEME.accent }}>
            Mark, 44, Dublin
          </p>
        </div>

        {/* Trust signals */}
        <div className="flex justify-center gap-6 mb-6">
          {["Free forever", "No credit card", "Cancel anytime"].map((t) => (
            <div key={t} className="flex flex-col items-center gap-1">
              <span className="text-lg">&#10003;</span>
              <span className="text-xs text-zinc-500 text-center">{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-10 pt-2">
        <Link
          to="/register?source=gym-floor"
          style={{ background: THEME.accent }}
          className="block w-full text-center text-white font-bold text-base py-4 rounded-xl shadow-md active:opacity-90 transition-opacity"
        >
          Start My Free 3-Day Program
        </Link>
        <p className="text-center text-sm text-zinc-500 mt-4">
          Already have an account?{" "}
          <Link
            to="/login"
            style={{ color: THEME.accent }}
            className="font-semibold underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
