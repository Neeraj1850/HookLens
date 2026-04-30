import type { TokenDef } from '../../types/uniswap'

interface TokenSelectorProps {
  token: TokenDef | null
  tokens: TokenDef[]
  onChange: (token: TokenDef) => void
  label: string
  disabled?: boolean
}

export function TokenSelector({
  token,
  tokens,
  onChange,
  label,
  disabled,
}: TokenSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{label}</span>

      <div className="relative">
        <select
          value={token?.address ?? ''}
          onChange={(e) => {
            const found = tokens.find((t) => t.address === e.target.value)
            if (found) onChange(found)
          }}
          disabled={disabled}
          className="w-full appearance-none bg-surface border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-zinc-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {tokens.map((t) => (
            <option key={t.address} value={t.address}>
              {t.logoChar} {t.symbol} - {t.name}
            </option>
          ))}
        </select>

        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none text-xs">
          v
        </span>
      </div>
    </div>
  )
}
