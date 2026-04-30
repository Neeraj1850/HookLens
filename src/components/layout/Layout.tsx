import type { ReactNode } from 'react'
import { Header } from './Header'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main className="pt-14">{children}</main>
    </div>
  )
}
