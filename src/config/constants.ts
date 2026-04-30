export const UNISWAP_API_BASE = 'https://trade-api.gateway.uniswap.org/v1'

export const UNISWAP_SUBGRAPH_V4 =
  'https://gateway.thegraph.com/api/subgraphs/id/...' // filled Phase 4

export const SOURCIFY_API = 'https://sourcify.dev/server'

export const SUPPORTED_CHAINS = [
  { id: 8453, name: 'Base', shortName: 'base' },
  { id: 1, name: 'Ethereum', shortName: 'eth' },
  { id: 42161, name: 'Arbitrum', shortName: 'arb' },
  { id: 10, name: 'Optimism', shortName: 'op' },
  { id: 137, name: 'Polygon', shortName: 'matic' },
  { id: 130, name: 'Unichain', shortName: 'unichain' },
] as const

export const DEFAULT_TOKEN_IN = {
  address: '0x0000000000000000000000000000000000000000',
  symbol: 'ETH',
  decimals: 18,
  chainId: 8453,
}

export const DEFAULT_TOKEN_OUT = {
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  symbol: 'USDC',
  decimals: 6,
  chainId: 8453,
}

export const HOOK_FLAG_MASK = BigInt(0x3FFF)

export const CALLBACK_DESCRIPTIONS: Record<string, string> = {
  beforeInitialize:
    'Runs before a new pool is created. Used to validate pool params or set initial state.',
  afterInitialize:
    'Runs after pool creation. Can set up hook-specific storage or emit events.',
  beforeAddLiquidity:
    'Runs before liquidity is added. Can gate who can LP or charge admission fees.',
  afterAddLiquidity:
    'Runs after liquidity is added. Common for loyalty points or LP reward tracking.',
  beforeRemoveLiquidity:
    'Runs before LP removes position. Can enforce lock-up periods.',
  afterRemoveLiquidity:
    'Runs after position removal. Common for settlement logic.',
  beforeSwap:
    'Runs before every swap. Most powerful callback; can modify fees, block swaps, or change routing.',
  afterSwap:
    'Runs after every swap. Used for rebates, oracle updates, MEV redistribution.',
  beforeDonate:
    'Runs before donate() is called. Rare; used in advanced MEV strategies.',
  afterDonate:
    'Runs after donate(). Used to distribute donated fees.',
  beforeSwapReturnsDelta:
    'beforeSwap returns a custom delta; allows hook to override swap amounts directly.',
  afterSwapReturnsDelta:
    'afterSwap returns a custom delta; hook can take or give tokens after swap.',
  afterAddLiquidityReturnsDelta:
    'afterAddLiquidity returns a delta; hook can adjust final LP token amounts.',
  afterRemoveLiquidityReturnsDelta:
    'afterRemoveLiquidity returns a delta; hook can adjust withdrawal amounts.',
}
