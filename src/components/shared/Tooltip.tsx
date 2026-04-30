import { useState } from 'react'
import type { ReactNode } from 'react'

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const [show, setShow] = useState(false)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 whitespace-nowrap z-50 shadow-xl animate-fade-in pointer-events-none">
          {content}
        </span>
      )}
    </span>
  )
}
