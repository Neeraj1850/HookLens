export function formatUSD(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (Number.isNaN(num)) return '$-'
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
  return `$${num.toFixed(2)}`
}

export function formatTokenAmount(
  amount: string,
  decimals = 18,
  displayDecimals = 4,
): string {
  try {
    if (!amount || amount === '0') return '0.' + '0'.repeat(displayDecimals)
    // Use BigInt for integer division to preserve full precision, then format
    const big = BigInt(amount)
    const divisor = BigInt(10) ** BigInt(decimals)
    const whole = big / divisor
    const remainder = big % divisor
    // Convert remainder to fractional string with correct decimal places
    const fracStr = remainder.toString().padStart(decimals, '0').slice(0, displayDecimals)
    const num = parseFloat(`${whole}.${fracStr}`)
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`
    return num.toFixed(displayDecimals)
  } catch {
    return '-'
  }
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}
