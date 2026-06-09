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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route
        path="/capability-score"
        element={<CapabilityScore />}
      />

      <Route
        path="/register"
        element={<Register />}
      />
      <Route
  path="/login"
  element={<Login />}
/>
<Route
  path="/dashboard"
  element={<Dashboard />}
/>
<Route
  path="/training"
  element={<Training />}
/>

<Route
  path="/nutrition"
  element={<Nutrition />}
/>

<Route
  path="/habits"
  element={<Habits />}
/>

<Route
  path="/progress"
  element={<Progress />}
/>
<Route
  path="/programme/:id"
  element={<Programme />}
/>
<Route
  path="/programme/:programmeId/:weekId"
  element={<Week />}
/>
<Route
  path="/programme/:programmeId/:weekId/:workoutId"
  element={<Workout />}
 />
 <Route
  path="/exercise/:exerciseId"
  element={<Exercise />}
/>
    </Routes>
    
  )
}