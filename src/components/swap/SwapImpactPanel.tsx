import { SUPPORTED_CHAINS } from '../../config/constants'
import { useSwapSimulator } from '../../hooks/useSwapSimulator'
import { getTokensForChain } from '../../api/uniswap'
import { AmountInput } from './AmountInput'
import { QuoteRow } from './QuoteRow'
import { TokenSelector } from './TokenSelector'
import { LoadingDots } from '../shared/LoadingDots'
import { LoadingSkeleton } from '../shared/LoadingSkeleton'
import { mergeTokenOptions } from '../../utils/token'

// Chains that the Trading API supports for quotes
const QUOTABLE_CHAIN_IDS = [8453, 1, 42161]

export function SwapImpactPanel() {
  const {
    tokenIn,
    tokenOut,
    amount,
    chainId,
    comparison,
    tokensSource,
    isLoading,
    error,
    fetchQuotes,
    setTokenIn,
    setTokenOut,
    setAmount,
    setChainId,
    swapTokens,
  } = useSwapSimulator()

  const tokens = mergeTokenOptions(getTokensForChain(chainId), [tokenIn, tokenOut])
  const selectedChain = SUPPORTED_CHAINS.find((chain) => chain.id === chainId)
  const canFetch = !isLoading && !!tokenIn && !!tokenOut && !!amount && parseFloat(amount) > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
            Live Swap Impact
          </span>
          <p className="text-xs text-zinc-500">
            Compares V4 hook-only route vs best available market route via the Uniswap Trading API
          </p>
        </div>

        {/* Chain selector */}
        <div className="flex flex-wrap gap-1">
          {SUPPORTED_CHAINS.filter((c) => QUOTABLE_CHAIN_IDS.includes(c.id)).map((chain) => (
            <button
              key={chain.id}
              onClick={() => setChainId(chain.id)}
              className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
                chainId === chain.id
                  ? 'bg-white text-black font-medium'
                  : 'text-zinc-600 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              {chain.shortName}
            </button>
          ))}
        </div>
      </div>

      {/* Token pair selector */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
        <TokenSelector
          label="Token In"
          token={tokenIn}
          tokens={tokens}
          onChange={setTokenIn}
          disabled={isLoading}
        />

        <button
          onClick={swapTokens}
          disabled={isLoading}
          className="mb-px w-9 h-9 rounded-lg border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white transition-colors flex items-center justify-center text-sm disabled:opacity-40"
          aria-label="Swap token direction"
        >
          ⇄
        </button>

        <TokenSelector
          label="Token Out"
          token={tokenOut}
          tokens={tokens}
          onChange={setTokenOut}
          disabled={isLoading}
        />
      </div>

      {/* Pool token hint */}
      {tokensSource && (
        <p className="text-[10px] text-zinc-600 -mt-2">
          Using tokens from pool:{' '}
          <span className="font-mono text-zinc-400">{tokensSource}</span>
          {' '}— discover pools below to get real token addresses
        </p>
      )}

      {/* Amount input */}
      <AmountInput
        value={amount}
        onChange={setAmount}
        symbol={tokenIn?.symbol ?? 'ETH'}
        disabled={isLoading}
      />

      {/* Fetch button */}
      <button
        onClick={fetchQuotes}
        disabled={!canFetch}
        className="w-full py-3 rounded-xl bg-white text-black text-sm font-medium hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <LoadingDots /> Fetching quotes…
          </>
        ) : (
          'Compare Hook vs Market Route →'
        )}
      </button>

      {/* Error state */}
      {error && !isLoading && (
        <div className="border border-zinc-800 rounded-xl px-4 py-3 flex flex-col gap-1.5">
          <p className="text-xs font-medium text-zinc-400">Quote failed</p>
          <p className="text-xs text-zinc-500 leading-relaxed">{error}</p>
          {error.toLowerCase().includes('api key') && (
            <p className="text-[10px] text-zinc-700 mt-0.5">
              Add VITE_UNISWAP_API_KEY to your .env file and restart the dev server.
            </p>
          )}
          {error.toLowerCase().includes('proxy') && (
            <p className="text-[10px] text-zinc-700 mt-0.5">
              Make sure you are running <code className="font-mono">npm run dev</code> so the local
              proxy is active.
            </p>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          <LoadingSkeleton className="h-16" lines={2} />
        </div>
      )}

      {/* Results */}
      {comparison && !isLoading && (
        <div className="flex flex-col gap-3 animate-slide-up">
          {/* No hook pool notice */}
          {comparison.noHookPool && (
            <div className="border border-zinc-800 rounded-xl px-5 py-4 flex flex-col gap-1">
              <p className="text-xs text-zinc-400 font-medium">
                No v4 hook pool found for this pair
              </p>
              <p className="text-[10px] text-zinc-600 leading-relaxed">
                The Trading API returned no hook-only route on{' '}
                {selectedChain?.name ?? `chain ${chainId}`}. The baseline route is shown below.
              </p>
            </div>
          )}

          {/* Hook quote */}
          {!comparison.noHookPool && (
            <QuoteRow
              label="With Hook (V4 only)"
              quote={comparison.hookQuote}
              error={comparison.hookError}
              isLoading={false}
              highlight={comparison.isPositive}
            />
          )}

          {/* Base quote */}
          <QuoteRow
            label="Best Market Route"
            quote={comparison.baseQuote}
            error={comparison.baseError}
            isLoading={false}
            highlight={!comparison.isPositive && !comparison.noHookPool}
          />

          {/* Impact summary */}
          {comparison.hookQuote && comparison.baseQuote && (
            <div className="border-t border-border pt-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Hook Impact</span>
                <span
                  className={`text-sm font-mono font-semibold ${
                    comparison.isPositive ? 'text-emerald-400' : 'text-zinc-400'
                  }`}
                >
                  {comparison.impactAmount} {comparison.baseQuote.quote.output.token.symbol}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Impact %</span>
                <span
                  className={`text-xs font-mono ${
                    comparison.isPositive ? 'text-emerald-400' : 'text-zinc-400'
                  }`}
                >
                  {comparison.impactPercent > 0 ? '+' : ''}
                  {comparison.impactPercent.toFixed(3)}%
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-zinc-500">Better for swapper</span>
                <span
                  className={`text-xs ${
                    comparison.isPositive ? 'text-emerald-400' : 'text-zinc-500'
                  }`}
                >
                  {comparison.isPositive ? 'Yes — hook improves price' : 'No — hook reduces output'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-zinc-500">Routing</span>
                <div className="flex gap-2 text-[10px] font-mono text-zinc-600">
                  <span>hook: {comparison.hookQuote.routing}</span>
                  <span className="text-zinc-800">|</span>
                  <span>base: {comparison.baseQuote.routing}</span>
                </div>
              </div>
            </div>
          )}

          <p className="text-[10px] text-zinc-800 text-right">
            Fetched {new Date(comparison.fetchedAt).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  )
}
