/**
 * LocalAI — Ollama REST integration for plain-English swap report explanations.
 *
 * Connects to a locally running Ollama server (http://localhost:11434)
 * using its native JSON REST API — no npm package required, just fetch.
 * No API key needed. Works with any model the user has pulled:
 *   ollama pull llama3.2        (recommended, ~2GB)
 *   ollama pull phi3            (lightweight, ~2.3GB)
 *   ollama pull mistral         (balanced, ~4GB)
 *
 * In production on Vercel, Ollama is not available — the caller receives
 * an OllamaUnavailableError and should display a graceful fallback.
 */

import type { AgentReport } from './agentEngine'

// ─── Error types ──────────────────────────────────────────────────────────────

export class OllamaUnavailableError extends Error {
  constructor() {
    super('Ollama is not running. Start it with: ollama serve')
    this.name = 'OllamaUnavailableError'
  }
}

export class OllamaNoModelError extends Error {
  public readonly model: string
  constructor(model: string) {
    super(`Model "${model}" not found. Pull it with: ollama pull ${model}`)
    this.name = 'OllamaNoModelError'
    this.model = model
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

const OLLAMA_HOST = 'http://localhost:11434'

/** Preferred model order — first available is used */
const PREFERRED_MODELS = ['llama3.2', 'llama3', 'phi3', 'mistral', 'gemma2']

// ─── Ollama REST types ────────────────────────────────────────────────────────

interface OllamaModel {
  name: string
}

interface OllamaListResponse {
  models: OllamaModel[]
}

interface OllamaGenerateChunk {
  response: string
  done: boolean
  model?: string
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(report: AgentReport, hookAddress: string | null): string {
  const decision = report.decision
  const confidence = report.confidence
  const hookScore = report.hookScore?.score?.toFixed(1) ?? 'N/A'
  const marketScore = report.baseScore?.score?.toFixed(1) ?? 'N/A'
  const impactPct = `${report.impactPercent > 0 ? '+' : ''}${report.impactPercent.toFixed(3)}%`
  const impactAmt = report.impactAmount
  const riskLines = report.warnings.join('\n')
  const rationaleLines = report.rationale.join('\n')

  return `You are a DeFi swap advisor explaining results to a non-technical user. Be concise, friendly, and avoid jargon. Use plain English. Do not use bullet points — write 2 to 3 short paragraphs only.

Here is the result of a Uniswap v4 swap simulation:

DECISION: ${decision}
CONFIDENCE: ${confidence}%
HOOK ROUTE SCORE: ${hookScore}/100
MARKET ROUTE SCORE: ${marketScore}/100
PRICE IMPACT VS MARKET: ${impactPct} (${impactAmt})
IS HOOK BETTER: ${report.isPositive ? 'Yes' : 'No'}
HOOK ADDRESS: ${hookAddress ?? 'Not specified'}

TECHNICAL RATIONALE:
${rationaleLines}

WARNINGS:
${riskLines || 'None'}

In simple language, explain:
1. What these scores mean for someone who wants to swap tokens
2. Whether the hook route is good or bad for this swap and why
3. What the user should do next

Do not mention "V4_HOOKS_ONLY", "BEST_PRICE", or internal API terms. Keep it under 120 words.`
}

// ─── Model detection via REST ─────────────────────────────────────────────────

async function detectModel(): Promise<string> {
  let data: OllamaListResponse
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) throw new OllamaUnavailableError()
    data = await res.json() as OllamaListResponse
  } catch (err) {
    if (err instanceof OllamaUnavailableError) throw err
    throw new OllamaUnavailableError()
  }

  const available = (data.models ?? []).map((m) => m.name.split(':')[0]!)

  for (const preferred of PREFERRED_MODELS) {
    if (available.includes(preferred)) return preferred
  }

  if (available.length > 0) return available[0]!

  throw new OllamaNoModelError(PREFERRED_MODELS[0]!)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ExplainResult {
  text: string
  model: string
}

/**
 * Generate a plain-English explanation of an AgentReport using Ollama.
 * Streams the NDJSON response from /api/generate token-by-token.
 *
 * @param report      The completed AgentReport from runAgentPipeline
 * @param hookAddress Optional hook contract address for context
 * @param onChunk     Called with each streamed text token as it arrives
 * @returns           Final complete text + model name used
 */
export async function explainReport(
  report: AgentReport,
  hookAddress: string | null,
  onChunk: (chunk: string) => void,
): Promise<ExplainResult> {
  const model = await detectModel()
  const prompt = buildPrompt(report, hookAddress)

  let res: Response
  try {
    res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
        options: {
          temperature: 0.4,
          num_predict: 200,
          top_p: 0.9,
        },
      }),
    })
  } catch {
    throw new OllamaUnavailableError()
  }

  if (!res.ok || !res.body) throw new OllamaUnavailableError()

  // Stream NDJSON — each line is a JSON object { response, done }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const chunk = JSON.parse(trimmed) as OllamaGenerateChunk
        if (chunk.response) {
          fullText += chunk.response
          onChunk(chunk.response)
        }
        if (chunk.done) break
      } catch {
        // malformed line — skip
      }
    }
  }

  return { text: fullText.trim(), model }
}

/**
 * Quick connectivity check — resolves true if Ollama is reachable.
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    })
    return res.ok
  } catch {
    return false
  }
}
