
import PortalNav from "../components/PortalNav";
import { Link, useParams } from "react-router-dom";

export default function Week() {
  const { programmeId, weekId } = useParams();

  const workouts = [
    {
      title: "Workout A",
      description: "Full Body Strength"
    },
    {
      title: "Workout B",
      description: "Mobility & Conditioning"
    },
    {
      title: "Workout C",
      description: "Strength & Balance"
    }
  ];

  return (
    <div className="min-h-screen bg-stone-50 p-8">

      <PortalNav />

      <h1 className="text-4xl font-bold mb-2">
        {programmeId}
      </h1>

      <p className="text-zinc-600 mb-8">
        {weekId}
      </p>

      <div className="grid gap-6 md:grid-cols-3">

        {workouts.map((workout) => (
          <div
            key={workout.title}
            className="bg-white rounded-2xl p-6 shadow"
          >
            <h2 className="text-2xl font-bold mb-2">
              {workout.title}
            </h2>

            <p className="text-zinc-600 mb-4">
              {workout.description}
            </p>

            <Link
  to={`/programme/${programmeId}/${weekId}/workout-a`}
  className="inline-block rounded-xl bg-emerald-700 px-4 py-2 text-white"
>
  Start Workout
</Link>

          </div>
        ))}

      </div>

    </div>
  );
}