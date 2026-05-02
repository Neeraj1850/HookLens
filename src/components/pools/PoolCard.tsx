import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHookStore } from '../../store/hookStore'
import { comparePoolMarket } from '../../api/poolDiscovery'
import type { HookPool, PoolMarketComparison } from '../../types/hook'
import { formatUSD } from '../../utils/format'
import { LoadingSkeleton } from '../shared/LoadingSkeleton'

interface PoolCardProps {
  pool: HookPool
  chainId: number
}

function formatFee(feeTier: number): string {
  return `${(feeTier / 10000).toFixed(2)}%`
}

function formatLiquidity(liquidity: string): string {
  const n = parseFloat(liquidity)
  if (Number.isNaN(n) || n === 0) return '—'
  if (n >= 1e18) return `${(n / 1e18).toFixed(1)}T`
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}B`
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}M`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}K`
  return n.toFixed(0)
}

function formatVolume(usd: string): string {
  const n = parseFloat(usd)
  if (Number.isNaN(n) || n === 0) return '—'
  return formatUSD(n)
}

/** Pool bucket for the market comparison section */
function PoolBucket({
  label,
  accentClass,
  pools,
}: {
  label: string
  accentClass: string
  pools: HookPool[]
}) {
  return (
    <div className="rounded-xl border border-zinc-900 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] uppercase tracking-widest ${accentClass}`}>{label}</span>
        <span className="text-[10px] text-zinc-700">{pools.length} pool{pools.length !== 1 ? 's' : ''}</span>
      </div>

      {pools.length === 0 ? (
        <p className="text-[10px] text-zinc-700 leading-relaxed">No pools found for this pair.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {pools.slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-lg bg-zinc-950/60 border border-zinc-900 px-3 py-2 grid grid-cols-3 gap-2">
              <div>
                <span className="block text-[9px] text-zinc-700">Pair</span>
                <span className="block text-[10px] font-mono text-zinc-400 truncate">
                  {item.token0.symbol}/{item.token1.symbol}
                </span>
              </div>
              <div>
                <span className="block text-[9px] text-zinc-700">Fee</span>
                <span className="block text-[10px] font-mono text-zinc-500">{formatFee(item.feeTier)}</span>
              </div>
              <div>
                <span className="block text-[9px] text-zinc-700">Vol (all)</span>
                <span className="block text-[10px] font-mono text-zinc-500 truncate">{formatVolume(item.volumeUSD)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PoolCard({ pool, chainId }: PoolCardProps) {
  const setSimTokensFromPool = useHookStore((state) => state.setSimTokensFromPool)
  const [expanded, setExpanded] = useState(false)
  const [comparison, setComparison] = useState<PoolMarketComparison | null>(null)
  const [loadingComp, setLoadingComp] = useState(false)

  const quoteChainId = pool.chainId || chainId

  // Fetch market comparison when expanded
  useEffect(() => {
    if (!expanded || comparison) return
    let cancelled = false
    setLoadingComp(true)
    comparePoolMarket(pool, quoteChainId).then((result) => {
      if (!cancelled) {
        setComparison(result)
        setLoadingComp(false)
      }
    }).catch(() => { if (!cancelled) setLoadingComp(false) })
    return () => { cancelled = true }
  }, [expanded, pool, quoteChainId, comparison])

  const handleUseInSimulator = () => {
    setSimTokensFromPool(pool.token0, pool.token1, quoteChainId)
  }

  const hasVol7d = parseFloat(pool.volume7dUSD) > 0
  const hasVol30d = parseFloat(pool.volume30dUSD) > 0

  return (
    <div className="flex flex-col gap-3 py-4 border-b border-[#141414] last:border-b-0">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-white truncate">
            {pool.token0.symbol}/{pool.token1.symbol}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-zinc-800 text-zinc-500 shrink-0">
            {formatFee(pool.feeTier)}
          </span>
          {/* Recently active badge */}
          {pool.recentlyActive && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-900/30 border border-emerald-800/50 text-emerald-400 shrink-0 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Active 7d
            </span>
          )}
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-800 text-zinc-600 shrink-0">
          {pool.source}
        </span>
      </div>

      {/* Primary metrics grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Liquidity', formatLiquidity(pool.liquidity)],
          ['Vol (all)', pool.volumeUSD !== '0' ? formatVolume(pool.volumeUSD) : '—'],
          ['Txns (all)', pool.txCount > 0 ? pool.txCount.toLocaleString() : '—'],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-600">{label}</span>
            <span className="text-xs font-mono text-zinc-300 truncate">{value}</span>
          </div>
        ))}
      </div>

      {/* 7d / 30d metrics row — only shown for subgraph pools */}
      {pool.source === 'subgraph' && (hasVol7d || hasVol30d || pool.txCount7d > 0 || pool.txCount30d > 0) && (
        <div className="grid grid-cols-4 gap-2 border-t border-zinc-900/60 pt-2">
          {[
            ['Vol 7d', formatVolume(pool.volume7dUSD)],
            ['Vol 30d', formatVolume(pool.volume30dUSD)],
            ['Txns 7d', pool.txCount7d > 0 ? pool.txCount7d.toLocaleString() : '—'],
            ['Txns 30d', pool.txCount30d > 0 ? pool.txCount30d.toLocaleString() : '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[9px] text-zinc-700 uppercase tracking-wide">{label}</span>
              <span className={`text-[11px] font-mono truncate ${
                label.includes('7d') && value !== '—' ? 'text-emerald-400/80' : 'text-zinc-500'
              }`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] font-mono text-zinc-800 truncate">{pool.id}</div>

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] text-zinc-600 hover:text-zinc-300 border border-zinc-900 hover:border-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          {expanded ? '↑ Hide comparison' : '↓ Pool market comparison'}
        </button>
        <Link
          to="/ai-studio"
          onClick={handleUseInSimulator}
          className="text-[10px] text-zinc-600 hover:text-white border border-zinc-900 hover:border-zinc-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <span className="text-yellow-400/80">✦</span>
          Simulate in AI Studio →
        </Link>
      </div>

      {/* Pool market comparison: hook pools vs no-hook pools for same pair */}
      {expanded && (
        <div className="flex flex-col gap-2 pt-1">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
            Same-Pair Pool Comparison
          </span>
          <p className="text-[10px] text-zinc-700 leading-relaxed">
            Pools with this exact hook vs. pools without any hook for the{' '}
            <span className="font-mono text-zinc-500">{pool.token0.symbol}/{pool.token1.symbol}</span> pair.
          </p>

          {loadingComp && <LoadingSkeleton className="h-20" lines={2} />}

          {comparison && !loadingComp && (
            <>
              {comparison.error && (
                <p className="text-[10px] text-zinc-600 border border-zinc-900 rounded-xl px-3 py-2">
                  {comparison.error}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <PoolBucket
                  label="With This Hook"
                  accentClass="text-violet-400"
                  pools={comparison.hookPools}
                />
                <PoolBucket
                  label="No Hook"
                  accentClass="text-zinc-500"
                  pools={comparison.noHookPools}
                />
              </div>
              <p className="text-[9px] text-zinc-800 font-mono">
                source: {comparison.source} · {new Date(comparison.fetchedAt).toLocaleTimeString()}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
