import type { CheckExplanation } from '../types/hook'

export const HOOK_EXPLANATIONS: CheckExplanation[] = [
  {
    checkId: 'verified',
    title: 'Why Source Verification Matters',
    why:
      'Without verified source code, you cannot know what a hook actually does. The hook address encodes which callbacks are active, but not the logic inside them.',
    example:
      'A hook claims to be a dynamic fee hook, but its unverified bytecode routes part of every swap to an attacker address.',
    mitigation:
      'Prefer hooks with exact_match verification on Sourcify. Rebuild the source with the same compiler settings and compare bytecode before trusting high-value pools.',
    reference: 'https://sourcify.dev',
  },
  {
    checkId: 'no-selfdestruct',
    title: 'selfdestruct in Hook Contracts',
    why:
      'A hook with selfdestruct can permanently erase its runtime bytecode. Pools keep calling the same hook address, so removing the code can break swaps for every pool using it.',
    example:
      'An owner calls a destroy function. The hook bytecode disappears, and later PoolManager callbacks hit an empty address during swaps.',
    mitigation:
      'Hooks should not include selfdestruct. The hook address is fixed at pool initialization, so destructible hook logic is not a safe upgrade path.',
    reference: 'https://github.com/Uniswap/v4-core/blob/main/src/libraries/Hooks.sol',
  },
  {
    checkId: 'no-delegatecall',
    title: 'delegatecall in Hook Callbacks',
    why:
      'delegatecall executes another contract in the hook storage context. A malicious target can rewrite hook state such as fees, allowlists, or payout addresses.',
    example:
      'beforeSwap delegates to an implementation that the owner can replace. A new implementation redirects outputs or changes fee settings mid-flight.',
    mitigation:
      'Avoid delegatecall in hook callbacks. If upgradeability is unavoidable, use time-locked governance and make the trust assumption explicit.',
  },
  {
    checkId: 'access-control',
    title: 'Access Control on Admin Functions',
    why:
      'Hook admin functions often control fees, thresholds, allowlists, or recipients. If anyone can call them, anyone can change pool behavior.',
    example:
      'A public setFeeMultiplier function lets an attacker set fees to 100%, making swaps unusable or stripping value from LPs.',
    mitigation:
      'Use Ownable, AccessControl, or immutable parameters for privileged settings. Emit events for every sensitive configuration change.',
    reference: 'https://docs.openzeppelin.com/contracts/access-control',
  },
  {
    checkId: 'no-reentrancy',
    title: 'Reentrancy in Hook Callbacks',
    why:
      'Hook callbacks run during PoolManager execution. External calls before state updates can re-enter hook logic and corrupt accounting.',
    example:
      'afterSwap sends ETH before updating balances. A malicious receiver re-enters and triggers another action before accounting is finalized.',
    mitigation:
      'Use checks-effects-interactions. Update state before external calls and add ReentrancyGuard for hooks that move value.',
  },
  {
    checkId: 'beforeswap-delta',
    title: 'beforeSwap Return Type',
    why:
      'In Uniswap v4, beforeSwap must return the expected selector, BeforeSwapDelta, and fee value. Incorrect return data can make swaps revert.',
    example:
      'A hook returns only bytes4 from beforeSwap. PoolManager expects the full tuple and every swap through the pool reverts.',
    mitigation:
      'Return the complete beforeSwap tuple and use BeforeSwapDeltaLibrary.ZERO_DELTA when the hook does not modify amounts.',
    reference: 'https://github.com/Uniswap/v4-core/blob/main/src/interfaces/IHooks.sol',
  },
  {
    checkId: 'no-tx-origin',
    title: 'tx.origin Authentication',
    why:
      'tx.origin is the original signer, not the direct caller. Authentication based on tx.origin can be bypassed through phishing contracts.',
    example:
      'An admin signs a transaction to a malicious contract, which then calls a privileged hook function while tx.origin is still the admin.',
    mitigation:
      'Use msg.sender with explicit access control. Never use tx.origin for authorization.',
  },
  {
    checkId: 'no-arbitrary-external',
    title: 'External Calls in afterSwap',
    why:
      'afterSwap runs on every swap. Calls to arbitrary contracts can revert, behave maliciously, or expand the hook attack surface.',
    example:
      'afterSwap calls an external oracle. If the oracle is compromised or starts reverting, swaps through the hooked pool fail.',
    mitigation:
      'Keep callback calls minimal, call only trusted contracts, and use try/catch for non-critical external integrations.',
  },
  {
    checkId: 'centralization',
    title: 'Centralization Risk',
    why:
      'A single owner that can change hook parameters creates a major trust assumption for swappers and LPs.',
    example:
      'An owner changes the fee recipient to their own address or raises fees after liquidity has entered the pool.',
    mitigation:
      'Use immutable parameters, multisigs, time-locks, or DAO control for sensitive settings.',
  },
  {
    checkId: 'flags-match',
    title: 'Permission Flags vs Implementation',
    why:
      'Hook permission bits determine which callbacks PoolManager will call. Flags that do not match implemented functions can permanently brick pool actions.',
    example:
      'BEFORE_SWAP_FLAG is set, but beforeSwap has the wrong signature. Every swap through the pool reverts.',
    mitigation:
      'Only set flags for callbacks that are fully implemented and tested. Validate permissions in the hook test suite.',
  },
  {
    checkId: 'assembly-safety',
    title: 'Inline Assembly Safety',
    why:
      'Inline assembly bypasses Solidity safety checks. Unsafe calldata or memory operations can create subtle storage and accounting bugs.',
    example:
      'Assembly copies user calldata without bounds checks and overwrites a configuration slot used to calculate hook fees.',
    mitigation:
      'Avoid assembly unless needed. Document each block and review bounds, memory writes, and storage writes carefully.',
  },
  {
    checkId: 'flash-loan-safety',
    title: 'Flash Loan Price Manipulation',
    why:
      'Hooks that use spot pool price for decisions can be manipulated within one transaction using flash liquidity.',
    example:
      'An attacker moves the spot price, triggers a lower dynamic fee, performs a large swap, then restores price before the transaction ends.',
    mitigation:
      'Use TWAP data, minimum observation windows, and delayed updates for price-sensitive hook behavior.',
    reference: 'https://docs.uniswap.org/contracts/v4/overview',
  },
]

export function getExplanation(checkId: string): CheckExplanation | null {
  return HOOK_EXPLANATIONS.find((explanation) => explanation.checkId === checkId) ?? null
}
