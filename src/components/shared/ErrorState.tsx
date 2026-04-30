interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      <span className="text-zinc-600 text-2xl">x</span>
      <p className="text-sm text-zinc-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  )
}
