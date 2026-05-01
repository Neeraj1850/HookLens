import { usePoolDiscovery } from '../../hooks/usePoolDiscovery'
import { EmptyState } from '../shared/EmptyState'
import { LoadingSkeleton } from '../shared/LoadingSkeleton'
import { PoolCard } from './PoolCard'

export function PoolDiscoveryPanel() {
  const { poolDiscovery, isFetchingPools, poolFetchError, fetchPools } = usePoolDiscovery()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
            Pools Using This Hook
          </span>
          <p className="text-xs text-zinc-500">
            Via Uniswap v4 subgraph | onchain fallback
          </p>
        </div>
        {!poolDiscovery && (
          <button
            onClick={fetchPools}
            disabled={isFetchingPools}
            className="px-4 py-2 rounded-xl bg-white text-black text-xs font-medium hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors self-start sm:self-auto"
          >
            {isFetchingPools ? 'Searching...' : 'Find Pools ->'}
          </button>
        )}
      </div>

      {isFetchingPools && (
        <div className="flex flex-col gap-3 py-4">
          <LoadingSkeleton className="h-16" lines={2} />
          <p className="text-xs text-zinc-600">
            Querying the v4 subgraph, then searching PoolManager logs if needed...
          </p>
        </div>
      )}

      {poolFetchError && !isFetchingPools && (
        <div className="border border-zinc-800 rounded-xl px-4 py-3">
          <p className="text-xs text-zinc-500">{poolFetchError}</p>
          <button
            onClick={fetchPools}
            className="text-xs text-zinc-600 hover:text-white transition-colors mt-2 underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      {poolDiscovery && !isFetchingPools && (
        <div className="flex flex-col gap-0 animate-slide-up">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#141414]">
            <span className="text-xs text-zinc-500">
              {poolDiscovery.totalFound === 0
                ? 'No pools found'
                : `${poolDiscovery.totalFound} pool${poolDiscovery.totalFound !== 1 ? 's' : ''} found`}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-700 font-mono">
                source: {poolDiscovery.source}
              </span>
              <button
                onClick={fetchPools}
                className="text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors underline underline-offset-2"
              >
                refresh
              </button>
            </div>
          </div>

          {poolDiscovery.pools.length === 0 ? (
            <EmptyState
              title="No pools found for this hook"
              description={
                poolDiscovery.source === 'subgraph'
                  ? 'No v4 pools using this hook address were found in the subgraph'
                  : 'No Initialize events found in the last 50,000 blocks for this hook'
              }
            />
          ) : (
            <div>
              {poolDiscovery.pools.map((pool) => (
                <PoolCard key={pool.id} pool={pool} />
              ))}
            </div>
          )}
        </div>
      )}

      {!poolDiscovery && !isFetchingPools && !poolFetchError && (
        <EmptyState
          title="Search for pools using this hook"
          description="Queries the Uniswap v4 subgraph and falls back to onchain logs"
        />
      )}
    </div>
  )
}
