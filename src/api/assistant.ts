import type { AgentReport } from './agentEngine'
import type { SafetyAnalysis } from '../types/hook'

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

const OLLAMA_HOST = String(import.meta.env.VITE_OLLAMA_PROXY_URL ?? '/hooklens-ollama').replace(/\/$/, '')

const PREFERRED_MODELS = ['llama3.2', 'llama3', 'phi3', 'mistral', 'gemma2']

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

export function buildSystemContext(report: AgentReport, hookAddress: string | null, safety: SafetyAnalysis | null): string {
  const decision = report.decision
  const confidence = report.confidence
  
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

  let sourceCodeContext = 'Sourcify Source Code: Not available or unverified.'
  if (safety?.source.verification.isVerified && safety.source.sources) {
    const files = Object.entries(safety.source.sources)
    const hookFile = files.find(([name]) => name.toLowerCase().includes('hook')) || files[0]
    if (hookFile) {
      const code = hookFile[1].content.slice(0, 1500)
      sourceCodeContext = `Verified Source Code Snippet (${hookFile[0]}):\n\`\`\`solidity\n${code}...\n\`\`\``
    }
  }

  return `You are an expert DeFi smart contract auditor. Your task is to analyze Uniswap v4 swap simulation results and explain EXACTLY why a route fails or why it has severe price impact.

SWAP SIMULATION DATA:
DECISION: ${decision} (Confidence: ${confidence}%)
HOOK ADDRESS: ${hookAddress ?? 'Not specified'}
PRICE IMPACT VS MARKET: ${impactPct} (${impactAmt})

ROUTES EVALUATED:
1. Hook Route (V4_HOOKS_ONLY): Output: ${hookOutput} | Gas: ${hookGas} | Routing Type: ${hookRouting}
2. Market Route (BEST_PRICE): Output: ${marketOutput} | Gas: ${marketGas} | Routing Type: ${marketRouting}

SIMULATION RATIONALE:
${rationaleLines}

WARNINGS:
${riskLines || 'None'}

${sourceCodeContext}

INSTRUCTIONS FOR YOUR RESPONSE:
1. DO NOT give generic security advice (like "use a proxy" or "add reentrancy guards") unless it specifically explains the swap failure.
2. Focus entirely on the math, the routing differences, and the specific logic in the provided Solidity snippet.
3. If the swap failed, explain what specific line or logic in the hook caused the transaction to revert or quote to fail.
4. If there is a massive negative price impact, explain how the hook's fee structure or forced routing is draining value.
5. Be incredibly concise. Do not repeat words. Get straight to the technical point.`
}

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

export interface ExplainResult {
  text: string
  model: string
}

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
          temperature: 0.2,
          top_p: 0.9,
          repeat_penalty: 1.15,
        },
      }),
    })
  } catch {
    throw new OllamaUnavailableError()
  }

  if (!res.ok || !res.body) throw new OllamaUnavailableError()

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
        continue
      }
    }
  }

  return { text: fullText.trim(), model }
}

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
