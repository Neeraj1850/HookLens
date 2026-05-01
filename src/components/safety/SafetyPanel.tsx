import { useCallback } from 'react'
import { useSafetyAnalysis } from '../../hooks/useSafetyAnalysis'
import { useHookStore } from '../../store/hookStore'
import type { SafetyCategory } from '../../types/hook'
import { LoadingDots } from '../shared/LoadingDots'
import { LoadingSkeleton } from '../shared/LoadingSkeleton'
import { SafetyCheckItem } from './SafetyCheckItem'
import { SafetyScoreBadge } from './SafetyScoreBadge'

const CATEGORY_LABELS: Record<SafetyCategory, string> = {
  verification: 'Verification',
  'access-control': 'Access Control',
  reentrancy: 'Reentrancy',
  'callback-safety': 'Callback Safety',
  centralization: 'Centralization',
  'hook-specific': 'Hook-Specific',
}

export function SafetyPanel() {
  const {
    currentInspection,
    isAnalyzing,
    analysisError,
    setAnalyzing,
    setAnalysisError,
  } = useHookStore()
  const { safety, runAnalysis } = useSafetyAnalysis()

  const handleAnalyze = useCallback(async () => {
    if (!currentInspection) return
    setAnalyzing(true)
    setAnalysisError(null)
    const result = await runAnalysis(
      currentInspection.decoded.address,
      currentInspection.decoded.chainId,
    )
    if (!result) {
      setAnalysisError('Safety analysis failed. Try again in a moment.')
    }
    setAnalyzing(false)
  }, [currentInspection, runAnalysis, setAnalyzing, setAnalysisError])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
            Safety Analysis
          </span>
          <p className="text-xs text-zinc-500">
            Static analysis via Sourcify | 12 deterministic checks
          </p>
        </div>
        {!safety && (
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !currentInspection}
            className="px-4 py-2 rounded-xl bg-white text-black text-xs font-medium hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2 self-start sm:self-auto"
          >
            {isAnalyzing ? (
              <>
                <LoadingDots size="sm" /> Analyzing...
              </>
            ) : (
              'Run Analysis ->'
            )}
          </button>
        )}
      </div>

      {analysisError && !isAnalyzing && (
        <div className="border border-zinc-800 rounded-xl px-4 py-3">
          <p className="text-xs text-zinc-500">{analysisError}</p>
        </div>
      )}

      {isAnalyzing && (
        <div className="flex flex-col gap-3 py-4">
          <LoadingSkeleton className="h-12" lines={3} />
          <p className="text-xs text-zinc-600">
            Fetching source from Sourcify and running deterministic checks...
          </p>
        </div>
      )}

      {safety && !isAnalyzing && (
        <div className="flex flex-col gap-5 animate-slide-up">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <SafetyScoreBadge score={safety.score} size="lg" />

            <div className="flex flex-col gap-2 flex-1">
              <div
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
                  safety.source.verification.isVerified
                    ? 'bg-white/5 border-white/20'
                    : 'bg-zinc-950 border-zinc-800'
                }`}
              >
                <span className="text-sm">
                  {safety.source.verification.isVerified ? '✓' : 'x'}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-white">
                    {safety.source.verification.isVerified
                      ? 'Source Verified on Sourcify'
                      : 'Source Not Verified'}
                  </span>
                  {safety.source.verification.isVerified &&
                    safety.source.verification.sourcifyUrl && (
                      <a
                        href={safety.source.verification.sourcifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-zinc-500 hover:text-white transition-colors underline underline-offset-2"
                      >
                        View on Sourcify
                      </a>
                    )}
                  {safety.source.verification.matchType !== 'unverified' && (
                    <span className="text-[10px] text-zinc-600">
                      {safety.source.verification.matchType.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>

              {(safety.hasCriticalIssues || safety.hasHighIssues) && (
                <div className="px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950">
                  <p className="text-xs text-zinc-400">
                    {safety.checks.filter((check) => !check.passed).length} issue(s) found |{' '}
                    {safety.hasCriticalIssues
                      ? 'Critical issues present'
                      : safety.hasHighIssues
                        ? 'High severity issues'
                        : 'Review recommended'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {(Object.keys(CATEGORY_LABELS) as SafetyCategory[]).map((cat) => {
            const catChecks = safety.checks.filter((check) => check.category === cat)
            if (catChecks.length === 0) return null

            const catFailed = catChecks.filter((check) => !check.passed).length

            return (
              <div key={cat} className="flex flex-col gap-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                    {CATEGORY_LABELS[cat]}
                  </span>
                  {catFailed > 0 && (
                    <span className="text-[10px] text-zinc-500">{catFailed} issue(s)</span>
                  )}
                </div>
                <div className="bg-surface border border-border rounded-xl px-4">
                  {catChecks.map((check) => (
                    <SafetyCheckItem key={check.id} check={check} />
                  ))}
                </div>
              </div>
            )
          })}

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors self-start underline underline-offset-2"
          >
            Re-analyze
          </button>

          <p className="text-[10px] text-zinc-800">
            Analyzed {new Date(safety.analyzedAt).toLocaleTimeString()}
          </p>
        </div>
      )}

      {!safety && !isAnalyzing && (
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          <div className="w-10 h-10 rounded-xl border border-zinc-800 flex items-center justify-center text-zinc-700 text-lg">
            #
          </div>
          <p className="text-xs text-zinc-500">
            Run analysis to check this hook for security issues
          </p>
          <p className="text-[10px] text-zinc-700">
            Fetches source from Sourcify | No API key needed
          </p>
        </div>
      )}
    </div>
  )
}
