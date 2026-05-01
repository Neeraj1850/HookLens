import { useState, type ReactNode } from 'react'
import { Badge } from './Badge'

interface AccordionSectionProps {
  id: string
  title: string
  children: ReactNode
  defaultOpen?: boolean
  badge?: string
  badgeVariant?: 'active' | 'muted' | 'outline' | 'default'
}

export function AccordionSection({
  id,
  title,
  children,
  defaultOpen = false,
  badge,
  badgeVariant = 'muted',
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section id={id} className="rounded-xl border border-border bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-white truncate">{title}</span>
          {badge && <Badge text={badge} variant={badgeVariant} size="sm" />}
        </div>
        <span className={`text-xs text-zinc-700 transition-transform ${open ? 'rotate-180' : ''}`}>
          v
        </span>
      </button>

      {open && <div className="border-t border-[#141414] p-5 animate-fade-in">{children}</div>}
    </section>
  )
}
