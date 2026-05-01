import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { SUPPORTED_CHAINS } from '../../config/constants'
import { useHookStore } from '../../store/hookStore'
import { isLikelyHookAddress, validateHookAddress } from '../../utils/address'

export function AddressInput() {
  const navigate = useNavigate()
  const { currentAddress, currentChainId, setAddress, setChainId } = useHookStore()
  const input = currentAddress

  const validation = useMemo(() => {
    if (input.length !== 42) return { error: '', isHookLike: false }

    const result = validateHookAddress(input)
    if (!result.valid || !result.checksummed) {
      return { error: result.error ?? '', isHookLike: false }
    }

    return {
      error: '',
      isHookLike: isLikelyHookAddress(result.checksummed),
    }
  }, [input])

  const { error, isHookLike } = validation

  const handleSubmit = useCallback(() => {
    const result = validateHookAddress(input)
    if (!result.valid || !result.checksummed) {
      return
    }

    setAddress(result.checksummed)
    navigate(`/inspect/${currentChainId}/${result.checksummed}`)
  }, [input, currentChainId, navigate, setAddress])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-2xl">
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-600">Chain</span>
        <div className="flex items-center gap-1 flex-wrap">
          {SUPPORTED_CHAINS.map((chain) => (
            <button
              key={chain.id}
              onClick={() => setChainId(chain.id)}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                currentChainId === chain.id
                  ? 'bg-white text-black font-medium'
                  : 'text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              {chain.shortName}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="0x... paste any v4 hook address"
          spellCheck={false}
          className={`w-full bg-surface border rounded-xl px-5 py-4 font-mono text-sm text-white placeholder-zinc-700 focus:outline-none transition-colors pr-32 ${
            error
              ? 'border-zinc-600'
              : input.length === 42 && !error
                ? 'border-zinc-600 focus:border-white'
                : 'border-border focus:border-zinc-600'
          }`}
        />

        <button
          onClick={handleSubmit}
          disabled={!input || input.length !== 42}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg text-xs font-medium bg-white text-black hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Inspect
        </button>
      </div>

      <div className="h-4 flex items-center">
        {error && <span className="text-xs text-zinc-500">{error}</span>}
        {!error && isHookLike && input.length === 42 && (
          <span className="text-xs text-zinc-500">Hook flags detected. Press Enter to inspect</span>
        )}
        {!error && !isHookLike && input.length === 42 && (
          <span className="text-xs text-zinc-600">
            No hook flags detected. This may be a non-hook contract
          </span>
        )}
      </div>
    </div>
  )
}
