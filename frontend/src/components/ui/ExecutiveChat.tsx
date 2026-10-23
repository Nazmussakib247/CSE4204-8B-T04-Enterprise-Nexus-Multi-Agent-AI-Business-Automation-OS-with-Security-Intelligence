'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { executiveChatApi, executiveAskStream } from '@/lib/api'
import type { AgentConversation, Delegation } from '@/lib/api'
import toast from 'react-hot-toast'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  delegations?: Delegation[]
  streaming?: boolean
}

const AGENT_LABELS: Record<string, string> = {
  hr: 'HR', finance: 'Finance', support: 'Support', analytics: 'Analytics',
}

function DelegationChip({ d }: { d: Delegation }) {
  const label = d.label || AGENT_LABELS[d.agent] || d.agent
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest border ${
        d.status === 'failed'
          ? 'border-red-400/30 text-red-300'
          : 'border-primary-container/30 text-primary-container'
      }`}
      title={d.question || ''}
    >
      {d.status === 'started' && <span className="w-1 h-1 rounded-full bg-primary-container animate-pulse" />}
      → {label} Agent
      {d.status === 'failed' && ' ✕'}
    </span>
  )
}

export default function ExecutiveChat() {
  const [conversations, setConversations] = useState<AgentConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const refreshConversations = useCallback(() => {
    executiveChatApi.conversations()
      .then(r => setConversations(r.data.data))
      .catch(() => { /* sidebar list is non-critical */ })
  }, [])

  useEffect(() => { refreshConversations() }, [refreshConversations])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const openConversation = async (id: string) => {
    if (busy) return
    setActiveId(id)
    setHistoryLoading(true)
    try {
      const r = await executiveChatApi.messages(id)
      setMessages(
        r.data.data
          .filter(m => m.role !== 'tool')
          .map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            delegations: m.metadata?.delegations,
          })),
      )
    } catch {
      toast.error('Could not load conversation')
    } finally {
      setHistoryLoading(false)
    }
  }

  const newChat = () => {
    if (busy) return
    setActiveId(null)
    setMessages([])
  }

  const send = async () => {
    const q = input.trim()
    if (!q || busy) return
    setBusy(true)
    setInput('')
    setMessages(prev => [
      ...prev,
      { role: 'user', content: q },
      { role: 'assistant', content: '', delegations: [], streaming: true },
    ])

    const patchLast = (fn: (m: ChatMessage) => ChatMessage) =>
      setMessages(prev => prev.map((m, i) => (i === prev.length - 1 ? fn(m) : m)))

    try {
      await executiveAskStream(q, activeId, {
        onToken: text => patchLast(m => ({ ...m, content: m.content + text })),
        onDelegation: d =>
          patchLast(m => {
            const list = [...(m.delegations || [])]
            const idx = list.findIndex(x => x.agent === d.agent && x.status === 'started')
            if (d.status === 'started' || idx === -1) list.push(d)
            else list[idx] = d
            return { ...m, delegations: list }
          }),
        onDone: ({ conversation_id, delegations }) => {
          patchLast(m => ({ ...m, streaming: false, delegations }))
          setActiveId(conversation_id)
          refreshConversations()
        },
        onError: message => {
          patchLast(m => ({
            ...m,
            streaming: false,
            content: m.content || message,
          }))
          toast.error(message)
        },
      })
    } catch {
      patchLast(m => ({ ...m, streaming: false, content: m.content || 'Connection lost.' }))
      toast.error('Streaming connection failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl text-white overflow-hidden" style={{ background: '#16191a' }}>
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-primary-container icon-filled">psychology</span>
          <h3 className="font-display text-[16px] font-semibold text-white">Ask the Executive Agent</h3>
        </div>
        <p className="font-body text-[13px] text-white/40">
          Multi-agent orchestrator — delegates to HR, Finance, Support and Analytics, with conversation memory.
        </p>
      </div>

      <div className="flex" style={{ height: 440 }}>
        {/* Conversation sidebar */}
        <div className="hidden md:flex flex-col w-56 shrink-0 border-r border-white/[0.06]">
          <button
            onClick={newChat}
            className="m-3 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.1] font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white hover:border-primary-container/40 transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            New chat
          </button>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {conversations.length === 0 && (
              <p className="px-3 py-2 font-body text-[12px] text-white/25">No conversations yet.</p>
            )}
            {conversations.map(c => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                  activeId === c.id ? 'bg-white/[0.08] text-white' : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80'
                }`}
              >
                <p className="font-body text-[12px] truncate">{c.title || 'Untitled'}</p>
                <p className="font-mono text-[9px] uppercase tracking-wider text-white/25 mt-0.5">
                  {new Date(c.updated_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {historyLoading ? (
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/30">Loading history…</p>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-[36px] text-white/15 mb-2">forum</span>
                <p className="font-body text-[13px] text-white/40 max-w-sm">
                  Ask anything across your business — e.g. “Compare this month’s hiring pipeline with our support workload.”
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      m.role === 'user'
                        ? 'text-white'
                        : 'bg-white/[0.04] border border-white/[0.06] text-white/85'
                    }`}
                    style={m.role === 'user' ? { background: 'linear-gradient(135deg,#00c2a8,#006b5c)' } : undefined}
                  >
                    {m.delegations && m.delegations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {m.delegations.map((d, j) => <DelegationChip key={`${d.agent}-${j}`} d={d} />)}
                      </div>
                    )}
                    <p className="font-body text-[13px] leading-relaxed whitespace-pre-wrap">
                      {m.content}
                      {m.streaming && <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-primary-container animate-pulse align-middle" />}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-white/[0.06] flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="e.g. What are the top finance anomalies this week?"
              disabled={busy}
              className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-white/25 font-body text-[14px] focus:outline-none focus:border-primary-container/50 transition-all disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)', boxShadow: '0 4px 14px rgba(0,194,168,0.3)' }}
            >
              <span className="material-symbols-outlined text-[16px]">{busy ? 'hourglass_empty' : 'send'}</span>
              {busy ? 'Thinking' : 'Ask'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
