export default function ResultsOpportunity({
  lowestCategory,
  recommendation,
}) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm border border-zinc-200">
      <h3 className="text-2xl font-bold mb-4">
        ⚠️ Biggest Opportunity
      </h3>

      <p className="text-xl font-semibold mb-4 text-amber-600">
        {lowestCategory.name}
      </p>

      <p className="text-zinc-600 leading-relaxed">
        {recommendation}
      </p>
    </div>
  );
}