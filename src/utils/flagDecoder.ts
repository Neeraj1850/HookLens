import { isAddress, getAddress } from 'viem'
import type { HookFlags, DecodedHook, HookCategory } from '../types/hook'

const FLAGS = {
  BEFORE_INITIALIZE: BigInt(1) << BigInt(13),
  AFTER_INITIALIZE: BigInt(1) << BigInt(12),
  BEFORE_ADD_LIQUIDITY: BigInt(1) << BigInt(11),
  AFTER_ADD_LIQUIDITY: BigInt(1) << BigInt(10),
  BEFORE_REMOVE_LIQUIDITY: BigInt(1) << BigInt(9),
  AFTER_REMOVE_LIQUIDITY: BigInt(1) << BigInt(8),
  BEFORE_SWAP: BigInt(1) << BigInt(7),
  AFTER_SWAP: BigInt(1) << BigInt(6),
  BEFORE_DONATE: BigInt(1) << BigInt(5),
  AFTER_DONATE: BigInt(1) << BigInt(4),
  BEFORE_SWAP_RETURNS_DELTA: BigInt(1) << BigInt(3),
  AFTER_SWAP_RETURNS_DELTA: BigInt(1) << BigInt(2),
  AFTER_ADD_LIQUIDITY_RETURNS_DELTA: BigInt(1) << BigInt(1),
  AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA: BigInt(1) << BigInt(0),
} as const

export function decodeHookFlags(address: string): HookFlags {
  const addrBigInt = BigInt(address.toLowerCase())
  const flagBits = addrBigInt & BigInt(0x3FFF)

  return {
    beforeInitialize: Boolean(flagBits & FLAGS.BEFORE_INITIALIZE),
    afterInitialize: Boolean(flagBits & FLAGS.AFTER_INITIALIZE),
    beforeAddLiquidity: Boolean(flagBits & FLAGS.BEFORE_ADD_LIQUIDITY),
    afterAddLiquidity: Boolean(flagBits & FLAGS.AFTER_ADD_LIQUIDITY),
    beforeRemoveLiquidity: Boolean(flagBits & FLAGS.BEFORE_REMOVE_LIQUIDITY),
    afterRemoveLiquidity: Boolean(flagBits & FLAGS.AFTER_REMOVE_LIQUIDITY),
    beforeSwap: Boolean(flagBits & FLAGS.BEFORE_SWAP),
    afterSwap: Boolean(flagBits & FLAGS.AFTER_SWAP),
    beforeDonate: Boolean(flagBits & FLAGS.BEFORE_DONATE),
    afterDonate: Boolean(flagBits & FLAGS.AFTER_DONATE),
    beforeSwapReturnsDelta: Boolean(flagBits & FLAGS.BEFORE_SWAP_RETURNS_DELTA),
    afterSwapReturnsDelta: Boolean(flagBits & FLAGS.AFTER_SWAP_RETURNS_DELTA),
    afterAddLiquidityReturnsDelta: Boolean(flagBits & FLAGS.AFTER_ADD_LIQUIDITY_RETURNS_DELTA),
    afterRemoveLiquidityReturnsDelta: Boolean(flagBits & FLAGS.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA),
  }
}

export function getActiveCallbacks(flags: HookFlags): string[] {
  const labelMap: Record<keyof HookFlags, string> = {
    beforeInitialize: 'beforeInitialize',
    afterInitialize: 'afterInitialize',
    beforeAddLiquidity: 'beforeAddLiquidity',
    afterAddLiquidity: 'afterAddLiquidity',
    beforeRemoveLiquidity: 'beforeRemoveLiquidity',
    afterRemoveLiquidity: 'afterRemoveLiquidity',
    beforeSwap: 'beforeSwap',
    afterSwap: 'afterSwap',
    beforeDonate: 'beforeDonate',
    afterDonate: 'afterDonate',
    beforeSwapReturnsDelta: 'beforeSwapReturnsDelta',
    afterSwapReturnsDelta: 'afterSwapReturnsDelta',
    afterAddLiquidityReturnsDelta: 'afterAddLiquidityReturnsDelta',
    afterRemoveLiquidityReturnsDelta: 'afterRemoveLiquidityReturnsDelta',
  }

  return Object.entries(flags)
    .filter(([, active]) => active)
    .map(([key]) => labelMap[key as keyof HookFlags])
}

export function classifyHook(flags: HookFlags): HookCategory {
  const hasSwap = flags.beforeSwap || flags.afterSwap
  const hasLiquidity =
    flags.beforeAddLiquidity ||
    flags.afterAddLiquidity ||
    flags.beforeRemoveLiquidity ||
    flags.afterRemoveLiquidity
  const hasInit = flags.beforeInitialize || flags.afterInitialize

  if (hasSwap && hasLiquidity) return 'full-lifecycle'
  if (hasSwap && !hasLiquidity) return 'swap-only'
  if (hasLiquidity && !hasSwap) return 'liquidity-only'
  if (hasInit && !hasSwap && !hasLiquidity) return 'initialize-only'
  return 'custom'
}

export function decodeHook(address: string, chainId = 8453): DecodedHook {
  if (!isAddress(address)) {
    throw new Error('Invalid Ethereum address')
  }

  const checksummed = getAddress(address)
  const flags = decodeHookFlags(checksummed)
  const activeCallbacks = getActiveCallbacks(flags)
  const category = classifyHook(flags)

  return {
    address: checksummed,
    chainId,
    flags,
    activeCallbacks,
    totalActive: activeCallbacks.length,
    category,
    isValid: true,
  }
}
