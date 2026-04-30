import type { DecodedHook } from '../../types/hook'
import { Badge } from '../shared/Badge'

const CATEGORY_LABELS: Record<string, string> = {
  'swap-only': 'Swap Hook',
  'liquidity-only': 'Liquidity Hook',
  'full-lifecycle': 'Full Lifecycle Hook',
  'initialize-only': 'Initialize Hook',
  custom: 'Custom Hook',
  unknown: 'Unknown',
}

interface HookSummaryProps {
  decoded: DecodedHook
  chainName: string
}

export function HookSummary({ decoded, chainName }: HookSummaryProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Hook Address</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-white break-all">{decoded.address}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge text={CATEGORY_LABELS[decoded.category]} variant="active" />
        <Badge text={chainName} variant="outline" />
        <Badge
          text={`${decoded.totalActive} callbacks`}
          variant={decoded.totalActive > 0 ? 'default' : 'muted'}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Permission Bits</span>
        <div className="flex items-center gap-1 flex-wrap">
          {Array.from({ length: 14 }).map((_, i) => {
            const bitPos = 13 - i
            const flagBit = BigInt(decoded.address.toLowerCase()) & (BigInt(1) << BigInt(bitPos))
            const isSet = flagBit > BigInt(0)

            return (
              <div
                key={i}
                title={`Bit ${bitPos}`}
                className={`w-4 h-6 rounded-sm transition-colors ${
                  isSet ? 'bg-white' : 'bg-zinc-900 border border-zinc-800'
                }`}
              />
            )
          })}
          <span className="ml-2 font-mono text-xs text-zinc-600">
            {(BigInt(decoded.address.toLowerCase()) & BigInt(0x3FFF)).toString(2).padStart(14, '0')}
          </span>
        </div>
      </div>
    </div>
  )
}
