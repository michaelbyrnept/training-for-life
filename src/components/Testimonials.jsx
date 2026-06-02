import { useState } from "react";
import { useSwipeable } from "react-swipeable";
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

const nextTestimonial = () => {

  setTestimonialIndex((prev) =>
    (prev + 1) % testimonials.length
  );

};

const prevTestimonial = () => {

  setTestimonialIndex((prev) =>
    prev === 0
      ? testimonials.length - 1
      : prev - 1
  );

};
const handlers = useSwipeable({
  onSwipedLeft: nextTestimonial,
  onSwipedRight: prevTestimonial,
  trackMouse: true,
});
  return (

    <section
      id="stories"
      className="bg-stone-50 px-6 py-28"
    >

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="max-w-2xl">

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
<div className="mb-6 flex gap-1 text-amber-400">

  {[...Array(5)].map((_, index) => (
    <span key={index} className="text-3xl">
      ★
    </span>
  ))}

</div>
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

        {/* TESTIMONIAL CAROUSEL */}
<div className="mt-12">

 <div
  {...handlers}
  className="relative rounded-[2.5rem] border border-zinc-200 bg-white p-8 shadow-xl md:p-12"
>
    {/* LEFT ARROW */}
    <button
      onClick={prevTestimonial}
      className="absolute left-4 toptop-20-1/2 hidden -translate-y-1/2 rounded-full border border-zinc-200 bg-white p-3 text-zinc-600 transition hover:bg-zinc-100 md:block"
    >
      ←
    </button>

    {/* RIGHT ARROW */}
    <button
      onClick={nextTestimonial}
      className="absolute right-4 toptop-20-1/2 hidden -translate-y-1/2 rounded-full border border-zinc-200 bg-white p-3 text-zinc-600 transition hover:bg-zinc-100 md:block"
    >
      →
    </button>

    <div className="mx-auto max-w-3xl text-center">

      <p className="mb-4 text-6xl font-bold leading-none text-emerald-700">
        “
      </p>
<div className="mb-6 flex justify-center gap-1 text-yellow-400">

  {[...Array(5)].map((_, index) => (
    <span key={index} className="text-2xl">
      ★
    </span>
  ))}

</div>
      <p className="text-xl leading-relaxed text-zinc-700 italic md:text-2xl">
        {testimonials[testimonialIndex].quote}
      </p>

      <div className="mt-10">

        <p className="font-semibold tracking-tight">
          — {testimonials[testimonialIndex].name}
        </p>

      </div>

    </div>

    {/* DOTS */}
    <div className="mt-10 flex justify-center gap-3">

      {testimonials.map((_, index) => (

        <button
          key={index}
          onClick={() => setTestimonialIndex(index)}
          className={`h-3 w-3 rounded-full transition ${
            testimonialIndex === index
              ? "bg-emerald-700"
              : "bg-zinc-300"
          }`}
        />

      ))}

    </div>

  </div>

</div>

     

      </div>

    </section>

  );
}