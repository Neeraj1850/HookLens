import type { HookPool } from '../../types/hook'
import { formatUSD } from '../../utils/format'

interface PoolCardProps {
  pool: HookPool
}

function formatFee(feeTier: number): string {
  return `${(feeTier / 10000).toFixed(2)}%`
}

function formatLiquidity(liquidity: string): string {
  const n = parseFloat(liquidity)
  if (Number.isNaN(n) || n === 0) return '-'
  if (n >= 1e18) return `${(n / 1e18).toFixed(1)}T`
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}B`
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}M`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}K`
  return n.toFixed(0)
}

export function PoolCard({ pool }: PoolCardProps) {
  return (
    <div className="flex flex-col gap-3 py-4 border-b border-[#141414] last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-white truncate">
            {pool.token0.symbol}/{pool.token1.symbol}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-zinc-800 text-zinc-500 shrink-0">
            {formatFee(pool.feeTier)}
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-800 text-zinc-600 shrink-0">
          {pool.source}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          ['Liquidity', formatLiquidity(pool.liquidity)],
          ['Volume', pool.volumeUSD !== '0' ? formatUSD(parseFloat(pool.volumeUSD)) : '-'],
          ['Txns', pool.txCount > 0 ? pool.txCount.toLocaleString() : '-'],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-600">{label}</span>
            <span className="text-xs font-mono text-zinc-300 truncate">{value}</span>
          </div>
        ))}
      </div>

      <div className="text-[10px] font-mono text-zinc-800 truncate">{pool.id}</div>
    </div>
  )
}
