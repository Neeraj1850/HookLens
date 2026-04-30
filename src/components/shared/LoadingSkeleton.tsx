export function LoadingSkeleton({
  className = '',
  lines = 1,
}: {
  className?: string
  lines?: number
}) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`bg-zinc-900 rounded animate-pulse ${className}`}
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  )
}
