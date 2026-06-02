import Hero from "../assets/Hero.png";
export default function About() {
  return (

    <section className="bg-zinc-100 px-6 py-28">

      <div className="mx-auto grid max-w-7xl gap-20 md:grid-cols-2 md:items-center">

        {/* IMAGE SIDE */}
        <div>

          <div className="overflow-hidden rounded-[3rem] border border-zinc-200 bg-white shadow-2xl">

            <img
  src={Hero}
  alt="Capability coaching"
  className="h-full w-full object-cover object-center"
/>

          </div>

        </div>

        {/* TEXT SIDE */}
        <div>

          <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">
            About Michael
          </p>

          <h2 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Patient. Clear. Empowering.
          </h2>

          <div className="mt-10 space-y-8 text-lg leading-8 text-zinc-700">

            <p>
              My goal is not simply to help people exercise more.
            </p>

            <p>
              My goal is to help successful adults rebuild confidence
              in what their body can still do — and what it can still become.
            </p>

            <p>
              Many people quietly begin believing that slowing down,
              feeling weaker, or becoming physically limited is simply
              part of getting older.
            </p>

            <p>
              I don’t believe that has to be the case.
            </p>

            <p>
              Through structured capability coaching, I help clients
              feel stronger, move better, stay independent,
              and become more optimistic about the future ahead of them.
            </p>

            <p>
              This is not about extreme fitness.
              It’s about building a body — and a future —
              that you feel confident living in.
            </p>

          </div>

        </div>

      </div>

    </section>

  );
}