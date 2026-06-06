export default function ResultsProfile({
  summary,
  strengthScore,
  mobilityScore,
  energyScore,
  confidenceScore,
  consistencyScore,
  futureCapabilityScore,
}) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm border border-zinc-200">
      <p className="text-zinc-600 leading-relaxed mb-8">
        {summary}
      </p>

      <h3 className="text-2xl font-bold mb-6">
        Your Capability Profile
      </h3>

   <div>
 <div>
  <div className="flex justify-between mb-1">
    <span>Strength</span>
    <span>{strengthScore}/10</span>
  </div>

  <div className="h-1.5 w-full rounded-full bg-zinc-200">
    <div
      className="h-1.5 rounded-full bg-emerald-700"
      style={{ width: `${strengthScore * 10}%` }}
    />
  </div>
</div>

        <div>
  <div className="flex justify-between mb-1">
    <span>Mobility</span>
    <span>{mobilityScore}/10</span>
  </div>

  <div className="h-1.5 w-full rounded-full bg-zinc-200">
    <div
      className="h-1.5 rounded-full bg-emerald-700"
      style={{ width: `${mobilityScore * 10}%` }}
    />
  </div>
</div>

        <div>
  <div className="flex justify-between mb-1">
    <span>Energy</span>
    <span>{energyScore}/10</span>
  </div>

  <div className="h-1.5 w-full rounded-full bg-zinc-200">
    <div
      className="h-1.5 rounded-full bg-emerald-700"
      style={{ width: `${energyScore * 10}%` }}
    />
  </div>
</div>

        <div>
  <div className="flex justify-between mb-1">
    <span>Confidence</span>
    <span>{confidenceScore}/10</span>
  </div>

  <div className="h-1.5 w-full rounded-full bg-zinc-200">
    <div
      className="h-1.5 rounded-full bg-emerald-700"
      style={{ width: `${confidenceScore * 10}%` }}
    />
  </div>
</div>

        <div>
  <div className="flex justify-between mb-1">
    <span>Consistency</span>
    <span>{consistencyScore}/10</span>
  </div>

  <div className="h-1.5 w-full rounded-full bg-zinc-200">
    <div
      className="h-1.5 rounded-full bg-emerald-700"
      style={{ width: `${consistencyScore * 10}%` }}
    />
  </div>
</div>

        <div>
  <div className="flex justify-between mb-1">
    <span>Future Capability</span>
    <span>{futureCapabilityScore}/15</span>
  </div>

  <div className="h-1.5 w-full rounded-full bg-zinc-200">
    <div
      className="h-1.5 rounded-full bg-emerald-700"
      style={{ width: `${(futureCapabilityScore / 15) * 100}%` }}
    />
  </div>
</div>
      </div>
    </div>
  );
}