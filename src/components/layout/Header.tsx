import { Link, useLocation } from 'react-router-dom'

export function Header() {
  const { pathname } = useLocation()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-black/90 border-b border-border backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-black font-bold text-sm group-hover:bg-zinc-200 transition-colors">
            ⬡
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">HookLens</span>
          <span className="text-xs text-zinc-600 hidden sm:block">v4 Hook Inspector</span>
        </Link>

        <nav className="flex items-center gap-1">
          {[
            { path: '/', label: 'Inspect' },
            { path: '/about', label: 'About' },
          ].map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                pathname === path
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
