import { Link } from "react-router-dom";

export default function PortalNav() {
  return (
    <div className="flex flex-wrap gap-3 mb-8">

      <Link
        to="/dashboard"
        className="px-4 py-2 rounded-xl bg-emerald-700 text-white"
      >
        Dashboard
      </Link>

      <Link
        to="/training"
        className="px-4 py-2 rounded-xl border"
      >
        Training
      </Link>

      <Link
        to="/nutrition"
        className="px-4 py-2 rounded-xl border"
      >
        Nutrition
      </Link>

      <Link
        to="/habits"
        className="px-4 py-2 rounded-xl border"
      >
        Habits
      </Link>

      <Link
        to="/progress"
        className="px-4 py-2 rounded-xl border"
      >
        Progress
      </Link>

    </div>
  );
}