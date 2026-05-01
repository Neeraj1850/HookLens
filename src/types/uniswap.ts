// Uniswap Trading API base URL
// Docs: https://developers.uniswap.org/docs/api-reference/aggregator_quote
export const UNISWAP_API_BASE = 'https://trade-api.gateway.uniswap.org/v1'

// hooksOptions controls which v4 pool types are included in quote routing
export type HooksOption =
  | 'V4_HOOKS_INCLUSIVE' // v4 pools with or without hooks (default when V4 in protocols)
  | 'V4_HOOKS_ONLY'      // only v4 pools that have a hook attached
  | 'V4_NO_HOOKS'        // only v4 pools without any hook

export type RoutingType =
  | 'CLASSIC'    // Uniswap v2/v3/v4 pool routing
  | 'DUTCH_V2'   // UniswapX Dutch auction v2
  | 'DUTCH_V3'   // UniswapX Dutch auction v3
  | 'PRIORITY'   // UniswapX priority routing
  | 'WRAP'       // ETH → WETH wrap
  | 'UNWRAP'     // WETH → ETH unwrap
  | 'BRIDGE'     // Cross-chain bridge

// POST /quote request body — per official API docs
export interface QuoteRequest {
  /** Token address to sell (0x0000...0000 = native ETH) */
  tokenIn: string
  /** Token address to buy (0x0000...0000 = native ETH) */
  tokenOut: string
  /** Chain ID of the input token */
  tokenInChainId: number
  /** Chain ID of the output token */
  tokenOutChainId: number
  /** Amount in token base units (e.g. "1000000" for 1 USDC). Must be > 0. */
  amount: string
  /** EXACT_INPUT: sell fixed amount. EXACT_OUTPUT: buy fixed amount. */
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT'
  /** Wallet address that will execute the swap */
  swapper: string
  /** Auto-calculate slippage. Cannot be set alongside slippageTolerance. */
  autoSlippage?: 'DEFAULT'
  /** Manual slippage as a percentage (e.g. 0.5 = 0.5%). Cannot be set alongside autoSlippage. */
  slippageTolerance?: number
  /** Whitelist specific protocols. When including "V4", use hooksOptions to filter hook pools. */
  protocols?: string[]
  /** Filter v4 pools by hook presence. Only applies when protocols includes "V4". */
  hooksOptions?: HooksOption
  /** Preferred routing strategy */
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
  /** Set when the simulated transaction would revert */
  txFailureReason?: string
}

export interface QuoteError {
  code: string
  message: string
  detail?: string
}

/** Result of getDualQuote() — compares hook-only vs best-market routes */
export interface HookQuoteComparison {
  hookQuote: QuoteResponse | null
  baseQuote: QuoteResponse | null
  hookError: QuoteError | null
  baseError: QuoteError | null
  /** True when hook quote failed due to no hook pool existing for this pair */
  noHookPool: boolean
  /** Signed output delta formatted as human-readable string (e.g. "+0.0012") */
  impactAmount: string
  /** Delta as percentage of base output (positive = hook gives more) */
  impactPercent: number
  /** True when hook output >= base output */
  isPositive: boolean
  fetchedAt: number
}

export interface TokenDef {
  address: string
  symbol: string
  decimals: number
  chainId: number
  name: string
  /** Single character for the token avatar fallback */
  logoChar: string
}
