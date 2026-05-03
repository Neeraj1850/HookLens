import { Token, Ether, type Currency } from '@uniswap/sdk-core'
import type { HookPool } from '../types/hook'
import type { TokenDef } from '../types/uniswap'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

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

export function tokenDefToCurrency(tokenDef: TokenDef): Currency {
  const addr = tokenDef.address.toLowerCase()
  if (addr === ZERO_ADDRESS) {
    return Ether.onChain(tokenDef.chainId)
  }
  return new Token(
    tokenDef.chainId,
    tokenDef.address,
    tokenDef.decimals,
    tokenDef.symbol,
    tokenDef.name,
  )
}
