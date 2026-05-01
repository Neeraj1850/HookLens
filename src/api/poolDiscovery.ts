import { getAddress, isAddress } from 'viem'
import type { HookPool, PoolDiscovery } from '../types/hook'

const POOL_MANAGER = '0x000000000004444c5dc75cb358380d2e3de08a90'
const V4_SUBGRAPH_ID = 'DiYPVdygkfjDWhbxGSqAQxwBKmfKnkWQojqeM2rkLb3G'
const V4_SUBGRAPH_ENDPOINT = `https://gateway.thegraph.com/api/subgraphs/id/${V4_SUBGRAPH_ID}`
const INITIALIZE_TOPIC =
  '0x91ccaa7a278130b65168c3a0c8d3bcae84cf5e43704342bd3ec0b59e59c036db'

const POOLS_BY_HOOK_QUERY = `
  query PoolsByHook($hook: String!, $skip: Int!) {
    pools(
      first: 20
      skip: $skip
      where: { hook: $hook }
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
      hook
    }
  }
`

interface RpcLog {
  data?: string
  topics?: string[]
  transactionHash?: string
}

async function fetchPoolsFromSubgraph(hookAddress: string): Promise<HookPool[]> {
  const apiKey =
    getStorageValue('hooklens_thegraph_key') ?? import.meta.env.VITE_THEGRAPH_API_KEY
  const endpoint = apiKey
    ? `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${V4_SUBGRAPH_ID}`
    : V4_SUBGRAPH_ENDPOINT

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: POOLS_BY_HOOK_QUERY,
      variables: {
        hook: hookAddress.toLowerCase(),
        skip: 0,
      },
    }),
  })

  if (!res.ok) throw new Error(`Subgraph error ${res.status}`)

  const json = (await res.json()) as {
    data?: { pools?: Record<string, unknown>[] }
    errors?: { message?: string }[]
  }

  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? 'GraphQL error')
  }

  return (json.data?.pools ?? []).map(mapSubgraphPool)
}

function mapSubgraphPool(p: Record<string, unknown>): HookPool {
  const t0 = p.token0 as Record<string, unknown> | undefined
  const t1 = p.token1 as Record<string, unknown> | undefined

  return {
    id: String(p.id ?? ''),
    token0: {
      id: String(t0?.id ?? ''),
      symbol: String(t0?.symbol ?? '???'),
      decimals: Number(t0?.decimals ?? 18),
    },
    token1: {
      id: String(t1?.id ?? ''),
      symbol: String(t1?.symbol ?? '???'),
      decimals: Number(t1?.decimals ?? 18),
    },
    feeTier: Number(p.feeTier ?? 0),
    liquidity: String(p.liquidity ?? '0'),
    liquidityUSD: 0,
    volumeUSD: String(p.volumeUSD ?? '0'),
    txCount: Number(p.txCount ?? 0),
    hook: String(p.hook ?? ''),
    source: 'subgraph',
  }
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
    const pool = mapInitializeLog(log, hookLower)
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

function mapInitializeLog(log: RpcLog, hookLower: string): HookPool | null {
  const data = log.data?.startsWith('0x') ? log.data.slice(2) : (log.data ?? '')
  if (data.length < 448) return null

  const hookFromLog = `0x${data.slice(256 + 24, 256 + 64)}`
  if (hookFromLog.toLowerCase() !== hookLower) return null

  const currency0 = `0x${data.slice(24, 64)}`
  const currency1 = `0x${data.slice(64 + 24, 64 + 64)}`
  const fee = parseInt(data.slice(128, 192), 16)

  return {
    id: log.topics?.[1] ?? log.transactionHash ?? 'unknown',
    token0: { id: currency0, symbol: '???', decimals: 18 },
    token1: { id: currency1, symbol: '???', decimals: 18 },
    feeTier: Number.isFinite(fee) ? fee : 0,
    liquidity: '0',
    liquidityUSD: 0,
    volumeUSD: '0',
    txCount: 0,
    hook: hookFromLog,
    source: 'onchain',
  }
}

function getRpcUrl(chainId: number): string {
  const alchemyKey =
    getStorageValue('hooklens_alchemy_key') ??
    import.meta.env.VITE_ALCHEMY_API_KEY ??
    import.meta.env.VITE_RPC_BASE

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

function getStorageValue(key: string): string | null {
  if (typeof localStorage === 'undefined') return null
  const value = localStorage.getItem(key)
  return value?.trim() || null
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
    const pools = await fetchPoolsFromSubgraph(checksummed)
    return {
      pools,
      totalFound: pools.length,
      source: 'subgraph',
      fetchedAt: Date.now(),
    }
  } catch (subgraphErr) {
    console.warn('Subgraph failed, trying onchain:', subgraphErr)
  }

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
        'Both subgraph and onchain lookup failed: ' +
        (onchainErr instanceof Error ? onchainErr.message : 'unknown'),
      fetchedAt: Date.now(),
    }
  }
}
