import { useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";

const COLORS = {
  parchment: "#FAFAF9",
  pine: "#1A3A2A",
  accent: "#2D6A4F",
  accentLight: "#EAF5EF",
  mint: "#9FE1CB",
  hairline: "#E5E5E5",
  textDark: "#111111",
  textMuted: "#555555",
  mutedOnDark: "#9FB3AC",
};

const starter = {
  eyebrow: "Get Started",
  title: "Starter Package",
  subtitle: "Around 6 Sessions",
  price: "€349",
  description:
    "Designed to get you started with in-person coaching, no ongoing commitment. A natural first step before moving into regular coaching.",
};

const tiers = [
  {
    id: "1:1",
    label: "Fully Yours",
    title: "1:1 Coaching",
    subtitle: "Private, Fully Personalised",
    people: 1,
    single: 60,
    bundle: 55,
    features: [
      "The full session is yours, no sharing",
      "Fully personalised programme",
      "Strength, mobility & conditioning",
      "Direct access to Michael",
    ],
    dark: true,
  },
  {
    id: "1:2",
    label: "Bring a Partner",
    title: "1:2 Coaching",
    subtitle: "Shared Session, Split Cost",
    people: 2,
    single: 79,
    bundle: 74,
    features: [
      "Train with a partner or friend",
      "Shared accountability",
      "Personalised within the pair",
      "Lower cost per person",
    ],
    dark: false,
  },
  {
    id: "1:3",
    label: "Best Value",
    title: "1:3 Coaching",
    subtitle: "Small Group, Lowest Per Person",
    people: 3,
    single: 99,
    bundle: 94,
    features: [
      "Small group coaching",
      "Lowest cost per person",
      "Shared energy & motivation",
      "Same hour, more people",
    ],
    dark: false,
  },
];

function PersonIcon({ stroke }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" width="12" height="12">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

function TierCard({ tier }) {
  const [billing, setBilling] = useState("single");
  const dark = tier.dark;

  const totalPrice = billing === "single" ? tier.single : tier.bundle;
  const perPerson = totalPrice / tier.people;

  const labelColor = dark ? COLORS.mint : COLORS.accent;
  const subtitleColor = dark ? COLORS.mutedOnDark : COLORS.textMuted;
  const mutedColor = dark ? COLORS.mutedOnDark : COLORS.textMuted;
  const splitColor = dark ? COLORS.mint : COLORS.accent;
  const figureBg = dark ? "rgba(255,255,255,0.12)" : COLORS.accentLight;
  const iconStroke = dark ? COLORS.mint : COLORS.accent;
  const dotColor = dark ? COLORS.mint : COLORS.accent;

  return (
    <div
      className="flex flex-col p-6 sm:p-8"
      style={{ backgroundColor: dark ? COLORS.pine : "#FFFFFF" }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: labelColor,
          margin: "0 0 16px",
        }}
      >
        {tier.label}
      </p>

      <h3
        className="text-xl sm:text-2xl"
        style={{ fontWeight: 500, color: dark ? COLORS.parchment : COLORS.textDark, margin: "0 0 4px" }}
      >
        {tier.title}
      </h3>
      <p style={{ fontSize: "13px", color: subtitleColor, margin: "0 0 20px" }}>
        {tier.subtitle}
      </p>

      <div className="flex flex-wrap" style={{ gap: "18px", marginBottom: "20px", fontSize: "13px" }}>
        {[
          { key: "single", label: "Single Session" },
          { key: "bundle", label: "10+ Sessions" },
        ].map((b) => {
          const active = billing === b.key;
          return (
            <button
              key={b.key}
              onClick={() => setBilling(b.key)}
              style={{
                background: "none",
                border: "none",
                padding: "0 0 4px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: active ? 500 : 400,
                color: active ? (dark ? COLORS.parchment : COLORS.textDark) : mutedColor,
                borderBottom: active ? `1px solid ${dark ? COLORS.mint : COLORS.accent}` : "1px solid transparent",
              }}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline" style={{ gap: "6px", marginBottom: "6px" }}>
        <span
          className="text-3xl sm:text-4xl"
          style={{ fontWeight: 500, color: dark ? COLORS.parchment : COLORS.textDark }}
        >
          €{totalPrice}
        </span>
        <span style={{ fontSize: "13px", color: mutedColor }}>per session</span>
      </div>

      {tier.people > 1 ? (
        <p style={{ fontSize: "13px", color: splitColor, margin: "0 0 20px" }}>
          That's €{perPerson.toFixed(2)} per person, split {tier.people} ways.
        </p>
      ) : (
        <div style={{ marginBottom: "20px" }} />
      )}

      <div className="flex" style={{ gap: "6px", marginBottom: "20px" }}>
        {Array.from({ length: tier.people }).map((_, i) => (
          <span
            key={i}
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              backgroundColor: figureBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PersonIcon stroke={iconStroke} />
          </span>
        ))}
      </div>

      <ul
        className="flex flex-col"
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 28px",
          gap: "10px",
          flex: 1,
          fontSize: "14px",
        }}
      >
        {tier.features.map((f) => (
          <li
            key={f}
            className="flex items-start"
            style={{ gap: "10px", color: dark ? COLORS.parchment : COLORS.textDark }}
          >
            <span
              style={{
                width: "4px",
                height: "4px",
                borderRadius: "50%",
                backgroundColor: dotColor,
                marginTop: "8px",
                flexShrink: 0,
              }}
            />
            {f}
          </li>
        ))}
      </ul>

      <Link
        to="/consultation"
        className="flex items-center justify-center"
        style={{
          backgroundColor: dark ? COLORS.parchment : COLORS.pine,
          color: dark ? COLORS.pine : COLORS.parchment,
          border: dark ? "none" : `1px solid ${COLORS.pine}`,
          borderRadius: "3px",
          padding: "14px 20px",
          fontSize: "14px",
          fontWeight: 600,
          textDecoration: "none",
          textAlign: "center",
        }}
      >
        Book a Consultation
      </Link>
    </div>
  );
}

export default function InPersonCoaching() {
  return (
    <>
    <SEO
      title="In-Person Personal Training in South Dublin | Training for Life"
      description="Private 1:1, 1:2 and small group personal training sessions in South Dublin with Michael Byrne. Starter packages from €349. Serving Rathmines, Ranelagh, Dundrum, Sandyford and surrounding areas. Book a free consultation."
      canonical="https://trainingforlife.ie/coaching/in-person"
    />
    <section className="px-6 py-16 md:py-24" style={{ backgroundColor: COLORS.parchment }}>
      <div className="mx-auto" style={{ maxWidth: "1080px" }}>
        <Link
          to="/"
          style={{ fontSize: "13px", fontWeight: 600, color: COLORS.accent, textDecoration: "none" }}
        >
          ← Back to home
        </Link>

        <p
          style={{
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: COLORS.accent,
            margin: "24px 0 16px",
          }}
        >
          Personal Training · South Dublin
        </p>
        <h1
          className="text-3xl sm:text-4xl md:text-5xl"
          style={{ fontWeight: 600, lineHeight: 1.15, maxWidth: "640px", margin: "0 0 20px", color: COLORS.textDark }}
        >
          In-Person Personal Training in South Dublin
        </h1>
        <p
          className="text-base sm:text-lg"
          style={{ lineHeight: 1.6, color: COLORS.textMuted, maxWidth: "580px", margin: "0 0 12px" }}
        >
          Private, in-person coaching from Michael Byrne in South Dublin.
          Choose from 1:1, 1:2 or small group sessions. Buy 10 or more sessions for a lower per-session rate.
        </p>
        <p
          className="text-base"
          style={{ lineHeight: 1.6, color: COLORS.textMuted, maxWidth: "580px", margin: "0 0 20px" }}
        >
          Serving clients in Rathmines, Ranelagh, Dundrum, Sandyford, Stillorgan, Ballsbridge, Donnybrook and surrounding South Dublin areas.
        </p>

        {/* AVAILABILITY NOTICE */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: "6px",
            padding: "10px 16px",
            marginBottom: "32px",
            fontSize: "13px",
            color: "#92400e",
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: "16px" }}>⚡</span>
          <span>Limited spots available. Currently accepting new clients for July.</span>
        </div>

        <div
          className="flex flex-wrap items-center justify-between p-6 sm:p-8"
          style={{
            backgroundColor: COLORS.accentLight,
            borderRadius: "4px",
            marginBottom: "40px",
            gap: "20px",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: COLORS.pine,
                margin: "0 0 6px",
              }}
            >
              {starter.eyebrow}
            </p>
            <p className="text-lg sm:text-xl" style={{ fontWeight: 600, margin: "0 0 6px", color: COLORS.textDark }}>
              {starter.title} · {starter.subtitle}
            </p>
            <p style={{ fontSize: "14px", color: COLORS.accent, margin: 0, maxWidth: "460px" }}>
              {starter.description}
            </p>
          </div>
          <div>
            <p className="text-xl sm:text-2xl" style={{ fontWeight: 600, margin: "0 0 12px", color: COLORS.textDark }}>
              From {starter.price}
            </p>
            <Link
              to="/consultation"
              className="inline-flex items-center justify-center"
              style={{
                backgroundColor: COLORS.pine,
                color: COLORS.parchment,
                borderRadius: "3px",
                padding: "12px 22px",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Book a Consultation
            </Link>
          </div>
        </div>

        <div
          className="grid sm:grid-cols-2 lg:grid-cols-3"
          style={{ gap: "1px", backgroundColor: COLORS.hairline, border: `1px solid ${COLORS.hairline}` }}
        >
          {tiers.map((tier) => (
            <TierCard key={tier.id} tier={tier} />
          ))}
        </div>

        {/* WHY IN-PERSON */}
        <div style={{ marginTop: "48px", padding: "32px", backgroundColor: COLORS.accentLight, borderRadius: "8px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 600, color: COLORS.textDark, margin: "0 0 12px" }}>
            Why choose in-person personal training?
          </h2>
          <p style={{ fontSize: "15px", lineHeight: 1.7, color: COLORS.textMuted, margin: "0 0 12px" }}>
            In-person training with Michael means every session is fully supervised, adapted to how you feel on the day, and built around your specific goals. There's no guesswork and no wasted time.
          </p>
          <p style={{ fontSize: "15px", lineHeight: 1.7, color: COLORS.textMuted, margin: 0 }}>
            Whether you're a complete beginner, returning after a break, or an experienced gym-goer looking to level up, Michael personalises every programme to your starting point, your goals, and your lifestyle.
          </p>
        </div>

        {/* ONLINE COACHING LINK */}
        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: COLORS.textMuted, marginBottom: "8px" }}>
            Not based in South Dublin?
          </p>
          <Link
            to="/coaching/support"
            style={{ fontSize: "14px", fontWeight: 600, color: COLORS.accent, textDecoration: "none" }}
          >
            Explore online coaching options for clients anywhere in Ireland →
          </Link>
        </div>

      </div>
    </section>
    </>
  );
}  