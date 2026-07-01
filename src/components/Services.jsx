import { Link } from "react-router-dom";

const services = [
  {
    tag: "Most Personal",
    tagColor: "#2d6a4f",
    title: "Elite Coaching",
    subtitle: "Unlimited Access · South Dublin or Remote",
    price: "€999",
    priceNote: "/4 weeks",
    bestFor: "Professionals who want to move fast with zero guesswork.",
    description:
      "Michael manages everything — programming, nutrition strategy, recovery. Daily check-ins, unlimited sessions, same-day responses. This is the full-service option.",
    features: [
      "Daily check-ins, Michael responds same day",
      "Unlimited in-person or remote sessions",
      "Fully managed programming and nutrition strategy",
      "Direct phone access",
    ],
    cta: "Apply for Elite",
    ctaHref: "/consultation",
    external: false,
    dark: true,
  },
  {
    tag: "Most Popular",
    tagColor: "#2d6a4f",
    title: "Hybrid Coaching",
    subtitle: "Online + In-Person · South Dublin",
    price: "From €249",
    priceNote: "/4 weeks",
    bestFor: "South Dublin clients who want online accountability and the option to train in person.",
    description:
      "Everything in Online Coaching, plus in-person sessions when you want them. The closest thing to a dedicated personal trainer, at a fraction of the cost.",
    features: [
      "Weekly check-in and personal Sunday video from Michael",
      "Optional in-person sessions each month",
      "In-person form checks and faster adjustments",
      "Priority response time",
    ],
    cta: "Book a Consultation",
    ctaHref: "/consultation",
    external: false,
    dark: false,
  },
  {
    tag: "Remote",
    tagColor: "#2d6a4f",
    title: "Online Coaching",
    subtitle: "Anywhere · Fully Remote",
    price: "From €149",
    priceNote: "/4 weeks",
    bestFor: "People who want expert direction and never want to guess what to do next.",
    description:
      "Every Friday you check in. Every Sunday, Michael sends a personal video reviewing your week and laying out exactly what to do next. You just show up and do the work.",
    features: [
      "Weekly Friday check-in",
      "Personal Sunday video from Michael every week",
      "Fully personalised programming, updated weekly",
      "Everything in Premium included",
    ],
    cta: "Book a Consultation",
    ctaHref: "/consultation",
    external: false,
    dark: false,
  },
  {
    tag: "Self-Directed",
    tagColor: "#0369a1",
    title: "Premium Membership",
    subtitle: "Train on Your Own Terms",
    price: "€19.99",
    priceNote: "/4 weeks",
    bestFor: "Motivated people who train independently and want the best tools to do it.",
    description:
      "Full access to the Training for Life app. Build custom workouts, follow programmes, track progress, and measure your Capability Score. No coach access included.",
    features: [
      "Unlimited custom workouts and programmes",
      "Full workout history and personal bests",
      "Capability Score and progress tracking",
      "Coach-published programme templates",
    ],
    cta: "Join Premium",
    ctaHref: "/register",
    external: false,
    dark: false,
  },
  {
    tag: "Free",
    tagColor: "#888",
    title: "Free App",
    subtitle: "Get Started",
    price: "Free",
    priceNote: null,
    bestFor: "Anyone who wants to start before committing.",
    description:
      "Access the exercise library, log workouts, and see what the app can do. Upgrade any time.",
    features: [
      "Exercise library",
      "Basic workout logging",
      "1 saved custom workout",
    ],
    cta: "Get the Free App",
    ctaHref: "/register",
    external: false,
    dark: false,
  },
];

export default function Services() {
  return (
   <section id="services" className="bg-stone-50 px-6 py-24">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-16 max-w-2xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">
            Personal Training &amp; Online Coaching
          </p>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-zinc-900 md:text-5xl">
            Every level of support, from free to fully managed.
          </h2>
          <p className="mt-6 text-lg leading-8 text-zinc-600">
            Start free and track your training, upgrade to Premium for the full app experience, or work directly with Michael through online or in-person coaching. Pick the level that matches how seriously you want to take this.
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
              <p style={{ fontSize: "13px", fontWeight: 600, color: s.dark ? "#9fe1cb" : "#2d6a4f", margin: "0 0 6px" }}>
                {s.subtitle}
              </p>
              {s.bestFor && (
                <p style={{ fontSize: "13px", color: s.dark ? "rgba(255,255,255,0.55)" : "#888", margin: "0 0 16px", lineHeight: 1.5 }}>
                  Best for: {s.bestFor}
                </p>
              )}

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