import { Routes, Route } from 'react-router-dom'
import WhatsAppButton from './components/WhatsAppButton'

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
import AdminCheckIns from "./pages/Admin/AdminCheckIns";
import AdminMeals from "./pages/Admin/AdminMeals";
import AdminBundles from "./pages/Admin/AdminBundles";
import AdminSessions from "./pages/Admin/AdminSessions";
import AdminRevenue from "./pages/Admin/AdminRevenue";
import AdminWins from "./pages/Admin/AdminWins";
import AdminCoachSession from "./pages/Admin/AdminCoachSession";
import AdminCalendar from "./pages/Admin/AdminCalendar";
import AdminProgressOverview from "./pages/Admin/AdminProgressOverview";
import AdminBroadcast from "./pages/Admin/AdminBroadcast";
import AdminForecast from "./pages/Admin/AdminForecast";
import NutritionGroceryList from "./pages/NutritionGroceryList";
import ClassLog from "./pages/ClassLog";
import Classes from "./pages/Classes";
import CheckIn from "./pages/CheckIn";
import Consultation from "./pages/Consultation";
import AIRunningPlan from "./pages/AIRunningPlan";
import CapabilityProgramme from "./pages/CapabilityProgramme";
import CapabilitySession   from "./pages/CapabilitySession";
import PrivacyPolicy from "./PrivacyPolicy";
import InPersonCoaching from "./pages/InPersonCoaching";
import CoachingOverview from "./pages/CoachingOverview";
import CoachingAbout from "./pages/CoachingAbout";
import CoachingPhilosophy from "./pages/CoachingPhilosophy";
import CoachingSupport from "./pages/CoachingSupport";
import CoachingBook from "./pages/CoachingBook";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import Bundles from "./pages/Bundles";
import BundleSuccess from "./pages/BundleSuccess";
import OnboardingProgramme from "./pages/OnboardingProgramme";
import AdminGroups from "./pages/Admin/AdminGroups";
import AdminGroupProfile from "./pages/Admin/AdminGroupProfile";
import AdminGroupCoachSession from "./pages/Admin/AdminGroupCoachSession";
import AdminImportClients from "./pages/Admin/AdminImportClients";
import AccountActivation from "./pages/AccountActivation";
import GymLanding from "./pages/GymLanding";
import MyWorkouts from "./pages/MyWorkouts";
import WorkoutBuilder from "./pages/WorkoutBuilder";
import MyWorkoutSession from "./pages/MyWorkoutSession";
import MyProgrammes from "./pages/MyProgrammes";
import ProgrammeBuilder from "./pages/ProgrammeBuilder";
import MyProgrammeView from "./pages/MyProgrammeView";
import Integrations from "./pages/Integrations";
import StravaCallback from "./pages/StravaCallback";
import AdminIntegrations from "./pages/Admin/AdminIntegrations";
import AdminNutrition from "./pages/Admin/AdminNutrition";
import AdminClientNutrition from "./pages/Admin/AdminClientNutrition";
import MyMealIdeas from "./pages/MyMealIdeas";
import Messages from "./pages/Messages";
import AdminMessages from "./pages/Admin/AdminMessages";

export default function App() {
  return (
    <>
    <WhatsAppButton />
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
      <Route path="/classes" element={<Classes />} />
      <Route path="/class/:classId" element={<ClassLog />} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/exercises" element={<AdminRoute><AdminExercises /></AdminRoute>} />
      <Route path="/admin/workouts" element={<AdminRoute><AdminWorkouts /></AdminRoute>} />
      <Route path="/admin/programmes" element={<AdminRoute><AdminProgrammes /></AdminRoute>} />
      <Route path="/admin/classes" element={<AdminRoute><AdminClasses /></AdminRoute>} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/onboarding/programme" element={<OnboardingProgramme />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/nutrition/calculator" element={<NutritionCalculator />} />
      <Route path="/admin/metrics" element={<AdminRoute><AdminMetrics /></AdminRoute>} />
      <Route path="/admin/clients" element={<AdminRoute><AdminClients /></AdminRoute>} />
      <Route path="/admin/clients/:uid" element={<AdminRoute><AdminClientProfile /></AdminRoute>} />
      <Route path="/admin/groups" element={<AdminRoute><AdminGroups /></AdminRoute>} />
      <Route path="/admin/groups/:groupId" element={<AdminRoute><AdminGroupProfile /></AdminRoute>} />
      <Route path="/admin/groups/:groupId/session/:workoutId" element={<AdminRoute><AdminGroupCoachSession /></AdminRoute>} />
      <Route path="/admin/consultations" element={<AdminRoute><AdminConsultations /></AdminRoute>} />
      <Route path="/admin/outreach" element={<AdminRoute><AdminOutreach /></AdminRoute>} />
      <Route path="/admin/waitlist" element={<AdminRoute><AdminWaitlist /></AdminRoute>} />
      <Route path="/admin/check-ins" element={<AdminRoute><AdminCheckIns /></AdminRoute>} />
      <Route path="/admin/meals" element={<AdminRoute><AdminMeals /></AdminRoute>} />
      <Route path="/admin/nutrition" element={<AdminRoute><AdminNutrition /></AdminRoute>} />
      <Route path="/admin/nutrition/:clientUid" element={<AdminRoute><AdminClientNutrition /></AdminRoute>} />
      <Route path="/meal-ideas" element={<MyMealIdeas />} />
      <Route path="/admin/bundles" element={<AdminRoute><AdminBundles /></AdminRoute>} />
      <Route path="/admin/sessions" element={<AdminRoute><AdminSessions /></AdminRoute>} />
      <Route path="/admin/revenue" element={<AdminRoute><AdminRevenue /></AdminRoute>} />
      <Route path="/admin/wins" element={<AdminRoute><AdminWins /></AdminRoute>} />
      <Route path="/admin/session/:clientUid/:programmeId/:workoutId" element={<AdminRoute><AdminCoachSession /></AdminRoute>} />
      <Route path="/admin/calendar" element={<AdminRoute><AdminCalendar /></AdminRoute>} />
      <Route path="/admin/progress" element={<AdminRoute><AdminProgressOverview /></AdminRoute>} />
      <Route path="/admin/broadcast" element={<AdminRoute><AdminBroadcast /></AdminRoute>} />
      <Route path="/admin/forecast" element={<AdminRoute><AdminForecast /></AdminRoute>} />
      <Route path="/nutrition/grocery-list" element={<NutritionGroceryList />} />
      <Route path="/check-in" element={<CheckIn />} />
      <Route path="/consultation" element={<Consultation />} />
      <Route path="/ai-running-plan" element={<AIRunningPlan />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/coaching" element={<CoachingOverview />} />
      <Route path="/coaching/about" element={<CoachingAbout />} />
      <Route path="/coaching/in-person" element={<InPersonCoaching />} />
      <Route path="/coaching/philosophy" element={<CoachingPhilosophy />} />
      <Route path="/coaching/support" element={<CoachingSupport />} />
      <Route path="/coaching/book" element={<CoachingBook />} />
      <Route path="/subscription/success" element={<SubscriptionSuccess />} />
      <Route path="/bundles" element={<Bundles />} />
      <Route path="/bundles/success" element={<BundleSuccess />} />
      <Route path="/activate/:token" element={<AccountActivation />} />
      <Route path="/start" element={<GymLanding />} />
      <Route path="/admin/import-clients" element={<AdminRoute><AdminImportClients /></AdminRoute>} />
      <Route path="/my-workouts" element={<MyWorkouts />} />
      <Route path="/my-workouts/new" element={<WorkoutBuilder />} />
      <Route path="/my-workouts/:workoutId/edit" element={<WorkoutBuilder />} />
      <Route path="/my-workouts/:workoutId" element={<MyWorkoutSession />} />
      <Route path="/my-programmes" element={<MyProgrammes />} />
      <Route path="/my-programmes/new" element={<ProgrammeBuilder />} />
      <Route path="/my-programmes/:programmeId/edit" element={<ProgrammeBuilder />} />
      <Route path="/my-programmes/:programmeId" element={<MyProgrammeView />} />
      <Route path="/integrations" element={<Integrations />} />
      <Route path="/strava/callback" element={<StravaCallback />} />
      <Route path="/admin/integrations" element={<AdminRoute><AdminIntegrations /></AdminRoute>} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/admin/messages" element={<AdminRoute><AdminMessages /></AdminRoute>} />
    </Routes>
    </>
  )
}
