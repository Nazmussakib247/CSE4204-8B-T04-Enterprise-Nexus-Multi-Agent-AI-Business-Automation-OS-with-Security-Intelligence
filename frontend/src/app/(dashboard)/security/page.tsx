'use client'

import { useState, useEffect, useCallback } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import { securityApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface AuditLog {
  id: string
  action: string
  resource_type: string | null
  resource_id: string | null
  ip_address: string | null
  success: boolean
  created_at: string
  correlation_id: string | null
  users?: { name: string; email: string } | null
}

interface SecurityStats {
  eventsToday: number
  failedToday: number
  activeThreats: number
  systemHealth: string
}

const actionLabel = (action: string) => {
  const map: Record<string, string> = {
    'auth.login': 'Login',
    'auth.logout': 'Logout',
    'auth.forgot_password': 'Password Reset Request',
    'auth.reset_password': 'Password Reset',
    'hr.cv.upload': 'CV Upload',
    'hr.report.create': 'HR Report Created',
  }
  return map[action] || action
}

const sevColor = (success: boolean) =>
  success ? 'bg-primary-container/10 text-primary' : 'bg-error-container text-on-error-container'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  return `${Math.floor(h / 24)} day ago`
}

export default function SecurityPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'activity' | 'failed'>('activity')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [logsRes, statsRes] = await Promise.all([
        securityApi.getAuditLogs({ page, limit: 20, ...(tab === 'failed' ? { success: 'false' } : {}) }),
        securityApi.getStats(),
      ])
      setLogs(logsRes.data.data || [])
      setTotal(logsRes.data.total || 0)
      setStats(statsRes.data)
    } catch {
      toast.error('Failed to load security data')
    } finally {
      setLoading(false)
    }
  }, [page, tab])

  useEffect(() => { fetchData() }, [fetchData])

  const statCards = [
    { label: 'Events Today', value: stats?.eventsToday ?? '—', icon: 'event_note', color: 'text-primary', bg: 'bg-primary/10', sub: 'All audit events' },
    { label: 'Failed Auth', value: stats?.failedToday ?? '—', icon: 'gpp_bad', color: 'text-error', bg: 'bg-error-container', sub: 'Last 24 hours' },
    { label: 'Active Threats', value: stats?.activeThreats ?? '—', icon: 'block', color: 'text-orange-600', bg: 'bg-orange-50', sub: 'Last 1 hour' },
    { label: 'System Health', value: stats?.systemHealth ?? '—', icon: 'health_and_safety', color: 'text-primary', bg: 'bg-primary/10', sub: 'DB connectivity' },
  ]

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Security Intelligence"
        subtitle="Real-time audit log and threat monitoring"
        action={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-xl border border-primary/20">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Live</span>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)', boxShadow: '0 4px 14px rgba(0,194,168,0.3)' }}
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span> Refresh
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-outline-variant/50">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.bg}`}>
              <span className={`material-symbols-outlined text-[18px] icon-filled ${s.color}`}>{s.icon}</span>
            </div>
            <p className="font-display text-[26px] font-bold text-on-surface">{s.value}</p>
            <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider mt-0.5">{s.label}</p>
            <p className="font-mono text-[10px] text-on-surface-variant/60 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Audit log panel */}
      <div className="bg-white rounded-2xl border border-outline-variant/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30 flex-wrap gap-3">
          <div className="flex gap-2">
            {(['activity', 'failed'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setPage(1) }}
                className={`px-4 py-2 rounded-xl font-mono text-[10px] uppercase tracking-widest font-bold transition-all ${
                  tab === t ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {t === 'activity' ? 'All Events' : 'Failed Only'}
              </button>
            ))}
          </div>
          <span className="font-mono text-[10px] text-on-surface-variant">{total} total records</span>
        </div>

        {loading ? (
          <div className="p-8 text-center font-mono text-[11px] text-on-surface-variant">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center font-mono text-[11px] text-on-surface-variant">No events recorded yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  {['Event', 'User', 'IP Address', 'Time', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-on-surface">{actionLabel(log.action)}</td>
                    <td className="px-5 py-3 text-on-surface-variant">
                      {log.users ? log.users.email : <span className="opacity-40">—</span>}
                    </td>
                    <td className="px-5 py-3 font-mono text-on-surface-variant">
                      {log.ip_address || <span className="opacity-40">—</span>}
                    </td>
                    <td className="px-5 py-3 text-on-surface-variant">{timeAgo(log.created_at)}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 rounded-lg font-mono text-[9px] uppercase font-bold ${sevColor(log.success)}`}>
                        {log.success ? 'success' : 'failed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-outline-variant/20">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg border border-outline-variant disabled:opacity-30 hover:bg-surface-container transition-all"
            >
              Previous
            </button>
            <span className="font-mono text-[10px] text-on-surface-variant">Page {page} of {Math.ceil(total / 20)}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(total / 20)}
              className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg border border-outline-variant disabled:opacity-30 hover:bg-surface-container transition-all"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
