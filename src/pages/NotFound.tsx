import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'

export function NotFound() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = '404 — HookLens'
  }, [])

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] gap-6">
        <span className="text-7xl font-mono text-zinc-800">404</span>
        <p className="text-sm text-zinc-500">Page not found</p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
        >
          Back to Inspector
        </button>
      </div>
    </Layout>
  )
}
