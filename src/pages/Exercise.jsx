import PortalNav from "../components/PortalNav";
import { useParams } from "react-router-dom";
import { useState } from "react";
import PickerField from "../components/PickerField";
import WheelPicker from "../components/WheelPicker";

export default function Exercise() {
  const { exerciseId } = useParams();
const [set1Complete, setSet1Complete] = useState(false);
const [set2Complete, setSet2Complete] = useState(false);
const [set3Complete, setSet3Complete] = useState(false);
const [reps, setReps] = useState(10);
const [weight, setWeight] = useState(20);
const [rir, setRir] = useState(2);
const repValues = [];

for (let i = 0; i <= 20; i++) {
  repValues.push(i);
}

  return (
    <div className="min-h-screen bg-stone-50 p-8">

      <PortalNav />

      <div className="max-w-3xl mx-auto">

        <h1 className="text-4xl font-bold mb-2">
          {exerciseId?.replaceAll("-", " ")}
        </h1>
<div className="inline-flex items-center rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-700 mb-6">
  In Progress
</div>
        <p className="text-zinc-600 mb-8">
          Complete your prescribed sets below.
        </p>
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 mb-6">

  <p className="text-sm font-medium text-emerald-700">
    Target Rep Range
  </p>

  <h2 className="text-3xl font-bold text-emerald-800">
    8 - 12 Reps
  </h2>

</div>
<div className="bg-white rounded-3xl p-6 shadow mb-6">

  <div className="flex justify-between items-center mb-4">

    <div>
      <p className="text-sm text-zinc-500">
        Target Rep Range
      </p>

      <h2 className="text-3xl font-bold text-emerald-700">
        8 - 12 Reps
      </h2>
    </div>

    <div className="text-right">
      <p className="text-sm text-zinc-500">
        Sets
      </p>

      <h2 className="text-3xl font-bold">
        3
      </h2>
    </div>

  </div>

  <div className="w-full bg-zinc-200 rounded-full h-4">
    <div
      className="bg-emerald-600 h-4 rounded-full"
      style={{ width: "33%" }}
    />
  </div>

  <p className="mt-3 text-sm text-zinc-500">
    1 of 3 sets completed
  </p>
</div>
<div className="bg-white rounded-3xl p-6 shadow mb-6">

  <h2 className="text-xl font-bold mb-4">
    Previous Performance
  </h2>

  <div className="space-y-2">

    <div className="flex justify-between">
      
      <span>Set 1</span>
      <span>20kg × 10</span>
    </div>

    <div className="flex justify-between">
      <span>Set 2</span>
      <span>20kg × 10</span>
    </div>

    <div className="flex justify-between">
      <span>Set 3</span>
      <span>20kg × 10</span>
    </div>

  </div>

</div>
        {/* VIDEO */}

        <div className="bg-white rounded-3xl p-8 shadow mb-6">

          <div className="aspect-video rounded-3xl bg-zinc-200 flex items-center justify-center">

            <span className="text-zinc-500 text-lg">
              Exercise Video
            </span>

          </div>

        </div>

        {/* COACH NOTES */}

        <div className="bg-white rounded-3xl p-8 shadow mb-6">

          <h2 className="text-2xl font-bold mb-4">
            Coach Notes
          </h2>

          <ul className="space-y-3 text-zinc-700">
            <li>Keep your chest tall.</li>
            <li>Control the descent.</li>
            <li>Drive through the floor.</li>
          </ul>

        </div>

        {/* SET 1 */}

        <div className="bg-white rounded-3xl p-8 shadow mb-6">

          <h2 className="text-2xl font-bold mb-6">
            Set 1
          </h2>
<div className="rounded-2xl bg-zinc-100 p-4 mb-6">

  <p className="text-sm text-zinc-500">
    Last Session
  </p>

  <p className="font-semibold">
    20kg × 10
  </p>

</div>
          <div className="grid md:grid-cols-3 gap-4 mb-6">

  <PickerField
    label="Weight"
    value={weight}
    setValue={setWeight}
    step={2.5}
    suffix="kg"
  />

  <WheelPicker
  label="Reps"
  value={reps}
  setValue={setReps}
  values={repValues}
/>

  <PickerField
    label="RIR"
    value={rir}
    setValue={setRir}
  />



          </div>

          <button
            onClick={() => setSet1Complete(true)}
            className={`w-full rounded-3xl py-5 text-xl font-semibold text-white ${
              set1Complete
                ? "bg-emerald-500"
                : "bg-emerald-700"
            }`}
          >
            {set1Complete ? "✓ Set Complete" : "Complete Set"}
          </button>

        </div>

        {/* SET 2 */}

        <div className="bg-white rounded-3xl p-8 shadow mb-6">

          <h2 className="text-2xl font-bold mb-6">
            Set 2
          </h2>

          <div className="grid md:grid-cols-2 gap-4 mb-6">

            <input
              type="number"
              placeholder="Weight"
              defaultValue="20"
              className="rounded-3xl border p-4 text-lg"
            />

            <input
              type="number"
              placeholder="Reps"
              defaultValue="10"
              className="rounded-3xl border p-4 text-lg"
            />

          </div>

          <button
            onClick={() => setSet2Complete(true)}
            className={`w-full rounded-3xl py-5 text-xl font-semibold text-white ${
              set2Complete
                ? "bg-emerald-500"
                : "bg-emerald-700"
            }`}
          >
            {set2Complete ? "✓ Set Complete" : "Complete Set"}
          </button>

        </div>

        {/* SET 3 */}

        <div className="bg-white rounded-3xl p-8 shadow">

          <h2 className="text-2xl font-bold mb-6">
            Set 3
          </h2>

          <div className="grid md:grid-cols-2 gap-4 mb-6">

            <input
              type="number"
              placeholder="Weight"
              defaultValue="20"
              className="rounded-3xl border p-4 text-lg"
            />

            <input
              type="number"
              placeholder="Reps"
              defaultValue="10"
              className="rounded-3xl border p-4 text-lg"
            />

          </div>

          <button
            onClick={() => setSet3Complete(true)}
            className={`w-full rounded-3xl py-5 text-xl font-semibold text-white ${
              set3Complete
                ? "bg-emerald-500"
                : "bg-emerald-700"
            }`}
          >
            {set3Complete
              ? "✓ Exercise Complete"
              : "Complete Exercise"}
          </button>

        </div>

      </div>

    </div>
  );
}