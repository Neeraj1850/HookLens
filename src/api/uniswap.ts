/**
 * Uniswap Trading API service
 *
 * Docs: https://developers.uniswap.org/docs/api-reference/aggregator_quote
 * API base: https://trade-api.gateway.uniswap.org/v1
 *
 * Key request fields (per official docs):
 *   - type: "EXACT_INPUT" | "EXACT_OUTPUT"
 *   - amount: token base units (e.g. 1 USDC = "1000000"), must be > 0
 *   - tokenIn / tokenOut: ERC-20 address; 0x0000...0000 = native ETH
 *   - tokenInChainId / tokenOutChainId: chain IDs (1 = Ethereum, 8453 = Base, etc.)
 *   - swapper: wallet address that will execute the swap
 *   - slippageTolerance (number, %) OR autoSlippage: "DEFAULT" — exactly one required
 *   - routingPreference: "BEST_PRICE" | "FASTEST"
 *   - protocols: optional whitelist, e.g. ["V4"]
 *   - hooksOptions: "V4_HOOKS_INCLUSIVE" | "V4_HOOKS_ONLY" | "V4_NO_HOOKS" (only when protocols includes "V4")
 */

import {
  UNISWAP_API_BASE,
  type HookQuoteComparison,
  type QuoteError,
  type QuoteRequest,
  type QuoteResponse,
  type TokenDef,
} from '../types/uniswap'

// ─── Environment helpers ──────────────────────────────────────────────────────

function getApiKey(): string {
  return String(import.meta.env.VITE_UNISWAP_API_KEY ?? '').trim()
}

/**
 * Returns the base URL for Trading API calls.
 * In development, the Vite dev server provides a local proxy at /hooklens-uniswap
 * that forwards requests to trade-api.gateway.uniswap.org without CORS issues.
 * In production, VITE_UNISWAP_PROXY_URL can point to a server-side proxy.
 */
function getApiBase(): string {
  const configuredProxy = String(import.meta.env.VITE_UNISWAP_PROXY_URL ?? '').trim()
  if (configuredProxy) return configuredProxy.replace(/\/$/, '')
  if (import.meta.env.DEV === true) return '/hooklens-uniswap/v1'
  return UNISWAP_API_BASE
}

// ─── Proxy envelope detection ────────────────────────────────────────────────

/** Shape returned by the Vite dev server proxy plugin in vite.config.ts */
interface TradeApiProxyEnvelope {
  hooklensProxy: true
  ok: boolean
  status: number
  statusText: string
  body: unknown
}

function isProxyEnvelope(value: unknown): value is TradeApiProxyEnvelope {
  return (
    value != null &&
    typeof value === 'object' &&
    (value as { hooklensProxy?: unknown }).hooklensProxy === true
  )
}

// ─── Core fetch ──────────────────────────────────────────────────────────────

/**
 * POST to a Trading API endpoint and return the parsed JSON body.
 * Handles both direct requests and the Vite proxy envelope format.
 * Throws descriptive errors for all failure modes.
 */
async function uniswapFetch<T>(endpoint: string, payload: unknown): Promise<T> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(
      'Uniswap API key not configured. Add VITE_UNISWAP_API_KEY to your .env file.',
    )
  }

  const url = `${getApiBase()}${endpoint}`
  debugLog('request', { endpoint, url, payload })

  // Determine whether to pass x-erc20eth-enabled based on native ETH input.
  // UniswapX routes support native ETH input (EIP-7914) when enabled explicitly.
  const hasNativeInput =
    payload != null &&
    typeof payload === 'object' &&
    (payload as { tokenIn?: string }).tokenIn === NATIVE_ETH_ADDRESS
  const erc20EthEnabled = hasNativeInput ? 'true' : 'false'

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': apiKey,
        // Router version must be consistent across /quote and /swap calls.
        'x-universal-router-version': '2.0',
        // Enable native ETH input for UniswapX only when tokenIn is the zero address.
        'x-erc20eth-enabled': erc20EthEnabled,
        // Use standard Permit2 message flow (not as a transaction).
        'x-permit2-disabled': 'false',
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    // Network-level error (fetch itself rejected — CORS, offline, etc.)
    debugLog('network error', { endpoint, url, err })
    throw new Error(
      import.meta.env.DEV === true
        ? 'Quote request did not reach the API. Make sure the Vite dev server is running (npm run dev) so the local proxy is active.'
        : 'Quote request was blocked by the browser or network. Set VITE_UNISWAP_PROXY_URL to a server-side proxy to bypass CORS.',
      { cause: err },
    )
  }

  debugLog('response', { endpoint, status: res.status, ok: res.ok })

  const body = await readBody(res)

  // The Vite dev server proxy wraps upstream responses in a TradeApiProxyEnvelope.
  if (isProxyEnvelope(body)) {
    debugLog('proxy upstream', { endpoint, ok: body.ok, status: body.status })
    if (!body.ok) {
      throwApiError(endpoint, body.status, body.body)
    }
    debugLog('success', { endpoint, body: body.body })
    return body.body as T
  }

  if (!res.ok) {
    throwApiError(endpoint, res.status, body)
  }

  debugLog('success', { endpoint, body })
  return body as T
}

// ─── Response body helpers ───────────────────────────────────────────────────

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  // Try common error message keys in priority order
  for (const key of ['message', 'error', 'detail', 'reason', 'title', 'errorCode']) {
    if (typeof b[key] === 'string' && (b[key] as string).trim()) {
      return (b[key] as string).trim()
    }
  }
  // Some APIs return an errors array
  if (Array.isArray(b.errors)) {
    const first = b.errors[0] as Record<string, unknown> | undefined
    if (typeof first?.message === 'string') return first.message
  }
  return null
}

function throwApiError(endpoint: string, status: number, body: unknown): never {
  debugLog('error', { endpoint, status, body })

  const detail = body == null ? null : safeStringify(body)
  const extracted = extractErrorMessage(body)
  const fallback = status > 0 ? `HTTP ${status}` : 'Network error'
  const message = extracted ?? fallback

  if (status === 401) {
    throw new Error(
      'Invalid Uniswap API key. Check VITE_UNISWAP_API_KEY in your .env file and restart the dev server.',
    )
  }
  if (status === 429) {
    throw new Error('Uniswap API rate limit exceeded. Wait a moment and try again.')
  }
  if (status === 400) {
    const hint = detail && detail !== '{}' ? ` (${detail})` : ''
    throw new Error(`Bad request: ${message}${hint}`)
  }
  if (status === 404 && endpoint === '/quote') {
    throw new Error('No route found for this token pair and chain combination.')
  }

  const fullDetail = detail && detail !== '{}' && detail !== `"${message}"` ? ` | ${detail}` : ''
  throw new Error(`${message}${fullDetail}`)
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a single quote from the Uniswap Trading API.
 *
 * The request must contain either `slippageTolerance` or `autoSlippage: "DEFAULT"` — not both.
 * When `protocols` includes "V4", you can set `hooksOptions` to filter pools.
 */
export async function getQuote(request: QuoteRequest): Promise<QuoteResponse> {
  // Validate required fields before hitting the network
  if (!request.tokenIn || !request.tokenOut) {
    throw new Error('tokenIn and tokenOut are required for a quote.')
  }
  if (!request.amount || request.amount === '0') {
    throw new Error('amount must be a positive non-zero integer string (base units).')
  }
  if (!request.swapper) {
    throw new Error('swapper wallet address is required.')
  }
  if (request.slippageTolerance != null && request.autoSlippage != null) {
    throw new Error('Provide either slippageTolerance or autoSlippage, not both.')
  }

  debugLog('quote request', {
    type: request.type,
    amount: request.amount,
    tokenIn: request.tokenIn,
    tokenOut: request.tokenOut,
    tokenInChainId: request.tokenInChainId,
    tokenOutChainId: request.tokenOutChainId,
    swapper: request.swapper,
    slippageTolerance: request.slippageTolerance,
    autoSlippage: request.autoSlippage,
    protocols: request.protocols,
    hooksOptions: request.hooksOptions,
    routingPreference: request.routingPreference,
  })

  return uniswapFetch<QuoteResponse>('/quote', request)
}

/**
 * Fetch two parallel quotes for the same pair:
 *   1. Hook quote: V4 protocol, hooks-only pools
 *   2. Base quote: best available route across all protocols (no hook filter)
 *
 * If the hook quote fails because no hook pool exists, `noHookPool` is set to true.
 * The impact delta and percentage compare hook vs base output amounts.
 */
export async function getDualQuote(
  tokenIn: TokenDef,
  tokenOut: TokenDef,
  amountHuman: string,
  chainId: number,
  swapper: string,
): Promise<HookQuoteComparison> {
  const amountWei = toWei(amountHuman, tokenIn.decimals)

  // Ensure chain IDs are consistent (use token chain IDs if they agree, otherwise fall back to param)
  const effectiveChainId =
    tokenIn.chainId === tokenOut.chainId ? tokenIn.chainId : chainId

  const swapperAddress = swapper || DUMMY_SWAPPER

  const baseRequest: QuoteRequest = {
    type: 'EXACT_INPUT',
    amount: amountWei,
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    tokenInChainId: effectiveChainId,
    tokenOutChainId: effectiveChainId,
    swapper: swapperAddress,
    // Use auto slippage so we don't need to hardcode a value.
    // autoSlippage is only for Uniswap Protocol routes (v2/v3/v4), not UniswapX.
    autoSlippage: 'DEFAULT',
    routingPreference: 'BEST_PRICE',
  }

  debugLog('dual quote start', {
    chainId: effectiveChainId,
    tokenIn: tokenIn.symbol,
    tokenOut: tokenOut.symbol,
    amountHuman,
    amountWei,
  })

  // Run both quote requests. We serialize them with a small gap to avoid
  // hammering the API simultaneously and triggering rate limits.
  let hookQuote: QuoteResponse | null = null
  let baseQuote: QuoteResponse | null = null
  let hookError: QuoteError | null = null
  let baseError: QuoteError | null = null

  try {
    hookQuote = await getQuote({
      ...baseRequest,
      protocols: ['V4'],
      hooksOptions: 'V4_HOOKS_ONLY',
    })
  } catch (err) {
    hookError = toQuoteError('HOOK_QUOTE_FAILED', err)
  }

  // Brief pause between requests to be respectful to the rate limiter
  await sleep(350)

  try {
    // Base quote: no protocol filter — the API finds the best available route
    baseQuote = await getQuote(baseRequest)
  } catch (err) {
    baseError = toQuoteError('BASE_QUOTE_FAILED', err)
  }

  // Determine whether the hook quote failed because no hook pool exists for this pair
  const hookErrText = hookError?.message.toLowerCase() ?? ''
  const noHookPool =
    hookError != null &&
    (hookErrText.includes('no quote') ||
      hookErrText.includes('no route') ||
      hookErrText.includes('insufficient liquidity') ||
      hookErrText.includes('no route found'))

  // Calculate output delta between hook and base route
  let impactAmount = '0'
  let impactPercent = 0
  let isPositive = false

  if (hookQuote && baseQuote) {
    const hookOut = BigInt(hookQuote.quote.output.amount || '0')
    const baseOut = BigInt(baseQuote.quote.output.amount || '0')
    const diff = hookOut - baseOut

    impactAmount = formatSignedAmount(diff.toString(), tokenOut.decimals, tokenOut.decimals <= 6 ? 2 : 4)

    if (baseOut > BigInt(0)) {
      // Express as percentage with 3 decimal places of precision
      impactPercent = Number((diff * BigInt(100_000)) / baseOut) / 1000
    }

    isPositive = diff >= BigInt(0)
  }

  const result: HookQuoteComparison = {
    hookQuote,
    baseQuote,
    hookError,
    baseError,
    noHookPool,
    impactAmount,
    impactPercent,
    isPositive,
    fetchedAt: Date.now(),
  }

  debugLog('dual quote result', result)
  return result
}

// ─── Amount conversion utilities ─────────────────────────────────────────────

/**
 * Convert a human-readable token amount to base units (wei-equivalent).
 * Example: toWei("1.5", 6) → "1500000" (1.5 USDC)
 */
export function toWei(amount: string, decimals: number): string {
  const normalized = amount.trim()
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid amount: "${amount}". Must be a positive decimal number.`)
  }

  const [whole, fraction = ''] = normalized.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  const scale = BigInt(10) ** BigInt(decimals)
  const wei = BigInt(whole || '0') * scale + BigInt(paddedFraction || '0')

  if (wei === BigInt(0)) {
    throw new Error('Amount must be greater than zero.')
  }

  return wei.toString()
}

/**
 * Format a signed base-unit amount back to a human-readable string with sign prefix.
 * Example: formatSignedAmount("-500000", 6, 2) → "-0.50"
 */
function formatSignedAmount(amountWei: string, decimals: number, displayDecimals = 4): string {
  try {
    const isNegative = amountWei.startsWith('-')
    const abs = isNegative ? amountWei.slice(1) : amountWei
    const num = Number(BigInt(abs || '0')) / 10 ** decimals
    return `${isNegative ? '-' : '+'}${num.toFixed(displayDecimals)}`
  } catch {
    return '-'
  }
}

// ─── Token catalog ────────────────────────────────────────────────────────────

/** The zero address is used to represent native ETH (not WETH) in the Trading API. */
export const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * Well-known tokens per chain for the swap simulator UI.
 * These are the tokens the API is most likely to have liquid routes for.
 */
export const TOKENS_BY_CHAIN: Record<number, TokenDef[]> = {
  // Base
  8453: [
    {
      address: NATIVE_ETH_ADDRESS,
      symbol: 'ETH',
      decimals: 18,
      chainId: 8453,
      name: 'Ether',
      logoChar: 'Ξ',
    },
    {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      decimals: 6,
      chainId: 8453,
      name: 'USD Coin',
      logoChar: '$',
    },
    {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      decimals: 18,
      chainId: 8453,
      name: 'Wrapped Ether',
      logoChar: 'W',
    },
    {
      address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      symbol: 'DAI',
      decimals: 18,
      chainId: 8453,
      name: 'Dai Stablecoin',
      logoChar: 'D',
    },
    {
      address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
      symbol: 'USDbC',
      decimals: 6,
      chainId: 8453,
      name: 'USD Base Coin',
      logoChar: 'B',
    },
  ],
  // Ethereum Mainnet
  1: [
    {
      address: NATIVE_ETH_ADDRESS,
      symbol: 'ETH',
      decimals: 18,
      chainId: 1,
      name: 'Ether',
      logoChar: 'Ξ',
    },
    {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      decimals: 6,
      chainId: 1,
      name: 'USD Coin',
      logoChar: '$',
    },
    {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      decimals: 18,
      chainId: 1,
      name: 'Wrapped Ether',
      logoChar: 'W',
    },
    {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      symbol: 'DAI',
      decimals: 18,
      chainId: 1,
      name: 'Dai Stablecoin',
      logoChar: 'D',
    },
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      decimals: 6,
      chainId: 1,
      name: 'Tether USD',
      logoChar: 'T',
    },
  ],
  // Arbitrum One
  42161: [
    {
      address: NATIVE_ETH_ADDRESS,
      symbol: 'ETH',
      decimals: 18,
      chainId: 42161,
      name: 'Ether',
      logoChar: 'Ξ',
    },
    {
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      symbol: 'USDC',
      decimals: 6,
      chainId: 42161,
      name: 'USD Coin',
      logoChar: '$',
    },
    {
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      symbol: 'WETH',
      decimals: 18,
      chainId: 42161,
      name: 'Wrapped Ether',
      logoChar: 'W',
    },
  ],
}

/** Return the token list for a chain, defaulting to Base if the chain is unknown. */
export function getTokensForChain(chainId: number): TokenDef[] {
  return TOKENS_BY_CHAIN[chainId] ?? TOKENS_BY_CHAIN[8453]!
}

/**
 * A well-known Ethereum address used as a placeholder swapper when the user
 * has not connected a wallet. This is vitalik.eth — safe to use for read-only quotes.
 */
export const DUMMY_SWAPPER = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toQuoteError(code: string, err: unknown): QuoteError {
  const rawMessage = err instanceof Error ? err.message : String(err)
  const [message, detail] = rawMessage.split(' | ', 2)
  return { code, message: message ?? rawMessage, detail }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function debugLog(label: string, payload: unknown): void {
  if (
    import.meta.env.DEV !== true &&
    import.meta.env.VITE_HOOKLENS_DEBUG_QUOTES !== 'true'
  ) {
    return
  }
  console.info(`[HookLens quote] ${label}`, payload)
}
