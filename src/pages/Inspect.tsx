import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AddressInput } from '../components/hook/AddressInput'
import { BitPatternDisplay } from '../components/hook/BitPatternDisplay'
import { CallbackFlags } from '../components/hook/CallbackFlags'
import { Layout } from '../components/layout/Layout'
import { PoolDiscoveryPanel } from '../components/pools/PoolDiscoveryPanel'
import { SafetyPanel } from '../components/safety/SafetyPanel'
import { SafetyScoreBadge } from '../components/safety/SafetyScoreBadge'

import { Badge } from '../components/shared/Badge'
import { Card } from '../components/shared/Card'
import { AccordionSection } from '../components/shared/AccordionSection'
import { ErrorState } from '../components/shared/ErrorState'
import { LoadingSkeleton } from '../components/shared/LoadingSkeleton'
import { ShareBar } from '../components/shared/ShareBar'
import { SUPPORTED_CHAINS } from '../config/constants'
import { useHookDecoder } from '../hooks/useHookDecoder'
import { useHookStore } from '../store/hookStore'
import { truncateAddress } from '../utils/address'

function badgeForScore(score: number): 'active' | 'muted' {
  return score >= 7 ? 'active' : 'muted'
}

/** Numbered step indicator for the sidebar guide */
function StepItem({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-5 h-5 rounded-full border border-zinc-800 text-[10px] text-zinc-600 flex items-center justify-center shrink-0 mt-0.5">
        {num}
      </span>
      <p className="text-xs text-zinc-500 leading-relaxed">{text}</p>
    </div>
  )
}

export function Inspect() {
  const { address, chainId } = useParams<{
    address: string
    chainId: string
  }>()
  const navigate = useNavigate()
  const { decode, isDecoding, decodeError, currentInspection } = useHookDecoder()
  const {
    setAddress,
    setChainId,
    poolDiscovery,
  } = useHookStore()
  const safety = currentInspection?.safety
  const decoded = currentInspection?.decoded
  const chain = decoded ? SUPPORTED_CHAINS.find((item) => item.id === decoded.chainId) : null
  const chainName = chain?.name ?? (decoded ? `Chain ${decoded.chainId}` : 'Unknown chain')

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
      {/* Hook header bar */}
      <div className="border-b border-[#1c1c1c] bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between gap-6">
            <div className="flex flex-col gap-3 min-w-0">
              <button
                onClick={() => navigate('/')}
                className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors self-start flex items-center gap-1"
              >
                ← Back
              </button>

              {decoded ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge text={decoded.category} variant="active" />
                    <Badge text={chainName} variant="outline" />
                    <Badge text={`${decoded.totalActive}/14 callbacks`} variant="muted" />
                  </div>
                  <p className="font-mono text-xs text-zinc-500 break-all">{decoded.address}</p>
                  <BitPatternDisplay address={decoded.address} />
                </>
              ) : (
                <LoadingSkeleton className="h-20" lines={3} />
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {safety && <SafetyScoreBadge score={safety.score} size="sm" />}
              <ShareBar />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Address input for switching hooks */}
        <div className="mb-6">
          <AddressInput />
        </div>

        {isDecoding && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <LoadingSkeleton className="h-36" lines={4} />
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

        {currentInspection && decoded && !isDecoding && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

            {/* Main panels */}
            <div className="flex flex-col gap-3">
              <AccordionSection
                id="callbacks"
                title="Callback Flags"
                defaultOpen
                badge={`${decoded.totalActive} active`}
                badgeVariant={decoded.totalActive > 0 ? 'active' : 'muted'}
              >
                <CallbackFlags flags={decoded.flags} activeCallbacks={decoded.activeCallbacks} />
              </AccordionSection>


              <AccordionSection
                id="pools"
                title="Pools Using This Hook"
                badge={poolDiscovery ? `${poolDiscovery.totalFound} found` : 'Not searched'}
                badgeVariant={poolDiscovery?.totalFound ? 'active' : 'muted'}
              >
                <PoolDiscoveryPanel />
              </AccordionSection>

              <AccordionSection
                id="safety"
                title="Safety Analysis"
                badge={safety ? `${safety.score.toFixed(1)}/10` : 'Not run'}
                badgeVariant={safety ? badgeForScore(safety.score) : 'muted'}
              >
                <SafetyPanel />
              </AccordionSection>
            </div>

            {/* Sticky sidebar */}
            <aside className="flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
              {/* Quick stats */}
              <Card>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">
                  Quick Stats
                </p>
                <div className="flex flex-col gap-3">
                  {[
                    ['Active Callbacks', decoded.totalActive.toString()],
                    ['Category', decoded.category],
                    ['Chain', chainName],
                    [
                      'Inspected',
                      new Date(currentInspection.inspectedAt).toLocaleTimeString(),
                    ],
                    [
                      'Pools Found',
                      poolDiscovery?.totalFound.toString() ?? '—',
                    ],
                    [
                      'Safety Score',
                      safety ? `${safety.score.toFixed(1)}/10` : '—',
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <span className="text-xs text-zinc-600">{label}</span>
                      <span className="text-xs font-mono text-zinc-300 truncate text-right">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Workflow guide */}
              <Card>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">
                  Suggested Workflow
                </p>
                <div className="flex flex-col gap-3">
                  <StepItem
                    num={1}
                    text="Review the callback flags to understand which lifecycle events this hook intercepts."
                  />
                  <StepItem
                    num={2}
                    text="Find pools to discover which token pairs are live on this hook."
                  />
                  <StepItem
                    num={3}
                    text="Run Safety Analysis to check for reentrancy, selfdestruct, tx.origin, and access control issues."
                  />
                  <StepItem
                    num={4}
                    text="Head to AI Studio → Agentic Swap Simulator for a live quote comparison and AI-powered routing decision."
                  />
                </div>
              </Card>

              {/* Data sources */}
              <Card>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">
                  Data Sources
                </p>
                <div className="flex flex-col gap-3">
                  {[
                    {
                      key: 'VITE_THEGRAPH_API_KEY',
                      label: 'The Graph',
                      desc: 'Pool discovery',
                    },
                    {
                      key: 'sourcify.dev',
                      label: 'Sourcify',
                      desc: 'Safety analysis',
                    },
                    {
                      key: 'AI Studio',
                      label: 'Trading API',
                      desc: 'Quote comparison (in AI Studio)',
                    },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-zinc-400">{label}</span>
                        <code className="text-[9px] font-mono text-zinc-700 truncate">{key}</code>
                      </div>
                      <p className="text-[10px] text-zinc-700">{desc}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </aside>
          </div>
        )}
      </div>
    </Layout>
  )
}
