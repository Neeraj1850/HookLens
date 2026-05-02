import { Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { Home } from './pages/Home'
import { Inspect } from './pages/Inspect'
import { AiStudio } from './pages/AiStudio'
import { NotFound } from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/ai-studio" element={<AiStudio />} />
      <Route path="/inspect/:chainId/:address" element={<Inspect />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
