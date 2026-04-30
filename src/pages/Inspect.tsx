import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AddressInput } from '../components/hook/AddressInput'
import { HookInfoPanel } from '../components/hook/HookInfoPanel'
import { Layout } from '../components/layout/Layout'
import { SafetyScoreBadge } from '../components/safety/SafetyScoreBadge'
import { ApiKeyPanel } from '../components/settings/ApiKeyPanel'
import { ErrorState } from '../components/shared/ErrorState'
import { LoadingDots } from '../components/shared/LoadingDots'
import { useHookDecoder } from '../hooks/useHookDecoder'
import { useHookStore } from '../store/hookStore'
import { truncateAddress } from '../utils/address'

export function Inspect() {
  const { address, chainId } = useParams<{
    address: string
    chainId: string
  }>()
  const navigate = useNavigate()
  const { decode, isDecoding, decodeError, currentInspection } = useHookDecoder()
  const { setAddress, setChainId } = useHookStore()
  const safety = currentInspection?.safety

  useEffect(() => {
    document.title = address ? `${truncateAddress(address)} - HookLens` : 'HookLens - Inspect'

    if (address && chainId) {
      const parsedChain = parseInt(chainId, 10)
      setAddress(address)
      setChainId(parsedChain)
      void decode(address, parsedChain)
    }
  }, [address, chainId, decode, setAddress, setChainId])

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1.5 self-start"
          >
            Back
          </button>
          <div className="w-full max-w-xl">
            <AddressInput />
          </div>
        </div>

        {isDecoding && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <LoadingDots size="lg" />
              <span className="text-xs text-zinc-600">Decoding hook flags...</span>
            </div>
          </div>
        )}

        {decodeError && !isDecoding && (
          <ErrorState
            message={decodeError}
            onRetry={() => {
              if (address && chainId) void decode(address, parseInt(chainId, 10))
            }}
          />
        )}

        {currentInspection && !isDecoding && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <HookInfoPanel inspection={currentInspection} />
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-surface border border-border rounded-xl p-5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">
                  Quick Stats
                </p>
                <div className="flex flex-col gap-3">
                  {safety && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-zinc-600">Safety Score</span>
                      <SafetyScoreBadge score={safety.score} size="sm" />
                    </div>
                  )}
                  {[
                    ['Active Callbacks', currentInspection.decoded.totalActive.toString()],
                    ['Hook Category', currentInspection.decoded.category],
                    ['Chain ID', currentInspection.decoded.chainId.toString()],
                    ['Inspected', new Date(currentInspection.inspectedAt).toLocaleTimeString()],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <span className="text-xs text-zinc-600">{label}</span>
                      <span className="text-xs font-mono text-zinc-300 truncate">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface border border-border rounded-xl p-4">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">
                  How It Works
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  The Swap Impact panel calls the Uniswap Trading API twice - once with{' '}
                  <span className="font-mono text-zinc-400">V4_HOOKS_ONLY</span> and once with{' '}
                  <span className="font-mono text-zinc-400">V4_NO_HOOKS</span> - and shows the
                  economic difference. The delta IS what this hook does to a swap.
                </p>
              </div>

              <ApiKeyPanel />
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
