/**
 * Token utility helpers — bridges between subgraph pool token data and
 * the @uniswap/sdk-core Currency type used by the Trading API layer.
 *
 * The subgraph returns raw pool token objects (id, symbol, decimals).
 * The SDK requires Token or NativeCurrency instances.
 * These helpers convert between the two without duplicating address/decimal knowledge.
 */

import { Token, Ether, type Currency } from '@uniswap/sdk-core'
import type { HookPool } from '../types/hook'
import type { TokenDef } from '../types/uniswap'

/** The zero address used by both native ETH and the Trading API */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * Convert a subgraph pool token (with raw id/symbol/decimals) to a TokenDef.
 * TokenDef is used as a thin intermediate type for storage and display.
 */
export function poolTokenToTokenDef(
  token: HookPool['token0'] | HookPool['token1'],
  chainId: number,
): TokenDef {
  const symbol = token.symbol || '???'
  return {
    address: token.id,
    symbol,
    decimals: token.decimals,
    chainId,
    name: symbol,
    logoChar: symbol.charAt(0).toUpperCase() || '?',
  }
}

/**
 * Convert a TokenDef to an SDK Currency object suitable for getDualQuote().
 *
 * - If the address is the zero address → returns Ether.onChain(chainId)
 *   (native ETH; toAddress() will correctly resolve to 0x000...000)
 * - Otherwise → returns a Token instance with address, decimals, and symbol
 *   from the TokenDef (which sourced them from the subgraph or SDK catalog)
 */
export function tokenDefToCurrency(tokenDef: TokenDef): Currency {
  const addr = tokenDef.address.toLowerCase()
  if (addr === ZERO_ADDRESS) {
    return Ether.onChain(tokenDef.chainId)
  }
  return new Token(
    tokenDef.chainId,
    tokenDef.address, // checksummed address from the TokenDef
    tokenDef.decimals,
    tokenDef.symbol,
    tokenDef.name,
  )
}

/**
 * Convert an SDK Currency back to a display-friendly TokenDef.
 * Useful when the UI needs a uniform shape for rendering (e.g. select options).
 */
export function currencyToTokenDef(currency: Currency, chainId?: number): TokenDef {
  const resolvedChainId = currency.isNative ? (chainId ?? 1) : (currency as Token).chainId
  const address = currency.isNative ? ZERO_ADDRESS : (currency as Token).address
  const symbol = currency.symbol ?? '???'
  return {
    address,
    symbol,
    decimals: currency.decimals,
    chainId: resolvedChainId,
    name: currency.name ?? symbol,
    logoChar: symbol.charAt(0).toUpperCase() || '?',
  }
}

/**
 * Merge a chain's default token list with any pool-specific tokens,
 * deduplicating by address. Pool tokens are inserted after the defaults.
 */
export function mergeTokenOptions(tokens: TokenDef[], selected: Array<TokenDef | null>): TokenDef[] {
  const byAddress = new Map(tokens.map((token) => [token.address.toLowerCase(), token]))
  for (const token of selected) {
    if (!token) continue
    byAddress.set(token.address.toLowerCase(), token)
  }
  return [...byAddress.values()]
}
