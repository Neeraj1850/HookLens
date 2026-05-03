import { useState, useCallback, useEffect, useRef } from 'react'
import type { AgentReport } from '../../api/agentEngine'
import {
  sendChatMessage,
  buildSystemContext,
  isOllamaAvailable,
  OllamaUnavailableError,
  OllamaNoModelError,
  type ChatMessage,
} from '../../api/assistant'

import type { SafetyAnalysis } from '../../types/hook'

interface Props {
  report: AgentReport
  hookAddress: string | null
  safety?: SafetyAnalysis | null
}

type ChatPhase = 'idle' | 'checking' | 'unavailable' | 'chatting' | 'error'

export function AssistantChat({ report, hookAddress, safety }: Props) {
  const [phase, setPhase] = useState<ChatPhase>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [hint, setHint] = useState('')
  const [modelName, setModelName] = useState('…')

  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Reset when report changes (new simulation run)
  useEffect(() => {
    setPhase('idle')
    setMessages([])
    setInput('')
    setIsGenerating(false)
  }, [report.completedAt])

  const startChat = useCallback(async () => {
    setPhase('checking')

    const available = await isOllamaAvailable()
    if (!available) {
      setHint('Start Ollama: ollama serve — then pull a model: ollama pull llama3.2')
      setPhase('unavailable')
      return
    }

    setPhase('chatting')
    setIsGenerating(true)
    setModelName('…')

    const sysMsg: ChatMessage = {
      role: 'system',
      content: buildSystemContext(report, hookAddress, safety || null),
    }

    const firstMsg: ChatMessage = {
      role: 'user',
      content: 'Explain this swap simulation report and verify the hook contract safety.',
    }

    // Initialize state with system and user msg, plus empty assistant msg for streaming
    const initMsgs = [sysMsg, firstMsg]
    setMessages([...initMsgs, { role: 'assistant', content: '' }])

    try {
      const result = await sendChatMessage(initMsgs, (chunk) => {
        setMessages((prev) => {
          const newMsgs = [...prev]
          const last = newMsgs[newMsgs.length - 1]
          if (last && last.role === 'assistant') {
            last.content += chunk
          }
          return newMsgs
        })
      })
      setModelName(result.model)
    } catch (err) {
      handleError(err)
    } finally {
      setIsGenerating(false)
    }
  }, [report, hookAddress, safety])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isGenerating) return

    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const newMsgs = [...messages, userMsg]
    
    setInput('')
    setMessages([...newMsgs, { role: 'assistant', content: '' }])
    setIsGenerating(true)

    try {
      const result = await sendChatMessage(newMsgs, (chunk) => {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant') {
            last.content += chunk
          }
          return updated
        })
      })
      setModelName(result.model)
    } catch (err) {
      handleError(err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleError = (err: unknown) => {
    if (err instanceof OllamaUnavailableError) {
      setHint('Start Ollama: ollama serve — then pull a model: ollama pull llama3.2')
      setPhase('unavailable')
    } else if (err instanceof OllamaNoModelError) {
      setHint(err.message)
      setPhase('unavailable')
    } else {
      setHint(err instanceof Error ? err.message : 'Local AI chat failed')
      setPhase('error')
    }
  }

  // ── Idle ────────────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="border border-zinc-900 rounded-2xl p-6 flex flex-col gap-4 bg-gradient-to-br from-[#0a0a0a] to-[#111] shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 blur-3xl rounded-full" />
        <div className="flex items-center justify-between gap-4 relative z-10">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-300 tracking-wide">Audit Assistant</span>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
                Privacy First
              </span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-[280px]">
              Chat with a local auditor model to dive deep into this swap simulation.
            </p>
          </div>
          <button
            onClick={startChat}
            className="shrink-0 px-5 py-2.5 rounded-xl bg-violet-600/10 border border-violet-500/30 text-violet-300 text-xs font-semibold hover:bg-violet-600/20 hover:border-violet-500/50 hover:text-white transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.1)]"
          >
            <span className="text-sm">◈</span>
            Start Chat
          </button>
        </div>
      </div>
    )
  }

  // ── Checking ─────────────────────────────────────────────────────────────────
  if (phase === 'checking') {
    return (
      <div className="border border-zinc-900 rounded-2xl p-6 flex items-center gap-4 bg-[#0a0a0a]">
        <span className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin shrink-0" />
        <span className="text-xs font-medium text-zinc-500">Waking up local model…</span>
      </div>
    )
  }

  // ── Unavailable / Error ───────────────────────────────────────────────────────
  if (phase === 'unavailable' || phase === 'error') {
    return (
      <div className="border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-300 tracking-wide">Audit Assistant</span>
          <span className="text-[9px] px-2 py-0.5 rounded-full border border-red-900/50 bg-red-900/10 text-red-400 font-mono">
            {phase === 'error' ? 'error' : 'offline'}
          </span>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">
          {phase === 'unavailable' 
            ? 'Ollama is not responding. To enable the local auditor:' 
            : 'Something went wrong during generation:'}
        </p>
        <code className="text-[10px] font-mono text-zinc-400 bg-zinc-950 border border-zinc-900 rounded-lg px-4 py-3 leading-relaxed block overflow-x-auto whitespace-pre-wrap">
          {hint}
        </code>
        <button
          onClick={startChat}
          className="self-start text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
        >
          Try Again →
        </button>
      </div>
    )
  }

  // ── Chatting ─────────────────────────────────────────────────────────────────
  // Filter out the hidden system prompt
  const displayMsgs = messages.filter((m) => m.role !== 'system')

  return (
    <div className="border border-zinc-800 rounded-2xl flex flex-col bg-[#0a0a0a] shadow-xl overflow-hidden h-[600px]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/30">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-5 h-5">
            {isGenerating && <span className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping" />}
            <span className="w-2 h-2 rounded-full bg-violet-400 relative z-10 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
          </div>
          <span className="text-xs font-semibold text-zinc-300">Auditor</span>
          <span className="text-[9px] font-mono text-zinc-500 border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 rounded ml-1">
            {modelName}
          </span>
        </div>
        <button
          onClick={() => setPhase('idle')}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {displayMsgs.map((msg, i) => {
          const isUser = msg.role === 'user'
          return (
            <div key={i} className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
              <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider px-1">
                {isUser ? 'You' : 'AI'}
              </span>
              <div 
                className={`text-xs leading-relaxed max-w-[90%] p-3.5 rounded-2xl whitespace-pre-wrap ${
                  isUser 
                    ? 'bg-violet-600/20 border border-violet-500/30 text-violet-100 rounded-tr-sm' 
                    : 'bg-zinc-900/80 border border-zinc-800 text-zinc-300 rounded-tl-sm'
                }`}
              >
                {msg.content || (isGenerating && i === displayMsgs.length - 1 ? <span className="animate-pulse">...</span> : '')}
              </div>
            </div>
          )
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 bg-zinc-900/40 border-t border-zinc-800/50">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isGenerating}
            placeholder="Ask about routing, code, or risks..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-12 py-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            className="absolute right-2 p-1.5 rounded-lg bg-violet-600/20 text-violet-400 hover:bg-violet-600/40 hover:text-violet-300 disabled:opacity-30 disabled:hover:bg-violet-600/20 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
