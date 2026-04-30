export const UNISWAP_API_BASE = 'https://trade-api.gateway.uniswap.org/v1'

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
  autoSlippage?: 'DEFAULT'
  slippageTolerance?: number
  protocols?: string[]
  hooksOptions?: HooksOption
  routingPreference?: 'BEST_PRICE' | 'FASTEST'
}

export interface QuoteToken {
  address: string
  symbol: string
  decimals: number
  chainId: number
}

export interface QuoteResult {
  chainId: number
  input: { amount: string; token: QuoteToken }
  output: { amount: string; token: QuoteToken }
  slippage: number
  priceImpact: number
  gasFee?: string
  gasFeeUSD?: string
  gasFeeQuote?: string
  route?: unknown[][]
  portionBips?: number
  portionAmount?: string
}

export interface QuoteResponse {
  routing: RoutingType
  quote: QuoteResult
  permitData: unknown | null
  txFailureReason?: string
}

export interface QuoteError {
  code: string
  message: string
  detail?: string
}

export interface HookQuoteComparison {
  hookQuote: QuoteResponse | null
  baseQuote: QuoteResponse | null
  hookError: QuoteError | null
  baseError: QuoteError | null
  noHookPool: boolean
  impactAmount: string
  impactPercent: number
  isPositive: boolean
  fetchedAt: number
}

export interface TokenDef {
  address: string
  symbol: string
  decimals: number
  chainId: number
  name: string
  logoChar: string
}
