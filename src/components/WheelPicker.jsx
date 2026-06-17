export default function WheelPicker({
  label,
  value,
  setValue,
  values,
}) {
  return (
    <div className="bg-white rounded-3xl border p-4">

      <p className="text-sm text-zinc-500 mb-4">
        {label}
      </p>

      <div className="h-64 overflow-y-auto snap-y snap-mandatory">

        {values.map((item) => (
          <button
            key={item}
            onClick={() => setValue(item)}
            className={`w-full snap-center py-4 transition-all ${
              value === item
                ? "text-5xl font-bold text-emerald-700"
                : "text-2xl text-zinc-400"
            }`}
          >
            {item}
          </button>
        ))}

      </div>

    </div>
  );
}
