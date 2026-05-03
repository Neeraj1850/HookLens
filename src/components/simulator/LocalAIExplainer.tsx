import { useState, useCallback, useEffect } from 'react'
import type { AgentReport } from '../../api/agentEngine'
import {
  explainReport,
  isOllamaAvailable,
  OllamaUnavailableError,
  OllamaNoModelError,
} from '../../api/localAI'

import type { SafetyAnalysis } from '../../types/hook'

interface Props {
  report: AgentReport
  hookAddress: string | null
  safety?: SafetyAnalysis | null
}

type UIState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'unavailable'; hint: string }
  | { phase: 'generating'; model: string; partial: string }
  | { phase: 'done'; model: string; text: string }
  | { phase: 'error'; message: string }

export function LocalAIExplainer({ report, hookAddress, safety }: Props) {
  const [state, setState] = useState<UIState>({ phase: 'idle' })

  // Reset when report changes (new simulation run)
  useEffect(() => {
    setState({ phase: 'idle' })
  }, [report.completedAt])

  const handleExplain = useCallback(async () => {
    setState({ phase: 'checking' })

    const available = await isOllamaAvailable()
    if (!available) {
      setState({
        phase: 'unavailable',
        hint: 'Start Ollama: ollama serve — then pull a model: ollama pull llama3.2',
      })
      return
    }

    setState({ phase: 'generating', model: '…', partial: '' })

    try {
      let model = '…'
      const result = await explainReport(report, hookAddress, safety || null, (chunk) => {
        setState((prev) =>
          prev.phase === 'generating'
            ? { ...prev, partial: prev.partial + chunk, model }
            : prev,
        )
      })
      model = result.model
      setState({ phase: 'done', model: result.model, text: result.text })
    } catch (err) {
      if (err instanceof OllamaUnavailableError) {
        setState({
          phase: 'unavailable',
          hint: 'Start Ollama: ollama serve — then pull a model: ollama pull llama3.2',
        })
      } else if (err instanceof OllamaNoModelError) {
        setState({
          phase: 'unavailable',
          hint: err.message,
        })
      } else {
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : 'Local AI explanation failed',
        })
      }
    }
  }, [report, hookAddress, safety])

  // ── Idle ────────────────────────────────────────────────────────────────────
  if (state.phase === 'idle') {
    return (
      <div className="border border-zinc-900 rounded-2xl p-5 flex flex-col gap-3 bg-[#0a0a0a]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Local AI</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-zinc-800 text-zinc-700">
                Ollama · no API key
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Explain this result in plain English using a local model.
            </p>
          </div>
          <button
            id="local-ai-explain-btn"
            onClick={handleExplain}
            className="shrink-0 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-medium hover:border-zinc-500 hover:text-white transition-all flex items-center gap-1.5"
          >
            <span className="text-sm">◈</span>
            Explain
          </button>
        </div>
      </div>
    )
  }

  // ── Checking ─────────────────────────────────────────────────────────────────
  if (state.phase === 'checking') {
    return (
      <div className="border border-zinc-900 rounded-2xl p-5 flex items-center gap-3 bg-[#0a0a0a]">
        <span className="w-3.5 h-3.5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin shrink-0" />
        <span className="text-xs text-zinc-600">Checking Ollama…</span>
      </div>
    )
  }

  // ── Unavailable ───────────────────────────────────────────────────────────────
  if (state.phase === 'unavailable') {
    return (
      <div className="border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Local AI</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-zinc-800 text-zinc-700 font-mono">offline</span>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Ollama is not running locally. To enable plain-English explanations:
        </p>
        <code className="text-[10px] font-mono text-zinc-400 bg-zinc-900 rounded-lg px-3 py-2 leading-relaxed block">
          {state.hint}
        </code>
        <button
          onClick={handleExplain}
          className="self-start text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors underline underline-offset-2"
        >
          Retry →
        </button>
      </div>
    )
  }

  // ── Generating (streaming) ───────────────────────────────────────────────────
  if (state.phase === 'generating') {
    return (
      <div className="border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Local AI</span>
          <span className="text-[9px] font-mono text-zinc-700">{state.model}</span>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed min-h-[3rem]">
          {state.partial || <span className="text-zinc-700">Generating…</span>}
          <span className="inline-block w-1.5 h-3.5 bg-zinc-600 ml-0.5 animate-pulse align-middle" />
        </p>
      </div>
    )
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (state.phase === 'done') {
    return (
      <div className="border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3 bg-[#0a0a0a]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Local AI</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-zinc-800 text-zinc-700">
              {state.model}
            </span>
          </div>
          <button
            onClick={handleExplain}
            className="text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors"
          >
            Regenerate
          </button>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">{state.text}</p>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  return (
    <div className="border border-red-900/40 rounded-2xl p-5 flex flex-col gap-2 bg-[#0a0a0a]">
      <span className="text-[10px] text-red-500 uppercase tracking-widest">Local AI Error</span>
      <p className="text-xs text-zinc-500">{state.phase === 'error' ? state.message : ''}</p>
      <button
        onClick={handleExplain}
        className="self-start text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors underline underline-offset-2"
      >
        Retry
      </button>
    </div>
  )
}
