import type { HookPool } from '../types/hook'
import type { TokenDef } from '../types/uniswap'

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

export function mergeTokenOptions(tokens: TokenDef[], selected: Array<TokenDef | null>): TokenDef[] {
  const byAddress = new Map(tokens.map((token) => [token.address.toLowerCase(), token]))

  for (const token of selected) {
    if (!token) continue
    byAddress.set(token.address.toLowerCase(), token)
  }

  return [...byAddress.values()]
}
