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

export interface SafetyAnalysis {
  score: number
  checks: SafetyCheck[]
  hasCriticalIssues: boolean
}

export interface SafetyCheck {
  id: string
  name: string
  passed: boolean
  severity: 'critical' | 'warning' | 'info'
  description: string
}

export interface HookPool {
  id: string
  token0: { symbol: string; address: string }
  token1: { symbol: string; address: string }
  liquidity: string
  volumeUSD: string
  feeTier: number
}

export interface FullHookInspection {
  decoded: DecodedHook
  swapImpact?: HookSwapImpact
  safety?: SafetyAnalysis
  pools?: HookPool[]
  inspectedAt: number
}
