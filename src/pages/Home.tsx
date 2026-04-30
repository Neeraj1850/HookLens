import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AddressInput } from '../components/hook/AddressInput'
import { Layout } from '../components/layout/Layout'
import { ApiKeyPanel } from '../components/settings/ApiKeyPanel'
import { useHookStore } from '../store/hookStore'

const EXAMPLE_HOOKS = [
  {
    address: '0x5eCa32E21A49c85B14E0AB4d4d7E7bCfA92f7A2D',
    label: 'Dynamic Fee Hook',
    chain: 'Base',
    chainId: 8453,
  },
  {
    address: '0xc3Fa7acaadD1A3C06E7aA8c0dE7c5d6e2B8F9a10',
    label: 'TWAP Oracle Hook',
    chain: 'Base',
    chainId: 8453,
  },
]

export function Home() {
  const navigate = useNavigate()
  const { history, setAddress, setChainId } = useHookStore()

  useEffect(() => {
    document.title = 'HookLens - Uniswap v4 Hook Inspector'
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
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-xs text-zinc-400">Uniswap v4 Hook Inspector</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-4 max-w-2xl">
            Understand any v4 hook <span className="text-zinc-500">before you use it</span>
          </h1>

          <p className="text-base text-zinc-500 max-w-lg mb-10 leading-relaxed">
            Paste a hook address. See exactly which callbacks it activates, how it changes swap
            economics via the Uniswap API, and whether it is safe to use.
          </p>

          <AddressInput />

          <div className="w-full max-w-2xl mt-8 text-left">
            <ApiKeyPanel />
          </div>

          <div className="flex items-center gap-3 mt-8 flex-wrap justify-center">
            {[
              '14 callback flags decoded',
              'Live swap impact via Uniswap API',
              'Static safety analysis',
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

        <div className="border-t border-border px-6 py-6">
          <div className="max-w-2xl mx-auto">
            <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-3">
              Example Hooks
            </p>
            <div className="flex flex-col gap-1">
              {EXAMPLE_HOOKS.map((item) => (
                <button
                  key={item.address}
                  onClick={() => handleAddressClick(item.address, item.chainId)}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg hover:bg-surface transition-colors text-left group"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs text-zinc-400 group-hover:text-white transition-colors">
                      {item.label}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-700 truncate">
                      {item.address}
                    </span>
                  </span>
                  <span className="text-[10px] text-zinc-700 shrink-0">{item.chain}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className="border-t border-border px-6 py-6">
            <div className="max-w-2xl mx-auto">
              <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-3">Recent</p>
              <div className="flex flex-col gap-1">
                {history.map((item) => (
                  <button
                    key={`${item.chainId}-${item.address}`}
                    onClick={() => handleAddressClick(item.address, item.chainId)}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg hover:bg-surface transition-colors text-left group"
                  >
                    <span className="font-mono text-xs text-zinc-400 group-hover:text-white transition-colors truncate">
                      {item.address}
                    </span>
                    <span className="text-[10px] text-zinc-700 shrink-0">Chain {item.chainId}</span>
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
