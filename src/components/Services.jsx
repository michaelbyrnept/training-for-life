import { Link } from "react-router-dom";

const services = [
  {
    tag: "Most Popular",
    tagColor: "#2d6a4f",
    title: "1-to-1 Capability Coaching",
    subtitle: "In Person · South Dublin",
    description:
      "Private, structured coaching sessions designed around your goals, your body, and your life. Available 1, 2, or 3 times per week.",
    features: [
      "Fully personalised programme",
      "Strength, mobility & conditioning",
      "Ongoing coaching & accountability",
      "Regular capability assessments",
      "South Dublin based",
    ],
    cta: "Book a Consultation",
    ctaHref: "/consultation",
    external: true,
    dark: true,
  },
  {
    tag: "Flexible",
    tagColor: "#2d6a4f",
    title: "Hybrid Coaching",
    subtitle: "Online + In Person",
    description:
      "A structured online programme with regular check-ins, video feedback, and the option to combine with in-person sessions.",
    features: [
      "Custom online programming",
      "Weekly check-ins & feedback",
      "Video form review",
      "Progress tracking",
      "Flexible around your schedule",
    ],
    cta: "Book a Consultation",
    ctaHref: "/consultation",
    external: true,
    dark: false,
  },
  {
    tag: "Free to Join",
    tagColor: "#0369a1",
    title: "Training App",
    subtitle: "Start Training Today",
    description:
      "Access structured programmes, track your workouts, and follow guided training — all built around long-term capability.",
    features: [
      "Structured training programmes",
      "Workout logging & history",
      "Capability assessment & score",
      "Free to join",
      "Premium programmes available",
    ],
    cta: "Take the Capability Assessment",
    ctaHref: "/capability-score",
    external: false,
    dark: false,
  },
];

export default function Services() {
  return (
    <section className="bg-stone-50 px-6 py-24">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-16 max-w-2xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">
            How We Work Together
          </p>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-zinc-900 md:text-5xl">
            Three ways to build your capability.
          </h2>
          <p className="mt-6 text-lg leading-8 text-zinc-600">
            Whether you want hands-on coaching, flexible online support, or a free way to start — there's a path that fits your life.
          </p>
        </div>

        {/* Service cards */}
        <div className="grid gap-6 md:grid-cols-3">
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
              {/* Tag */}
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                backgroundColor: s.dark ? "rgba(255,255,255,0.1)" : "#eaf5ef",
                color: s.dark ? "#9fe1cb" : s.tagColor,
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "4px 12px",
                borderRadius: "20px",
                marginBottom: "20px",
                width: "fit-content",
              }}>
                {s.tag}
              </div>

              {/* Title */}
              <h3 style={{
                fontSize: "22px",
                fontWeight: 700,
                color: s.dark ? "#fff" : "#111",
                margin: "0 0 4px",
                lineHeight: 1.2,
              }}>
                {s.title}
              </h3>
              <p style={{
                fontSize: "13px",
                fontWeight: 600,
                color: s.dark ? "#9fe1cb" : "#2d6a4f",
                margin: "0 0 16px",
              }}>
                {s.subtitle}
              </p>

              <p style={{
                fontSize: "15px",
                color: s.dark ? "#c5e8d8" : "#555",
                lineHeight: 1.6,
                margin: "0 0 24px",
              }}>
                {s.description}
              </p>

              {/* Features */}
              <ul style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 32px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                flex: 1,
              }}>
                {s.features.map((f) => (
                  <li key={f} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "14px",
                    color: s.dark ? "#c5e8d8" : "#444",
                  }}>
                    <span style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      backgroundColor: s.dark ? "rgba(255,255,255,0.1)" : "#eaf5ef",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke={s.dark ? "#9fe1cb" : "#2d6a4f"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {s.external ? (
                <a
                  href={s.ctaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: s.dark ? "#fff" : "#2d6a4f",
                    color: s.dark ? "#1a3a2a" : "#fff",
                    borderRadius: "12px",
                    padding: "14px 20px",
                    fontSize: "14px",
                    fontWeight: 700,
                    textDecoration: "none",
                    textAlign: "center",
                  }}
                >
                  {s.cta}
                </a>
              ) : (
                <Link
                  to={s.ctaHref}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#2d6a4f",
                    color: "#fff",
                    borderRadius: "12px",
                    padding: "14px 20px",
                    fontSize: "14px",
                    fontWeight: 700,
                    textDecoration: "none",
                    textAlign: "center",
                  }}
                >
                  {s.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
