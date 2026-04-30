import {
  UNISWAP_API_BASE,
  type HookQuoteComparison,
  type QuoteError,
  type QuoteRequest,
  type QuoteResponse,
  type TokenDef,
} from '../types/uniswap'

const API_KEY_STORAGE_KEY = 'hooklens_uniswap_api_key'

function getApiKey(): string {
  const fromStorage =
    typeof localStorage === 'undefined' ? null : localStorage.getItem(API_KEY_STORAGE_KEY)
  const fromEnv = import.meta.env.VITE_UNISWAP_API_KEY
  return fromStorage ?? fromEnv ?? ''
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0
}

export function saveApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key.trim())
}

async function uniswapFetch<T>(endpoint: string, body: unknown): Promise<T> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(
      'Uniswap API key not set. Add it in Settings or set VITE_UNISWAP_API_KEY in your .env file.',
    )
  }

  const url = `${UNISWAP_API_BASE}${endpoint}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let errorMessage = `API error ${res.status}`
    try {
      const errorBody = (await res.json()) as { message?: string; error?: string }
      errorMessage = errorBody.message ?? errorBody.error ?? errorMessage
    } catch {
      // Ignore parse errors and keep the status-based fallback.
    }

    if (res.status === 401) {
      throw new Error('Invalid API key. Check your key in Settings.')
    }
    if (res.status === 429) {
      throw new Error('Rate limit exceeded. Wait a moment and try again.')
    }
    if (res.status === 400) {
      throw new Error(`Bad request: ${errorMessage}`)
    }
    throw new Error(errorMessage)
  }

  return res.json() as Promise<T>
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getQuote(request: QuoteRequest): Promise<QuoteResponse> {
  return uniswapFetch<QuoteResponse>('/quote', request)
}

export async function getDualQuote(
  tokenIn: TokenDef,
  tokenOut: TokenDef,
  amountHuman: string,
  chainId: number,
  swapper: string,
): Promise<HookQuoteComparison> {
  const amountWei = toWei(amountHuman, tokenIn.decimals)
  const baseRequest: QuoteRequest = {
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    tokenInChainId: chainId,
    tokenOutChainId: chainId,
    amount: amountWei,
    type: 'EXACT_INPUT',
    swapper,
    autoSlippage: 'DEFAULT',
    protocols: ['V4'],
    routingPreference: 'BEST_PRICE',
  }

  let hookQuote: QuoteResponse | null = null
  let baseQuote: QuoteResponse | null = null
  let hookError: QuoteError | null = null
  let baseError: QuoteError | null = null

  try {
    hookQuote = await getQuote({
      ...baseRequest,
      hooksOptions: 'V4_HOOKS_ONLY',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    hookError = { code: 'HOOK_QUOTE_FAILED', message: msg }
  }

  await delay(400)

  try {
    baseQuote = await getQuote({
      ...baseRequest,
      hooksOptions: 'V4_NO_HOOKS',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    baseError = { code: 'BASE_QUOTE_FAILED', message: msg }
  }

  const hookErrorText = hookError?.message.toLowerCase() ?? ''
  const noHookPool =
    hookError !== null &&
    (hookErrorText.includes('no quotes') ||
      hookErrorText.includes('no route') ||
      hookErrorText.includes('insufficient liquidity'))

  let impactAmount = '0'
  let impactPercent = 0
  let isPositive = false

  if (hookQuote && baseQuote) {
    const hookOut = BigInt(hookQuote.quote.output.amount || '0')
    const baseOut = BigInt(baseQuote.quote.output.amount || '0')
    const diff = hookOut - baseOut

    impactAmount = formatSignedTokenAmount(
      diff.toString(),
      tokenOut.decimals,
      tokenOut.decimals <= 6 ? 2 : 4,
    )

    if (baseOut > BigInt(0)) {
      impactPercent = Number((diff * BigInt(100_000)) / baseOut) / 1000
    }

    isPositive = diff >= BigInt(0)
  }

  return {
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
}

export function toWei(amount: string, decimals: number): string {
  try {
    const normalized = amount.trim()
    if (!/^\d+(\.\d+)?$/.test(normalized)) {
      throw new Error('Invalid numeric amount')
    }

    const [whole, fraction = ''] = normalized.split('.')
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
    const scale = BigInt(10) ** BigInt(decimals)
    const wei = BigInt(whole || '0') * scale + BigInt(paddedFraction || '0')
    return wei.toString()
  } catch {
    throw new Error(`Invalid amount: ${amount}`)
  }
}

function formatSignedTokenAmount(
  amountWei: string,
  decimals: number,
  displayDecimals = 4,
): string {
  try {
    const abs = amountWei.startsWith('-') ? amountWei.slice(1) : amountWei
    const negative = amountWei.startsWith('-')
    const num = Number(BigInt(abs || '0')) / 10 ** decimals
    return `${negative ? '-' : '+'}${num.toFixed(displayDecimals)}`
  } catch {
    return '-'
  }
}

export const TOKENS_BY_CHAIN: Record<number, TokenDef[]> = {
  8453: [
    {
      address: '0x0000000000000000000000000000000000000000',
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
  1: [
    {
      address: '0x0000000000000000000000000000000000000000',
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
  ],
  42161: [
    {
      address: '0x0000000000000000000000000000000000000000',
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
  ],
}

export function getTokensForChain(chainId: number): TokenDef[] {
  return TOKENS_BY_CHAIN[chainId] ?? TOKENS_BY_CHAIN[8453]
}

export const DUMMY_SWAPPER = '0x0000000000000000000000000000000000000001'
