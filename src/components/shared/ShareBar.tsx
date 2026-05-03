import { useState } from 'react'
import { useHookStore } from '../../store/hookStore'
import { copyToClipboard, exportInspectionJSON, generateShareUrl } from '../../utils/export'

export function ShareBar() {
  const { currentInspection, poolDiscovery } = useHookStore()
  const [copied, setCopied] = useState(false)

  if (!currentInspection) return null

  const shareUrl = generateShareUrl(
    currentInspection.decoded.address,
    currentInspection.decoded.chainId,
  )

  const handleCopyLink = async () => {
    await copyToClipboard(shareUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = () => {
    exportInspectionJSON(currentInspection, poolDiscovery)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <button
        onClick={handleCopyLink}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors"
      >
        {copied ? 'Copied' : 'Share Link'}
      </button>
      <button
        onClick={handleExport}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors"
      >
        Export JSON
      </button>
    </div>
  )
}
