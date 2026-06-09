
import PortalNav from "../components/PortalNav";
import { Link, useParams } from "react-router-dom";

export default function Programme() {
  const { id } = useParams();

  const weeks = [
    {
      title: "Week 1",
      status: "Available",
    },
    {
      title: "Week 2",
      status: "Locked",
    },
    {
      title: "Week 3",
      status: "Locked",
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50 p-8">
      <PortalNav />

      <h1 className="text-4xl font-bold mb-2">
        {id}
      </h1>

      <p className="text-zinc-600 mb-8">
        Programme details will appear here.
      </p>

      <div className="grid gap-6 md:grid-cols-3">
        {weeks.map((week) => (
          <div
            key={week.title}
            className="bg-white rounded-2xl p-6 shadow"
          >
            <h2 className="text-2xl font-bold mb-2">
              {week.title}
            </h2>

            <p className="text-zinc-500 mb-4">
              {week.status}
            </p>

            <Link
  to={`/programme/${id}/week-1`}
  className="inline-block rounded-xl bg-emerald-700 px-4 py-2 text-white"
>
  View Week
</Link>
          </div>
        ))}
      </div>
    </div>
  );
}