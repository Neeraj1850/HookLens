import { decodeEventLog, getAddress, isAddress, parseAbiItem, type Hex } from 'viem'
import { UNISWAP_V4_SUBGRAPH_IDS_BY_CHAIN } from '../config/constants'
import type { HookPool, PoolDiscovery, PoolMarketComparison } from '../types/hook'

const POOL_MANAGER = '0x000000000004444c5dc75cb358380d2e3de08a90'
const INITIALIZE_TOPIC =
  '0x91ccaa7a278130b65168c3a0c8d3bcae84cf5e43704342bd3ec0b59e59c036db'
const INITIALIZE_EVENT = parseAbiItem(
  'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)',
)
const NATIVE_CURRENCY = '0x0000000000000000000000000000000000000000'

function daysAgoTimestamp(days: number): number {
  return Math.floor(Date.now() / 1000) - days * 86400
}

const POOLS_BY_HOOK_QUERY = `
  query PoolsByHook($hook: String!, $skip: Int!, $since7d: Int!, $since30d: Int!) {
    pools(
      first: 20
      skip: $skip
      where: { hooks: $hook }
      orderBy: liquidity
      orderDirection: desc
    ) {
      id
      liquidity
      sqrtPrice
      token0 { id symbol decimals }
      token1 { id symbol decimals }
      feeTier
      volumeUSD
      txCount
      hooks
      poolDayData7d: poolDayData(
        first: 7
        orderBy: date
        orderDirection: desc
        where: { date_gte: $since7d }
      ) { volumeUSD txCount date }
      poolDayData30d: poolDayData(
        first: 30
        orderBy: date
        orderDirection: desc
        where: { date_gte: $since30d }
      ) { volumeUSD txCount date }
    }
  }
`

const POOL_MARKET_COMPARISON_QUERY = `
  query PoolMarketComparison(
    $token0: String!
    $token1: String!
    $hook: String!
    $zeroHook: String!
  ) {
    hookPools: pools(
      first: 10
      where: {
        token0: $token0
        token1: $token1
        hooks: $hook
      }
      orderBy: liquidity
      orderDirection: desc
    ) {
      id
      liquidity
      sqrtPrice
      token0 { id symbol decimals }
      token1 { id symbol decimals }
      feeTier
      volumeUSD
      txCount
      hooks
    }
    noHookPools: pools(
      first: 10
      where: {
        token0: $token0
        token1: $token1
        hooks: $zeroHook
      }
      orderBy: liquidity
      orderDirection: desc
    ) {
      id
      liquidity
      sqrtPrice
      token0 { id symbol decimals }
      token1 { id symbol decimals }
      feeTier
      volumeUSD
      txCount
      hooks
    }
  }
`

interface RpcLog {
  data?: string
  topics?: string[]
  transactionHash?: string
}

async function fetchPoolsFromSubgraph(
  hookAddress: string,
  chainId: number,
): Promise<HookPool[]> {
  const subgraphId = UNISWAP_V4_SUBGRAPH_IDS_BY_CHAIN[chainId]
  if (!subgraphId) throw new Error(`No v4 subgraph configured for chain ${chainId}`)

  const endpoint = getGraphEndpoint(subgraphId)
  debugSubgraph('PoolsByHook request', {
    chainId,
    subgraphId,
    endpoint: maskGraphEndpoint(endpoint),
    hook: hookAddress.toLowerCase(),
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: POOLS_BY_HOOK_QUERY,
      variables: {
        hook: hookAddress.toLowerCase(),
        skip: 0,
        since7d: daysAgoTimestamp(7),
        since30d: daysAgoTimestamp(30),
      },
    }),
  })

  if (!res.ok) throw new Error(`Subgraph error ${res.status}`)

  const json = (await res.json()) as {
    data?: { pools?: Record<string, unknown>[] }
    errors?: { message?: string }[]
  }
  debugSubgraph('PoolsByHook raw JSON', { chainId, json })

  if (json.errors?.length) {
    debugSubgraph('PoolsByHook GraphQL errors', json.errors)
    throw new Error(json.errors[0]?.message ?? 'GraphQL error')
  }

  const pools = json.data?.pools ?? []
  debugSubgraph('PoolsByHook response sample', {
    chainId,
    count: pools.length,
    sample: pools.slice(0, 3),
  })

  return pools.map((pool) => mapSubgraphPool(pool, chainId))
}

function mapSubgraphPool(p: Record<string, unknown>, chainId: number): HookPool {
  const t0 = p.token0 as Record<string, unknown> | undefined
  const t1 = p.token1 as Record<string, unknown> | undefined

  const dayData7d = (p.poolDayData7d as Array<Record<string, unknown>> | undefined) ?? []
  const dayData30d = (p.poolDayData30d as Array<Record<string, unknown>> | undefined) ?? []

  const volume7dUSD = dayData7d
    .reduce((sum, d) => sum + parseFloat(String(d.volumeUSD ?? '0')), 0)
    .toFixed(2)
  const volume30dUSD = dayData30d
    .reduce((sum, d) => sum + parseFloat(String(d.volumeUSD ?? '0')), 0)
    .toFixed(2)
  const txCount7d = dayData7d.reduce((sum, d) => sum + Number(d.txCount ?? 0), 0)
  const txCount30d = dayData30d.reduce((sum, d) => sum + Number(d.txCount ?? 0), 0)

  return {
    id: String(p.id ?? ''),
    chainId,
    token0: {
      id: String(t0?.id ?? ''),
      symbol: normalizeTokenSymbol(String(t0?.id ?? ''), String(t0?.symbol ?? '???')),
      decimals: Number(t0?.decimals ?? 18),
    },
    token1: {
      id: String(t1?.id ?? ''),
      symbol: normalizeTokenSymbol(String(t1?.id ?? ''), String(t1?.symbol ?? '???')),
      decimals: Number(t1?.decimals ?? 18),
    },
    feeTier: Number(p.feeTier ?? 0),
    liquidity: String(p.liquidity ?? '0'),
    liquidityUSD: 0,
    volumeUSD: String(p.volumeUSD ?? '0'),
    txCount: Number(p.txCount ?? 0),
    volume7dUSD,
    volume30dUSD,
    txCount7d,
    txCount30d,
    recentlyActive: txCount7d > 0,
    hook: normalizeSubgraphHook(p.hooks ?? p.hook),
    source: 'subgraph',
  }
}

function normalizeSubgraphHook(hook: unknown): string {
  if (typeof hook !== 'string') return ''
  const lower = hook.toLowerCase()
  if (!isAddress(lower)) return hook
  return getAddress(lower)
}

async function fetchPoolsOnchain(hookAddress: string, chainId: number): Promise<HookPool[]> {
  const rpcUrl = getRpcUrl(chainId)
  const blockJson = await rpcRequest<{ result?: string }>(rpcUrl, {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_blockNumber',
    params: [],
  })

  if (!blockJson.result) throw new Error('eth_blockNumber failed')

  const latestBlock = parseInt(blockJson.result, 16)
  const fromBlock = Math.max(0, latestBlock - 50_000)
  const logsJson = await rpcRequest<{ result?: RpcLog[]; error?: { message?: string } }>(rpcUrl, {
    jsonrpc: '2.0',
    id: 2,
    method: 'eth_getLogs',
    params: [
      {
        address: POOL_MANAGER,
        topics: [INITIALIZE_TOPIC],
        fromBlock: `0x${fromBlock.toString(16)}`,
        toBlock: 'latest',
      },
    ],
  })

  if (logsJson.error) {
    throw new Error(logsJson.error.message ?? 'eth_getLogs failed')
  }

  const pools: HookPool[] = []
  const hookLower = hookAddress.toLowerCase()

  for (const log of logsJson.result ?? []) {
    const pool = mapInitializeLog(log, hookLower, chainId)
    if (pool) pools.push(pool)
  }

  return pools
}

async function rpcRequest<T>(rpcUrl: string, body: unknown): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`RPC error ${res.status}`)
  return res.json() as Promise<T>
}

function mapInitializeLog(log: RpcLog, hookLower: string, chainId: number): HookPool | null {
  if (!log.data || !log.topics || log.topics.length < 4) return null

  try {
    const decoded = decodeEventLog({
      abi: [INITIALIZE_EVENT],
      data: log.data as Hex,
      topics: log.topics as [Hex, ...Hex[]],
    })

    const args = decoded.args
    const hookFromLog = getAddress(args.hooks)
    if (hookFromLog.toLowerCase() !== hookLower) return null

    const currency0 = getAddress(args.currency0)
    const currency1 = getAddress(args.currency1)
    const fee = Number(args.fee)

    return {
      id: args.id ?? log.transactionHash ?? 'unknown',
      chainId,
      token0: {
        id: currency0,
        symbol: normalizeTokenSymbol(currency0, '???'),
        decimals: 18,
      },
      token1: {
        id: currency1,
        symbol: normalizeTokenSymbol(currency1, '???'),
        decimals: 18,
      },
      feeTier: Number.isFinite(fee) ? fee : 0,
      liquidity: '0',
      liquidityUSD: 0,
      volumeUSD: '0',
      txCount: 0,
      volume7dUSD: '0',
      volume30dUSD: '0',
      txCount7d: 0,
      txCount30d: 0,
      recentlyActive: false,
      hook: hookFromLog,
      source: 'onchain',
    }
  } catch {
    return null
  }
}

function normalizeTokenSymbol(address: string, symbol: string): string {
  return address.toLowerCase() === NATIVE_CURRENCY ? 'ETH' : symbol
}

function getRpcUrl(chainId: number): string {
  const alchemyKey = String(
    import.meta.env.VITE_ALCHEMY_API_KEY ?? import.meta.env.VITE_RPC_BASE ?? '',
  ).trim()

  const rpcs: Record<number, string> = {
    8453: alchemyKey
      ? `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`
      : 'https://mainnet.base.org',
    1: alchemyKey
      ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
      : 'https://eth.llamarpc.com',
    42161: 'https://arb1.arbitrum.io/rpc',
    10: 'https://mainnet.optimism.io',
    137: 'https://polygon-rpc.com',
  }

  return rpcs[chainId] ?? rpcs[8453]
}

function getGraphEndpoint(subgraphId: string): string {
  const apiKey = String(import.meta.env.VITE_THEGRAPH_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new Error(
      'VITE_THEGRAPH_API_KEY is not set. Add it to your .env file to query the subgraph.',
    )
  }
  return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`
}

function debugSubgraph(label: string, payload: unknown): void {
  if (import.meta.env.VITE_HOOKLENS_DEBUG_SUBGRAPH !== 'true') return
  console.info(`[HookLens subgraph] ${label}`, payload)
}

function maskGraphEndpoint(endpoint: string): string {
  return endpoint.replace(/\/api\/[^/]+\/subgraphs\//, '/api/<key>/subgraphs/')
}

export async function discoverPools(
  hookAddress: string,
  chainId: number,
): Promise<PoolDiscovery> {
  if (!isAddress(hookAddress)) {
    return {
      pools: [],
      totalFound: 0,
      source: 'none',
      error: 'Invalid hook address',
      fetchedAt: Date.now(),
    }
  }

  const checksummed = getAddress(hookAddress)

  try {
    const pools = await fetchPoolsFromSubgraph(checksummed, chainId)
    return {
      pools,
      totalFound: pools.length,
      source: 'subgraph',
      fetchedAt: Date.now(),
    }
  } catch (subgraphError) {
    try {
      const pools = await fetchPoolsOnchain(checksummed, chainId)
      return {
        pools,
        totalFound: pools.length,
        source: 'onchain',
        fetchedAt: Date.now(),
      }
    } catch (onchainErr) {
      return {
        pools: [],
        totalFound: 0,
        source: 'none',
        error:
          `Both subgraph and onchain lookup failed. Subgraph: ${formatError(subgraphError)}. Onchain: ${formatError(onchainErr)}`,
        fetchedAt: Date.now(),
      }
    }
  }
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown'
}

export async function comparePoolMarket(
  pool: HookPool,
  chainId: number,
): Promise<PoolMarketComparison> {
  const subgraphId = UNISWAP_V4_SUBGRAPH_IDS_BY_CHAIN[chainId]
  if (!subgraphId) {
    return {
      hookPools: [pool],
      noHookPools: [],
      totalHookPools: 1,
      totalNoHookPools: 0,
      source: 'none',
      error: `No v4 subgraph configured for chain ${chainId}`,
      fetchedAt: Date.now(),
    }
  }

  const endpoint = getGraphEndpoint(subgraphId)
  const variables = {
    token0: pool.token0.id.toLowerCase(),
    token1: pool.token1.id.toLowerCase(),
    hook: pool.hook.toLowerCase(),
    zeroHook: NATIVE_CURRENCY,
  }

  debugSubgraph('PoolMarketComparison request', {
    chainId,
    subgraphId,
    endpoint: maskGraphEndpoint(endpoint),
    variables,
  })

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: POOL_MARKET_COMPARISON_QUERY,
        variables,
      }),
    })

    if (!res.ok) throw new Error(`Subgraph error ${res.status}`)

    const json = (await res.json()) as {
      data?: {
        hookPools?: Record<string, unknown>[]
        noHookPools?: Record<string, unknown>[]
      }
      errors?: { message?: string }[]
    }
    debugSubgraph('PoolMarketComparison raw JSON', { chainId, json })

    if (json.errors?.length) {
      throw new Error(json.errors[0]?.message ?? 'GraphQL error')
    }

    const hookPools = (json.data?.hookPools ?? []).map((item) => mapSubgraphPool(item, chainId))
    const noHookPools = (json.data?.noHookPools ?? []).map((item) => mapSubgraphPool(item, chainId))

    return {
      hookPools,
      noHookPools,
      totalHookPools: hookPools.length,
      totalNoHookPools: noHookPools.length,
      source: 'subgraph',
      fetchedAt: Date.now(),
    }
  } catch (err) {
    return {
      hookPools: [pool],
      noHookPools: [],
      totalHookPools: 1,
      totalNoHookPools: 0,
      source: 'none',
      error: err instanceof Error ? err.message : 'Pool market comparison failed',
      fetchedAt: Date.now(),
    }
  }
}
