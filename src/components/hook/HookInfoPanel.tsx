import { SUPPORTED_CHAINS } from '../../config/constants'
import type { FullHookInspection } from '../../types/hook'
import { Card } from '../shared/Card'
import { EmptyState } from '../shared/EmptyState'
import { CallbackFlags } from './CallbackFlags'
import { HookSummary } from './HookSummary'

interface HookInfoPanelProps {
  inspection: FullHookInspection
}

export function HookInfoPanel({ inspection }: HookInfoPanelProps) {
  const { decoded } = inspection
  const chain = SUPPORTED_CHAINS.find((c) => c.id === decoded.chainId)
  const chainName = chain?.name ?? `Chain ${decoded.chainId}`

  return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <Card>
        <div className="flex flex-col gap-1 mb-4">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Hook Identity</span>
        </div>
        <HookSummary decoded={decoded} chainName={chainName} />
      </Card>

      <Card>
        <div className="flex flex-col gap-1 mb-4">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Callback Flags</span>
          <p className="text-xs text-zinc-500">Decoded from the hook address permission bits</p>
        </div>
        <CallbackFlags flags={decoded.flags} activeCallbacks={decoded.activeCallbacks} />
      </Card>

      <Card className="opacity-40">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Swap Impact</span>
          <span className="text-[10px] text-zinc-700 border border-zinc-800 px-2 py-0.5 rounded-full">
            Phase 2
          </span>
        </div>
        <EmptyState
          title="Swap comparison loading in Phase 2"
          description="Will show V4_HOOKS_ONLY vs V4_NO_HOOKS quote comparison"
        />
      </Card>

      <Card className="opacity-40">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Safety Analysis</span>
          <span className="text-[10px] text-zinc-700 border border-zinc-800 px-2 py-0.5 rounded-full">
            Phase 3
          </span>
        </div>
        <EmptyState
          title="Contract security checks in Phase 3"
          description="Will analyze bytecode and source via Sourcify"
        />
      </Card>
    </div>
  )
}
