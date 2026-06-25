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
            <p className="text-2xl font-semibold tracking-tight">
              Michael Byrne
            </p>

            <p className="mt-1 text-zinc-500">
              Personal Trainer · South Dublin
            </p>
          </div>

          <p className="mt-6 leading-7 text-zinc-600">
            Personal training and online coaching in South Dublin.
            Helping adults build strength, confidence and long-term
            physical capability.
          </p>

        </div>

        {/* NAVIGATION */}
        <div>

          <h3 className="text-lg font-semibold">
            Services
          </h3>

          <div className="mt-6 flex flex-col gap-4 text-zinc-600">

            <a
              href="/coaching/in-person"
              className="transition hover:text-emerald-700"
            >
              In-Person Personal Training
            </a>

            <a
              href="/coaching/support"
              className="transition hover:text-emerald-700"
            >
              Online Coaching
            </a>

            <a
              href="/capability-score"
              className="transition hover:text-emerald-700"
            >
              Free Capability Assessment
            </a>

            <a
              href="/consultation"
              className="transition hover:text-emerald-700"
            >
              Book a Consultation
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
          © 2026 Michael Byrne · Personal Trainer South Dublin · All rights reserved.
        </p>

        <div className="flex gap-6">
          <a href="/privacy-policy" className="transition hover:text-emerald-700">Privacy Policy</a>
          <a href="/consultation" className="transition hover:text-emerald-700">Book a Consultation</a>
        </div>

      </div>
    </footer>
  )
}
