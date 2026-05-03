import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AddressInput } from '../components/hook/AddressInput'
import { Layout } from '../components/layout/Layout'
import { useHookStore } from '../store/hookStore'

const EXAMPLE_HOOKS = [
  {
    address: '0xc3fa7acaadd1a3c06e7aa8c0de7c5d6e2b8f9a10',
    label: 'TWAP Oracle Hook',
    chain: 'Base',
    chainId: 8453,
    description: 'beforeSwap + afterSwap — price oracle',
  },
]

export function Home() {
  const navigate = useNavigate()
  const { history, setAddress, setChainId } = useHookStore()

  useEffect(() => {
    document.title = 'HookLens — Uniswap v4 Hook Inspector'
  }, [])

  const handleAddressClick = (address: string, chainId: number) => {
    setAddress(address)
    setChainId(chainId)
    navigate(`/inspect/${chainId}/${address}`)
  }

  return (
    <Layout>
      <div className="min-h-[calc(100vh-56px)] flex flex-col">

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-zinc-800 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-zinc-400">Uniswap v4 Hook Inspector</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-4 max-w-2xl leading-tight">
            Understand any v4 hook{' '}
            <span className="text-zinc-500">before you use it</span>
          </h1>

          <p className="text-base text-zinc-500 max-w-md mb-10 leading-relaxed">
            Paste a hook address to instantly decode its permission flags, compare swap economics
            via the Uniswap API, run a safety check, and find every pool using it.
          </p>

          <AddressInput />

          <div className="flex items-center gap-2 mt-8 flex-wrap justify-center">
            {[
              '14 callback flags',
              'Live quote comparison',
              'Source safety analysis',
              'Pool discovery',
            ].map((feature) => (
              <span
                key={feature}
                className="text-xs text-zinc-600 border border-zinc-900 px-3 py-1 rounded-full"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>

        <div className="border-t border-border px-6 py-8">
          <div className="max-w-2xl mx-auto">
            <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-5">
              What you get
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  label: 'Decode',
                  desc: 'Hook flags are read from the address itself — result is instant, no network call needed.',
                },
                {
                  label: 'Compare',
                  desc: 'Runs two quotes via the Uniswap Trading API: V4 hook-only vs best available market route.',
                },
                {
                  label: 'Verify',
                  desc: 'Fetches source from Sourcify and runs 12 deterministic security checks.',
                },
              ].map(({ label, desc }) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-zinc-300">{label}</span>
                  <p className="text-xs text-zinc-600 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border px-6 py-5">
          <div className="max-w-2xl mx-auto">
            <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-3">
              Try an example
            </p>
            <div className="flex flex-col gap-1">
              {EXAMPLE_HOOKS.map((item) => (
                <button
                  key={item.address}
                  onClick={() => handleAddressClick(item.address, item.chainId)}
                  className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg hover:bg-surface transition-colors text-left group border border-transparent hover:border-zinc-900"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs text-zinc-300 group-hover:text-white transition-colors font-medium">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-zinc-600">{item.description}</span>
                    <code className="font-mono text-[10px] text-zinc-700 truncate">
                      {item.address}
                    </code>
                  </span>
                  <span className="text-[10px] text-zinc-700 shrink-0 border border-zinc-800 px-2 py-0.5 rounded-md">
                    {item.chain}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className="border-t border-border px-6 py-5">
            <div className="max-w-2xl mx-auto">
              <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-3">Recent</p>
              <div className="flex flex-col gap-1">
                {history.map((item) => (
                  <button
                    key={`${item.chainId}-${item.address}`}
                    onClick={() => handleAddressClick(item.address, item.chainId)}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg hover:bg-surface transition-colors text-left group"
                  >
                    <code className="font-mono text-xs text-zinc-500 group-hover:text-white transition-colors truncate">
                      {item.address}
                    </code>
                    <span className="text-[10px] text-zinc-700 shrink-0">
                      Chain {item.chainId}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
