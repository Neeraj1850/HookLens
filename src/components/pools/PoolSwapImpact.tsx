import { useEffect, useMemo, useState } from 'react'
import { isAddress } from 'viem'
import { useAccount } from 'wagmi'
import { comparePoolMarket } from '../../api/poolDiscovery'
import { DUMMY_SWAPPER, getDualQuote, toWei } from '../../api/uniswap'
import type { HookPool, PoolMarketComparison } from '../../types/hook'
import type { HookQuoteComparison, TokenDef } from '../../types/uniswap'
import { formatUSD } from '../../utils/format'
import { tokenDefToCurrency } from '../../utils/token'
import { LoadingSkeleton } from '../shared/LoadingSkeleton'
import { QuoteRow } from '../swap/QuoteRow'

interface PoolSwapImpactProps {
  pool: HookPool
  chainId: number
}

const NATIVE_CURRENCY = '0x0000000000000000000000000000000000000000'

function toTokenDef(
  token: HookPool['token0'],
  chainId: number,
  fallbackLogo: string,
): TokenDef {
  const symbol = token.id.toLowerCase() === NATIVE_CURRENCY ? 'ETH' : token.symbol

  return {
    address: token.id,
    symbol,
    decimals: token.decimals,
    chainId,
    name: symbol,
    logoChar: symbol[0] ?? fallbackLogo,
  }
}

function formatPair(tokenIn: TokenDef, tokenOut: TokenDef): string {
  return `${tokenIn.symbol} -> ${tokenOut.symbol}`
}

function shortAddress(address: string): string {
  return address.length === 42 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address
}

function formatFee(feeTier: number): string {
  return `${(feeTier / 10000).toFixed(2)}%`
}

function formatLiquidity(liquidity: string): string {
  const n = parseFloat(liquidity)
  if (Number.isNaN(n) || n === 0) return '-'
  if (n >= 1e18) return `${(n / 1e18).toFixed(1)}T`
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}B`
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}M`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}K`
  return n.toFixed(0)
}

function isNoRoute(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('no quote') ||
    lower.includes('no quotes') ||
    lower.includes('no route') ||
    lower.includes('insufficient liquidity')
  )
}

function hasSevereHookImpact(comparison: HookQuoteComparison): boolean {
  return Boolean(
    comparison.hookQuote &&
      comparison.baseQuote &&
      Number.isFinite(comparison.impactPercent) &&
      comparison.impactPercent < -50,
  )
}

function QuotePayloadPreview({
  tokenIn,
  tokenOut,
  amount,
  chainId,
  swapper,
  pool,
}: {
  tokenIn: TokenDef
  tokenOut: TokenDef
  amount: string
  chainId: number
  swapper: string
  pool: HookPool
}) {
  let amountWei: string
  try {
    amountWei = toWei(amount, tokenIn.decimals)
  } catch {
    amountWei = 'invalid amount'
  }

  return (
    <details className="rounded-xl border border-zinc-900 px-4 py-3">
      <summary className="cursor-pointer text-[10px] text-zinc-600 uppercase tracking-widest">
        Quote Payload
      </summary>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[
          ['Pool ID', pool.id],
          ['Hook', pool.hook],
          ['tokenIn', tokenIn.address],
          ['tokenOut', tokenOut.address],
          ['tokenInChainId', String(chainId)],
          ['tokenOutChainId', String(chainId)],
          ['amount', amountWei],
          ['swapper', swapper],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <span className="block text-[10px] text-zinc-800">{label}</span>
            <span className="block text-[10px] font-mono text-zinc-500 truncate">{value}</span>
          </div>
        ))}
      </div>
    </details>
  )
}

function PoolBucket({
  label,
  tone,
  pools,
}: {
  label: string
  tone: string
  pools: HookPool[]
}) {
  return (
    <div className="rounded-xl border border-zinc-900 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{label}</span>
        <span className="text-[10px] text-zinc-700">{pools.length} pools</span>
      </div>

      {pools.length === 0 ? (
        <p className="text-xs text-zinc-700 leading-relaxed">
          No indexed same-pair pools in this bucket.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {pools.slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-lg bg-zinc-950/60 border border-zinc-900 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-400 font-mono">
                  {item.token0.symbol}/{item.token1.symbol}
                </span>
                <span className={`text-[10px] ${tone}`}>{formatFee(item.feeTier)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  ['Liq', formatLiquidity(item.liquidity)],
                  ['Vol', item.volumeUSD !== '0' ? formatUSD(parseFloat(item.volumeUSD)) : '-'],
                  ['Tx', item.txCount > 0 ? item.txCount.toLocaleString() : '-'],
                ].map(([metric, value]) => (
                  <div key={metric} className="min-w-0">
                    <span className="block text-[10px] text-zinc-800">{metric}</span>
                    <span className="block text-[10px] text-zinc-500 font-mono truncate">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-mono text-zinc-800 truncate mt-2">{item.id}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PoolSwapImpact({ pool, chainId }: PoolSwapImpactProps) {
  const quoteChainId = pool.chainId || chainId
  const [amount, setAmount] = useState('1')
  const [isReversed, setIsReversed] = useState(false)
  const [comparison, setComparison] = useState<HookQuoteComparison | null>(null)
  const [marketComparison, setMarketComparison] = useState<PoolMarketComparison | null>(null)
  const [isLoadingMarket, setIsLoadingMarket] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { address: walletAddress } = useAccount()

  const [tokenA, tokenB] = useMemo(
    () => [
      toTokenDef(pool.token0, quoteChainId, 'A'),
      toTokenDef(pool.token1, quoteChainId, 'B'),
    ],
    [quoteChainId, pool.token0, pool.token1],
  )

  const tokenIn = isReversed ? tokenB : tokenA
  const tokenOut = isReversed ? tokenA : tokenB
  const swapper = walletAddress ? String(walletAddress) : DUMMY_SWAPPER
  const canQuote = isAddress(tokenIn.address) && isAddress(tokenOut.address)
  const bothQuotePathsFailed = Boolean(
    comparison &&
      !comparison.hookQuote &&
      !comparison.baseQuote &&
      comparison.hookError &&
      comparison.baseError,
  )
  const hookOnlyUnavailable = Boolean(comparison?.noHookPool && !comparison.hookQuote)
  const hasMarketQuote = Boolean(comparison?.baseQuote)
  const severeHookImpact = comparison ? hasSevereHookImpact(comparison) : false
  const hasNoHookLiquidity = (marketComparison?.totalNoHookPools ?? 0) > 0

  useEffect(() => {
    let cancelled = false

    async function fetchMarketComparison() {
      setIsLoadingMarket(true)
      const result = await comparePoolMarket(pool, quoteChainId)
      if (!cancelled) {
        setMarketComparison(result)
        setIsLoadingMarket(false)
      }
    }

    void fetchMarketComparison()

    return () => {
      cancelled = true
    }
  }, [quoteChainId, pool])

  const fetchImpact = async () => {
    if (!canQuote) {
      setError('Pool token addresses are incomplete, so this pair cannot be quoted.')
      return
    }

    setIsLoading(true)
    setError(null)
    setComparison(null)

    try {
      const currencyIn  = tokenDefToCurrency(tokenIn)
      const currencyOut = tokenDefToCurrency(tokenOut)
      const result = await getDualQuote(
        currencyIn,
        currencyOut,
        amount,
        quoteChainId,
        swapper,
      )
      setComparison(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap impact quote failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="border-t border-[#141414] pt-4 mt-1 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
          Pool-Scoped Swap Impact
        </span>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Uses this pool row&apos;s token pair from the subgraph, then compares Uniswap Trading API
          routes with <span className="font-mono text-zinc-400">V4_HOOKS_ONLY</span> and{' '}
          <span className="font-mono text-zinc-400">V4_NO_HOOKS</span>. The API compares route
          classes for this pair; it does not force this exact pool ID.
        </p>
      </div>

      <QuotePayloadPreview
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        amount={amount}
        chainId={quoteChainId}
        swapper={swapper}
        pool={pool}
      />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-600">Amount</span>
            <input
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value)
                setComparison(null)
              }}
              disabled={isLoading}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </label>

          <button
            onClick={() => {
              setIsReversed((current) => !current)
              setComparison(null)
            }}
            disabled={isLoading}
            className="mb-px w-10 h-10 rounded-lg border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white transition-colors flex items-center justify-center text-sm disabled:opacity-40"
            aria-label="Reverse pool quote direction"
          >
            ⇄
          </button>

          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] text-zinc-600">Direction</span>
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm font-mono text-zinc-300 truncate">
              {formatPair(tokenIn, tokenOut)}
            </div>
          </div>
        </div>

        <button
          onClick={fetchImpact}
          disabled={isLoading || !amount.trim()}
          className="px-4 py-2.5 rounded-xl bg-white text-black text-xs font-medium hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors self-end"
        >
          {isLoading ? 'Quoting...' : 'Analyze Impact'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {[
          ['Chain', String(quoteChainId)],
          ['Token In', `${tokenIn.symbol} ${shortAddress(tokenIn.address)}`],
          ['Token Out', `${tokenOut.symbol} ${shortAddress(tokenOut.address)}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-900 px-3 py-2">
            <span className="block text-[10px] text-zinc-700">{label}</span>
            <span className="block text-[10px] font-mono text-zinc-500 truncate">{value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="block text-[10px] text-zinc-600 uppercase tracking-widest">
              Same-Pair Pool Filter
            </span>
            <p className="text-xs text-zinc-600 mt-1">
              Subgraph buckets for pools using this hook versus pools with no hook.
            </p>
          </div>
          {marketComparison && (
            <span className="text-[10px] text-zinc-700 font-mono">
              source: {marketComparison.source}
            </span>
          )}
        </div>

        {isLoadingMarket && <LoadingSkeleton className="h-20" lines={3} />}

        {marketComparison && !isLoadingMarket && (
          <>
            {marketComparison.error && (
              <div className="border border-zinc-900 rounded-xl px-4 py-3">
                <p className="text-xs text-zinc-600">{marketComparison.error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <PoolBucket
                label="Using This Hook"
                tone="text-zinc-400"
                pools={marketComparison.hookPools}
              />
              <PoolBucket
                label="No Hook"
                tone="text-zinc-600"
                pools={marketComparison.noHookPools}
              />
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="border border-zinc-800 rounded-xl px-4 py-3">
          <p className="text-xs text-zinc-500">{error}</p>
          {error.includes('API key') && (
            <p className="text-xs text-zinc-700 mt-1">
              Add VITE_UNISWAP_API_KEY to your .env file and restart the dev server.
            </p>
          )}
        </div>
      )}

      {isLoading && <LoadingSkeleton className="h-16" lines={2} />}

      {comparison && !isLoading && (
        <div className="flex flex-col gap-3 animate-slide-up">
          {bothQuotePathsFailed && (
            <div className="border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-xs text-zinc-400 font-medium">
                Aggregator quotes failed for {formatPair(tokenIn, tokenOut)}.
              </p>
              <p className="text-[10px] text-zinc-700 mt-1 leading-relaxed">
                The pool exists in the subgraph, but the Trading API did not return an executable
                hook-only route or best-market route for this exact payload. A direct pool page in
                the Uniswap UI can still show a quote because it may use a different direct-pool
                path, wrap assumption, chain context, or amount handling than the aggregator quote
                endpoint.
              </p>
            </div>
          )}

          {hookOnlyUnavailable && hasMarketQuote && (
            <div className="border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-xs text-zinc-500 font-medium">
                No aggregator hook route found for {formatPair(tokenIn, tokenOut)}.
              </p>
              <p className="text-[10px] text-zinc-700 mt-1">
                The Trading API returned a market quote below, but{' '}
                <span className="font-mono">V4_HOOKS_ONLY</span> returned{' '}
                <span className="font-mono">No quotes available</span>. This means the aggregator
                could not construct an executable hook-only route for this selected payload; it
                does not mean the indexed pool has no historical activity.
                {!hasNoHookLiquidity
                  ? ' The subgraph also did not return same-pair no-hook pools, so the successful no-hook quote may be using a broader route.'
                  : ''}
              </p>
            </div>
          )}

          {severeHookImpact && (
            <div className="border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-xs text-zinc-500 font-medium">
                Hook-only route is extremely inefficient.
              </p>
              <p className="text-[10px] text-zinc-700 mt-1 leading-relaxed">
                Both quote classes succeeded, but the hook-only output is more than 50% worse
                than the no-hook route. This usually means hook-pool liquidity is thin or the
                hook route takes a much worse path. Treat this as a routing warning, not a
                contract-security finding.
              </p>
            </div>
          )}

          {!comparison.noHookPool && (
            <QuoteRow
              label="With Hook (V4 only)"
              quote={comparison.hookQuote}
              error={comparison.hookError}
              isLoading={false}
              highlight={comparison.isPositive}
            />
          )}

          <QuoteRow
            label="Best Market Route"
            quote={comparison.baseQuote}
            error={comparison.baseError}
            isLoading={false}
            highlight={!comparison.isPositive && !comparison.noHookPool}
          />

          {bothQuotePathsFailed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { label: 'Hook path', err: comparison.hookError },
                { label: 'Best market path', err: comparison.baseError },
              ].map(({ label, err }) => {
                if (!err) return null
                return (
                  <div key={label} className="rounded-xl border border-zinc-900 px-4 py-3">
                    <span className="block text-[10px] text-zinc-600 uppercase tracking-widest">
                      {label}
                    </span>
                    <span className="block mt-1 text-xs text-zinc-500 leading-relaxed">
                      {isNoRoute(err.message) ? 'No route found' : err.message}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {comparison.hookQuote && comparison.baseQuote && (
            <div className="border-t border-border pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                [
                  'Hook Impact',
                  `${comparison.isPositive ? '+' : ''}${comparison.impactAmount} ${
                    comparison.baseQuote.quote.output.token.symbol
                  }`,
                ],
                [
                  'Impact Percent',
                  `${comparison.impactPercent > 0 ? '+' : ''}${comparison.impactPercent.toFixed(3)}%`,
                ],
                [
                  'Better For Swapper',
                  comparison.isPositive ? 'Yes' : 'No',
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-zinc-600">{label}</span>
                  <span className="text-xs font-mono text-zinc-300">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
