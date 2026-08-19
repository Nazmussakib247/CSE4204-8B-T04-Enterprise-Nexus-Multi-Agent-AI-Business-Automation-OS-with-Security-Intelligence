'use client'

import { useState } from 'react'
import { agentsApi } from '@/lib/api'
import type { AgentStep, AgentSource } from '@/lib/api'
import toast from 'react-hot-toast'

type AgentName = 'hr' | 'finance' | 'support' | 'analytics'

interface AgentAskPanelProps {
  agent: AgentName
  label: string // e.g. "HR" → renders "Ask HR Agent"
  placeholder?: string
}

export default function AgentAskPanel({ agent, label, placeholder }: AgentAskPanelProps) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [sources, setSources] = useState<AgentSource[]>([])
  const [stepsOpen, setStepsOpen] = useState(false)

  const ask = async () => {
    const q = message.trim()
    if (!q || loading) return
    setLoading(true)
    setAnswer(null)
    setSteps([])
    setSources([])
    setStepsOpen(false)
    try {
      const res = await agentsApi.chat(agent, q)
      setAnswer(res.data.answer)
      setSteps(res.data.steps || [])
      setSources(res.data.sources || [])
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string } } }
      const msg =
        e.response?.status === 503
          ? 'The AI agent is temporarily unavailable. Please try again shortly.'
          : e.response?.data?.error || 'Agent request failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/50 overflow-hidden mb-6">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-container/30 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary-container/10">
            <span className="material-symbols-outlined text-[18px] text-primary">smart_toy</span>
          </div>
          <div className="text-left">
            <h3 className="font-display text-[15px] font-semibold text-on-surface">Ask {label} Agent</h3>
            <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
              AI assistant with live data tools
            </p>
          </div>
        </div>
        <span
          className={`material-symbols-outlined text-[20px] text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div className="px-6 pb-5 border-t border-outline-variant/30">
          {/* Input row */}
          <div className="flex gap-2 mt-4">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
              placeholder={placeholder || `Ask the ${label} agent about your data...`}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl border border-outline-variant/50 text-[13px] text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container/60 disabled:opacity-50"
            />
            <button
              onClick={ask}
              disabled={loading || !message.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white bg-primary hover:opacity-90 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[15px]">
                {loading ? 'hourglass_empty' : 'send'}
              </span>
              {loading ? 'Thinking' : 'Ask'}
            </button>
          </div>

          {/* Answer */}
          {loading && (
            <div className="mt-4 flex items-center gap-2 text-on-surface-variant">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest">
                Agent is querying your data…
              </span>
            </div>
          )}
          {answer && (
            <div className="mt-4 rounded-xl bg-surface-container/40 border border-outline-variant/30 p-4">
              <p className="text-[13px] leading-relaxed text-on-surface whitespace-pre-wrap">{answer}</p>
            </div>
          )}

          {/* Source citations (RAG) */}
          {answer && sources.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface-variant/60">Sources:</span>
              {sources.map((src, i) => (
                <span
                  key={i}
                  title={src.snippet}
                  className="inline-flex items-center gap-1 rounded-full border border-primary-container/40 bg-primary-container/5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-primary cursor-help"
                >
                  <span className="material-symbols-outlined text-[11px]">menu_book</span>
                  {src.title.length > 40 ? `${src.title.slice(0, 40)}…` : src.title}
                </span>
              ))}
            </div>
          )}

          {/* Agent steps trace */}
          {steps.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setStepsOpen((s) => !s)}
                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
                aria-expanded={stepsOpen}
              >
                <span
                  className={`material-symbols-outlined text-[14px] transition-transform ${stepsOpen ? 'rotate-90' : ''}`}
                >
                  chevron_right
                </span>
                Agent steps ({steps.length} tool {steps.length === 1 ? 'call' : 'calls'})
              </button>
              {stepsOpen && (
                <ol className="mt-2 space-y-2">
                  {steps.map((s, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-outline-variant/30 px-4 py-3 text-[12px]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-on-surface-variant">{i + 1}.</span>
                        <span className="font-mono text-[11px] font-semibold text-primary">{s.tool}</span>
                        {!s.success && (
                          <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-error-container text-on-error-container">
                            failed
                          </span>
                        )}
                      </div>
                      {Object.keys(s.args || {}).length > 0 && (
                        <p className="mt-1 font-mono text-[10px] text-on-surface-variant break-all">
                          args: {JSON.stringify(s.args)}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-on-surface-variant/80 break-all line-clamp-3">
                        {s.result_summary}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
