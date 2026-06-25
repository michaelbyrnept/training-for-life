import Logo from "../assets/Logo.svg";
import { useState } from "react";
import { Link } from "react-router-dom";
export default function Navbar() {
const [menuOpen, setMenuOpen] = useState(false);
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

            <p className="text-lg font-semibold tracking-tight text-zinc-900">
              Michael Byrne
            </p>

            <p className="text-sm text-zinc-500">
              Training For Life
            </p>

          </div>

        </div>

        {/* NAVIGATION */}
        <div className="hidden items-center gap-10 text-sm font-medium text-zinc-600 md:flex">

          <Link
            to="/coaching/in-person"
            className="transition hover:text-emerald-700"
          >
            In-Person Training
          </Link>

          <Link
            to="/coaching/support"
            className="transition hover:text-emerald-700"
          >
            Online Coaching
          </Link>

          <a
            href="#stories"
            className="transition hover:text-emerald-700"
          >
            Client Stories
          </a>

          <Link
            to="/capability-score"
            className="transition hover:text-emerald-700"
          >
            Free Assessment
          </Link>

          <Link
  to="/login"
  className="transition hover:text-emerald-700"
>
  Login
</Link>

        </div>
<button
  onClick={() => setMenuOpen(!menuOpen)}
  className="md:hidden text-3xl"
>
  ☰
</button>
        {/* CTA */}
       <div className="hidden md:block">

          <a
  href="/consultation"
  className="inline-block rounded-2xl bg-emerald-700 px-8 py-4 text-base font-medium text-white shadow-lg shadow-emerald-700/20 transition hover:opacity-90"
>
  Book Consultation
</a>

        </div>

      </div>
{menuOpen && (
  <div className="md:hidden border-t border-zinc-200 bg-stone-50">
    <div className="flex flex-col px-6 py-4 text-sm font-medium text-zinc-600">

      <Link
        to="/coaching/in-person"
        className="py-3 hover:text-emerald-700"
      >
        In-Person Training
      </Link>

      <Link
        to="/coaching/support"
        className="py-3 hover:text-emerald-700"
      >
        Online Coaching
      </Link>

      <a
        href="#stories"
        className="py-3 hover:text-emerald-700"
      >
        Client Stories
      </a>

      <Link
        to="/capability-score"
        className="py-3 hover:text-emerald-700"
      >
        Free Assessment
      </Link>

      <Link
        to="/login"
        className="py-3 hover:text-emerald-700"
      >
        Login
      </Link>

      <a
        href="/consultation"
        className="mt-3 rounded-xl bg-emerald-700 px-4 py-3 text-center text-white"
      >
        Book Consultation
      </a>

    </div>
  </div>
)}
    </nav>

  );
}
