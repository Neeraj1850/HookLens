export const SOURCIFY_BASE = 'https://sourcify.dev/server'
export const SOURCIFY_REPO_BASE = 'https://repo.sourcify.dev'

export const SOURCIFY_SUPPORTED_CHAIN_IDS = [
  1, 10, 56, 100, 130, 137, 324, 1101, 8453, 42161, 42220, 43114, 59144, 81457,
  11155111, 84532,
]

export const SUPPORTED_CHAINS = [
  { id: 8453, name: 'Base', shortName: 'base' },
  { id: 1, name: 'Ethereum', shortName: 'eth' },
  { id: 42161, name: 'Arbitrum', shortName: 'arb' },
  { id: 10, name: 'Optimism', shortName: 'op' },
  { id: 137, name: 'Polygon', shortName: 'matic' },
  { id: 130, name: 'Unichain', shortName: 'unichain' },
] as const

export const UNISWAP_V4_SUBGRAPH_IDS_BY_CHAIN: Record<number, string> = {
  1: 'DiYPVdygkfjDWhbxGSqAQxwBKmfKnkWQojqeM2rkLb3G',
  8453: 'G5TsTKNi8yhPSV7kycaE23oWbqv9zzNqR49FoEQjzq1r',
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
