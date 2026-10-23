'use client'

import { useState } from 'react'
import { tasksApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface Props { open: boolean; onClose: () => void }

const AGENTS = [
  { type: 'hr', label: 'HR Agent', desc: 'Screen CVs, analyse candidate profiles', icon: 'groups', color: 'text-primary-container', bg: 'bg-primary-container/10' },
  { type: 'finance', label: 'Finance Agent', desc: 'Detect anomalies in financial records', icon: 'payments', color: 'text-tertiary', bg: 'bg-tertiary-fixed/40' },
  { type: 'support', label: 'Support Agent', desc: 'Analyse tickets, sentiment detection', icon: 'support_agent', color: 'text-primary', bg: 'bg-primary/10' },
  { type: 'analytics', label: 'Analytics Agent', desc: 'Generate cross-module KPI reports', icon: 'bar_chart_4_bars', color: 'text-error', bg: 'bg-error-container' },
  { type: 'executive', label: 'Executive Agent', desc: 'Create AI executive briefing', icon: 'auto_awesome', color: 'text-yellow-600', bg: 'bg-yellow-50' },
]

export default function AgentTaskModal({ open, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const handleCreate = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      await tasksApi.createTask(selected)
      toast.success(`${AGENTS.find(a => a.type === selected)?.label} task queued`)
      setSelected(null)
      onClose()
    } catch {
      toast.error('Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/30">
          <div>
            <h2 className="font-display text-[16px] font-semibold text-on-surface">New Agent Task</h2>
            <p className="font-body text-[12px] text-on-surface-variant mt-0.5">Select an AI agent to queue a task</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-4 space-y-2">
          {AGENTS.map(a => (
            <button
              key={a.type}
              onClick={() => setSelected(a.type)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                selected === a.type
                  ? 'border-primary-container bg-primary-container/5'
                  : 'border-outline-variant/50 hover:border-primary-container/30 hover:bg-surface-container-low'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.bg}`}>
                <span className={`material-symbols-outlined text-[20px] icon-filled ${a.color}`}>{a.icon}</span>
              </div>
              <div className="flex-1">
                <p className="font-body text-[14px] font-semibold text-on-surface">{a.label}</p>
                <p className="font-body text-[12px] text-on-surface-variant">{a.desc}</p>
              </div>
              {selected === a.type && (
                <span className="material-symbols-outlined text-[18px] icon-filled text-primary-container">check_circle</span>
              )}
            </button>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-outline-variant/30 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={!selected || submitting}
            className="flex-1 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white disabled:opacity-40 transition-all"
            style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)' }}>
            {submitting ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
