import { useState } from 'react'
import { hasApiKey, saveApiKey } from '../../api/uniswap'
import { Card } from '../shared/Card'

const KEY_CONFIGS = [
  {
    id: 'uniswap',
    label: 'Uniswap API Key',
    subtext:
      'Required for live swap quotes via the Uniswap Trading API. Free at developers.uniswap.org/dashboard',
    storageKey: 'hooklens_uniswap_api_key',
    placeholder: 'Paste your API key...',
    required: true,
  },
  {
    id: 'thegraph',
    label: 'The Graph API Key',
    subtext: 'Optional. Improves pool discovery. Free at thegraph.com/studio',
    storageKey: 'hooklens_thegraph_key',
    placeholder: 'Your Graph API key...',
    required: false,
  },
  {
    id: 'alchemy',
    label: 'Alchemy RPC Key',
    subtext: 'Optional. Improves onchain fallback speed. Free tier available.',
    storageKey: 'hooklens_alchemy_key',
    placeholder: 'Your Alchemy key...',
    required: false,
  },
] as const

export function ApiKeyPanel() {
  const [keys, setKeys] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      KEY_CONFIGS.map((config) => [
        config.id,
        typeof localStorage === 'undefined' ? '' : (localStorage.getItem(config.storageKey) ?? ''),
      ]),
    ),
  )
  const [configuredKeys, setConfiguredKeys] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      KEY_CONFIGS.map((config) => [
        config.id,
        typeof localStorage !== 'undefined' && Boolean(localStorage.getItem(config.storageKey)),
      ]),
    ),
  )
  const [savedId, setSavedId] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState(() => hasApiKey())

  const handleSave = (config: (typeof KEY_CONFIGS)[number]) => {
    const key = keys[config.id] ?? ''
    if (!key.trim()) return
    if (config.id === 'uniswap') {
      saveApiKey(key)
      setIsConfigured(true)
    } else {
      localStorage.setItem(config.storageKey, key.trim())
    }
    setConfiguredKeys((current) => ({ ...current, [config.id]: true }))
    setSavedId(config.id)
    window.setTimeout(() => setSavedId(null), 2000)
  }

  return (
    <Card>
      <div className="flex flex-col gap-4">
        {KEY_CONFIGS.map((config) => {
          const key = keys[config.id] ?? ''
          const configured = config.id === 'uniswap' ? isConfigured : configuredKeys[config.id]

          return (
            <div key={config.id} className="flex flex-col gap-3 border-b border-[#141414] pb-4 last:border-b-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-white">
                    {config.label}{' '}
                    {!config.required && <span className="text-zinc-600">(optional)</span>}
                  </span>
                  <p className="text-xs text-zinc-600">{config.subtext}</p>
                </div>
                {configured && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20 shrink-0">
                    Configured
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={key}
                  onChange={(e) =>
                    setKeys((current) => ({ ...current, [config.id]: e.target.value }))
                  }
                  placeholder={config.placeholder}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave(config)}
                  className="min-w-0 flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors"
                />
                <button
                  onClick={() => handleSave(config)}
                  disabled={!key.trim()}
                  className="px-4 py-2.5 rounded-xl bg-white text-black text-xs font-medium hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {savedId === config.id ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          )
        })}

        <p className="text-[10px] text-zinc-700">
          Keys are stored in your browser localStorage only and sent only to their matching API
          providers.
        </p>
      </div>
    </Card>
  )
}
