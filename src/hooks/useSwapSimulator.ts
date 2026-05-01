import { useCallback, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { DUMMY_SWAPPER, getDualQuote, getTokensForChain } from '../api/uniswap'
import { useHookStore } from '../store/hookStore'

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

  useEffect(() => {
    if (!simTokenIn || !simTokenOut) {
      const tokens = getTokensForChain(simChainId)
      if (!simTokenIn) setSimTokenIn(tokens[0] ?? null)
      if (!simTokenOut) setSimTokenOut(tokens[1] ?? null)
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
      const result = await getDualQuote(
        simTokenIn,
        simTokenOut,
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
      const tokens = getTokensForChain(chainId)
      setSimChainId(chainId)
      setSimTokenIn(tokens[0] ?? null)
      setSimTokenOut(tokens[1] ?? null)
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
