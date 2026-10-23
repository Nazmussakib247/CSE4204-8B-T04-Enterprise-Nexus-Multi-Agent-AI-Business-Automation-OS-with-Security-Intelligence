'use client'

import { useEffect, useState } from 'react'
import { getApiErrorMessage, tasksApi } from '@/lib/api'
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
  const [selected, setSelected] = useState<string[]>([])
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [mode, setMode] = useState<'sequential' | 'parallel'>('sequential')
  const [instructions, setInstructions] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  if (!open) return null

  const handleCreate = async () => {
    if (!selected.length) return
    setSubmitting(true)
    const batchId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
    const create = (agent: string, index: number) => tasksApi.createTask(agent, {
      instructions: instructions.trim() || 'Review the latest available business data and report actionable findings.',
      priority, execution_mode: mode, execution_order: index + 1, batch_id: batchId, total_agents: selected.length,
    })
    try {
      if (mode === 'parallel') await Promise.all(selected.map(create))
      else {
        for (let index = 0; index < selected.length; index += 1) {
          await create(selected[index], index)
        }
      }
      toast.success(`${selected.length} agent task${selected.length > 1 ? 's' : ''} queued`)
      setSelected([]); setInstructions(''); setPriority('normal'); setMode('sequential')
      onClose()
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to queue agent tasks'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="agent-task-modal-title">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-panel max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/30 bg-gradient-to-r from-[#062f35] to-[#007c6e] text-white">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-container">Orchestration</p>
            <h2 id="agent-task-modal-title" className="font-display text-[20px] font-semibold mt-1">Plan agent work</h2>
            <p className="font-body text-[12px] text-white/70 mt-0.5">Choose agents, priority and execution order.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-white/70 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="max-h-[min(70vh,640px)] overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Agents</p><p className="font-body text-[12px] text-on-surface-variant mt-1">{selected.length ? `${selected.length} selected · ${mode}` : 'Select one or more agents'}</p></div><button type="button" onClick={() => setSelected(selected.length === AGENTS.length ? [] : AGENTS.map(a => a.type))} className="font-mono text-[10px] uppercase tracking-widest text-primary hover:underline">{selected.length === AGENTS.length ? 'Clear all' : 'Select all'}</button></div>
          {AGENTS.map(a => (
            <button
              key={a.type}
              onClick={() => setSelected(current => current.includes(a.type) ? current.filter(item => item !== a.type) : [...current, a.type])}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                selected.includes(a.type)
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
              {selected.includes(a.type) && (
                <span className="material-symbols-outlined text-[18px] icon-filled text-primary-container">check_circle</span>
              )}
            </button>
          ))}
          {selected.length > 0 && <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low/50 p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">Execution order</p>{selected.map((type, index) => <div key={type} className="flex items-center gap-2 py-1.5"><span className="w-5 h-5 rounded-full bg-primary-container/10 text-primary text-[10px] flex items-center justify-center font-bold">{index + 1}</span><span className="font-body text-[12px] text-on-surface flex-1">{AGENTS.find(a => a.type === type)?.label}</span><button type="button" disabled={index === 0} onClick={() => setSelected(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next })} className="disabled:opacity-20"><span className="material-symbols-outlined text-[16px]">keyboard_arrow_up</span></button><button type="button" disabled={index === selected.length - 1} onClick={() => setSelected(current => { const next = [...current]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next })} className="disabled:opacity-20"><span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span></button></div>)}</div>}
          <div className="grid sm:grid-cols-2 gap-3"><label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Priority<select value={priority} onChange={event => setPriority(event.target.value as typeof priority)} className="mt-2 w-full rounded-xl border border-outline-variant bg-white px-3 py-2.5 font-body text-[13px]"><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label><label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Run mode<select value={mode} onChange={event => setMode(event.target.value as typeof mode)} className="mt-2 w-full rounded-xl border border-outline-variant bg-white px-3 py-2.5 font-body text-[13px]"><option value="sequential">Sequential — maintain order</option><option value="parallel">Parallel — all together</option></select></label></div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Instructions <span className="normal-case tracking-normal">(optional)</span><textarea value={instructions} onChange={event => setInstructions(event.target.value)} rows={3} maxLength={1000} placeholder="e.g. Review sales, finance risks and support sentiment for today…" className="mt-2 w-full resize-none rounded-xl border border-outline-variant bg-white px-3 py-2.5 font-body text-[13px]" /></label>
        </div>

        <div className="px-6 py-4 border-t border-outline-variant/30 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={!selected.length || submitting}
            className="flex-1 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white disabled:opacity-40 transition-all"
            style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)' }}>
            {submitting ? 'Queueing…' : `Queue ${selected.length || ''} task${selected.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
