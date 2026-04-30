interface EmptyStateProps {
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-12 h-12 rounded-2xl border border-zinc-800 flex items-center justify-center text-2xl text-zinc-700">
        ⬡
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-zinc-300">{title}</p>
        {description && <p className="text-xs text-zinc-600 max-w-xs">{description}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="text-xs px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
