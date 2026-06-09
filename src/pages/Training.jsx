import PortalNav from "../components/PortalNav";
import { Link } from "react-router-dom";

export default function Training() {
  const programmes = [
  {
    id: "at-home-strength",
    title: "At Home Strength",
    description: "Build strength from home with minimal equipment."
  },
  {
    id: "longevity-mobility",
    title: "Longevity Mobility",
    description: "Improve movement quality and joint health."
  },
  {
    id: "walking-programme",
    title: "30 Day Walking Programme",
    description: "Build your fitness and confidence through walking."
  },
  {
    id: "beginner-strength",
    title: "Beginner Full Body Strength",
    description: "A simple introduction to strength training."
  }
];

  return (
    <div className="min-h-screen bg-stone-50 p-8">

      <PortalNav />

      <h1 className="text-4xl font-bold mb-2">
        Training
      </h1>

      <p className="text-zinc-600 mb-8">
        Choose a programme and start building capability.
      </p>

      <div className="grid gap-6 md:grid-cols-2">

        {programmes.map((programme) => (
          <div
            key={programme.title}
            className="bg-white rounded-2xl p-6 shadow"
          >
            <h2 className="text-2xl font-bold mb-2">
              {programme.title}
            </h2>

            <p className="text-zinc-600 mb-4">
              {programme.description}
            </p>

          <Link
  to={`/programme/${programme.id}`}
  className="inline-block rounded-xl bg-emerald-700 px-5 py-3 text-white"
>
  View Programme
</Link>
          </div>
        ))}

      </div>

    </div>
  );
}