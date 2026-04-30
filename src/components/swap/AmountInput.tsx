interface AmountInputProps {
  value: string
  onChange: (val: string) => void
  symbol: string
  disabled?: boolean
}

export function AmountInput({ value, onChange, symbol, disabled }: AmountInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Amount</span>

      <div className="relative flex items-center">
        <input
          type="number"
          value={value}
          min="0"
          step="0.1"
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="1.0"
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-zinc-600 transition-colors pr-16 disabled:opacity-40 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="absolute right-4 text-xs text-zinc-500 font-mono">{symbol}</span>
      </div>

      <div className="flex gap-1.5">
        {['0.1', '1', '10', '100'].map((amt) => (
          <button
            key={amt}
            onClick={() => onChange(amt)}
            disabled={disabled}
            className="text-[10px] px-2.5 py-1 rounded-lg border border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-40"
          >
            {amt}
          </button>
        ))}
      </div>
    </div>
  )
}
