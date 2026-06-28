import HeroImage from "../assets/Hero.png";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-stone-50 px-6 pt-32 pb-24">

      {/* BACKGROUND GLOW */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-emerald-100 blur-3xl opacity-40"></div>
        <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-zinc-200 blur-3xl opacity-40"></div>
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-20 md:grid-cols-2 md:items-center">

        {/* TEXT SIDE */}
        <div>
          <p className="mb-6 text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">
            Personal Training · South Dublin &amp; Online Ireland
          </p>

          <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight text-zinc-900 md:text-7xl">
            Personal Training in Dublin That Fits Your Lifestyle
          </h1>

          <p className="mt-10 max-w-2xl text-xl leading-9 text-zinc-600">
            Premium coaching designed to help you stay strong, active, independent, and physically confident for decades to come.
          </p>

          {/* BUTTONS */}
          <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:flex-wrap">

            <a
              href="/consultation"
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-700 px-8 py-5 text-base font-medium text-white shadow-lg shadow-emerald-700/20 transition hover:opacity-90"
            >
              Book a Free Consultation
            </a>

            <a
              href="/#services"
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-300 bg-white px-8 py-5 text-base font-medium text-zinc-800 transition hover:bg-zinc-50"
            >
              See Pricing &amp; Options
            </a>

          </div>


          {/* TRUST TEXT */}
          <div className="mt-10 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <span className="text-amber-400">★★★★★</span>
            <span>5-Star Rated</span>
            <span className="mx-1 text-zinc-300">|</span>
            <span>South Dublin &amp; Online Ireland</span>
            <span className="mx-1 text-zinc-300">|</span>
            <span>Private 1:1 Sessions</span>
          </div>
        </div>

        {/* IMAGE SIDE */}
        <div>
          <div className="overflow-hidden rounded-[3rem] border border-zinc-200 bg-white shadow-2xl">
            <img
              src={HeroImage}
              alt="Michael Byrne personal trainer working with a client in South Dublin"
              className="h-[750px] w-full object-cover"
            />
          </div>
        </div>

      </div>
    </section>
  );
}