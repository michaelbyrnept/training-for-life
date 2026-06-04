import Logo from "../assets/Logo.svg";
export default function Navbar() {
  return (

    <nav className="sticky top-0 z-50 border-b border-white/20 bg-stone-50/80 backdrop-blur-xl">

      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

        {/* LEFT SIDE */}
        <div className="flex items-center gap-4">

          {/* LOGO */}
<div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">

  <img
    src={Logo}
    alt="Training For Life Logo"
    className="h-10 w-10 object-contain"
  />

</div>

          {/* BRAND */}
          <div>

            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
              Michael Byrne
            </h1>

            <p className="text-sm text-zinc-500">
              Training For Life
            </p>

          </div>

        </div>

        {/* NAVIGATION */}
        <div className="hidden items-center gap-10 text-sm font-medium text-zinc-600 md:flex">

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
            Stories
          </a>

          <a
            href="#contact"
            className="transition hover:text-emerald-700"
          >
            Contact
          </a>

        </div>

        {/* CTA */}
        <div className="hidden md:block">

          <a
  href="https://tally.so/r/Bz2QAe"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-block rounded-2xl bg-emerald-700 px-8 py-4 text-base font-medium text-white shadow-lg shadow-emerald-700/20 transition hover:opacity-90"
>
  Book Consultation
</a>

        </div>

      </div>

    </nav>

  );
}