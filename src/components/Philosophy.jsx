export default function Philosophy() {
  return (
    <section
      id="philosophy"
      className="bg-zinc-950 px-6 py-24 text-stone-100"
    >
      <div className="mx-auto grid max-w-7xl gap-16 md:grid-cols-2 md:items-center">

        {/* Left Side */}
        <div>

          <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-emerald-400">
            Philosophy
          </p>

          <h2 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Most adults are far more capable than they’ve been led to believe.
          </h2>

        </div>

        {/* Right Side */}
        <div className="space-y-6 text-lg leading-8 text-zinc-300">

          <p>
            Ageing does not automatically mean fragility,
            weakness, or rapid decline.
          </p>

          <p>
            With patient, structured, and empowering coaching,
            most adults can rebuild strength, confidence,
            movement quality, and physical resilience far beyond
            what they thought possible.
          </p>

          <p>
            This isn’t about extreme fitness.
            It’s about staying capable for the life you still
            want to live.
          </p>

        </div>

      </div>
    </section>
  )
}
