export default function Process() {
  return (

    <section
      id="process"
      className="bg-white px-6 py-28"
    >

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="max-w-3xl">

          <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">
            The Process
          </p>

          <h2 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            A structured path toward long-term capability.
          </h2>

          <p className="mt-8 text-lg leading-8 text-zinc-600">
            Capability coaching built to help you feel stronger,
            move better, stay independent, and become more
            confident in the future ahead of you.
          </p>

        </div>

        {/* PROCESS FLOW */}
        <div className="mt-20 grid gap-8 md:grid-cols-4">

          {[
            {
              step: "01",
              title: "Understand Your Starting Point",
              text:
                "We assess where you are now, what feels limiting, and what you want your future to feel like physically.",
            },

            {
              step: "02",
              title: "Build Your Capability Plan",
              text:
                "Together we create a structured roadmap designed around your goals, lifestyle, and long-term health.",
            },

            {
              step: "03",
              title: "Train With Confidence",
              text:
                "Through patient, empowering coaching, you begin rebuilding strength, movement confidence, and physical resilience.",
            },

            {
              step: "04",
              title: "Stay Capable For Life",
              text:
                "The goal is not short-term fitness. The goal is lasting capability, independence, and confidence for the decades ahead.",
            },

          ].map((item) => (

            <div
              key={item.step}
              className="relative overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-stone-50 p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >

              {/* STEP NUMBER */}
              <p className="text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">
                Step {item.step}
              </p>

              {/* TITLE */}
              <h3 className="mt-6 text-2xl font-semibold leading-tight tracking-tight">
                {item.title}
              </h3>

              {/* DESCRIPTION */}
              <p className="mt-6 leading-7 text-zinc-600">
                {item.text}
              </p>

            </div>

          ))}

        </div>

      </div>

    </section>

  );
}
