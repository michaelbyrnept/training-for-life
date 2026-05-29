import { useState, useEffect } from "react";

export default function Testimonials() {

  const testimonials = [

    {
      quote:
        "Michael is a fantastic PT. Always positive and upbeat I always leave our sessions in better form than when I arrived. He is technically excellent and knowledgable about all of the machines and free weights but as importantly he is also very knowledgable around human physiology and he can distinguish between what is best for clients based on age and fitness profile. He makes everything clear and easy to understand. I would strongly recommend Michael to anyone looking for a personal trainer.",
      name: "Paul, Capability Coaching Client",
    },

    {
      quote:
        "Michael believes in me more than I believe in myself at times, and that motivation has made a huge difference.",
      name: "Ann-Marie, Capability Coaching Client",
    },

    {
      quote:
        "Efficiency and fun. Michael is an excellent personal trainer. I feel good during my sessions hence I feel great and strong for my every day activities.",
      name: "Capability Coaching Client",
    },

    {
      quote:
        "I highly recommend my personal trainer! Very professional, motivating, and attentive during every workout. Since I started training, I’ve felt stronger, more confident, and healthier. The workouts are well planned and adapted to my goals. Great experience overall!",
      name: "Karen, Capability Coaching Client",
    },

    {
      quote:
        "I couldn't speak more highly of Michael. Firstly he's a great guy and secondly he's a brilliant personal trainer. He really helped me get me up and running in the gym and he couldn't have been more helpful. Highly recommend him",
      name: "Barry, Capability Coaching Client",
    },

  ];

  const [testimonialIndex, setTestimonialIndex] = useState(0);

  useEffect(() => {

    const interval = setInterval(() => {

      setTestimonialIndex((prev) =>
        (prev + 1) % testimonials.length
      );

    }, 20000);

    return () => clearInterval(interval);

  }, [testimonials.length]);

  return (

    <section
      id="stories"
      className="bg-stone-50 px-6 py-28"
    >

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="max-w-3xl">

          <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">
            Client Stories
          </p>

          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Real capability. Real confidence. Real life.
          </h2>

        </div>

        {/* FEATURED STORY */}
        <div className="mt-20">

          <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">
            Capability Spotlight
          </p>

          <div className="rounded-[3rem] border border-zinc-200 bg-white p-10 shadow-xl md:p-16">

            <div className="max-w-4xl">

              <p className="mb-6 text-sm uppercase tracking-[0.25em] text-zinc-500">
                A stronger body. A more confident life.
              </p>

              <p className="text-7xl font-bold leading-none text-emerald-700">
                “
              </p>

              <p className="mt-6 text-xl leading-relaxed text-zinc-700 md:text-2xl">

                I’ve been training with Michael for the past year and the results have been excellent.
                I feel noticeably healthier, stronger, and fitter overall.

                <br /><br />

                Beyond the physical benefits, the training has also had a real impact on my golf.
                I’m moving better, stronger through the swing, and seeing the benefits on the course.

                <br /><br />

                Michael is knowledgeable, motivating, and tailors sessions to what you need,
                striking the right balance between pushing you and keeping things enjoyable.

                <br /><br />

                I’d highly recommend him to anyone looking to improve their fitness,
                strength, confidence, and long-term physical capability.

              </p>

              <div className="mt-10">

                <p className="text-2xl font-semibold tracking-tight">
                  — Jarlath Dolly
                </p>

                <p className="mt-2 text-zinc-500">
                  Capability Coaching Client
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* ROTATING TESTIMONIALS */}
        <div className="mt-12 grid gap-8 md:grid-cols-3">

          {[0, 1, 2].map((offset) => {

            const review =
              testimonials[
                (testimonialIndex + offset) %
                testimonials.length
              ];

            return (

              <div
                key={offset}
                className="flex min-h-[320px] flex-col rounded-[2.5rem] border border-zinc-200 bg-white p-8 shadow-xl transition duration-300 hover:-translate-y-1"
              >

                <p className="mb-4 text-6xl font-bold leading-none text-emerald-700">
                  “
                </p>

                <p className="text-lg leading-8 text-zinc-700 italic">
                  {review.quote}
                </p>

                <div className="mt-auto pt-10">

                  <p className="font-semibold tracking-tight">
                    — {review.name}
                  </p>

                </div>

              </div>

            );

          })}

        </div>

      </div>

    </section>

  );
}