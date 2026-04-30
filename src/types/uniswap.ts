// Uniswap Trading API types
// Full implementation in Phase 2

export type HooksOption =
  | 'V4_HOOKS_INCLUSIVE'
  | 'V4_HOOKS_ONLY'
  | 'V4_NO_HOOKS'

export type RoutingType =
  | 'CLASSIC'
  | 'DUTCH_V2'
  | 'DUTCH_V3'
  | 'PRIORITY'
  | 'WRAP'
  | 'UNWRAP'
  | 'BRIDGE'

export interface QuoteRequest {
  tokenIn: string
  tokenOut: string
  tokenInChainId: number
  tokenOutChainId: number
  amount: string
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT'
  swapper: string
  slippageTolerance?: number
  autoSlippage?: 'DEFAULT'
  protocols?: string[]
  hooksOptions?: HooksOption
  routingPreference?: 'BEST_PRICE' | 'FASTEST'
}

export interface QuoteResponse {
  routing: RoutingType
  quote: {
    chainId: number
    input: { amount: string; token: { address: string; symbol: string } }
    output: { amount: string; token: { address: string; symbol: string } }
    slippage: number
    priceImpact: number
    gasFee?: string
  }
  permitData: unknown | null
  txFailureReason?: string
}
