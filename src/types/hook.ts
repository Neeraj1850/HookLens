// All 14 Uniswap v4 hook callback flags
export interface HookFlags {
  beforeInitialize: boolean
  afterInitialize: boolean
  beforeAddLiquidity: boolean
  afterAddLiquidity: boolean
  beforeRemoveLiquidity: boolean
  afterRemoveLiquidity: boolean
  beforeSwap: boolean
  afterSwap: boolean
  beforeDonate: boolean
  afterDonate: boolean
  beforeSwapReturnsDelta: boolean
  afterSwapReturnsDelta: boolean
  afterAddLiquidityReturnsDelta: boolean
  afterRemoveLiquidityReturnsDelta: boolean
}

export interface DecodedHook {
  address: string
  chainId: number
  flags: HookFlags
  activeCallbacks: string[]
  totalActive: number
  category: HookCategory
  isValid: boolean
}

export type HookCategory =
  | 'swap-only'
  | 'liquidity-only'
  | 'full-lifecycle'
  | 'initialize-only'
  | 'custom'
  | 'unknown'

export interface HookSwapImpact {
  withHook: SwapQuote
  withoutHook: SwapQuote
  impactAmount: string
  impactPercent: number
  feeDelta: number
  isPositiveForSwapper: boolean
}

export interface SwapQuote {
  amountIn: string
  amountOut: string
  tokenIn: string
  tokenOut: string
  feeInBps: number
  routing: string
  gasEstimate: string
  priceImpact: number
}

export interface VerificationStatus {
  isVerified: boolean
  matchType: 'exact_match' | 'match' | 'unverified'
  verifiedAt?: string
  sourcifyUrl?: string
}

export interface ContractSource {
  verification: VerificationStatus
  abi?: AbiItem[]
  sources?: Record<string, { content: string }>
  deployedBytecode?: string
  creationBytecode?: string
  compilerVersion?: string
}

export interface AbiItem {
  type: string
  name?: string
  inputs?: AbiParam[]
  outputs?: AbiParam[]
  stateMutability?: string
}

export interface AbiParam {
  name: string
  type: string
  internalType?: string
}

export interface SafetyAnalysis {
  score: number
  checks: SafetyCheck[]
  hasCriticalIssues: boolean
  hasHighIssues: boolean
  source: ContractSource
  analyzedAt: number
}

export interface SafetyCheck {
  id: string
  name: string
  description: string
  passed: boolean
  severity: 'critical' | 'high' | 'medium' | 'info'
  detail?: string
  category: SafetyCategory
}

export type SafetyCategory =
  | 'verification'
  | 'access-control'
  | 'reentrancy'
  | 'callback-safety'
  | 'centralization'
  | 'hook-specific'

export interface HookPool {
  id: string
  chainId: number
  token0: { id: string; symbol: string; decimals: number }
  token1: { id: string; symbol: string; decimals: number }
  feeTier: number
  liquidity: string
  liquidityUSD: number
  volumeUSD: string
  txCount: number
  hook: string
  source: 'subgraph' | 'onchain'
}

export interface PoolDiscovery {
  pools: HookPool[]
  totalFound: number
  source: 'subgraph' | 'onchain' | 'none'
  error?: string
  fetchedAt: number
}

export interface PoolMarketComparison {
  hookPools: HookPool[]
  noHookPools: HookPool[]
  totalHookPools: number
  totalNoHookPools: number
  source: 'subgraph' | 'none'
  error?: string
  fetchedAt: number
}

export interface CheckExplanation {
  checkId: string
  title: string
  why: string
  example: string
  mitigation: string
  reference?: string
}

export interface HookAddressCandidate {
  address: string
  chainId: number
  chainName: string
  poolCount: number
  txCount: number
  volumeUSD: number
  liquidity: string
  topPair: string
  topFeeTier: number
  source: 'subgraph' | 'curated'
  description: string
}

export interface HookAddressDiscovery {
  hooks: HookAddressCandidate[]
  totalFound: number
  chainsQueried: number
  source: 'subgraph' | 'curated' | 'none'
  errors: { chainId: number; message: string }[]
  fetchedAt: number
}

export interface FullHookInspection {
  decoded: DecodedHook
  swapImpact?: HookSwapImpact
  safety?: SafetyAnalysis
  pools?: HookPool[]
  inspectedAt: number
}
