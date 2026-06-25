import CoupleWalk from "../assets/CoupleWalk.png";
import Hike from "../assets/Hike.png";
import Football from "../assets/Football.png";
export default function Outcomes() {
  return (

    <section className="bg-stone-50 px-6 py-28">

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="max-w-3xl">

          <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">
            Outcomes
          </p>

          <h2 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Rebuild confidence in what your body can still do.
          </h2>

          <p className="mt-8 text-lg leading-8 text-zinc-600">
            Capability coaching designed to help you move better,
            feel stronger, stay independent, and fully engage in
            the life you still want to live.
          </p>

        </div>

        {/* OUTCOME CARDS */}
        <div className="mt-20 grid gap-8 md:grid-cols-3">

          {/* CARD 1 */}
          <div className="overflow-hidden rounded-[3rem] border border-zinc-200 bg-white shadow-xl transition duration-300 hover:-translate-y-1">

            <img
  src={CoupleWalk}
  alt="Couple walking together after personal training in South Dublin"
  className="h-64 w-full object-cover object-[center_35%]"
/>

            <div className="p-10">

              <h3 className="text-3xl font-semibold tracking-tight">
                Trust Your Body Again
              </h3>

              <p className="mt-6 leading-8 text-zinc-600">
                Rebuild strength, movement confidence, and physical resilience
                so everyday life feels easier, safer, and more enjoyable again.
              </p>

            </div>

          </div>

          {/* CARD 2 */}
          <div className="overflow-hidden rounded-[3rem] border border-zinc-200 bg-white shadow-xl transition duration-300 hover:-translate-y-1">

            <img
             src={Hike}
              alt="Active adults hiking outdoors after strength training programme"
              className="h-64 w-full object-cover"
            />

            <div className="p-10">

              <h3 className="text-3xl font-semibold tracking-tight">
                Stay Independent
              </h3>

              <p className="mt-6 leading-8 text-zinc-600">
                Maintain the freedom to travel, explore, move confidently,
                and continue living life on your own terms for years to come.
              </p>

            </div>

          </div>

          {/* CARD 3 */}
          <div className="overflow-hidden rounded-[3rem] border border-zinc-200 bg-white shadow-xl transition duration-300 hover:-translate-y-1">

            <img
            src={Football}
              alt="Adult staying active and enjoying sport after personal training"
              className="h-64 w-full object-cover"
            />

            <div className="p-10">

              <h3 className="text-3xl font-semibold tracking-tight">
                Enjoy Life Fully
              </h3>

              <p className="mt-6 leading-8 text-zinc-600">
                Feel more energetic, optimistic, and physically capable
                so you can fully engage in the people, experiences,
                and activities that matter most.
              </p>

            </div>

          </div>

        </div>

      </div>

    </section>

  );
}
