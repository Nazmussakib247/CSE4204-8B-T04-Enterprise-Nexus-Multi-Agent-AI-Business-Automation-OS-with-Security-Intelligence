'use client'

import { useCallback, useEffect, useState } from 'react'
import { agentActivityApi } from '@/lib/api'
import type { AgentActivityEntry } from '@/lib/api'
import { useRealtimeRefresh } from '@/lib/realtime'
import PageHeader from '@/components/ui/PageHeader'

const AGENT_META: Record<string, { icon: string; color: string }> = {
  hr: { icon: 'groups', color: 'text-primary' },
  finance: { icon: 'payments', color: 'text-tertiary' },
  support: { icon: 'support_agent', color: 'text-secondary' },
  analytics: { icon: 'bar_chart_4_bars', color: 'text-primary' },
  executive: { icon: 'auto_awesome', color: 'text-primary' },
}

/** "agent:finance:flag_transaction" → { agent: 'finance', detail: 'flag_transaction' } */
const parseAction = (action: string) => {
  const rest = action.slice('agent:'.length)
  const sep = rest.includes(':') ? ':' : '.'
  const [agent, ...detail] = rest.split(sep)
  return { agent: agent.split('.')[0], detail: detail.join(sep) || rest }
}

const timeAgo = (ts: string) => {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function ActivityPage() {
  const [entries, setEntries] = useState<AgentActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)

  const fetchActivity = useCallback(() => {
    agentActivityApi.list(80)
      .then(r => setEntries(r.data.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchActivity() }, [fetchActivity])

  // Live: prepend new agent audit rows as they land
  useRealtimeRefresh(['audit_logs'], (payload) => {
    setLive(true)
    const row = payload?.new as unknown as AgentActivityEntry | undefined
    if (row && typeof row.action === 'string' && row.action.startsWith('agent:')) {
      setEntries(prev => [row, ...prev].slice(0, 200))
    } else if (!payload) {
      fetchActivity() // polling fallback tick
    }
  }, 30_000)

  return (
    <div className="space-y-6 max-w-[900px]">
      <PageHeader
        title="Agent Activity"
        subtitle="Live trace of every AI agent action — tool calls, delegations, and writes"
        action={
          <span className="flex items-center gap-2 px-3 py-2 rounded-xl border border-outline-variant/50">
            <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-primary-container animate-pulse' : 'bg-on-surface-variant/30'}`} />
            <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
              {live ? 'Live' : 'Waiting for events'}
            </span>
          </span>
        }
      />

      <div className="bg-white rounded-2xl border border-outline-variant/50 overflow-hidden">
        {loading ? (
          <p className="px-6 py-10 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Loading activity…</p>
        ) : entries.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="material-symbols-outlined text-[44px] text-on-surface-variant/20 mb-3 block">monitoring</span>
            <p className="font-display text-[15px] font-semibold text-on-surface mb-1">No agent activity yet</p>
            <p className="font-body text-[13px] text-on-surface-variant">
              Ask any agent a question — every tool call and delegation will appear here in realtime.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-outline-variant/20">
            {entries.map(e => {
              const { agent, detail } = parseAction(e.action)
              const meta = AGENT_META[agent] || { icon: 'smart_toy', color: 'text-on-surface-variant' }
              const args = e.metadata && 'args' in e.metadata ? JSON.stringify(e.metadata.args) : null
              return (
                <li key={e.id} className="flex items-start gap-4 px-6 py-4">
                  <div className="w-9 h-9 rounded-xl bg-surface-container/60 flex items-center justify-center shrink-0 mt-0.5">
                    <span className={`material-symbols-outlined text-[18px] ${meta.color}`}>{meta.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] font-semibold text-on-surface uppercase tracking-wider">{agent}</span>
                      <span className="font-mono text-[11px] text-primary">{detail}</span>
                      {!e.success && (
                        <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-error-container text-on-error-container">failed</span>
                      )}
                    </div>
                    {args && (
                      <p className="font-mono text-[10px] text-on-surface-variant mt-1 break-all line-clamp-2">{args}</p>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-on-surface-variant/60 shrink-0 mt-1">{timeAgo(e.created_at)}</span>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
