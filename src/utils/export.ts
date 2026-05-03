import type { FullHookInspection, PoolDiscovery } from '../types/hook'

export function generateShareUrl(address: string, chainId: number): string {
  const base = typeof window === 'undefined' ? '' : window.location.origin
  return `${base}/inspect/${chainId}/${address}`
}

export function exportInspectionJSON(
  inspection: FullHookInspection,
  poolDiscovery?: PoolDiscovery | null,
): void {
  const data = {
    exportedAt: new Date().toISOString(),
    tool: 'HookLens',
    version: '1.0.0',
    hook: {
      address: inspection.decoded.address,
      chainId: inspection.decoded.chainId,
      category: inspection.decoded.category,
      activeCallbacks: inspection.decoded.activeCallbacks,
      totalActive: inspection.decoded.totalActive,
    },
    safety: inspection.safety
      ? {
          score: inspection.safety.score,
          hasCriticalIssues: inspection.safety.hasCriticalIssues,
          hasHighIssues: inspection.safety.hasHighIssues,
          checks: inspection.safety.checks.map((check) => ({
            id: check.id,
            name: check.name,
            passed: check.passed,
            severity: check.severity,
            detail: check.detail,
          })),
          verifiedOnSourcify: inspection.safety.source.verification.isVerified,
        }
      : null,
    pools: poolDiscovery ?? inspection.pools ?? null,
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hooklens-${inspection.decoded.address.slice(0, 8)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}
