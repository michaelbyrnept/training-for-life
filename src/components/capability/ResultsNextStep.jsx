export default function ResultsNextStep({
  nextStep,
}) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm border border-zinc-200">
      <h3 className="text-2xl font-bold mb-4">
        📈 Recommended Next Step
      </h3>

      <p className="text-zinc-600 leading-relaxed">
        {nextStep}
      </p>
    </div>
  );
}