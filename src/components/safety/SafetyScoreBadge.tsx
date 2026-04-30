interface SafetyScoreBadgeProps {
  score: number
  size?: 'sm' | 'lg'
}

function getScoreLabel(score: number): string {
  if (score >= 9) return 'Safe'
  if (score >= 7) return 'Caution'
  if (score >= 5) return 'Risky'
  return 'Unsafe'
}

function getScoreStyle(score: number): string {
  if (score >= 9) return 'text-white border-white/30 bg-white/10'
  if (score >= 7) return 'text-zinc-300 border-zinc-600 bg-zinc-900'
  if (score >= 5) return 'text-zinc-400 border-zinc-700 bg-zinc-900'
  return 'text-zinc-500 border-zinc-800 bg-zinc-950'
}

export function SafetyScoreBadge({ score, size = 'lg' }: SafetyScoreBadgeProps) {
  if (size === 'sm') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono ${getScoreStyle(
          score,
        )}`}
      >
        {score.toFixed(1)}
        <span className="text-[10px] font-sans">{getScoreLabel(score)}</span>
      </span>
    )
  }

  return (
    <div
      className={`inline-flex flex-col items-center justify-center rounded-2xl border p-5 gap-1 ${getScoreStyle(
        score,
      )}`}
    >
      <span className="text-4xl font-mono font-bold">{score.toFixed(1)}</span>
      <span className="text-xs font-medium uppercase tracking-widest">{getScoreLabel(score)}</span>
      <span className="text-[10px] text-zinc-600">out of 10</span>
    </div>
  )
}
