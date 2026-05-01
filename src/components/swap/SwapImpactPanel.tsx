import { SUPPORTED_CHAINS } from '../../config/constants'
import { useSwapSimulator } from '../../hooks/useSwapSimulator'
import { getTokensForChain } from '../../api/uniswap'
import { AmountInput } from './AmountInput'
import { QuoteRow } from './QuoteRow'
import { TokenSelector } from './TokenSelector'
import { LoadingDots } from '../shared/LoadingDots'
import { LoadingSkeleton } from '../shared/LoadingSkeleton'

export function SwapImpactPanel() {
  const {
    tokenIn,
    tokenOut,
    amount,
    chainId,
    comparison,
    isLoading,
    error,
    fetchQuotes,
    setTokenIn,
    setTokenOut,
    setAmount,
    setChainId,
    swapTokens,
  } = useSwapSimulator()

  const tokens = getTokensForChain(chainId)
  const selectedChain = SUPPORTED_CHAINS.find((chain) => chain.id === chainId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
            Live Swap Impact
          </span>
          <p className="text-xs text-zinc-500">
            Powered by Uniswap Trading API | hooksOptions comparison
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          {SUPPORTED_CHAINS.filter((c) => [8453, 1, 42161].includes(c.id)).map((chain) => (
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

      <AmountInput
        value={amount}
        onChange={setAmount}
        symbol={tokenIn?.symbol ?? 'ETH'}
        disabled={isLoading}
      />

      <button
        onClick={fetchQuotes}
        disabled={isLoading || !tokenIn || !tokenOut}
        className="w-full py-3 rounded-xl bg-white text-black text-sm font-medium hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <LoadingDots /> Fetching quotes...
          </>
        ) : (
          'Compare Hook vs No-Hook ->'
        )}
      </button>

      {error && (
        <div className="border border-zinc-800 rounded-xl px-4 py-3">
          <p className="text-xs text-zinc-500">{error}</p>
          {error.includes('API key') && (
            <p className="text-xs text-zinc-700 mt-1">Add your key in Settings</p>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          <LoadingSkeleton className="h-16" lines={2} />
        </div>
      )}

      {comparison && !isLoading && (
        <div className="flex flex-col gap-3 animate-slide-up">
          {comparison.noHookPool && (
            <div className="border border-zinc-800 rounded-xl px-5 py-4">
              <p className="text-xs text-zinc-500 font-medium">
                No v4 hook pool found for this pair on {selectedChain?.name ?? `chain ${chainId}`}
              </p>
              <p className="text-[10px] text-zinc-700 mt-1">
                V4_HOOKS_ONLY returned no routes. The base quote (no hook) is shown below.
              </p>
            </div>
          )}

          {!comparison.noHookPool && (
            <QuoteRow
              label="With Hook (V4_HOOKS_ONLY)"
              quote={comparison.hookQuote}
              error={comparison.hookError}
              isLoading={false}
              highlight={comparison.isPositive}
            />
          )}

          <QuoteRow
            label="Without Hook (V4_NO_HOOKS)"
            quote={comparison.baseQuote}
            error={comparison.baseError}
            isLoading={false}
            highlight={!comparison.isPositive && !comparison.noHookPool}
          />

          {comparison.hookQuote && comparison.baseQuote && (
            <div className="border-t border-border pt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Hook Impact</span>
                <span
                  className={`text-sm font-mono font-semibold ${
                    comparison.isPositive ? 'text-white' : 'text-zinc-400'
                  }`}
                >
                  {comparison.isPositive ? '+' : ''}
                  {comparison.impactAmount} {comparison.baseQuote.quote.output.token.symbol}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Impact %</span>
                <span className="text-xs font-mono text-zinc-300">
                  {comparison.impactPercent > 0 ? '+' : ''}
                  {comparison.impactPercent.toFixed(3)}%
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-zinc-500">Better for swapper</span>
                <span className="text-xs text-zinc-300 text-right">
                  {comparison.isPositive ? 'Yes - hook improves price' : 'No - hook reduces output'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-zinc-500">Routing</span>
                <div className="flex gap-2">
                  <span className="text-[10px] font-mono text-zinc-600">
                    hook: {comparison.hookQuote.routing}
                  </span>
                  <span className="text-[10px] text-zinc-800">|</span>
                  <span className="text-[10px] font-mono text-zinc-600">
                    base: {comparison.baseQuote.routing}
                  </span>
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
