import { isAddress, getAddress } from 'viem'

export function validateHookAddress(input: string): {
  valid: boolean
  checksummed?: string
  error?: string
} {
  const trimmed = input.trim()
  if (!trimmed) return { valid: false, error: 'Enter a hook address' }
  if (!trimmed.startsWith('0x')) {
    return { valid: false, error: 'Address must start with 0x' }
  }
  if (trimmed.length !== 42) {
    return { valid: false, error: 'Address must be 42 characters' }
  }
  if (!isAddress(trimmed)) {
    return { valid: false, error: 'Invalid Ethereum address' }
  }
  return { valid: true, checksummed: getAddress(trimmed) }
}

export function truncateAddress(address: string, start = 6, end = 4): string {
  if (address.length <= start + end) return address
  return `${address.slice(0, start)}...${address.slice(-end)}`
}

export function isLikelyHookAddress(address: string): boolean {
  try {
    const bits = BigInt(address.toLowerCase()) & BigInt(0x3FFF)
    return bits > BigInt(0)
  } catch {
    return false
  }
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}
