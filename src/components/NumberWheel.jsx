export default function NumberWheel({
  value,
  setValue,
  min,
  max,
}) {
  const numbers = [];

  for (let i = min; i <= max; i++) {
    numbers.push(i);
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 py-2 min-w-max">

        {numbers.map((number) => (
          <button
            key={number}
            onClick={() => setValue(number)}
            className={`h-16 w-16 rounded-2xl text-xl font-bold transition ${
              value === number
                ? "bg-emerald-700 text-white scale-110"
                : "bg-white border text-zinc-500"
            }`}
          >
            {number}
          </button>
        ))}

      </div>
    </div>
  );
}