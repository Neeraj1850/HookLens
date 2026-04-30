export function LoadingDots({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-1 h-1' : size === 'lg' ? 'w-2 h-2' : 'w-1.5 h-1.5'

  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`${sz} rounded-full bg-zinc-500 animate-bounce`}
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  )
}
