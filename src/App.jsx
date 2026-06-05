import { Routes, Route } from 'react-router-dom'

import Home from './pages/Home'
import CapabilityScore from './pages/CapabilityScore'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route
        path="/capability-score"
        element={<CapabilityScore />}
      />
    </Routes>
  )
}