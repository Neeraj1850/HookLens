/**
 * useSwapSimulator
 *
 * Bridges the Zustand store (which holds TokenDef for persistence/pool-linking)
 * with the @uniswap/sdk-core Currency types required by getDualQuote.
 *
 * - tokenDefToCurrency: converts stored TokenDef → SDK Currency for quote calls
 * - currencyToTokenDef: converts SDK Currency (from getTokensForChain) → TokenDef for storage
 */

import { useCallback, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { DUMMY_SWAPPER, getDualQuote, getTokensForChain } from '../api/uniswap'
import { useHookStore } from '../store/hookStore'
import { tokenDefToCurrency, currencyToTokenDef } from '../utils/token'

export function useSwapSimulator() {
  const {
    simTokenIn,
    simTokenOut,
    simTokensSource,
    simAmount,
    simChainId,
    quoteComparison,
    isFetchingQuotes,
    quoteError,
    setSimTokenIn,
    setSimTokenOut,
    setSimAmount,
    setSimChainId,
    setQuoteComparison,
    setFetchingQuotes,
    setQuoteError,
    swapTokens,
  } = useHookStore()

  const { address: walletAddress } = useAccount()

  // On mount / chain change: seed default tokens from SDK catalog if store is empty.
  // getTokensForChain returns Currency[] — convert to TokenDef for the store.
  useEffect(() => {
    if (!simTokenIn || !simTokenOut) {
      const currencies = getTokensForChain(simChainId)
      if (!simTokenIn && currencies[0]) setSimTokenIn(currencyToTokenDef(currencies[0], simChainId))
      if (!simTokenOut && currencies[1]) setSimTokenOut(currencyToTokenDef(currencies[1], simChainId))
    }
  }, [simChainId, simTokenIn, simTokenOut, setSimTokenIn, setSimTokenOut])

  const fetchQuotes = useCallback(async () => {
    if (!simTokenIn || !simTokenOut) return
    if (!simAmount || Number.isNaN(parseFloat(simAmount))) return
    if (parseFloat(simAmount) <= 0) return

    setFetchingQuotes(true)
    setQuoteError(null)

    try {
      const swapper = walletAddress ? String(walletAddress) : DUMMY_SWAPPER

      // Convert store TokenDef → SDK Currency for the Trading API call.
      // tokenDefToCurrency uses Ether.onChain() for native ETH and Token() for ERC-20s.
      const currencyIn  = tokenDefToCurrency(simTokenIn)
      const currencyOut = tokenDefToCurrency(simTokenOut)

      const result = await getDualQuote(
        currencyIn,
        currencyOut,
        simAmount,
        simChainId,
        swapper,
      )
      setQuoteComparison(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch quotes'
      setQuoteError(msg)
      setQuoteComparison(null)
    } finally {
      setFetchingQuotes(false)
    }
  }, [
    simTokenIn,
    simTokenOut,
    simAmount,
    simChainId,
    walletAddress,
    setFetchingQuotes,
    setQuoteError,
    setQuoteComparison,
  ])

  const handleChainChange = useCallback(
    (chainId: number) => {
      const currencies = getTokensForChain(chainId)
      setSimChainId(chainId)
      // Convert SDK Currency → TokenDef for the store
      setSimTokenIn(currencies[0]  ? currencyToTokenDef(currencies[0],  chainId) : null)
      setSimTokenOut(currencies[1] ? currencyToTokenDef(currencies[1], chainId) : null)
      setQuoteComparison(null)
    },
    [setSimChainId, setSimTokenIn, setSimTokenOut, setQuoteComparison],
  )

  return {
    tokenIn: simTokenIn,
    tokenOut: simTokenOut,
    amount: simAmount,
    chainId: simChainId,
    comparison: quoteComparison,
    tokensSource: simTokensSource,
    isLoading: isFetchingQuotes,
    error: quoteError,
    fetchQuotes,
    setTokenIn: setSimTokenIn,
    setTokenOut: setSimTokenOut,
    setAmount: setSimAmount,
    setChainId: handleChainChange,
    swapTokens,
  }
}
