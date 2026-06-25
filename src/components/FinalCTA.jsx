export default function FinalCTA() {
  return (
    <section
      id="contact"
      className="bg-zinc-950 px-6 py-24 text-center text-stone-100"
    >

      <div className="mx-auto max-w-4xl">

        <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-emerald-400">
          Begin Your Journey
        </p>

        <h2 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
         The way you age is more influenceable than you think.
        </h2>

        <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-zinc-300">
          Personal training in South Dublin and online coaching across Ireland — designed to help you stay strong, active, independent, and physically confident for the decades ahead.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="/consultation"
            className="inline-block rounded-2xl bg-emerald-700 px-8 py-4 text-base font-medium text-white shadow-lg shadow-emerald-700/20 transition hover:opacity-90"
          >
            Book a Free Consultation
          </a>
          <a
            href="/coaching/in-person"
            className="inline-block rounded-2xl border border-white/20 px-8 py-4 text-base font-medium text-white transition hover:bg-white/10"
          >
            View In-Person Options
          </a>
        </div>

        <p className="mt-8 text-sm text-zinc-500">
          Serving South Dublin — Rathmines, Ranelagh, Dundrum, Sandyford, Stillorgan and surrounding areas
        </p>

      </div>

    </section>
  )
}
