import { UNISWAP_API_BASE } from '../config/constants'
import type { QuoteRequest, QuoteResponse } from '../types/uniswap'

const apiKey = import.meta.env.VITE_UNISWAP_API_KEY ?? ''

export async function requestQuote(_request: QuoteRequest): Promise<QuoteResponse> {
  throw new Error(
    `Uniswap Trading API integration starts in Phase 2. Base URL: ${UNISWAP_API_BASE}. API key configured: ${Boolean(apiKey)}`,
  )
}
