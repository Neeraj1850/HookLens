import { ChainId, Ether, Token, WETH9, type Currency } from '@uniswap/sdk-core'
import { toAddress } from '@uniswap/v4-sdk'
import {
  type HookQuoteComparison,
  type QuoteError,
  type QuoteRequest,
  type QuoteResponse,
} from '../types/uniswap'

export type { Currency }

const USDC_MAINNET = new Token(
  ChainId.MAINNET,
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  6,
  'USDC',
  'USD Coin',
)

const DAI_MAINNET = new Token(
  ChainId.MAINNET,
  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  18,
  'DAI',
  'Dai Stablecoin',
)

const USDT_MAINNET = new Token(
  ChainId.MAINNET,
  '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  6,
  'USDT',
  'Tether USD',
)

const USDC_BASE = new Token(
  ChainId.BASE,
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  6,
  'USDC',
  'USD Coin',
)

const DAI_BASE = new Token(
  ChainId.BASE,
  '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  18,
  'DAI',
  'Dai Stablecoin',
)

const USDBC_BASE = new Token(
  ChainId.BASE,
  '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
  6,
  'USDbC',
  'USD Base Coin',
)

const USDC_ARBITRUM = new Token(
  ChainId.ARBITRUM_ONE,
  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  6,
  'USDC',
  'USD Coin',
)

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

export function getTokensForChain(chainId: number): Currency[] {
  return TOKENS_BY_CHAIN[chainId] ?? TOKENS_BY_CHAIN[ChainId.BASE]!
}

export function currencyToApiAddress(currency: Currency): string {
  return toAddress(currency)
}

export function currencySymbol(currency: Currency): string {
  return currency.symbol ?? '???'
}

function getApiKey(): string {
  return String(import.meta.env.VITE_UNISWAP_API_KEY ?? '').trim()
}

function getApiBase(): string {
  const configuredProxy = String(import.meta.env.VITE_UNISWAP_PROXY_URL ?? '').trim()
  if (configuredProxy) return configuredProxy.replace(/\/$/, '')
  return '/hooklens-uniswap/v1'
}

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

async function uniswapFetch<T>(endpoint: string, payload: unknown): Promise<T> {
  const apiKey = getApiKey()
  const url = `${getApiBase()}${endpoint}`
  debugLog('request', { endpoint, url, payload })

  const hasNativeInput =
    payload != null &&
    typeof payload === 'object' &&
    (payload as { tokenIn?: string }).tokenIn === '0x0000000000000000000000000000000000000000'
  const erc20EthEnabled = hasNativeInput ? 'true' : 'false'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-universal-router-version': '2.0',
    'x-erc20eth-enabled': erc20EthEnabled,
    'x-permit2-disabled': 'false',
  }

  if (apiKey) headers['x-api-key'] = apiKey

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
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
      'Invalid Uniswap API key. Set UNISWAP_API_KEY on the proxy server, then restart the dev server.',
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

export async function getDualQuote(
  currencyIn: Currency,
  currencyOut: Currency,
  amountHuman: string,
  chainId: number,
  swapper: string,
): Promise<HookQuoteComparison> {
  const tokenInAddr = currencyToApiAddress(currencyIn)
  const tokenOutAddr = currencyToApiAddress(currencyOut)
  const amountWei = toWei(amountHuman, currencyIn.decimals)

  const effectiveChainId =
    !currencyIn.isNative && !currencyOut.isNative &&
    (currencyIn as Token).chainId === (currencyOut as Token).chainId
      ? (currencyIn as Token).chainId
      : chainId

  const swapperAddr = swapper || DUMMY_SWAPPER

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

  await sleep(350)

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

  const hookErrText = hookError?.message.toLowerCase() ?? ''
  const noHookPool =
    hookError != null &&
    (hookErrText.includes('no quote') ||
      hookErrText.includes('no route') ||
      hookErrText.includes('insufficient liquidity') ||
      hookErrText.includes('no route found'))

  let impactAmount = '0'
  let impactPercent = 0
  let isPositive = false

  if (hookQuote && baseQuote) {
    const hookOut = BigInt(hookQuote.quote.output.amount || '0')
    const baseOut = BigInt(baseQuote.quote.output.amount || '0')
    const diff = hookOut - baseOut

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

export const DUMMY_SWAPPER = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

function toQuoteError(code: string, err: unknown): QuoteError {
  const rawMessage = err instanceof Error ? err.message : String(err)
  const [message, detail] = rawMessage.split(' | ', 2)
  return { code, message: message ?? rawMessage, detail }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function debugLog(label: string, payload: unknown): void {
  if (import.meta.env.VITE_HOOKLENS_DEBUG_QUOTES !== 'true') return
  console.info(`[HookLens quote] ${label}`, payload)
}
