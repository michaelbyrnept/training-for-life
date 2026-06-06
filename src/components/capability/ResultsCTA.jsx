export default function ResultsCTA() {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm border border-zinc-200 text-center">
      <h3 className="text-3xl font-bold mb-4">
        Ready To Improve Your Capability Score?
      </h3>

      <p className="text-zinc-600 mb-8">
        Book a Capability Consultation and receive a
        personalised roadmap for improving your strength,
        confidence and long-term capability.
      </p>

      <a
        href="/consultation"
        className="inline-block rounded-2xl bg-emerald-700 px-8 py-4 font-semibold text-white transition hover:bg-emerald-800"
      >
        Book A Capability Consultation
      </a>
    </div>
  );
}