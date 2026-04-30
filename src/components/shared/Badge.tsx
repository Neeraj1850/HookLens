type BadgeVariant = 'default' | 'active' | 'muted' | 'outline'

interface BadgeProps {
  text: string
  variant?: BadgeVariant
  size?: 'sm' | 'md'
}

export function Badge({ text, variant = 'default', size = 'md' }: BadgeProps) {
  const base = 'inline-flex items-center rounded-full font-medium tracking-wide'
  const sz = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-white/10 text-white border border-white/20',
    active: 'bg-white text-black',
    muted: 'bg-zinc-900 text-zinc-400 border border-zinc-800',
    outline: 'border border-zinc-700 text-zinc-300',
  }

  return <span className={`${base} ${sz} ${variants[variant]}`}>{text}</span>
}
