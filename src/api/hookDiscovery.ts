import { getAddress, isAddress } from 'viem'
import { SUPPORTED_CHAINS, UNISWAP_V4_SUBGRAPH_IDS_BY_CHAIN } from '../config/constants'
import type { HookAddressCandidate, HookAddressDiscovery } from '../types/hook'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// 7-day and 30-day epoch timestamps (computed once per module load)
const SINCE_7D = Math.floor(Date.now() / 1000) - 7 * 86400
const SINCE_30D = Math.floor(Date.now() / 1000) - 30 * 86400

const HOOKS_BY_CHAIN_QUERY = `
  query HooksByChain($first: Int!, $skip: Int!, $since7d: Int!, $since30d: Int!) {
    pools(
      first: $first
      skip: $skip
      orderBy: txCount
      orderDirection: desc
      where: { hooks_not: "${ZERO_ADDRESS}" }
    ) {
      id
      hooks
      liquidity
      volumeUSD
      txCount
      feeTier
      token0 { symbol }
      token1 { symbol }
      poolDayData7d: poolDayData(
        first: 7
        orderBy: date
        orderDirection: desc
        where: { date_gte: $since7d }
      ) { volumeUSD txCount }
      poolDayData30d: poolDayData(
        first: 30
        orderBy: date
        orderDirection: desc
        where: { date_gte: $since30d }
      ) { volumeUSD txCount }
    }
  }
`

interface RawPool {
  id?: string
  hook?: string
  hooks?: string
  liquidity?: string
  volumeUSD?: string
  txCount?: string | number
  feeTier?: string | number
  token0?: { symbol?: string }
  token1?: { symbol?: string }
  poolDayData7d?: Array<{ volumeUSD?: string; txCount?: string | number }>
  poolDayData30d?: Array<{ volumeUSD?: string; txCount?: string | number }>
}

export async function discoverAllHookAddresses(
  chainIds?: number[],
): Promise<HookAddressDiscovery> {
  // Filter to chains that have a subgraph configured; also apply caller's selection if provided
  const configuredChains = SUPPORTED_CHAINS.filter(
    (chain) =>
      UNISWAP_V4_SUBGRAPH_IDS_BY_CHAIN[chain.id] &&
      (chainIds == null || chainIds.length === 0 || chainIds.includes(chain.id)),
  )
  debugSubgraph('discoverAllHookAddresses start', {
    supportedChains: SUPPORTED_CHAINS.map((chain) => ({
      id: chain.id,
      name: chain.name,
      configured: Boolean(UNISWAP_V4_SUBGRAPH_IDS_BY_CHAIN[chain.id]),
    })),
    configuredChains,
    requestedChainIds: chainIds,
  })

  const results = await Promise.allSettled(configuredChains.map(fetchChainHookAddresses))
  debugSubgraph('discoverAllHookAddresses settled results', results)

  const hooks = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  const errors = results.flatMap((result, index) =>
    result.status === 'rejected'
      ? [
          {
            chainId: configuredChains[index]!.id,
            message: result.reason instanceof Error ? result.reason.message : 'Query failed',
          },
        ]
      : [],
  )

  if (hooks.length === 0) {
    debugSubgraph('discoverAllHookAddresses no hooks found', {
      configuredChainCount: configuredChains.length,
      errors,
    })

    return {
      hooks: [],
      totalFound: 0,
      chainsQueried: configuredChains.length,
      source: 'none',
      errors,
      fetchedAt: Date.now(),
    }
  }

  const ranked = hooks.sort(
    (a, b) =>
      b.poolCount - a.poolCount ||
      b.txCount - a.txCount ||
      b.volumeUSD - a.volumeUSD,
  )
  debugSubgraph('discoverAllHookAddresses ranked hooks', ranked)

  return {
    hooks: ranked,
    totalFound: ranked.length,
    chainsQueried: configuredChains.length,
    source: 'subgraph',
    errors,
    fetchedAt: Date.now(),
  }
}

async function fetchChainHookAddresses(
  chain: (typeof SUPPORTED_CHAINS)[number],
): Promise<HookAddressCandidate[]> {
  const subgraphId = UNISWAP_V4_SUBGRAPH_IDS_BY_CHAIN[chain.id]
  if (!subgraphId) throw new Error(`No v4 subgraph configured for ${chain.name}`)

  const endpoint = getGraphEndpoint(subgraphId)
  debugSubgraph('HooksByChain request', {
    chainId: chain.id,
    chainName: chain.name,
    subgraphId,
    endpoint: maskGraphEndpoint(endpoint),
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: HOOKS_BY_CHAIN_QUERY,
      variables: { first: 100, skip: 0, since7d: SINCE_7D, since30d: SINCE_30D },
    }),
  })

  debugSubgraph('HooksByChain HTTP response', {
    chainId: chain.id,
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
  })

  if (!res.ok) throw new Error(`Subgraph error ${res.status}`)

  const json = (await res.json()) as {
    data?: { pools?: RawPool[] }
    errors?: { message?: string }[]
  }
  debugSubgraph('HooksByChain raw JSON', { chainId: chain.id, json })

  if (json.errors?.length) {
    debugSubgraph('HooksByChain GraphQL errors', {
      chainId: chain.id,
      errors: json.errors,
    })
    throw new Error(json.errors[0]?.message ?? 'GraphQL error')
  }

  const pools = json.data?.pools ?? []
  debugSubgraph('HooksByChain response sample', {
    chainId: chain.id,
    count: pools.length,
    sample: pools.slice(0, 5),
  })

  return summarizeHookPools(pools, chain)
}

function summarizeHookPools(
  pools: RawPool[],
  chain: (typeof SUPPORTED_CHAINS)[number],
): HookAddressCandidate[] {
  const byHook = new Map<string, HookAddressCandidate>()

  for (const pool of pools) {
    debugSubgraph('summarizeHookPools raw pool', { chainId: chain.id, pool })

    const rawHook = pool.hooks ?? pool.hook
    const hook = normalizeHook(rawHook)
    if (!hook) {
      debugSubgraph('summarizeHookPools dropped pool', {
        chainId: chain.id,
        poolId: pool.id,
        rawHook,
        reason: 'missing, zero, or invalid hook address',
      })
      continue
    }

    const txCount = Number(pool.txCount ?? 0)
    const volumeUSD = Number(pool.volumeUSD ?? 0)
    const feeTier = Number(pool.feeTier ?? 0)
    const pair = `${pool.token0?.symbol ?? '???'}/${pool.token1?.symbol ?? '???'}`

    // Aggregate poolDayData windows
    const txCount7d = (pool.poolDayData7d ?? []).reduce(
      (sum, d) => sum + Number(d.txCount ?? 0), 0,
    )
    const txCount30d = (pool.poolDayData30d ?? []).reduce(
      (sum, d) => sum + Number(d.txCount ?? 0), 0,
    )
    const volume7dUSD = (pool.poolDayData7d ?? []).reduce(
      (sum, d) => sum + parseFloat(String(d.volumeUSD ?? '0')), 0,
    )
    const volume30dUSD = (pool.poolDayData30d ?? []).reduce(
      (sum, d) => sum + parseFloat(String(d.volumeUSD ?? '0')), 0,
    )

    const current = byHook.get(hook)

    if (!current) {
      byHook.set(hook, {
        address: hook,
        chainId: chain.id,
        chainName: chain.name,
        poolCount: 1,
        txCount: Number.isFinite(txCount) ? txCount : 0,
        txCount7d,
        txCount30d,
        volumeUSD: Number.isFinite(volumeUSD) ? volumeUSD : 0,
        volume7dUSD,
        volume30dUSD,
        liquidity: pool.liquidity ?? '0',
        topPair: pair,
        topFeeTier: Number.isFinite(feeTier) ? feeTier : 0,
        source: 'subgraph',
        description: describeHook(pair, feeTier, chain.name),
        recentlyActive: txCount7d > 0,
      })
      continue
    }

    current.poolCount += 1
    const addTx = Number.isFinite(txCount) ? txCount : 0
    const addVol = Number.isFinite(volumeUSD) ? volumeUSD : 0
    current.txCount += addTx
    current.txCount7d += txCount7d
    current.txCount30d += txCount30d
    current.volumeUSD += addVol
    current.volume7dUSD += volume7dUSD
    current.volume30dUSD += volume30dUSD
    current.recentlyActive = current.recentlyActive || txCount7d > 0
    // Track the busiest pool pair as the representative for this hook
    if (addTx > 0 && txCount > (current.txCount - addTx)) {
      current.topPair = pair
      current.topFeeTier = feeTier
      current.description = describeHook(pair, feeTier, chain.name)
    }
  }

  return [...byHook.values()]
}

function getGraphEndpoint(subgraphId: string): string {
  const apiKey = String(import.meta.env.VITE_THEGRAPH_API_KEY ?? '').trim()
  if (!apiKey) {
    // The public gateway endpoint no longer accepts unauthenticated requests.
    // Add VITE_THEGRAPH_API_KEY to your .env file. Get a key at https://thegraph.com/studio
    throw new Error(
      'VITE_THEGRAPH_API_KEY is not set. Add it to your .env file to query the subgraph.',
    )
  }
  return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`
}

function debugSubgraph(label: string, payload: unknown): void {
  if (
    import.meta.env.DEV !== true &&
    import.meta.env.VITE_HOOKLENS_DEBUG_SUBGRAPH !== 'true'
  ) {
    return
  }
  console.info(`[HookLens subgraph] ${label}`, payload)
}

function maskGraphEndpoint(endpoint: string): string {
  return endpoint.replace(/\/api\/[^/]+\/subgraphs\//, '/api/<key>/subgraphs/')
}

function normalizeHook(hook: unknown): string | null {
  if (typeof hook !== 'string') return null
  const lower = hook.toLowerCase()
  if (!isAddress(lower)) return null
  if (lower === ZERO_ADDRESS) return null
  return getAddress(lower)
}

function describeHook(pair: string, feeTier: number, chainName: string): string {
  const fee = Number.isFinite(feeTier) && feeTier > 0 ? `${(feeTier / 10000).toFixed(2)}%` : 'custom'
  return `Discovered from indexed Uniswap v4 pool data on ${chainName}. Inspect before routing through the ${pair} ${fee} market.`
}
