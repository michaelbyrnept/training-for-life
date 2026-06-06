export default function ResultsHero({
  totalScore,
  category,
}) {
  return (
    <div className="rounded-3xl bg-white p-10 shadow-sm border border-zinc-200">
      <p className="text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">
        Capability Assessment Complete
      </p>

      <h1 className="mt-4 text-5xl font-bold">
        Your Capability Score
      </h1>

      <div className="mt-10 flex items-end gap-3">
        <span className="text-8xl font-bold">
          {totalScore}
        </span>

        <span className="mb-3 text-3xl text-zinc-400">
          / 65
        </span>
      </div>

      <div className="mt-8 inline-flex rounded-full bg-emerald-100 px-5 py-2">
        <span className="font-semibold text-emerald-800">
          {category}
        </span>
      </div>
    </div>
  );
}