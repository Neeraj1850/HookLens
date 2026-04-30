import { useEffect, useState } from 'react'
import { hasApiKey, saveApiKey } from '../../api/uniswap'
import { Card } from '../shared/Card'

export function ApiKeyPanel() {
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)

  useEffect(() => {
    setIsConfigured(hasApiKey())
    const stored = localStorage.getItem('hooklens_uniswap_api_key')
    if (stored) setKey(stored)
  }, [])

  const handleSave = () => {
    if (!key.trim()) return
    saveApiKey(key)
    setIsConfigured(true)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-white">Uniswap API Key</span>
            <p className="text-xs text-zinc-600">
              Required for live swap quotes via the Uniswap Trading API. Free at
              developers.uniswap.org/dashboard
            </p>
          </div>
          {isConfigured && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
              Configured
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your API key..."
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="min-w-0 flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors"
          />
          <button
            onClick={handleSave}
            disabled={!key.trim()}
            className="px-4 py-2.5 rounded-xl bg-white text-black text-xs font-medium hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {saved ? 'Saved' : 'Save Key'}
          </button>
        </div>

        <p className="text-[10px] text-zinc-700">
          Keys are stored in your browser localStorage only. Never transmitted except to
          trade-api.gateway.uniswap.org
        </p>
      </div>
    </Card>
  )
}
