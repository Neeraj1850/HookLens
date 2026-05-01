import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AddressInput } from '../components/hook/AddressInput'
import { HookInfoPanel } from '../components/hook/HookInfoPanel'
import { Layout } from '../components/layout/Layout'
import { SafetyScoreBadge } from '../components/safety/SafetyScoreBadge'
import { ApiKeyPanel } from '../components/settings/ApiKeyPanel'
import { Card } from '../components/shared/Card'
import { ErrorState } from '../components/shared/ErrorState'
import { LoadingSkeleton } from '../components/shared/LoadingSkeleton'
import { ShareBar } from '../components/shared/ShareBar'
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
    document.title = address ? `${truncateAddress(address)} — HookLens` : 'HookLens — Inspect'

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
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1.5 self-start py-2"
          >
            Back
          </button>
          <div className="flex-1 w-full">
            <AddressInput />
          </div>
          <ShareBar />
        </div>

        {isDecoding && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <LoadingSkeleton className="h-36" lines={3} />
            </div>
            <LoadingSkeleton className="h-28" lines={3} />
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
            <div className="lg:col-span-2 flex flex-col gap-4">
              <HookInfoPanel inspection={currentInspection} />
            </div>

            <div className="flex flex-col gap-4">
              <Card>
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
              </Card>

              <Card>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">
                  How It Works
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  HookLens calls the Uniswap Trading API twice - once with{' '}
                  <span className="font-mono text-zinc-400">V4_HOOKS_ONLY</span> and once with{' '}
                  <span className="font-mono text-zinc-400">V4_NO_HOOKS</span> - and shows the
                  economic delta. Safety analysis fetches source from Sourcify. Pool discovery
                  queries the v4 subgraph.
                </p>
              </Card>

              <ApiKeyPanel />
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
