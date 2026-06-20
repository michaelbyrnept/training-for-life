import { Routes, Route } from 'react-router-dom'

import Home from './pages/Home'
import CapabilityScore from './pages/CapabilityScore'
import Register from './pages/Register'
import Login from './pages/Login'
import Dashboard from "./pages/Dashboard";
import Training from "./pages/Training";
import Nutrition from "./pages/Nutrition";
import Habits from "./pages/Habits";
import Progress from "./pages/Progress";
import Programme from "./pages/Programme";
import Week from "./pages/Week";
import Workout from "./pages/Workout";
import Exercise from "./pages/Exercise";
import AdminRoute from "./pages/Admin/AdminRoute";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminExercises from "./pages/Admin/AdminExercises";
import AdminWorkouts from "./pages/Admin/AdminWorkouts";
import AdminProgrammes from "./pages/Admin/AdminProgrammes";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import NutritionCalculator from "./pages/NutritionCalculator";
import AdminMetrics from "./pages/Admin/AdminMetrics";
import AdminClients from "./pages/Admin/AdminClients";
import AdminClientProfile from "./pages/Admin/AdminClientProfile";
import AdminClasses from "./pages/Admin/AdminClasses";
import AdminConsultations from "./pages/Admin/AdminConsultations";
import AdminOutreach from "./pages/Admin/AdminOutreach";
import AdminWaitlist from "./pages/Admin/AdminWaitlist";
import ClassLog from "./pages/ClassLog";
import CheckIn from "./pages/CheckIn";
import Consultation from "./pages/Consultation";
import AIRunningPlan from "./pages/AIRunningPlan";
import CapabilityProgramme from "./pages/CapabilityProgramme";
import CapabilitySession   from "./pages/CapabilitySession";
import PrivacyPolicy from "./PrivacyPolicy";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/capability-score" element={<CapabilityScore />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/training" element={<Training />} />
      <Route path="/nutrition" element={<Nutrition />} />
      <Route path="/habits" element={<Habits />} />
      <Route path="/progress" element={<Progress />} />
<Route path="/programme/capability-programme"              element={<CapabilityProgramme />} />
<Route path="/programme/capability-programme/:weekId/:day" element={<CapabilitySession />} />
<Route path="/programme/:id" element={<Programme />} />
<Route path="/programme/:programmeId/:weekId" element={<Week />} />
<Route path="/programme/:programmeId/:weekId/:workoutId" element={<Workout />} />
      <Route path="/exercise/:exerciseId" element={<Exercise />} />
      <Route path="/class/:classId" element={<ClassLog />} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/exercises" element={<AdminRoute><AdminExercises /></AdminRoute>} />
      <Route path="/admin/workouts" element={<AdminRoute><AdminWorkouts /></AdminRoute>} />
      <Route path="/admin/programmes" element={<AdminRoute><AdminProgrammes /></AdminRoute>} />
      <Route path="/admin/classes" element={<AdminRoute><AdminClasses /></AdminRoute>} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/nutrition/calculator" element={<NutritionCalculator />} />
      <Route path="/admin/metrics" element={<AdminRoute><AdminMetrics /></AdminRoute>} />
      <Route path="/admin/clients" element={<AdminRoute><AdminClients /></AdminRoute>} />
      <Route path="/admin/clients/:uid" element={<AdminRoute><AdminClientProfile /></AdminRoute>} />
      <Route path="/admin/consultations" element={<AdminRoute><AdminConsultations /></AdminRoute>} />
      <Route path="/admin/outreach" element={<AdminRoute><AdminOutreach /></AdminRoute>} />
      <Route path="/admin/waitlist" element={<AdminRoute><AdminWaitlist /></AdminRoute>} />
      <Route path="/check-in" element={<CheckIn />} />
      <Route path="/consultation" element={<Consultation />} />
      <Route path="/ai-running-plan" element={<AIRunningPlan />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />

    </Routes>
  )
}