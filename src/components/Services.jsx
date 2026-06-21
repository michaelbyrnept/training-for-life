import { Link } from "react-router-dom";

const services = [
  {
    tag: "Free to Join",
    tagColor: "#0369a1",
    title: "Free App",
    subtitle: "Start Training Today",
    price: "Free",
    priceNote: null,
    description:
      "Access the exercise library, follow structured workouts, and start tracking. The first step into Training For Life.",
    features: [
      "Exercise library",
      "Structured workouts",
      "Basic tracking",
    ],
    cta: "Get the Free App",
    ctaHref: "/register",
    external: false,
    dark: false,
  },
  {
    tag: "Self-Serve",
    tagColor: "#0369a1",
    title: "Premium Membership",
    subtitle: "Train at Your Own Pace",
    price: "€19.99",
    priceNote: "/month",
    description:
      "Full access to training programmes, habit and progress tracking, and educational content. No 1-to-1 access included.",
    features: [
      "All training programmes",
      "Habit tracking",
      "Progress tracking",
      "Educational content",
    ],
    cta: "Join Premium",
    ctaHref: "/register",
    external: false,
    dark: false,
  },
  {
    tag: "Remote",
    tagColor: "#2d6a4f",
    title: "Online Coaching",
    subtitle: "Anywhere · Fully Remote",
    price: "From €149",
    priceNote: "/month",
    description:
      "Everything in Premium, plus real accountability and direct guidance, delivered entirely online, wherever you are.",
    features: [
      "Everything in Premium",
      "Regular check-ins",
      "Video form review",
      "Direct access to Michael",
    ],
    cta: "Book a Consultation",
    ctaHref: "/consultation",
    external: false,
    dark: false,
  },
  {
    tag: "Flexible",
    tagColor: "#2d6a4f",
    title: "Hybrid Coaching",
    subtitle: "Online + Optional In Person",
    price: "From €199",
    priceNote: "/month",
    description:
      "Everything in Online Coaching, with the option to add a monthly in-person session if you're based near South Dublin.",
    features: [
      "Everything in Online Coaching",
      "Personalised adjustments",
      "Optional monthly in-person session",
      "South Dublin (in-person add-on only)",
    ],
    cta: "Book a Consultation",
    ctaHref: "/consultation",
    external: false,
    dark: false,
  },
  {
    tag: "Most Popular",
    tagColor: "#2d6a4f",
    title: "In-Person Coaching",
    subtitle: "South Dublin",
    price: "From €55",
    priceNote: "/session",
    description:
      "Private, in-person coaching, from a 6-session Starter Package through to ongoing 1:1, 1:2, or small group coaching.",
    features: [
      "Starter Package (6 sessions)",
      "1:1, 1:2 & small group options",
      "Fully personalised, in person",
      "South Dublin based",
    ],
    cta: "See In-Person Options",
    ctaHref: "/coaching/in-person",
    external: false,
    dark: true,
  },
];

export default function Services() {
  return (
   <section id="services" className="bg-stone-50 px-6 py-24">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-16 max-w-2xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">
            How We Work Together
          </p>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-zinc-900 md:text-5xl">
            Five ways to build your capability.
          </h2>
          <p className="mt-6 text-lg leading-8 text-zinc-600">
           Whether you want hands-on coaching, flexible online support, or a free way to start, there's a path that fits your life.
          </p>
        </div>

        {/* Service cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.title}
              style={{
                backgroundColor: s.dark ? "#1a3a2a" : "#fff",
                borderRadius: "24px",
                padding: "32px",
                border: s.dark ? "none" : "0.5px solid #e5e5e5",
                display: "flex",
                flexDirection: "column",
                gap: "0",
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", backgroundColor: s.dark ? "rgba(255,255,255,0.1)" : "#eaf5ef", color: s.dark ? "#9fe1cb" : s.tagColor, fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 12px", borderRadius: "20px", marginBottom: "20px", width: "fit-content" }}>
                {s.tag}
              </div>

              <h3 style={{ fontSize: "22px", fontWeight: 700, color: s.dark ? "#fff" : "#111", margin: "0 0 4px", lineHeight: 1.2 }}>
                {s.title}
              </h3>
              <p style={{ fontSize: "13px", fontWeight: 600, color: s.dark ? "#9fe1cb" : "#2d6a4f", margin: "0 0 16px" }}>
                {s.subtitle}
              </p>

              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", margin: "0 0 16px" }}>
                <span style={{ fontSize: "26px", fontWeight: 700, color: s.dark ? "#fff" : "#111" }}>
                  {s.price}
                </span>
                {s.priceNote && (
                  <span style={{ fontSize: "13px", color: s.dark ? "#c5e8d8" : "#777" }}>
                    {s.priceNote}
                  </span>
                )}
              </div>

              <p style={{ fontSize: "15px", color: s.dark ? "#c5e8d8" : "#555", lineHeight: 1.6, margin: "0 0 24px" }}>
                {s.description}
              </p>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                {s.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: s.dark ? "#c5e8d8" : "#444" }}>
                    <span style={{ width: "18px", height: "18px", borderRadius: "50%", backgroundColor: s.dark ? "rgba(255,255,255,0.1)" : "#eaf5ef", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke={s.dark ? "#9fe1cb" : "#2d6a4f"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to={s.ctaHref}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: s.dark ? "#fff" : "#2d6a4f", color: s.dark ? "#1a3a2a" : "#fff", borderRadius: "12px", padding: "14px 20px", fontSize: "14px", fontWeight: 700, textDecoration: "none", textAlign: "center" }}
              >
                {s.cta}
              </Link>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}