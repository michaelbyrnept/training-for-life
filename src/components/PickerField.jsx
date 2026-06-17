import { useState } from "react";

export default function PickerField({
  label,
  value,
  setValue,
  step = 1,
  suffix = "",
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div>

      <p className="mb-3 text-sm text-zinc-500">
        {label}
      </p>

      <div className="rounded-3xl border bg-white p-4">

        {!editing ? (
          <div className="flex items-center justify-between">

            <button
              onClick={() => setValue(value - step)}
              className="h-14 w-14 rounded-2xl bg-zinc-100 text-3xl"
            >
              -
            </button>

            <button
              onClick={() => setEditing(true)}
              className="text-4xl font-bold"
            >
              {value}
              {suffix}
            </button>

            <button
              onClick={() => setValue(value + step)}
              className="h-14 w-14 rounded-2xl bg-zinc-100 text-3xl"
            >
              +
            </button>

          </div>
        ) : (
          <input
            autoFocus
            type="number"
            value={value}
            onChange={(e) =>
              setValue(Number(e.target.value))
            }
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setEditing(false);
              }
            }}
            className="w-full rounded-2xl border p-4 text-center text-3xl font-bold"
          />
        )}

      </div>

    </div>
  );
}
