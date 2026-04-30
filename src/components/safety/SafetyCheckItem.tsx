import { useState } from 'react'
import type { SafetyCheck } from '../../types/hook'

const SEVERITY_ICON: Record<SafetyCheck['severity'], string> = {
  critical: 'x',
  high: '!',
  medium: '*',
  info: 'i',
}

const SEVERITY_LABEL: Record<SafetyCheck['severity'], string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  info: 'Info',
}

interface SafetyCheckItemProps {
  check: SafetyCheck
}

export function SafetyCheckItem({ check }: SafetyCheckItemProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-[#141414] last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-0 py-3 text-left hover:bg-white/[0.02] transition-colors rounded"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`w-5 h-5 rounded flex items-center justify-center text-[11px] shrink-0 ${
              check.passed ? 'bg-white/10 text-white' : 'bg-zinc-900 text-zinc-400'
            }`}
          >
            {check.passed ? '✓' : SEVERITY_ICON[check.severity]}
          </span>
          <span
            className={`text-sm truncate ${check.passed ? 'text-zinc-300' : 'text-white font-medium'}`}
          >
            {check.name}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!check.passed && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                check.severity === 'critical'
                  ? 'border-zinc-600 text-zinc-300'
                  : check.severity === 'high'
                    ? 'border-zinc-700 text-zinc-400'
                    : 'border-zinc-800 text-zinc-600'
              }`}
            >
              {SEVERITY_LABEL[check.severity]}
            </span>
          )}
          <span className={`text-zinc-700 text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>
            v
          </span>
        </div>
      </button>

      {expanded && (
        <div className="pb-3 px-8 animate-fade-in">
          <p className="text-xs text-zinc-500 leading-relaxed mb-1">{check.description}</p>
          {check.detail && (
            <p className="text-xs font-mono text-zinc-600 bg-zinc-950 rounded-lg px-3 py-2 mt-2">
              {check.detail}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
