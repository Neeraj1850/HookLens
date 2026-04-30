import { Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { Inspect } from './pages/Inspect'
import { NotFound } from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/inspect/:chainId/:address" element={<Inspect />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
