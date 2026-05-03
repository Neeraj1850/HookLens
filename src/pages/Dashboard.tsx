import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { LoadingSkeleton } from '../components/shared/LoadingSkeleton'
import { SUPPORTED_CHAINS, UNISWAP_V4_SUBGRAPH_IDS_BY_CHAIN } from '../config/constants'
import { CONFIGURED_CHAIN_IDS, useHookAddressDiscovery } from '../hooks/useHookAddressDiscovery'
import { useHookStore } from '../store/hookStore'
import type { HookAddressCandidate, HookCategory } from '../types/hook'
import { copyToClipboard, truncateAddress } from '../utils/address'
import { formatUSD } from '../utils/format'
import { classifyHook, decodeHookFlags } from '../utils/flagDecoder'

function formatFee(feeTier: number): string {
  if (!Number.isFinite(feeTier) || feeTier === 0) return 'custom'
  return `${(feeTier / 10000).toFixed(2)}%`
}

function getCategory(address: string): HookCategory {
  try { return classifyHook(decodeHookFlags(address)) }
  catch { return 'unknown' }
}

function getExplorerUrl(address: string, chainId: number): string {
  const e: Record<number, string> = {
    1: 'https://etherscan.io/address/',
    8453: 'https://basescan.org/address/',
    42161: 'https://arbiscan.io/address/',
    10: 'https://optimistic.etherscan.io/address/',
    137: 'https://polygonscan.com/address/',
  }
  return `${e[chainId] ?? 'https://etherscan.io/address/'}${address}`
}

const CATEGORY_LABELS: Record<HookCategory, string> = {
  'swap-only': 'Swap',
  'liquidity-only': 'Liquidity',
  'full-lifecycle': 'Full Lifecycle',
  'initialize-only': 'Initialize',
  custom: 'Custom',
  unknown: 'Unknown',
}

const CATEGORY_COLORS: Record<HookCategory, string> = {
  'swap-only': 'text-blue-400 border-blue-900 bg-blue-950/40',
  'liquidity-only': 'text-violet-400 border-violet-900 bg-violet-950/40',
  'full-lifecycle': 'text-emerald-400 border-emerald-900 bg-emerald-950/40',
  'initialize-only': 'text-amber-400 border-amber-900 bg-amber-950/40',
  custom: 'text-zinc-400 border-zinc-800 bg-zinc-900/40',
  unknown: 'text-zinc-600 border-zinc-900 bg-zinc-950',
}

type SortKey = 'txns' | 'volume' | 'pools' | 'address'
type ActivityFilter = 'all' | 'active' | 'inactive'

const CHAIN_OPTIONS = SUPPORTED_CHAINS.filter((c) => CONFIGURED_CHAIN_IDS.includes(c.id))

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [HookCategory, string][]

interface DropdownProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (val: string) => void
}

function Dropdown({ label, value, options, onChange }: DropdownProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors appearance-none cursor-pointer min-w-[140px]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-zinc-950">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface MultiDropdownProps {
  label: string
  values: string[]
  options: { value: string; label: string }[]
  onChange: (vals: string[]) => void
  placeholder?: string
}

function MultiDropdown({ label, values, options, onChange, placeholder = 'All' }: MultiDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggle = (val: string) => {
    onChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val])
  }

  const displayLabel =
    values.length === 0 ? placeholder : values.length === 1 ? options.find((o) => o.value === values[0])?.label ?? values[0] : `${values.length} selected`

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`bg-zinc-950 border rounded-lg px-3 py-2 text-xs text-left transition-colors min-w-[140px] flex items-center justify-between gap-2 ${
            values.length > 0 ? 'border-zinc-600 text-white' : 'border-zinc-800 text-zinc-400'
          } hover:border-zinc-600`}
        >
          <span className="truncate">{displayLabel}</span>
          <span className={`text-zinc-600 text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl min-w-[180px] overflow-hidden animate-fade-in">
            {values.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="w-full text-left px-3 py-2 text-[10px] text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900 transition-colors border-b border-zinc-900"
              >
                Clear selection
              </button>
            )}
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={`w-full text-left px-3 py-2.5 text-xs flex items-center gap-2.5 hover:bg-zinc-900 transition-colors ${
                  values.includes(opt.value) ? 'text-white' : 'text-zinc-500'
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] shrink-0 ${
                  values.includes(opt.value) ? 'bg-white border-white text-black' : 'border-zinc-700'
                }`}>
                  {values.includes(opt.value) ? '✓' : ''}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-zinc-900 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{label}</span>
      <p className="text-xl font-semibold text-white tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-zinc-700">{sub}</p>}
    </div>
  )
}

type EnrichedHook = HookAddressCandidate & { category: HookCategory }

function HookRow({ hook }: { hook: EnrichedHook }) {
  const navigate = useNavigate()
  const { setAddress, setChainId } = useHookStore()
  const [copied, setCopied] = useState(false)

  const inspect = () => {
    setAddress(hook.address)
    setChainId(hook.chainId)
    navigate(`/inspect/${hook.chainId}/${hook.address}`)
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    void copyToClipboard(hook.address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const catColor = CATEGORY_COLORS[hook.category]

  return (
    <div className="px-4 py-4 rounded-xl border border-zinc-900 hover:border-zinc-700 hover:bg-white/[0.015] transition-all flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-mono shrink-0 mt-0.5 ${catColor}`}>
          {CATEGORY_LABELS[hook.category]}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="font-mono text-sm text-white">{truncateAddress(hook.address)}</code>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-500">
              {hook.chainName}
            </span>
            <span className="text-[10px] text-zinc-600">
              {hook.poolCount} {hook.poolCount === 1 ? 'pool' : 'pools'}
            </span>
            {hook.recentlyActive && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-900/30 border border-emerald-800/50 text-emerald-400 shrink-0 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Active 7d
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-600 mt-1 leading-relaxed line-clamp-1 max-w-md">
            {hook.description}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCopy}
            className="text-[10px] text-zinc-700 hover:text-zinc-300 px-2 py-1 rounded border border-zinc-900 hover:border-zinc-700 transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <a
            href={getExplorerUrl(hook.address, hook.chainId)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-zinc-700 hover:text-zinc-300 px-2 py-1 rounded border border-zinc-900 hover:border-zinc-700 transition-colors"
          >
            Explorer ↗
          </a>
          <button
            onClick={inspect}
            className="text-[10px] text-black bg-white hover:bg-zinc-200 px-3 py-1 rounded font-medium transition-colors"
          >
            Inspect →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 pt-2 border-t border-zinc-900/60">
        {[
          ['Top Pair', hook.topPair || '—'],
          ['Fee Tier', formatFee(hook.topFeeTier)],
          ['Vol (30d)', hook.volume30dUSD > 0 ? formatUSD(hook.volume30dUSD) : '—'],
          ['Txns (30d)', hook.txCount30d > 0 ? hook.txCount30d.toLocaleString() : '—'],
          ['Vol (all)', hook.volumeUSD > 0 ? formatUSD(hook.volumeUSD) : '—'],
          ['Txns (all)', hook.txCount > 0 ? hook.txCount.toLocaleString() : '—'],
        ].map(([lbl, val]) => (
          <div key={lbl} className="flex flex-col gap-0.5">
            <span className="text-[9px] text-zinc-700 uppercase tracking-wider">{lbl}</span>
            <span className="text-xs font-mono text-zinc-400 truncate">{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Dashboard() {
  const [selectedChainIds, setSelectedChainIds] = useState<number[]>([])

  const { discovery, isLoading, error, fetchHooks } = useHookAddressDiscovery(selectedChainIds)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('txns')

  useEffect(() => { document.title = 'Dashboard — HookLens' }, [])

  const enrichedHooks = useMemo<EnrichedHook[]>(() =>
    (discovery?.hooks ?? []).map((h) => ({ ...h, category: getCategory(h.address) })),
  [discovery])

  const filteredHooks = useMemo<EnrichedHook[]>(() => {
    let result = [...enrichedHooks]

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (h) =>
          h.address.toLowerCase().includes(q) ||
          h.topPair.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q),
      )
    }

    if (selectedCategories.length > 0) {
      result = result.filter((h) => selectedCategories.includes(h.category))
    }

    if (activityFilter === 'active') result = result.filter((h) => h.txCount > 0 || h.volumeUSD > 0)
    if (activityFilter === 'inactive') result = result.filter((h) => h.txCount === 0 && h.volumeUSD === 0)

    result.sort((a, b) => {
      if (sortKey === 'txns') return b.txCount - a.txCount
      if (sortKey === 'volume') return b.volumeUSD - a.volumeUSD
      if (sortKey === 'pools') return b.poolCount - a.poolCount
      if (sortKey === 'address') return a.address.localeCompare(b.address)
      return 0
    })
    return result
  }, [enrichedHooks, searchQuery, selectedCategories, activityFilter, sortKey])

  const hasClientFilter = searchQuery || selectedCategories.length > 0 || activityFilter !== 'all'

  const handleChainChange = useCallback((vals: string[]) => {
    const ids = vals.map(Number)
    setSelectedChainIds(ids)
    void fetchHooks(ids)
  }, [fetchHooks])

  const totalTxns = filteredHooks.reduce((s, h) => s + h.txCount, 0)
  const totalVolume = filteredHooks.reduce((s, h) => s + h.volumeUSD, 0)
  const activeCount = filteredHooks.filter((h) => h.txCount > 0 || h.volumeUSD > 0).length

  const chainOptions = CHAIN_OPTIONS.map((c) => ({ value: String(c.id), label: c.name }))
  const categoryOptions = CATEGORY_OPTIONS.map(([v, l]) => ({ value: v, label: l }))

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-5">

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Hook Discovery</span>
              {discovery && (
                <span className="text-[10px] text-zinc-700">
                  · {new Date(discovery.fetchedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Uniswap v4 Hook Index
            </h1>
            <p className="text-xs text-zinc-500">
              {discovery?.totalFound ?? '—'} hooks across {discovery?.chainsQueried ?? '—'} chain{(discovery?.chainsQueried ?? 0) !== 1 ? 's' : ''}
              {hasClientFilter && ` · ${filteredHooks.length} shown after filters`}
            </p>
          </div>
          <button
            onClick={() => fetchHooks(selectedChainIds.length > 0 ? selectedChainIds : undefined)}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-white text-black text-xs font-medium hover:bg-zinc-200 disabled:opacity-30 transition-colors self-start whitespace-nowrap"
          >
            {isLoading ? 'Querying…' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Hooks Shown" value={filteredHooks.length.toString()} sub={`of ${discovery?.totalFound ?? '—'} total`} />
          <StatCard label="Active Hooks" value={activeCount.toString()} sub="with txns or volume" />
          <StatCard label="Total Txns" value={totalTxns > 0 ? totalTxns.toLocaleString() : '—'} />
          <StatCard label="Total Volume" value={totalVolume > 0 ? formatUSD(totalVolume) : '—'} />
        </div>

        <div className="border border-zinc-900 rounded-xl p-5 flex flex-col gap-5 bg-[#0a0a0a]">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm select-none">⌕</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by address, token pair, or description…"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-9 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors font-mono"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 text-xs">✕</button>
            )}
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <MultiDropdown
              label={`Chain${CHAIN_OPTIONS.length > 0 ? ` (${CHAIN_OPTIONS.length} configured)` : ''}`}
              values={selectedChainIds.map(String)}
              options={chainOptions}
              onChange={handleChainChange}
              placeholder="All chains"
            />

            <MultiDropdown
              label="Hook Type"
              values={selectedCategories}
              options={categoryOptions}
              onChange={setSelectedCategories}
              placeholder="All types"
            />

            <Dropdown
              label="Activity"
              value={activityFilter}
              options={[
                { value: 'all', label: 'All hooks' },
                { value: 'active', label: 'Has activity' },
                { value: 'inactive', label: 'No activity' },
              ]}
              onChange={(v) => setActivityFilter(v as ActivityFilter)}
            />

            <Dropdown
              label="Sort By"
              value={sortKey}
              options={[
                { value: 'txns', label: 'Transactions' },
                { value: 'volume', label: 'Volume' },
                { value: 'pools', label: 'Pool Count' },
                { value: 'address', label: 'Address A→Z' },
              ]}
              onChange={(v) => setSortKey(v as SortKey)}
            />

            {hasClientFilter && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategories([]); setActivityFilter('all') }}
                className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors underline underline-offset-2 mb-2"
              >
                Clear filters
              </button>
            )}
          </div>

          {SUPPORTED_CHAINS.filter((c) => !UNISWAP_V4_SUBGRAPH_IDS_BY_CHAIN[c.id]).length > 0 && (
            <p className="text-[10px] text-zinc-700 border-t border-zinc-900/60 pt-3">
              {SUPPORTED_CHAINS.filter((c) => !UNISWAP_V4_SUBGRAPH_IDS_BY_CHAIN[c.id]).map((c) => c.name).join(', ')} — no subgraph configured.{' '}
              <span className="text-zinc-600">Add IDs to constants.ts to enable.</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {isLoading && <LoadingSkeleton className="h-24" lines={4} />}

          {error && !isLoading && (
            <div className="border border-zinc-800 rounded-xl px-5 py-5 flex flex-col gap-2">
              <p className="text-xs font-medium text-zinc-400">Subgraph query failed</p>
              <p className="text-xs text-zinc-600 leading-relaxed">{error}</p>
              <button
                onClick={() => fetchHooks(selectedChainIds.length > 0 ? selectedChainIds : undefined)}
                className="text-xs text-zinc-600 hover:text-white underline underline-offset-2 self-start mt-1 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && filteredHooks.length === 0 && enrichedHooks.length > 0 && (
            <div className="border border-zinc-900 rounded-xl px-5 py-10 text-center flex flex-col gap-2 items-center">
              <p className="text-sm text-zinc-400 font-medium">No hooks match the current filters</p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategories([]); setActivityFilter('all') }}
                className="text-xs text-zinc-600 hover:text-white underline underline-offset-2 transition-colors"
              >
                Clear client filters
              </button>
            </div>
          )}

          {!isLoading && !error && enrichedHooks.length === 0 && !isLoading && (
            <div className="border border-zinc-900 rounded-xl px-5 py-10 text-center flex flex-col gap-2 items-center">
              <p className="text-sm text-zinc-400 font-medium">No hooks found</p>
              <p className="text-xs text-zinc-600 max-w-sm leading-relaxed">
                Check that VITE_THEGRAPH_API_KEY is set and the configured chains have indexed hook pools.
              </p>
            </div>
          )}

          {filteredHooks.map((hook) => (
            <HookRow key={`${hook.chainId}-${hook.address}`} hook={hook} />
          ))}
        </div>

        {(discovery?.errors.length ?? 0) > 0 && (
          <div className="border border-zinc-900 rounded-xl px-4 py-3 flex flex-col gap-1.5">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Partial Query Errors</p>
            {discovery!.errors.map((item) => (
              <p key={item.chainId} className="text-xs text-zinc-700">
                <span className="font-mono text-zinc-500">Chain {item.chainId}:</span> {item.message}
              </p>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
