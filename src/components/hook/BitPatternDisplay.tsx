interface BitPatternDisplayProps {
  address: string
}

export function BitPatternDisplay({ address }: BitPatternDisplayProps) {
  const bits = (BigInt(address.toLowerCase()) & BigInt(0x3fff)).toString(2).padStart(14, '0')

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <div className="flex items-center gap-1">
        {bits.split('').map((bit, index) => (
          <span
            key={`${bit}-${index}`}
            title={`Bit ${13 - index}: ${bit}`}
            className={`h-5 w-2.5 rounded-sm ${
              bit === '1' ? 'bg-white' : 'bg-zinc-900 border border-zinc-800'
            }`}
          />
        ))}
      </div>
      <span className="font-mono text-[10px] text-zinc-600">{bits}</span>
    </div>
  )
}
