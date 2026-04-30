import { CALLBACK_DESCRIPTIONS } from '../../config/constants'
import type { HookFlags } from '../../types/hook'
import { Tooltip } from '../shared/Tooltip'

interface CallbackFlagsProps {
  flags: HookFlags
  activeCallbacks: string[]
}

const FLAG_GROUPS = [
  {
    label: 'Swap',
    icon: '<>',
    flags: ['beforeSwap', 'afterSwap', 'beforeSwapReturnsDelta', 'afterSwapReturnsDelta'],
  },
  {
    label: 'Liquidity',
    icon: '<>',
    flags: [
      'beforeAddLiquidity',
      'afterAddLiquidity',
      'beforeRemoveLiquidity',
      'afterRemoveLiquidity',
      'afterAddLiquidityReturnsDelta',
      'afterRemoveLiquidityReturnsDelta',
    ],
  },
  {
    label: 'Initialize',
    icon: '()',
    flags: ['beforeInitialize', 'afterInitialize'],
  },
  {
    label: 'Donate',
    icon: '<>',
    flags: ['beforeDonate', 'afterDonate'],
  },
]

export function CallbackFlags({ activeCallbacks }: CallbackFlagsProps) {
  const activeSet = new Set(activeCallbacks)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500">{activeCallbacks.length} of 14 callbacks active</span>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs font-mono text-zinc-600">{activeCallbacks.length}/14</span>
      </div>

      {FLAG_GROUPS.map((group) => {
        const groupActive = group.flags.filter((f) => activeSet.has(f))

        return (
          <div key={group.label} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-zinc-700 text-xs font-mono">{group.icon}</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                {group.label}
              </span>
              {groupActive.length > 0 && (
                <span className="text-[10px] text-zinc-500">{groupActive.length} active</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {group.flags.map((flagName) => {
                const isActive = activeSet.has(flagName)
                const desc = CALLBACK_DESCRIPTIONS[flagName] ?? ''

                return (
                  <Tooltip key={flagName} content={desc}>
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-colors cursor-help w-full ${
                        isActive
                          ? 'bg-white/5 border-white/20 text-white'
                          : 'bg-transparent border-zinc-900 text-zinc-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isActive ? 'bg-white' : 'bg-zinc-800'
                        }`}
                      />
                      <span className="truncate">{flagName}</span>
                    </div>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
