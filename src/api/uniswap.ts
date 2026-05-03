/**
 * Uniswap Trading API + SDK Integration
 *
 * Uses @uniswap/sdk-core and @uniswap/v4-sdk as the canonical source of truth for:
 *   - Token addresses (via Token class, WETH9 constant)
 *   - Token decimals (from Token instances, never hardcoded separately)
 *   - Native ETH address (via Ether.onChain + toAddress)
 *   - ChainId enum (no magic numbers)
 *
 * API docs: https://developers.uniswap.org/docs/api-reference/aggregator_quote
 * v4 SDK quoting: https://developers.uniswap.org/docs/sdks/v4/guides/swapping/quoting
 * v4 deployments: https://developers.uniswap.org/docs/protocols/v4/deployments
 *
 * Skills: swap-integration (uniswap/uniswap-trading), swap-planner (uniswap/uniswap-driver)
 */

import { ChainId, Ether, Token, WETH9, type Currency } from '@uniswap/sdk-core'
import { toAddress } from '@uniswap/v4-sdk'
import {
  UNISWAP_API_BASE,
  type HookQuoteComparison,
  type QuoteError,
  type QuoteRequest,
  type QuoteResponse,
} from '../types/uniswap'

// ─── Re-export SDK Currency type for consumers ────────────────────────────────

export type { Currency }

// ─── Well-known token catalog sourced from @uniswap/sdk-core ─────────────────
// Using Token class ensures addresses, decimals and chainIds are always correct.
// WETH9 constant is the canonical source for Wrapped Ether addresses.

/** USDC on Ethereum Mainnet */
const USDC_MAINNET = new Token(
  ChainId.MAINNET,
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  6,
  'USDC',
  'USD Coin',
)

/** DAI on Ethereum Mainnet */
const DAI_MAINNET = new Token(
  ChainId.MAINNET,
  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  18,
  'DAI',
  'Dai Stablecoin',
)

/** USDT on Ethereum Mainnet */
const USDT_MAINNET = new Token(
  ChainId.MAINNET,
  '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  6,
  'USDT',
  'Tether USD',
)

/** USDC on Base */
const USDC_BASE = new Token(
  ChainId.BASE,
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  6,
  'USDC',
  'USD Coin',
)

/** DAI on Base */
const DAI_BASE = new Token(
  ChainId.BASE,
  '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  18,
  'DAI',
  'Dai Stablecoin',
)

/** USDbC (Bridged USDC) on Base */
const USDBC_BASE = new Token(
  ChainId.BASE,
  '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
  6,
  'USDbC',
  'USD Base Coin',
)

/** USDC on Arbitrum One */
const USDC_ARBITRUM = new Token(
  ChainId.ARBITRUM_ONE,
  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  6,
  'USDC',
  'USD Coin',
)

// ─── Token catalog per chain ──────────────────────────────────────────────────
// Native ETH uses Ether.onChain() — toAddress() returns 0x000...000 as expected by the API.
// WETH9 from sdk-core gives the correct wrapped ETH address per chain.

export const TOKENS_BY_CHAIN: Record<number, Currency[]> = {
  [ChainId.BASE]: [
    Ether.onChain(ChainId.BASE),
    USDC_BASE,
    WETH9[ChainId.BASE]!,
    DAI_BASE,
    USDBC_BASE,
  ],
  [ChainId.MAINNET]: [
    Ether.onChain(ChainId.MAINNET),
    USDC_MAINNET,
    WETH9[ChainId.MAINNET]!,
    DAI_MAINNET,
    USDT_MAINNET,
  ],
  [ChainId.ARBITRUM_ONE]: [
    Ether.onChain(ChainId.ARBITRUM_ONE),
    USDC_ARBITRUM,
    WETH9[ChainId.ARBITRUM_ONE]!,
  ],
}

/** Return the token list for a chain, defaulting to Base if the chain is unknown. */
export function getTokensForChain(chainId: number): Currency[] {
  return TOKENS_BY_CHAIN[chainId] ?? TOKENS_BY_CHAIN[ChainId.BASE]!
}

// ─── Currency → API-facing address ───────────────────────────────────────────

/**
 * Convert an SDK Currency to the address string expected by the Uniswap Trading API.
 * Native ETH → "0x0000000000000000000000000000000000000000" (per API docs).
 * ERC-20 tokens → checksummed address from the Token instance.
 *
 * Uses toAddress() from @uniswap/v4-sdk which handles both isNative and isToken cases.
 */
export function currencyToApiAddress(currency: Currency): string {
  return toAddress(currency)
}

/**
 * Get the decimal precision of a currency for amount calculations.
 * Uses currency.decimals directly from the SDK — no separate lookup needed.
 */
export function currencyDecimals(currency: Currency): number {
  return currency.decimals
}

/**
 * Get a display symbol for a currency (e.g. "ETH", "USDC").
 */
export function currencySymbol(currency: Currency): string {
  return currency.symbol ?? '???'
}

// ─── v4 Quoter contract addresses (from official deployment docs) ─────────────
// Source: https://developers.uniswap.org/docs/protocols/v4/deployments
// These are used for onchain static-call quoting via the v4 Quoter contract.

export const V4_QUOTER_ADDRESSES: Record<number, string> = {
  [ChainId.MAINNET]:      '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
  [ChainId.BASE]:         '0x0d5e0f971ed27fbff6c2837bf31316121532048d',
  [ChainId.ARBITRUM_ONE]: '0x3972c00f7ed4885e145823eb7c655375d275a1c5',
  10:                     '0x1f3131a13296fb91c90870043742c3cdbff1a8d7', // Optimism
  137:                    '0xb3d5c3dfc3a7aebff71895a7191796bffc2c81b9', // Polygon
  130:                    '0x333e3c607b141b18ff6de9f258db6e77fe7491e0', // Unichain
}

// ─── Environment helpers ──────────────────────────────────────────────────────

function getApiKey(): string {
  return String(import.meta.env.VITE_UNISWAP_API_KEY ?? '').trim()
}

/**
 * Resolves the Trading API base URL.
 *
 * - Always uses the /hooklens-uniswap server-side proxy path, which is handled by:
 *   - The Vite dev server plugin (vite.config.ts) during local development
 *   - Vercel rewrites (vercel.json) in production: /hooklens-uniswap/* → trade-api.gateway.uniswap.org/*
 * - VITE_UNISWAP_PROXY_URL overrides this for custom proxy deployments.
 *
 * This avoids CORS: the browser always talks to the same origin, and the proxy
 * forwards the request server-side with the API key in the header.
 */
function getApiBase(): string {
  const configuredProxy = String(import.meta.env.VITE_UNISWAP_PROXY_URL ?? '').trim()
  if (configuredProxy) return configuredProxy.replace(/\/$/, '')
  return '/hooklens-uniswap/v1'
}

// ─── Proxy envelope detection ─────────────────────────────────────────────────

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

// ─── Core fetch ───────────────────────────────────────────────────────────────

/**
 * POST to a Trading API endpoint and return the parsed JSON body.
 *
 * Headers per official API docs:
 *   - x-api-key: your API key
 *   - x-universal-router-version: "2.0" — must be consistent across /quote and /swap
 *   - x-erc20eth-enabled: enable native ETH input on UniswapX (EIP-7914)
 *   - x-permit2-disabled: false = use standard Permit2 message flow
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

  // Per API docs: enable EIP-7914 native ETH input for UniswapX only when tokenIn is zero address
  const hasNativeInput =
    payload != null &&
    typeof payload === 'object' &&
    (payload as { tokenIn?: string }).tokenIn === '0x0000000000000000000000000000000000000000'
  const erc20EthEnabled = hasNativeInput ? 'true' : 'false'

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': apiKey,
        // Router version MUST be consistent across /quote and /swap calls (per API docs)
        'x-universal-router-version': '2.0',
        // Enable native ETH input for UniswapX when tokenIn is the native currency address
        'x-erc20eth-enabled': erc20EthEnabled,
        // Use Permit2 message flow (not as a transaction — requires no onchain submission)
        'x-permit2-disabled': 'false',
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    debugLog('network error', { endpoint, url, err })
    throw new Error(
      'Quote request did not reach the API. In development, make sure the Vite dev server is running (npm run dev). In production, ensure the Vercel proxy rewrite in vercel.json is deployed.',
      { cause: err },
    )
  }

  debugLog('response', { endpoint, status: res.status, ok: res.ok })

  const body = await readBody(res)

  // The Vite dev server proxy wraps upstream responses in a TradeApiProxyEnvelope
  if (isProxyEnvelope(body)) {
    debugLog('proxy upstream', { endpoint, ok: body.ok, status: body.status })
    if (!body.ok) throwApiError(endpoint, body.status, body.body)
    debugLog('success (proxy)', { endpoint, body: body.body })
    return body.body as T
  }

  if (!res.ok) throwApiError(endpoint, res.status, body)

  debugLog('success', { endpoint, body })
  return body as T
}

// ─── Response helpers ─────────────────────────────────────────────────────────

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
  for (const key of ['message', 'error', 'detail', 'reason', 'title', 'errorCode']) {
    if (typeof b[key] === 'string' && (b[key] as string).trim()) {
      return (b[key] as string).trim()
    }
  }
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

// ─── Amount conversion utilities ──────────────────────────────────────────────

/**
 * Convert a human-readable token amount to base units using the SDK currency's decimals.
 * Example: toWei("1.5", USDC_BASE) → "1500000" (1.5 USDC = 6 decimals)
 *
 * Decimals come from the Currency object directly — no separate lookup or hardcoding.
 */
export function toWeiFromCurrency(amount: string, currency: Currency): string {
  return toWei(amount, currency.decimals)
}

/**
 * Convert a human-readable amount string to base units using an explicit decimal count.
 * Handles fractional amounts with full precision up to `decimals` digits.
 */
export function toWei(amount: string, decimals: number): string {
  const normalized = amount.trim().replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid amount: "${amount}". Must be a positive decimal number.`)
  }

  const [whole, fraction = ''] = normalized.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  const scale = BigInt(10) ** BigInt(decimals)
  const wei = BigInt(whole ?? '0') * scale + BigInt(paddedFraction || '0')

  if (wei === BigInt(0)) {
    throw new Error('Amount must be greater than zero.')
  }

  return wei.toString()
}

/**
 * Format a signed base-unit amount back to a human-readable string with sign prefix.
 * Example: formatSignedWei("-500000", 6, 2) → "-0.50"
 */
export function formatSignedWei(amountWei: string, decimals: number, displayDecimals = 4): string {
  try {
    const isNegative = amountWei.startsWith('-')
    const abs = isNegative ? amountWei.slice(1) : amountWei
    const num = Number(BigInt(abs || '0')) / 10 ** decimals
    return `${isNegative ? '-' : '+'}${num.toFixed(displayDecimals)}`
  } catch {
    return '—'
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a single quote from the Uniswap Trading API.
 *
 * Per API docs:
 *   - amount: token base units string (e.g. "1000000" for 1 USDC)
 *   - tokenIn / tokenOut: ERC-20 address; 0x0000...0000 = native ETH
 *   - Must include either slippageTolerance OR autoSlippage — not both
 *   - When protocols includes "V4", hooksOptions filters hook pool routing
 */
export async function getQuote(request: QuoteRequest): Promise<QuoteResponse> {
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
    routingPreference: request.routingPreference,
    hooksOptions: request.hooksOptions,
  })

  return uniswapFetch<QuoteResponse>('/quote', request)
}

/**
 * Fetch dual parallel quotes for the same Currency pair using SDK-native types:
 *   1. Hook quote:   V4 protocol, hooks-only pools (V4_HOOKS_ONLY)
 *   2. Market quote: Best available route across all protocols (BEST_PRICE)
 *
 * Uses currencyToApiAddress() to correctly resolve native ETH → 0x000...000.
 * Uses currency.decimals for amount conversion — no hardcoded decimal lookup.
 *
 * If the hook quote fails because no hook pool exists, noHookPool is true.
 * The impactAmount and impactPercent compare hook vs market output amounts.
 */
export async function getDualQuote(
  currencyIn: Currency,
  currencyOut: Currency,
  amountHuman: string,
  chainId: number,
  swapper: string,
): Promise<HookQuoteComparison> {
  // Use SDK-native address resolution — toAddress() handles isNative correctly
  const tokenInAddr = currencyToApiAddress(currencyIn)
  const tokenOutAddr = currencyToApiAddress(currencyOut)

  // Use currency.decimals from the SDK Token — never hardcode
  const amountWei = toWei(amountHuman, currencyIn.decimals)

  const effectiveChainId =
    !currencyIn.isNative && !currencyOut.isNative &&
    (currencyIn as Token).chainId === (currencyOut as Token).chainId
      ? (currencyIn as Token).chainId
      : chainId

  const swapperAddr = swapper || DUMMY_SWAPPER

  // Base request shared between both quote variants
  // autoSlippage: "DEFAULT" — calculated automatically for Uniswap Protocol routes (v2/v3/v4)
  const baseRequest: QuoteRequest = {
    type: 'EXACT_INPUT',
    amount: amountWei,
    tokenIn: tokenInAddr,
    tokenOut: tokenOutAddr,
    tokenInChainId: effectiveChainId,
    tokenOutChainId: effectiveChainId,
    swapper: swapperAddr,
    autoSlippage: 'DEFAULT',
    routingPreference: 'BEST_PRICE',
  }

  debugLog('dual quote start', {
    chainId: effectiveChainId,
    tokenIn: currencyIn.symbol,
    tokenInAddr,
    tokenOut: currencyOut.symbol,
    tokenOutAddr,
    amountHuman,
    amountWei,
    decimalsIn: currencyIn.decimals,
    decimalsOut: currencyOut.decimals,
  })

  let hookQuote: QuoteResponse | null = null
  let baseQuote: QuoteResponse | null = null
  let hookError: QuoteError | null = null
  let baseError: QuoteError | null = null

  // Hook quote: V4 protocol only, hooks-only pools
  // hooksOptions: "V4_HOOKS_ONLY" — only quote routes through v4 pools that have hooks
  try {
    hookQuote = await getQuote({
      ...baseRequest,
      protocols: ['V4'],
      hooksOptions: 'V4_HOOKS_ONLY',
    })
    debugLog('hook quote success', {
      routing: hookQuote.routing,
      output: hookQuote.quote.output.amount,
      gasFeeUSD: hookQuote.quote.gasFeeUSD,
    })
  } catch (err) {
    hookError = toQuoteError('HOOK_QUOTE_FAILED', err)
    debugLog('hook quote failed', hookError)
  }

  // Brief pause between requests to stay within the 3 req/s rate limit
  await sleep(350)

  // Market quote: best route across all protocols (no hook filter)
  try {
    baseQuote = await getQuote(baseRequest)
    debugLog('market quote success', {
      routing: baseQuote.routing,
      output: baseQuote.quote.output.amount,
      gasFeeUSD: baseQuote.quote.gasFeeUSD,
    })
  } catch (err) {
    baseError = toQuoteError('MARKET_QUOTE_FAILED', err)
    debugLog('market quote failed', baseError)
  }

  // Detect "no hook pool" — distinguishable from a general API failure
  const hookErrText = hookError?.message.toLowerCase() ?? ''
  const noHookPool =
    hookError != null &&
    (hookErrText.includes('no quote') ||
      hookErrText.includes('no route') ||
      hookErrText.includes('insufficient liquidity') ||
      hookErrText.includes('no route found'))

  // Calculate output delta using currency.decimals from SDK
  let impactAmount = '0'
  let impactPercent = 0
  let isPositive = false

  if (hookQuote && baseQuote) {
    const hookOut = BigInt(hookQuote.quote.output.amount || '0')
    const baseOut = BigInt(baseQuote.quote.output.amount || '0')
    const diff = hookOut - baseOut

    // Format with the output currency's decimals — from the SDK
    impactAmount = formatSignedWei(diff.toString(), currencyOut.decimals, currencyOut.decimals <= 6 ? 2 : 4)

    if (baseOut > BigInt(0)) {
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

// ─── Well-known swapper placeholder ──────────────────────────────────────────

/**
 * A well-known Ethereum address used as a placeholder swapper when the user
 * has not connected a wallet. vitalik.eth — safe for read-only quotes.
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
