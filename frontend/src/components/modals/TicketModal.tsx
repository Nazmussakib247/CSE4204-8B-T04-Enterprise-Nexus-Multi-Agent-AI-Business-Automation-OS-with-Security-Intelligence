'use client'

import { useState } from 'react'
import { supportApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function TicketModal({ open, onClose, onCreated }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) {
      toast.error('Please describe your issue')
      return
    }
    setLoading(true)
    try {
      const res = await supportApi.createTicket({ query })
      const ai = res.data?.ai_analysis
      if (ai?.sentiment) {
        toast.success(`Ticket created — Gemini detected: ${ai.sentiment} sentiment, ${ai.urgency} urgency`)
      } else {
        toast.success('Ticket created with AI analysis')
      }
      setQuery('')
      onCreated()
      onClose()
    } catch {
      toast.error('Failed to create ticket')
    } finally {
      setLoading(false)
    }
  }

  const charCount = query.length
  const charLimit = 1000

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl border border-outline-variant/50 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
          <div>
            <h2 className="font-display text-[16px] font-semibold text-on-surface">New Support Ticket</h2>
            <p className="font-mono text-[10px] text-on-surface-variant mt-0.5 uppercase tracking-wider">AI will analyse sentiment and urgency</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-surface-container flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">
              Describe your issue <span className="text-error">*</span>
            </label>
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value.slice(0, charLimit))}
              rows={6}
              placeholder="What's the problem? Be as specific as possible — our AI will analyse urgency and suggest a response..."
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-[13px] text-on-surface focus:outline-none focus:border-primary-container transition-colors resize-none font-body"
            />
            <div className="flex justify-end mt-1">
              <span className={`font-mono text-[10px] ${charCount > charLimit * 0.9 ? 'text-error' : 'text-on-surface-variant'}`}>
                {charCount}/{charLimit}
              </span>
            </div>
          </div>

          {/* What AI does */}
          <div className="bg-surface-container rounded-xl p-4 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">What Gemini AI will do</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: 'mood', label: 'Sentiment', desc: 'positive / neutral / negative' },
                { icon: 'priority_high', label: 'Urgency', desc: 'low / medium / high' },
                { icon: 'chat', label: 'Auto Reply', desc: 'generates a response' },
              ].map(item => (
                <div key={item.label} className="flex flex-col items-center text-center gap-1 p-2 bg-white rounded-xl border border-outline-variant/30">
                  <span className="material-symbols-outlined text-[18px] text-primary">{item.icon}</span>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-on-surface font-bold">{item.label}</p>
                  <p className="font-mono text-[9px] text-on-surface-variant">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="font-mono text-[10px] uppercase tracking-wider px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-all">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)', boxShadow: '0 4px 14px rgba(0,194,168,0.3)' }}
            >
              <span className="material-symbols-outlined text-[16px]">{loading ? 'hourglass_empty' : 'support_agent'}</span>
              {loading ? 'AI Analysing...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
