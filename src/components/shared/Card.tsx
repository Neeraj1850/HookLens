import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

export function Card({ children, className = '', hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-surface border border-border rounded-xl p-5
        ${hover ? 'hover:border-zinc-700 transition-colors cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
