import { Link, useParams } from "react-router-dom";
import PortalNav from "../components/PortalNav";

export default function Workout() {
  const { workoutId } = useParams();

  const exercises = [
    {
      name: "Goblet Squat",
      description: "Build lower body strength and stability.",
      lastSession: "20kg × 10",
    },
    {
      name: "Push Up",
      description: "Develop upper body strength and control.",
      lastSession: "8 reps",
    },
    {
      name: "Band Row",
      description: "Improve posture and upper back strength.",
      lastSession: "Green Band × 12",
    },
    {
      name: "Split Squat",
      description: "Build balance, stability and leg strength.",
      lastSession: "Bodyweight × 10",
    },
    {
      name: "Plank",
      description: "Develop core stability and endurance.",
      lastSession: "45 seconds",
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50 p-8">

      <PortalNav />

      <div className="mb-8">
        <h1 className="text-4xl font-bold capitalize">
          {workoutId?.replace("-", " ")}
        </h1>

        <p className="mt-2 text-zinc-600">
          Complete each exercise below.
        </p>

        <div className="mt-4 inline-block rounded-full bg-emerald-100 px-4 py-2 text-emerald-700 font-medium">
          Estimated Time: 35 Minutes
        </div>
      </div>

      <div className="space-y-6">

        {exercises.map((exercise) => (
          <div
            key={exercise.name}
            className="rounded-3xl bg-white p-6 shadow"
          >

            <h2 className="text-2xl font-bold">
              {exercise.name}
            </h2>

            <p className="mt-2 text-zinc-500">
              {exercise.description}
            </p>

            <div className="mt-4">
              <p className="text-sm text-zinc-500">
                Last Session
              </p>

              <p className="font-semibold">
                {exercise.lastSession}
              </p>
            </div>

            <Link
  to={`/exercise/${exercise.name.toLowerCase().replaceAll(" ", "-")}`}
  className="mt-6 block w-full rounded-2xl bg-emerald-700 py-4 text-center text-lg font-medium text-white"
>
  Start Exercise
</Link>

          </div>
        ))}

      </div>

    </div>
  );
}