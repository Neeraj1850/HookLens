import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { type Currency } from '@uniswap/sdk-core'
import { Layout } from '../components/layout/Layout'
import { SUPPORTED_CHAINS } from '../config/constants'
import { DUMMY_SWAPPER, getTokensForChain, currencySymbol, currencyToApiAddress } from '../api/uniswap'
import { runAgentPipeline, classifyHookRisk } from '../api/agentEngine'
import { useHookStore } from '../store/hookStore'
import type { AgentStep, AgentReport, AgentDecision } from '../api/agentEngine'
import { tokenDefToCurrency } from '../utils/token'

const QUOTABLE_CHAINS = SUPPORTED_CHAINS.filter((c) => [8453, 1, 42161].includes(c.id))

const DECISION_CONFIG: Record<AgentDecision, { label: string; color: string; bg: string; icon: string }> = {
  USE_HOOK_ROUTE:       { label: 'Use Hook Route',        color: 'text-emerald-400', bg: 'border-emerald-900 bg-emerald-950/30', icon: '✦' },
  USE_MARKET_ROUTE:     { label: 'Use Market Route',      color: 'text-blue-400',    bg: 'border-blue-900 bg-blue-950/30',    icon: '→' },
  NO_HOOK_POOL:         { label: 'No Hook Pool Found',    color: 'text-amber-400',   bg: 'border-amber-900 bg-amber-950/30',  icon: '○' },
  BOTH_ROUTES_FAILED:   { label: 'Both Routes Failed',    color: 'text-red-400',     bg: 'border-red-900 bg-red-950/30',      icon: '✕' },
  HOOK_RISK_ELEVATED:   { label: 'Elevated Hook Risk',    color: 'text-orange-400',  bg: 'border-orange-900 bg-orange-950/30',icon: '⚠' },
  INDETERMINATE:        { label: 'Indeterminate',         color: 'text-zinc-400',    bg: 'border-zinc-800 bg-zinc-900/30',    icon: '?' },
}

const SKILL_COLORS: Record<string, string> = {
  'swap-integration':        'text-violet-400',
  'swap-planner':            'text-blue-400',
  'v4-security-foundations': 'text-amber-400',
  'viem-integration':        'text-emerald-400',
}

const STATUS_ICONS: Record<string, string> = {
  idle:    '○',
  running: '◌',
  done:    '●',
  error:   '✕',
  skipped: '–',
}

function TokenSelect({
  value,
  onChange,
  tokens,
}: {
  value: Currency
  onChange: (t: Currency) => void
  tokens: Currency[]
}) {
  // Use the API address as the unique key (0x000...000 for native ETH)
  const valueAddr = currencyToApiAddress(value)
  return (
    <select
      value={valueAddr}
      onChange={(e) => {
        const t = tokens.find((t) => currencyToApiAddress(t) === e.target.value)
        if (t) onChange(t)
      }}
      className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-zinc-600 transition-colors cursor-pointer appearance-none w-full"
      style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1em' }}
    >
      {tokens.map((t) => (
        <option key={currencyToApiAddress(t)} value={currencyToApiAddress(t)}>
          {currencySymbol(t)}{t.isNative ? ' (native)' : ''}
        </option>
      ))}
    </select>
  )
}

function StepRow({ step }: { step: AgentStep }) {
  const icon = STATUS_ICONS[step.status] ?? '○'
  const skillColor = SKILL_COLORS[step.skill] ?? 'text-zinc-500'
  const isRunning = step.status === 'running'

  return (
    <div className={`flex flex-col gap-1.5 px-4 py-3 rounded-xl border transition-all duration-300 ${
      isRunning ? 'border-white/20 bg-white/[0.03]' :
      step.status === 'done' ? 'border-zinc-800/60 bg-transparent' :
      step.status === 'error' ? 'border-red-900/60 bg-red-950/10' :
      'border-zinc-900 bg-transparent'
    }`}>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-mono w-4 shrink-0 ${
          isRunning ? 'animate-pulse text-white' :
          step.status === 'done' ? 'text-emerald-400' :
          step.status === 'error' ? 'text-red-400' :
          'text-zinc-700'
        }`}>
          {icon}
        </span>
        <span className={`text-xs font-medium flex-1 ${
          isRunning ? 'text-white' :
          step.status === 'done' ? 'text-zinc-300' :
          'text-zinc-600'
        }`}>
          {step.label}
        </span>
        <span className={`text-[10px] font-mono ${skillColor} opacity-70 shrink-0 hidden sm:block`}>
          {step.skill}
        </span>
        {step.durationMs != null && (
          <span className="text-[10px] text-zinc-700 font-mono shrink-0">{step.durationMs}ms</span>
        )}
      </div>
      {step.detail && (
        <p className="text-[11px] text-zinc-500 pl-7 leading-relaxed font-mono">{step.detail}</p>
      )}
    </div>
  )
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{label}</span>
        <span className={`text-sm font-mono font-semibold ${color}`}>{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color.replace('text-', 'bg-')}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

export function AiStudio() {
  const navigate = useNavigate()
  const { address: walletAddress } = useAccount()
  const { simTokenIn, simTokenOut, simChainId, currentAddress } = useHookStore()

  // Local state
  const [chainId, setChainId] = useState<number>(simChainId || 8453)
  const [amount, setAmount] = useState('1')
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [report, setReport] = useState<AgentReport | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  // getTokensForChain returns SDK Currency[] — WETH9 and Ether from the SDK constants
  const chainCurrencies = getTokensForChain(chainId)

  // Bridge store-sourced TokenDef (from pool selection) to SDK Currency
  const storeIn  = simTokenIn  ? tokenDefToCurrency(simTokenIn)  : null
  const storeOut = simTokenOut ? tokenDefToCurrency(simTokenOut) : null

  // Merge: chain defaults + any store-loaded currencies, deduplicated by address
  const allCurrencies: Currency[] = [...chainCurrencies]
  if (storeIn  && !chainCurrencies.some((c) => currencyToApiAddress(c) === currencyToApiAddress(storeIn))) {
    allCurrencies.push(storeIn)
  }
  if (storeOut && !chainCurrencies.some((c) => currencyToApiAddress(c) === currencyToApiAddress(storeOut))) {
    allCurrencies.push(storeOut)
  }

  const [tokenIn,  setTokenIn]  = useState<Currency>(storeIn  ?? allCurrencies[0]!)
  const [tokenOut, setTokenOut] = useState<Currency>(storeOut ?? allCurrencies[1]!)

  const swapper = walletAddress ? String(walletAddress) : DUMMY_SWAPPER
  const hookAddress = currentAddress || null
  const hookRisk = hookAddress ? classifyHookRisk(hookAddress) : null

  const handleChainChange = (id: number) => {
    const currencies = getTokensForChain(id)
    setChainId(id)
    setTokenIn(currencies[0]!)
    setTokenOut(currencies[1]!)
    setReport(null)
    setSteps([])
    setRunError(null)
  }

  const handleSwapDir = () => {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setReport(null)
  }

  const handleRun = useCallback(async () => {
    if (!tokenIn || !tokenOut || !amount || parseFloat(amount) <= 0) return
    setIsRunning(true)
    setReport(null)
    setRunError(null)
    setSteps([])

    try {
      // Pass SDK Currency objects directly — getDualQuote uses currency.decimals
      const result = await runAgentPipeline(
        tokenIn,
        tokenOut,
        amount,
        chainId,
        swapper,
        hookAddress,
        (updatedSteps) => setSteps([...updatedSteps]),
      )
      setReport(result)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Agent pipeline failed')
    } finally {
      setIsRunning(false)
    }
  }, [tokenIn, tokenOut, amount, chainId, swapper, hookAddress])

  const decisionCfg = report ? DECISION_CONFIG[report.decision] : null
  const canRun = !isRunning && !!tokenIn && !!tokenOut && !!amount && parseFloat(amount) > 0

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400/80 text-lg">✦</span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Uniswap AI · Agentic Swap Simulator</span>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            AI Studio
          </h1>
          <p className="text-xs text-zinc-500 max-w-2xl leading-relaxed">
            A 6-step agentic pipeline that fetches dual quotes from the Uniswap Trading API
            (<span className="font-mono text-zinc-400">V4_HOOKS_ONLY</span> vs{' '}
            <span className="font-mono text-zinc-400">BEST_PRICE</span>), scores both routes,
            classifies hook risk using the <span className="font-mono text-zinc-400">v4-security-foundations</span> skill,
            and makes a deterministic routing recommendation.
          </p>
        </div>

        {/* Skill legend */}
        <div className="flex flex-wrap gap-3 text-[10px] font-mono border border-zinc-900 rounded-xl px-4 py-3 bg-zinc-950/40">
          <span className="text-zinc-700 uppercase tracking-wider mr-1">Skills used:</span>
          {Object.entries(SKILL_COLORS).map(([skill, color]) => (
            <span key={skill} className={`${color}`}>{skill}</span>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          {/* Left: Config + Steps */}
          <div className="flex flex-col gap-4">

            {/* Config card */}
            <div className="border border-zinc-800 rounded-2xl p-5 flex flex-col gap-5 bg-[#0a0a0a]">

              {/* Chain selector */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Chain</span>
                <div className="flex flex-wrap gap-1.5">
                  {QUOTABLE_CHAINS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleChainChange(c.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        chainId === c.id
                          ? 'bg-white text-black font-medium'
                          : 'text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Token pair */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Token Pair</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <TokenSelect
                      tokens={allCurrencies}
                      value={tokenIn}
                      onChange={(t) => { setTokenIn(t); setReport(null) }}
                    />
                  </div>

                  <button
                    onClick={handleSwapDir}
                    className="w-9 h-9 rounded-lg border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white transition-colors flex items-center justify-center text-base mt-6 shrink-0"
                    aria-label="Swap direction"
                  >⇄</button>

                  <div className="flex-1 flex flex-col gap-1.5">
                    <TokenSelect
                      tokens={allCurrencies}
                      value={tokenOut}
                      onChange={(t) => { setTokenOut(t); setReport(null) }}
                    />
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Amount ({tokenIn?.symbol})</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setReport(null) }}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors w-full"
                  placeholder="1"
                />
              </div>

              {/* Hook context */}
              {hookAddress && (
                <div className="flex items-center gap-3 border border-zinc-900 rounded-xl px-4 py-3 bg-zinc-950/40">
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-[10px] text-zinc-700 uppercase tracking-wider">Hook Context</span>
                    <code className="text-[10px] text-zinc-500 font-mono truncate">{hookAddress}</code>
                  </div>
                  {hookRisk && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                      hookRisk === 'HIGH'   ? 'text-red-400 border-red-900' :
                      hookRisk === 'MEDIUM' ? 'text-amber-400 border-amber-900' :
                      'text-emerald-400 border-emerald-900'
                    }`}>
                      {hookRisk}
                    </span>
                  )}
                  <button
                    onClick={() => navigate(`/inspect/${chainId}/${hookAddress}`)}
                    className="text-[10px] text-zinc-600 hover:text-white transition-colors shrink-0"
                  >
                    inspect →
                  </button>
                </div>
              )}

              {/* Run button */}
              <button
                id="ai-studio-run-btn"
                onClick={handleRun}
                disabled={!canRun}
                className="w-full py-3.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed bg-white text-black hover:bg-zinc-100"
              >
                {isRunning ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Agent Running…
                  </>
                ) : (
                  <>
                    <span className="text-base">✦</span>
                    Run Agentic Analysis
                  </>
                )}
              </button>

              {runError && (
                <div className="border border-red-900 rounded-xl px-4 py-3 flex flex-col gap-1">
                  <p className="text-xs font-medium text-red-400">Pipeline Error</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{runError}</p>
                  {runError.toLowerCase().includes('api key') && (
                    <p className="text-[10px] text-zinc-700 mt-0.5">Add VITE_UNISWAP_API_KEY to your .env and restart the dev server.</p>
                  )}
                </div>
              )}
            </div>

            {/* Pipeline steps */}
            {steps.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest px-1">Pipeline Execution</span>
                {steps.map((step) => (
                  <StepRow key={step.id} step={step} />
                ))}
              </div>
            )}
          </div>

          {/* Right: Report */}
          <div className="flex flex-col gap-4">

            {!report && !isRunning && (
              <div className="border border-zinc-900 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[280px]">
                <span className="text-4xl text-zinc-800">✦</span>
                <p className="text-sm text-zinc-600">Configure a swap pair and run the agent to get a routing recommendation.</p>
              </div>
            )}

            {isRunning && !report && (
              <div className="border border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[280px]">
                <span className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
                <p className="text-sm text-zinc-500">Agent is running…</p>
              </div>
            )}

            {report && decisionCfg && (
              <div className="flex flex-col gap-4 animate-fade-in">

                {/* Decision card */}
                <div className={`border rounded-2xl p-5 flex flex-col gap-3 ${decisionCfg.bg}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl ${decisionCfg.color}`}>{decisionCfg.icon}</span>
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Agent Decision</p>
                      <p className={`text-base font-semibold ${decisionCfg.color}`}>{decisionCfg.label}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[10px] text-zinc-600">Confidence</p>
                      <p className={`text-lg font-mono font-bold ${decisionCfg.color}`}>{report.confidence}%</p>
                    </div>
                  </div>

                  {/* Impact */}
                  {report.comparison?.hookQuote && report.comparison?.baseQuote && (
                    <div className="border-t border-white/5 pt-3 grid grid-cols-3 gap-3">
                      {[
                        ['Impact', report.impactAmount + ' ' + (report.comparison.baseQuote.quote.output.token.symbol)],
                        ['Impact %', `${report.impactPercent > 0 ? '+' : ''}${report.impactPercent.toFixed(3)}%`],
                        ['Better for swapper', report.isPositive ? 'Yes' : 'No'],
                      ].map(([l, v]) => (
                        <div key={l} className="flex flex-col gap-0.5">
                          <span className="text-[9px] text-zinc-600 uppercase tracking-wider">{l}</span>
                          <span className={`text-xs font-mono ${report.isPositive ? 'text-emerald-400' : 'text-zinc-400'}`}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Route scores */}
                {(report.hookScore || report.baseScore) && (
                  <div className="border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 bg-[#0a0a0a]">
                    <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Route Scores</span>
                    {report.hookScore && (
                      <ScoreBar label="Hook Route (V4_HOOKS_ONLY)" score={report.hookScore.score} color="text-violet-400" />
                    )}
                    {report.baseScore && (
                      <ScoreBar label="Market Route (BEST_PRICE)" score={report.baseScore.score} color="text-blue-400" />
                    )}
                  </div>
                )}

                {/* Rationale */}
                {report.rationale.length > 0 && (
                  <div className="border border-zinc-900 rounded-2xl p-5 flex flex-col gap-3 bg-[#0a0a0a]">
                    <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Agent Rationale</span>
                    <ul className="flex flex-col gap-2">
                      {report.rationale.map((line, i) => (
                        <li key={i} className="flex gap-2 text-xs text-zinc-500 leading-relaxed">
                          <span className="text-zinc-700 shrink-0 mt-0.5">·</span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {report.warnings.length > 0 && (
                  <div className="border border-amber-900/40 rounded-2xl p-5 flex flex-col gap-3 bg-amber-950/10">
                    <span className="text-[10px] text-amber-600 uppercase tracking-widest">⚠ Warnings</span>
                    <ul className="flex flex-col gap-2">
                      {report.warnings.map((w, i) => (
                        <li key={i} className="flex gap-2 text-xs text-amber-400/80 leading-relaxed">
                          <span className="shrink-0 mt-0.5">·</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Raw quote details */}
                {report.comparison && (
                  <details className="border border-zinc-900 rounded-2xl overflow-hidden">
                    <summary className="px-5 py-3 text-[10px] text-zinc-600 uppercase tracking-widest cursor-pointer hover:text-zinc-400 transition-colors">
                      Raw Quote Data
                    </summary>
                    <div className="px-5 pb-4 flex flex-col gap-3">
                      {report.comparison.hookQuote && (
                        <div>
                          <p className="text-[10px] text-zinc-700 mb-1">Hook Quote</p>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              ['Routing', report.comparison.hookQuote.routing],
                              ['Output', `${report.comparison.hookQuote.quote.output.amount} wei`],
                              ['Slippage', `${report.comparison.hookQuote.quote.slippage}%`],
                              ['Gas (USD)', report.comparison.hookQuote.quote.gasFeeUSD ?? '—'],
                            ].map(([l, v]) => (
                              <div key={l} className="flex flex-col gap-0.5">
                                <span className="text-[9px] text-zinc-700">{l}</span>
                                <span className="text-[10px] font-mono text-zinc-400 truncate">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {report.comparison.baseQuote && (
                        <div>
                          <p className="text-[10px] text-zinc-700 mb-1">Market Quote</p>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              ['Routing', report.comparison.baseQuote.routing],
                              ['Output', `${report.comparison.baseQuote.quote.output.amount} wei`],
                              ['Slippage', `${report.comparison.baseQuote.quote.slippage}%`],
                              ['Gas (USD)', report.comparison.baseQuote.quote.gasFeeUSD ?? '—'],
                            ].map(([l, v]) => (
                              <div key={l} className="flex flex-col gap-0.5">
                                <span className="text-[9px] text-zinc-700">{l}</span>
                                <span className="text-[10px] font-mono text-zinc-400 truncate">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-[9px] text-zinc-800 font-mono">
                        Fetched {new Date(report.completedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </details>
                )}

                {/* Dev Tool Comparison */}
                <div className="border border-zinc-900 rounded-2xl p-5 flex flex-col gap-4 bg-[#0a0a0a]">
                  <span className="text-[10px] text-zinc-600 uppercase tracking-widest">HookLens vs Other Tools</span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-zinc-900">
                          <th className="text-left text-zinc-600 pb-2 pr-3 font-normal">Feature</th>
                          {['HookLens', 'Tenderly', 'Dune', 'Hookmate'].map((t) => (
                            <th key={t} className={`text-center pb-2 px-2 font-normal ${t === 'HookLens' ? 'text-white' : 'text-zinc-600'}`}>{t}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/50">
                        {[
                          ['Hook flag decoder',       true, false, false, true ],
                          ['v4 subgraph discovery',   true, false, true,  false],
                          ['Live dual-quote API',      true, false, false, false],
                          ['Agentic routing decision', true, false, false, false],
                          ['v4-security-foundations', true, false, false, true ],
                          ['Source safety analysis',  true, true,  false, true ],
                          ['Pool market comparison',  true, false, true,  false],
                          ['Uniswap AI skills',       true, false, false, false],
                        ].map(([feature, ...vals]) => (
                          <tr key={String(feature)}>
                            <td className="text-zinc-500 py-2 pr-3">{feature}</td>
                            {vals.map((v, i) => (
                              <td key={i} className="text-center py-2 px-2">
                                <span className={v ? (i === 0 ? 'text-emerald-400' : 'text-zinc-400') : 'text-zinc-800'}>
                                  {v ? '✓' : '–'}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
