export default function Footer() {
  return (
    <footer
      id="contact"
      className="border-t border-zinc-200 bg-stone-50 px-6 py-20"
    >
      <div className="mx-auto grid max-w-7xl gap-16 md:grid-cols-4">

        {/* BRAND */}
        <div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Michael Byrne
            </h2>

            <p className="mt-1 text-zinc-500">
              Training for Life
            </p>
          </div>

          <p className="mt-6 leading-7 text-zinc-600">
            Premium capability coaching designed to help successful
            adults stay strong, active, independent, and physically
            confident for the decades ahead.
          </p>

        </div>

        {/* NAVIGATION */}
        <div>

          <h3 className="text-lg font-semibold">
            Navigation
          </h3>

          <div className="mt-6 flex flex-col gap-4 text-zinc-600">

            <a
              href="#philosophy"
              className="transition hover:text-emerald-700"
            >
              Philosophy
            </a>

            <a
              href="#process"
              className="transition hover:text-emerald-700"
            >
              Process
            </a>

            <a
              href="#stories"
              className="transition hover:text-emerald-700"
            >
              Client Stories
            </a>

            <a
              href="#contact"
              className="transition hover:text-emerald-700"
            >
              Consultation
            </a>

          </div>

        </div>

        {/* CONTACT */}
        <div>

          <h3 className="text-lg font-semibold">
            Contact
          </h3>

          <div className="mt-6 flex flex-col gap-4 text-zinc-600">

            <a
              href="https://instagram.com/trainingforlife.ie"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-emerald-700"
            >
              Instagram
            </a>

            <a
              href="mailto:michael@trainingforlife.ie"
              className="transition hover:text-emerald-700"
            >
              Email
            </a>

            <a
              href="https://wa.me/353852239897"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-emerald-700"
            >
              WhatsApp
            </a>

          </div>

        </div>

        {/* LOCATION / CTA */}
        <div>

          <h3 className="text-lg font-semibold">
            South Dublin Based
          </h3>

          <p className="mt-6 leading-7 text-zinc-600">
            Private capability coaching for successful adults across
            South Dublin and surrounding areas.
          </p>

          <a
  href="/consultation"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-block rounded-2xl bg-emerald-700 px-8 py-4 text-base font-medium text-white shadow-lg shadow-emerald-700/20 transition hover:opacity-90"
>
  Book Consultation
</a>

        </div>

      </div>

      {/* BOTTOM */}
      <div className="mx-auto mt-16 flex max-w-7xl flex-col gap-4 border-t border-zinc-200 pt-8 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">

        <p>
          © 2026 Michael Byrne. All rights reserved.
        </p>

        <p>
          Capability Coaching • Training For Life
        </p>

      </div>
    </footer>
  )
}
