// The canonical Uniswap Trading API base URL (same value as in types/uniswap.ts — one source of truth)
export const UNISWAP_API_BASE = 'https://trade-api.gateway.uniswap.org/v1'

// Sourcify contract verification endpoints
export const SOURCIFY_BASE = 'https://sourcify.dev/server'
export const SOURCIFY_REPO_BASE = 'https://repo.sourcify.dev'

// Chain IDs that Sourcify supports for contract verification
export const SOURCIFY_SUPPORTED_CHAIN_IDS = [
  1, 10, 56, 100, 130, 137, 324, 1101, 8453, 42161, 42220, 43114, 59144, 81457,
  11155111, 84532,
]

// Chains supported in the inspector and dashboard UI.
// Order matters: first chain is the default.
export const SUPPORTED_CHAINS = [
  { id: 8453, name: 'Base', shortName: 'base' },
  { id: 1, name: 'Ethereum', shortName: 'eth' },
  { id: 42161, name: 'Arbitrum', shortName: 'arb' },
  { id: 10, name: 'Optimism', shortName: 'op' },
  { id: 137, name: 'Polygon', shortName: 'matic' },
  { id: 130, name: 'Unichain', shortName: 'unichain' },
] as const

// Uniswap v4 subgraph IDs from The Graph (one per chain).
// Use VITE_THEGRAPH_API_KEY in .env to authenticate against gateway.thegraph.com.
// To add more chains: find the subgraph at https://thegraph.com/explorer/ and verify it
// exposes: pools { id, hooks, feeTier, txCount, volumeUSD, liquidity, token0{symbol}, token1{symbol} }
export const UNISWAP_V4_SUBGRAPH_IDS_BY_CHAIN: Record<number, string> = {
  // Ethereum Mainnet — verified ✓
  1: 'DiYPVdygkfjDWhbxGSqAQxwBKmfKnkWQojqeM2rkLb3G',
  // Base — verified ✓ (has 451K+ txns on hook pools as of May 2025)
  8453: 'G5TsTKNi8yhPSV7kycaE23oWbqv9zzNqR49FoEQjzq1r',
  // Arbitrum, Optimism, Polygon — add verified subgraph IDs here when available
  // Find them at: https://thegraph.com/explorer/ → search "uniswap v4"
}

// Default swap simulation token pair (Base network)
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

// The 14 Uniswap v4 hook permission bits, extracted from the lower 14 bits of the hook address.
export const HOOK_FLAG_MASK = BigInt(0x3FFF)

// Human-readable descriptions for each hook callback, shown in the inspector UI.
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
