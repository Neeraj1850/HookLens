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
import type { SafetyAnalysis } from '../types/hook'

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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OllamaChatChunk {
  model: string
  message?: ChatMessage
  done: boolean
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildSystemContext(report: AgentReport, hookAddress: string | null, safety: SafetyAnalysis | null): string {
  const decision = report.decision
  const confidence = report.confidence
  
  // Extract detailed routing info
  const hookOutput = report.hookScore ? `${report.hookScore.outputAmount.toPrecision(5)}` : 'N/A'
  const hookGas = report.hookScore ? `$${report.hookScore.gasFeeUSD.toFixed(2)}` : 'N/A'
  const hookRouting = report.hookScore?.routingType ?? 'N/A'
  
  const marketOutput = report.baseScore ? `${report.baseScore.outputAmount.toPrecision(5)}` : 'N/A'
  const marketGas = report.baseScore ? `$${report.baseScore.gasFeeUSD.toFixed(2)}` : 'N/A'
  const marketRouting = report.baseScore?.routingType ?? 'N/A'
  
  const impactPct = `${report.impactPercent > 0 ? '+' : ''}${report.impactPercent.toFixed(3)}%`
  const impactAmt = report.impactAmount
  const riskLines = report.warnings.join('\n')
  const rationaleLines = report.rationale.join('\n')

  // Extract sourcify verified code if available
  let sourceCodeContext = 'Sourcify Source Code: Not available or unverified.'
  if (safety?.source.verification.isVerified && safety.source.sources) {
    // Try to find a file containing 'Hook' or just take the first file's content
    const files = Object.entries(safety.source.sources)
    const hookFile = files.find(([name]) => name.toLowerCase().includes('hook')) || files[0]
    if (hookFile) {
      // Truncate to ~1500 chars to avoid blowing up local model context window
      const code = hookFile[1].content.slice(0, 1500)
      sourceCodeContext = `Verified Source Code Snippet (${hookFile[0]}):\n\`\`\`solidity\n${code}...\n\`\`\``
    }
  }

  return `You are a DeFi technical auditor explaining Uniswap v4 swap simulation results to a developer. Use technical language. Explain exactly what the output is, evaluate the routes used, and analyze the verified source code if provided to explain what went right or wrong with this hook.

SWAP SIMULATION DATA:
DECISION: ${decision} (Confidence: ${confidence}%)
HOOK ADDRESS: ${hookAddress ?? 'Not specified'}
PRICE IMPACT VS MARKET: ${impactPct} (${impactAmt})

ROUTES EVALUATED:
1. Hook Route (V4_HOOKS_ONLY): Output: ${hookOutput} | Gas: ${hookGas} | Routing Type: ${hookRouting}
2. Market Route (BEST_PRICE): Output: ${marketOutput} | Gas: ${marketGas} | Routing Type: ${marketRouting}

AGENT RATIONALE:
${rationaleLines}

AGENT WARNINGS:
${riskLines || 'None'}

${sourceCodeContext}

When the user asks you to explain the report or asks questions, provide a highly technical and structured answer based on the context above. Keep responses concise and focused on developer-level details.`
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
 * Sends a conversation to the Ollama Chat API.
 * Streams the NDJSON response token-by-token.
 *
 * @param messages    Full history of ChatMessages (system + user + assistant)
 * @param onChunk     Called with each streamed text token as it arrives
 * @returns           Final complete text + model name used
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
): Promise<ExplainResult> {
  const model = await detectModel()

  let res: Response
  try {
    res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: {
          temperature: 0.4,
          num_predict: 400,
          top_p: 0.9,
        },
      }),
    })
  } catch {
    throw new OllamaUnavailableError()
  }

  if (!res.ok || !res.body) throw new OllamaUnavailableError()

  // Stream NDJSON — each line is a JSON object { message: { content }, done }
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
        const chunk = JSON.parse(trimmed) as OllamaChatChunk
        if (chunk.message?.content) {
          fullText += chunk.message.content
          onChunk(chunk.message.content)
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
