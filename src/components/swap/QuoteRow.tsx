import type { QuoteError, QuoteResponse } from '../../types/uniswap'
import { formatTokenAmount, formatUSD } from '../../utils/format'
import { LoadingDots } from '../shared/LoadingDots'

interface QuoteRowProps {
  label: string
  quote: QuoteResponse | null
  error: QuoteError | null
  isLoading: boolean
  highlight?: boolean
}

function formatQuoteError(error: QuoteError): string {
  const lower = error.message.toLowerCase()
  if (
    lower.includes('no quotes') ||
    lower.includes('no quote') ||
    lower.includes('no route') ||
    lower.includes('insufficient liquidity')
  ) {
    return 'No route found'
  }
  return error.message
}

export function QuoteRow({ label, quote, error, isLoading, highlight }: QuoteRowProps) {
  const outputDecimals = quote?.quote.output.token.decimals ?? 18
  const displayDecimals = outputDecimals <= 6 ? 2 : 4

  return (
    <div
      className={`flex items-center justify-between px-5 py-4 rounded-xl border transition-all duration-300 ${
        highlight ? 'bg-white border-white' : 'bg-surface border-border'
      }`}
    >
      <div className="flex flex-col gap-0.5">
        <span
          className={`text-[10px] font-semibold uppercase tracking-widest ${
            highlight ? 'text-zinc-500' : 'text-zinc-600'
          }`}
        >
          {label}
        </span>
        {quote && (
          <span className={`text-[10px] ${highlight ? 'text-zinc-600' : 'text-zinc-700'}`}>
            via {quote.routing}
          </span>
        )}
      </div>

      <div className="flex flex-col items-end gap-0.5">
        {isLoading && <LoadingDots size="sm" />}
        {!isLoading && error && (
          <>
            <span className="text-xs text-zinc-500 text-right max-w-[15rem]">
              {formatQuoteError(error)}
            </span>
            {error.detail && (
              <span className="text-[10px] text-zinc-700 text-right max-w-[18rem] truncate">
                {error.detail}
              </span>
            )}
          </>
        )}
        {!isLoading && quote && (
          <>
            <span
              className={`text-lg font-mono font-semibold ${
                highlight ? 'text-black' : 'text-white'
              }`}
            >
              {formatTokenAmount(quote.quote.output.amount, outputDecimals, displayDecimals)}
            </span>
            <span
              className={`text-[10px] font-mono ${
                highlight ? 'text-zinc-600' : 'text-zinc-700'
              }`}
            >
              {quote.quote.output.token.symbol}
              {quote.quote.gasFeeUSD && ` | gas ~${formatUSD(quote.quote.gasFeeUSD)}`}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
