import { useState } from "react";
import { Link } from "react-router-dom";

const faqs = [
  {
    q: "How much does personal training cost in Dublin?",
    a: "In-person personal training in South Dublin starts from €55 per session, or €349 for a Starter Package of around 6 sessions. Online coaching starts from €149 per month, and hybrid coaching (online plus optional in-person) from €199 per month. A free consultation is always available first.",
  },
  {
    q: "Where in Dublin do you offer in-person personal training?",
    a: "Michael is based in South Dublin and works with clients across Rathmines, Ranelagh, Dundrum, Sandyford, Stillorgan, Ballsbridge, Donnybrook and surrounding areas. Online coaching is available to clients anywhere in Ireland.",
  },
  {
    q: "Do you offer a free consultation?",
    a: "Yes. You can book a free, no-obligation consultation to talk through your goals, current situation and which coaching option is the right fit. There is no pressure and no commitment required.",
  },
  {
    q: "Is personal training suitable for beginners or people returning after a break?",
    a: "Absolutely. Michael specialises in working with adults at all fitness levels, including complete beginners and those returning to exercise after injury, illness or a long break. Every programme is personalised to where you are right now.",
  },
  {
    q: "What is online personal training?",
    a: "Online coaching with Training for Life includes a weekly Friday check-in, a personalised Sunday video review from Michael, and your full next week planned out. It is fully remote and available to clients anywhere in Ireland, from €149 per month.",
  },
  {
    q: "What is the difference between 1:1, 1:2 and small group personal training?",
    a: "1:1 means the full session is yours alone — fully personalised. 1:2 means you train with one partner and share the cost of the same hour. 1:3 is a small group of three people, offering the best per-person value. All sessions are led by Michael and fully supervised.",
  },
];

function FAQItem({ faq }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border-b border-zinc-200 last:border-0"
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-zinc-900 md:text-lg">
          {faq.q}
        </span>
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition"
          style={{ transform: open ? "rotate(45deg)" : "none" }}
          aria-hidden="true"
        >
          +
        </span>
      </button>
      {open && (
        <p className="pb-5 text-base leading-7 text-zinc-600">
          {faq.a}
        </p>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-3xl">

        <div className="mb-12 text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">
            Common Questions
          </p>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-zinc-900 md:text-5xl">
            Personal training in Dublin — what you need to know.
          </h2>
        </div>

        <div className="divide-y divide-zinc-200 rounded-3xl border border-zinc-200 bg-stone-50 px-8">
          {faqs.map((faq) => (
            <FAQItem key={faq.q} faq={faq} />
          ))}
        </div>

        <p className="mt-10 text-center text-zinc-600">
          Still have a question?{" "}
          <Link
            to="/consultation"
            className="font-semibold text-emerald-700 underline underline-offset-2 hover:opacity-80"
          >
            Book a free consultation
          </Link>{" "}
          and ask Michael directly.
        </p>

      </div>
    </section>
  );
}
