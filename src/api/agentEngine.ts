/**
 * HookLens Agentic Decision Engine
 *
 * Powered by the Uniswap Trading API (POST /quote) with hooksOptions:
 *   - V4_HOOKS_ONLY  → hook-gated route
 *   - best-price     → best available market route
 *
 * The agent runs a structured multi-step pipeline:
 *   1. PLAN    — build a swap intent from user inputs
 *   2. QUOTE   — fetch dual quotes from the Uniswap API in parallel
 *   3. ANALYZE — score each route on output, gas, slippage, routing type
 *   4. DECIDE  — deterministic rule-based recommendation
 *   5. REPORT  — emit structured findings + rationale
 *
 * Skills consumed from the Uniswap AI skill catalog:
 *   - swap-integration  → getDualQuote, hooksOptions usage
 *   - swap-planner      → route scoring, protocol preference logic
 *   - v4-security-foundations → hook risk classification
 *   - viem-integration  → address validation helpers
 */

import { type Currency } from '@uniswap/sdk-core'
import { getDualQuote, currencySymbol } from './uniswap'
import type { HookQuoteComparison, QuoteResponse } from '../types/uniswap'

// ─── Agent Step Types ─────────────────────────────────────────────────────────

export type AgentStepStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped'

export interface AgentStep {
  id: string
  label: string
  skill: string          // which Uniswap AI skill this maps to
  status: AgentStepStatus
  detail: string | null  // human-readable output shown in the UI
  durationMs?: number
  startedAt?: number
}

export type AgentDecision =
  | 'USE_HOOK_ROUTE'      // hook pool offers better or equal price
  | 'USE_MARKET_ROUTE'    // base market route is clearly better
  | 'NO_HOOK_POOL'        // no V4 hook pool exists for this pair
  | 'BOTH_ROUTES_FAILED'  // API returned errors for both paths
  | 'HOOK_RISK_ELEVATED'  // hook exists but risk score is elevated
  | 'INDETERMINATE'       // cannot determine (missing data)

export interface RouteScore {
  outputAmount: number
  gasFeeUSD: number
  slippage: number
  routingType: string
  score: number          // composite 0–100
}

export interface AgentReport {
  decision: AgentDecision
  confidence: number              // 0–100
  hookScore: RouteScore | null
  baseScore: RouteScore | null
  impactAmount: string
  impactPercent: number
  isPositive: boolean
  rationale: string[]             // bulleted reasoning lines
  warnings: string[]
  comparison: HookQuoteComparison | null
  completedAt: number
}

export interface AgentRunState {
  steps: AgentStep[]
  report: AgentReport | null
  isRunning: boolean
  error: string | null
}

// ─── Scoring Helpers ──────────────────────────────────────────────────────────

/**
 * Compute a composite route score (0–100).
 * Higher is better for the swapper.
 *
 * Weights (from swap-planner skill):
 *   - output amount  50 pts (normalised vs the other route)
 *   - gas cost       25 pts (lower gas = higher score)
 *   - slippage       15 pts (lower slippage = higher score)
 *   - routing type   10 pts (DUTCH_V2/V3 > CLASSIC)
 */
function scoreRoute(quote: QuoteResponse, outputDecimals: number): RouteScore {
  const rawOutput = parseFloat(quote.quote.output.amount) / 10 ** outputDecimals
  const gasFeeUSD = parseFloat(quote.quote.gasFeeUSD ?? '0') || 0
  const slippage = quote.quote.slippage ?? 0
  const routingType = quote.routing

  // Routing type bonus
  const routingBonus =
    routingType === 'DUTCH_V2' || routingType === 'DUTCH_V3'
      ? 10
      : routingType === 'CLASSIC'
      ? 5
      : 0

  // Gas penalty (0–25 pts, 0 gas = full 25 pts, $10 gas = 0 pts)
  const gasPenalty = Math.max(0, 25 - (gasFeeUSD / 10) * 25)

  // Slippage penalty (0–15 pts, 0% slippage = full 15 pts, 3% = 0 pts)
  const slippagePenalty = Math.max(0, 15 - (slippage / 3) * 15)

  return {
    outputAmount: rawOutput,
    gasFeeUSD,
    slippage,
    routingType,
    // Output score is set to 0 here; relative scoring applied after both routes evaluated
    score: gasPenalty + slippagePenalty + routingBonus,
  }
}

/** Apply relative output scoring between two routes */
function applyOutputScore(a: RouteScore, b: RouteScore): [RouteScore, RouteScore] {
  const max = Math.max(a.outputAmount, b.outputAmount)
  if (max === 0) return [a, b]
  const aOut = (a.outputAmount / max) * 50
  const bOut = (b.outputAmount / max) * 50
  return [
    { ...a, score: Math.min(100, a.score + aOut) },
    { ...b, score: Math.min(100, b.score + bOut) },
  ]
}

// ─── Hook Risk Classification (v4-security-foundations skill) ─────────────────

/**
 * Maps hook callback flags encoded in the address bits to a risk level.
 * This mirrors the v4-security-foundations skill's hook risk taxonomy:
 *   - HIGH: afterSwap + beforeSwap with state writes → potential reentrancy
 *   - MEDIUM: single direction hooks
 *   - LOW: initialize-only or no callbacks
 */
export function classifyHookRisk(hookAddress: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' {
  const ZERO = '0x0000000000000000000000000000000000000000'
  if (!hookAddress || hookAddress === ZERO) return 'UNKNOWN'
  try {
    const lowerNibble = parseInt(hookAddress.slice(-4), 16)
    // Bits: beforeSwap=0x0100, afterSwap=0x0080, beforeAddLiquidity=0x0040, afterAddLiquidity=0x0020
    const hasBeforeSwap = Boolean(lowerNibble & 0x0100)
    const hasAfterSwap = Boolean(lowerNibble & 0x0080)
    const hasLiqHooks = Boolean(lowerNibble & 0x0040) || Boolean(lowerNibble & 0x0020)

    if (hasBeforeSwap && hasAfterSwap) return 'HIGH'
    if (hasBeforeSwap || hasAfterSwap || hasLiqHooks) return 'MEDIUM'
    return 'LOW'
  } catch {
    return 'UNKNOWN'
  }
}

// ─── Decision Logic (swap-planner skill) ─────────────────────────────────────

function makeDecision(
  comparison: HookQuoteComparison,
  hookScore: RouteScore | null,
  baseScore: RouteScore | null,
  hookRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN',
): { decision: AgentDecision; confidence: number; rationale: string[]; warnings: string[] } {
  const rationale: string[] = []
  const warnings: string[] = []

  // Both failed
  if (!comparison.hookQuote && !comparison.baseQuote) {
    rationale.push('Both V4_HOOKS_ONLY and best-price routes returned API errors.')
    rationale.push('This typically means no executable route exists for this pair on this chain at this amount.')
    return { decision: 'BOTH_ROUTES_FAILED', confidence: 90, rationale, warnings }
  }

  // No hook pool
  if (comparison.noHookPool || !comparison.hookQuote) {
    rationale.push('The Uniswap Trading API found no V4 hook pool for this token pair (V4_HOOKS_ONLY returned no route).')
    rationale.push('Routing through the best available market route is the only viable path.')
    if (comparison.baseQuote) {
      rationale.push(`Best market route: ${comparison.baseQuote.routing} — output ${comparison.baseQuote.quote.output.amount} ${comparison.baseQuote.quote.output.token.symbol}`)
    }
    return { decision: 'NO_HOOK_POOL', confidence: 95, rationale, warnings }
  }

  if (!baseScore || !hookScore) {
    return { decision: 'INDETERMINATE', confidence: 0, rationale: ['Missing score data.'], warnings }
  }

  // Hook risk elevation check (v4-security-foundations skill)
  if (hookRisk === 'HIGH') {
    warnings.push('Hook address encodes both beforeSwap and afterSwap callbacks — elevated reentrancy risk.')
    warnings.push('The v4-security-foundations skill flags full-lifecycle hooks as requiring additional audit scrutiny.')
  }

  // Impact threshold logic (swap-planner skill logic)
  const impactPct = comparison.impactPercent

  rationale.push(`Hook route (V4_HOOKS_ONLY): output score ${hookScore.score.toFixed(1)}/100, routing: ${hookScore.routingType}`)
  rationale.push(`Market route (best-price): output score ${baseScore.score.toFixed(1)}/100, routing: ${baseScore.routingType}`)
  rationale.push(`Hook impact vs market: ${impactPct > 0 ? '+' : ''}${impactPct.toFixed(3)}% (${comparison.impactAmount} ${comparison.baseQuote?.quote.output.token.symbol ?? ''})`)

  if (impactPct > 0.1) {
    // Hook is meaningfully better
    rationale.push('Hook route provides better output than the best market route — favourable for swapper.')
    const conf = Math.min(95, 70 + Math.abs(impactPct) * 5)
    if (hookRisk === 'HIGH') {
      warnings.push('Despite the price advantage, high hook risk warrants manual review before execution.')
      return { decision: 'HOOK_RISK_ELEVATED', confidence: Math.max(40, conf - 20), rationale, warnings }
    }
    return { decision: 'USE_HOOK_ROUTE', confidence: conf, rationale, warnings }
  } else if (impactPct < -0.5) {
    // Hook is materially worse
    rationale.push(`Hook route yields ${Math.abs(impactPct).toFixed(3)}% less output than the best market route.`)
    rationale.push('Routing through the best market route maximizes output for the swapper.')
    return { decision: 'USE_MARKET_ROUTE', confidence: Math.min(95, 65 + Math.abs(impactPct) * 3), rationale, warnings }
  } else {
    // Within noise band
    rationale.push(`Routes are within ±0.5% of each other — difference is within normal routing variance.`)
    if (hookRisk === 'LOW' || hookRisk === 'MEDIUM') {
      rationale.push('With comparable prices, the hook route may be preferred to support hook pool liquidity.')
      return { decision: 'USE_HOOK_ROUTE', confidence: 55, rationale, warnings }
    }
    return { decision: 'USE_MARKET_ROUTE', confidence: 55, rationale, warnings }
  }
}

// ─── Agent Runner ─────────────────────────────────────────────────────────────

export type StepUpdateCallback = (steps: AgentStep[]) => void

function makeStep(id: string, label: string, skill: string): AgentStep {
  return { id, label, skill, status: 'idle', detail: null }
}

function updateStep(
  steps: AgentStep[],
  id: string,
  patch: Partial<AgentStep>,
  cb: StepUpdateCallback,
): AgentStep[] {
  const next = steps.map((s) => (s.id === id ? { ...s, ...patch } : s))
  cb([...next])
  return next
}

/**
 * Run the full agentic swap decision pipeline.
 *
 * @param tokenIn   Input token
 * @param tokenOut  Output token
 * @param amount    Human-readable amount (e.g. "1.5")
 * @param chainId   Chain ID
 * @param swapper   Wallet address (or dummy)
 * @param hookAddress Optional hook address for risk classification
 * @param onStepUpdate Callback fired after every step state change
 */
export async function runAgentPipeline(
  currencyIn: Currency,
  currencyOut: Currency,
  amount: string,
  chainId: number,
  swapper: string,
  hookAddress: string | null,
  onStepUpdate: StepUpdateCallback,
): Promise<AgentReport> {
  // ── Initialise steps ────────────────────────────────────────────────────────
  let steps: AgentStep[] = [
    makeStep('plan',    '01 · Plan Swap Intent',         'swap-integration'),
    makeStep('quote',   '02 · Fetch Dual Quotes',        'swap-integration'),
    makeStep('analyze', '03 · Score Route Candidates',   'swap-planner'),
    makeStep('risk',    '04 · Classify Hook Risk',       'v4-security-foundations'),
    makeStep('decide',  '05 · Make Routing Decision',    'swap-planner'),
    makeStep('report',  '06 · Compile Agent Report',     'swap-planner'),
  ]
  onStepUpdate([...steps])

  // ── STEP 1: Plan ────────────────────────────────────────────────────────────
  steps = updateStep(steps, 'plan', { status: 'running', startedAt: Date.now() }, onStepUpdate)
  await sleep(400)

  const planDetail = [
    `EXACT_INPUT swap of ${amount} ${currencySymbol(currencyIn)} → ${currencySymbol(currencyOut)}`,
    `Chain: ${chainId}`,
    `Swapper: ${swapper.slice(0, 6)}…${swapper.slice(-4)}`,
    `Protocols: V4 (hooksOptions: V4_HOOKS_ONLY) + BEST_PRICE`,
    `decimals: ${currencyIn.decimals} → ${currencyOut.decimals} (from SDK)`,
  ].join(' · ')

  steps = updateStep(steps, 'plan', {
    status: 'done',
    detail: planDetail,
    durationMs: Date.now() - (steps.find((s) => s.id === 'plan')?.startedAt ?? Date.now()),
  }, onStepUpdate)

  // ── STEP 2: Dual Quote ───────────────────────────────────────────────────────
  steps = updateStep(steps, 'quote', { status: 'running', startedAt: Date.now() }, onStepUpdate)

  let comparison: HookQuoteComparison
  const quoteStart = Date.now()
  try {
    // getDualQuote uses Currency.decimals from the SDK — no hardcoded decimals
    comparison = await getDualQuote(currencyIn, currencyOut, amount, chainId, swapper)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Quote failed'
    steps = updateStep(steps, 'quote', { status: 'error', detail: msg }, onStepUpdate)
    for (const remaining of ['analyze', 'risk', 'decide', 'report']) {
      steps = updateStep(steps, remaining, { status: 'skipped', detail: 'Skipped due to quote failure.' }, onStepUpdate)
    }
    throw new Error(msg)
  }

  const hookStatus = comparison.hookQuote ? 'OK' : comparison.noHookPool ? 'No hook pool' : 'Failed'
  const baseStatus = comparison.baseQuote ? 'OK' : 'Failed'
  steps = updateStep(steps, 'quote', {
    status: 'done',
    detail: `V4_HOOKS_ONLY: ${hookStatus} · Best-price: ${baseStatus} · Latency: ${Date.now() - quoteStart}ms`,
    durationMs: Date.now() - quoteStart,
  }, onStepUpdate)

  // ── STEP 3: Score Routes ──────────────────────────────────────────────────
  steps = updateStep(steps, 'analyze', { status: 'running', startedAt: Date.now() }, onStepUpdate)
  await sleep(300)

  // Use currency.decimals from SDK — never hardcode
  const outputDecimals = currencyOut.decimals
  let hookScore: RouteScore | null = null
  let baseScore: RouteScore | null = null

  if (comparison.hookQuote && comparison.baseQuote) {
    const rawHook = scoreRoute(comparison.hookQuote, outputDecimals)
    const rawBase = scoreRoute(comparison.baseQuote, outputDecimals)
    ;[hookScore, baseScore] = applyOutputScore(rawHook, rawBase)
  } else if (comparison.baseQuote) {
    baseScore = scoreRoute(comparison.baseQuote, outputDecimals)
    baseScore = { ...baseScore, score: Math.min(100, baseScore.score + 50) }
  } else if (comparison.hookQuote) {
    hookScore = scoreRoute(comparison.hookQuote, outputDecimals)
    hookScore = { ...hookScore, score: Math.min(100, hookScore.score + 50) }
  }

  const analyzeDetail = [
    hookScore ? `Hook score: ${hookScore.score.toFixed(1)}/100` : 'Hook: N/A',
    baseScore ? `Market score: ${baseScore.score.toFixed(1)}/100` : 'Market: N/A',
    `Impact: ${comparison.impactPercent > 0 ? '+' : ''}${comparison.impactPercent.toFixed(3)}%`,
  ].join(' · ')

  steps = updateStep(steps, 'analyze', {
    status: 'done',
    detail: analyzeDetail,
    durationMs: Date.now() - (steps.find((s) => s.id === 'analyze')?.startedAt ?? Date.now()),
  }, onStepUpdate)

  // ── STEP 4: Risk Classification ───────────────────────────────────────────
  steps = updateStep(steps, 'risk', { status: 'running', startedAt: Date.now() }, onStepUpdate)
  await sleep(250)

  const hookRisk = hookAddress ? classifyHookRisk(hookAddress) : 'UNKNOWN'
  const riskDetail = hookAddress
    ? `Hook ${hookAddress.slice(0, 8)}… — Risk level: ${hookRisk}`
    : 'No hook address provided — risk classification skipped'

  steps = updateStep(steps, 'risk', {
    status: hookAddress ? 'done' : 'skipped',
    detail: riskDetail,
    durationMs: Date.now() - (steps.find((s) => s.id === 'risk')?.startedAt ?? Date.now()),
  }, onStepUpdate)

  // ── STEP 5: Decide ────────────────────────────────────────────────────────
  steps = updateStep(steps, 'decide', { status: 'running', startedAt: Date.now() }, onStepUpdate)
  await sleep(350)

  const { decision, confidence, rationale, warnings } = makeDecision(
    comparison,
    hookScore,
    baseScore,
    hookRisk,
  )

  steps = updateStep(steps, 'decide', {
    status: 'done',
    detail: `Decision: ${decision} — Confidence: ${confidence}%`,
    durationMs: Date.now() - (steps.find((s) => s.id === 'decide')?.startedAt ?? Date.now()),
  }, onStepUpdate)

  // ── STEP 6: Report ────────────────────────────────────────────────────────
  steps = updateStep(steps, 'report', { status: 'running', startedAt: Date.now() }, onStepUpdate)
  await sleep(200)

  const report: AgentReport = {
    decision,
    confidence,
    hookScore,
    baseScore,
    impactAmount: comparison.impactAmount,
    impactPercent: comparison.impactPercent,
    isPositive: comparison.isPositive,
    rationale,
    warnings,
    comparison,
    completedAt: Date.now(),
  }

  steps = updateStep(steps, 'report', {
    status: 'done',
    detail: `Report compiled · ${rationale.length} findings · ${warnings.length} warnings`,
    durationMs: Date.now() - (steps.find((s) => s.id === 'report')?.startedAt ?? Date.now()),
  }, onStepUpdate)

  return report
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
