export default function ResultsStrength({
  highestCategory,
}) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm border border-zinc-200">
      <h3 className="text-2xl font-bold mb-4">
        🏆 Your Strongest Area
      </h3>

      <p className="text-xl font-semibold mb-4 text-emerald-700">
        {highestCategory.name}
      </p>

      <p className="text-zinc-600 leading-relaxed">
        This appears to be one of your strongest areas right now and provides a solid foundation for your long-term health, capability and independence.
      </p>
    </div>
  );
}