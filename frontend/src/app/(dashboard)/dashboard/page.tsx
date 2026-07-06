'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { hrApi, financeApi, supportApi } from '@/lib/api'
import AgentTaskModal from '@/components/modals/AgentTaskModal'
import Link from 'next/link'

interface Stats { hr: number; finance: number; support: number; anomalies: number; hrTrend: number }

const StatCard = ({ label, value, icon, color, bg, trend, trendUp }: {
  label: string; value: string | number; icon: string; color: string; bg: string; trend?: string; trendUp?: boolean
}) => (
  <div className="bg-white rounded-2xl p-5 border border-outline-variant/50 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
        <span className={`material-symbols-outlined text-[20px] icon-filled ${color}`}>{icon}</span>
      </div>
      {trend && (
        <span className={`flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider ${trendUp ? 'text-primary' : 'text-error'}`}>
          <span className="material-symbols-outlined text-[14px]">{trendUp ? 'trending_up' : 'trending_down'}</span>
          {trend}
        </span>
      )}
    </div>
    <p className="font-display text-[30px] font-bold text-on-surface leading-none mb-1">{value}</p>
    <p className="font-mono text-[11px] text-on-surface-variant uppercase tracking-wider">{label}</p>
  </div>
)

const AgentCard = ({ title, icon, color, href, children }: {
  title: string; icon: string; color: string; href: string; children: React.ReactNode
}) => (
  <div className="bg-white rounded-2xl border border-outline-variant/50 overflow-hidden">
    <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/30">
      <div className="flex items-center gap-2.5">
        <span className={`material-symbols-outlined text-[18px] icon-filled ${color}`}>{icon}</span>
        <span className="font-display text-[14px] font-semibold text-on-surface">{title}</span>
      </div>
      <Link href={href} className="font-mono text-[10px] uppercase tracking-widest text-primary hover:text-primary-container transition-colors flex items-center gap-1">
        View all <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
      </Link>
    </div>
    <div className="px-5 py-3">{children}</div>
  </div>
)

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({ hr: 0, finance: 0, support: 0, anomalies: 0, hrTrend: 0 })
  const [hrData, setHrData] = useState<Array<{ id: string; candidate_name: string; recommendation: string; ai_score: number }>>([])
  const [financeData, setFinanceData] = useState<Array<{ id: string; category: string; amount: number; severity: string }>>([])
  const [supportData, setSupportData] = useState<Array<{ id: string; urgency: string; status: string; sentiment: string }>>([])
  const [loading, setLoading] = useState(true)
  const [taskModalOpen, setTaskModalOpen] = useState(false)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => {
    const done = () => setLoading(false)
    hrApi.getStats().then(r => {
      const s = r.data.stats
      setStats(prev => ({ ...prev, hr: s?.total ?? 0, hrTrend: s?.trend_pct ?? 0 }))
    }).catch(() => {})
    financeApi.getSummary().then(r => setStats(s => ({ ...s, finance: r.data.record_count ?? 0, anomalies: r.data.anomaly_count ?? 0 }))).catch(() => {})
    supportApi.getSentimentReport().then(r => setStats(s => ({ ...s, support: r.data.report?.total ?? 0 }))).catch(() => {})
    hrApi.getReports({ limit: 4 }).then(r => setHrData(r.data.data ?? [])).catch(() => {})
    financeApi.getRecords({ limit: 4 }).then(r => setFinanceData(r.data.data ?? [])).catch(() => {})
    supportApi.getTickets({ limit: 4 }).then(r => setSupportData(r.data.data ?? [])).catch(() => {}).finally(done)
  }, [])

  const recColor = (r: string) =>
    r === 'shortlist' ? 'bg-primary-container/10 text-primary' :
    r === 'reject' ? 'bg-error-container text-on-error-container' : 'bg-yellow-100 text-yellow-700'
  const sevColor = (s: string) =>
    s === 'critical' || s === 'high' ? 'bg-error-container text-on-error-container' :
    s === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-primary-container/10 text-primary'
  const urgColor = (u: string) =>
    u === 'high' ? 'bg-error-container text-on-error-container' :
    u === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-surface-container text-on-surface-variant'

  const hrTrendLabel = stats.hrTrend === 0 ? undefined : `${stats.hrTrend > 0 ? '+' : ''}${stats.hrTrend}%`

  return (
    <div className="space-y-6 max-w-[1400px]">
      <AgentTaskModal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} />

      {/* Header */}
      <div>
        <h1 className="font-display text-[26px] font-bold text-on-surface tracking-tight">
          {greeting}, {user?.name?.split(' ')[0]}
        </h1>
        <div className="flex items-center gap-4 mt-1">
          <span className="font-body text-[13px] text-on-surface-variant">{today}</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
            <span className="font-mono text-[10px] text-primary uppercase tracking-widest">All Systems Active</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="CV Screenings" value={loading ? '—' : stats.hr} icon="groups" color="text-primary-container" bg="bg-primary-container/10"
          trend={hrTrendLabel} trendUp={stats.hrTrend >= 0} />
        <StatCard label="Finance Records" value={loading ? '—' : stats.finance} icon="payments" color="text-tertiary" bg="bg-tertiary-fixed/40" />
        <StatCard label="Support Tickets" value={loading ? '—' : stats.support} icon="confirmation_number" color="text-primary" bg="bg-primary/10" />
        <StatCard label="Anomalies" value={loading ? '—' : stats.anomalies} icon="warning" color="text-error" bg="bg-error-container" />
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AgentCard title="HR Agent" icon="groups" color="text-primary-container" href="/hr">
          {hrData.length === 0 ? (
            <p className="font-body text-[13px] text-on-surface-variant py-4 text-center">No screenings yet</p>
          ) : hrData.map(r => (
            <Link href={`/hr/${r.id}`} key={r.id} className="flex items-center justify-between py-3 border-b border-outline-variant/20 last:border-0 hover:opacity-80 transition-opacity">
              <div>
                <p className="font-body text-[13px] font-medium text-on-surface">{r.candidate_name}</p>
                <p className="font-mono text-[10px] text-on-surface-variant mt-0.5">Score: {r.ai_score ?? '—'}%</p>
              </div>
              <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${recColor(r.recommendation)}`}>
                {r.recommendation ?? 'pending'}
              </span>
            </Link>
          ))}
        </AgentCard>

        <AgentCard title="Finance Agent" icon="payments" color="text-tertiary" href="/finance">
          {financeData.length === 0 ? (
            <p className="font-body text-[13px] text-on-surface-variant py-4 text-center">No records yet</p>
          ) : financeData.map(r => (
            <Link href={`/finance/${r.id}`} key={r.id} className="flex items-center justify-between py-3 border-b border-outline-variant/20 last:border-0 hover:opacity-80 transition-opacity">
              <div>
                <p className="font-body text-[13px] font-medium text-on-surface">{r.category}</p>
                <p className="font-mono text-[10px] text-on-surface-variant mt-0.5">৳{Number(r.amount).toLocaleString()}</p>
              </div>
              <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${sevColor(r.severity)}`}>
                {r.severity ?? 'normal'}
              </span>
            </Link>
          ))}
        </AgentCard>

        <AgentCard title="Support Agent" icon="support_agent" color="text-primary" href="/support">
          {supportData.length === 0 ? (
            <p className="font-body text-[13px] text-on-surface-variant py-4 text-center">No tickets yet</p>
          ) : supportData.map(r => (
            <Link href={`/support/${r.id}`} key={r.id} className="flex items-center justify-between py-3 border-b border-outline-variant/20 last:border-0 hover:opacity-80 transition-opacity">
              <div className="flex items-center gap-2">
                <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${urgColor(r.urgency)}`}>
                  {r.urgency ?? 'low'}
                </span>
                <span className="font-body text-[12px] text-on-surface-variant">{r.sentiment ?? '—'}</span>
              </div>
              <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${r.status === 'resolved' ? 'bg-primary-container/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                {r.status}
              </span>
            </Link>
          ))}
        </AgentCard>
      </div>

      {/* Quick actions */}
      <div className="bg-[#16191a] rounded-2xl p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary-container mb-1">Quick Actions</p>
          <p className="font-display text-[18px] font-semibold text-white">What do you want to automate today?</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'Screen CV', href: '/hr', icon: 'upload_file' },
            { label: 'Log Transaction', href: '/finance', icon: 'add_card' },
            { label: 'New Ticket', href: '/support', icon: 'confirmation_number' },
            { label: 'Get Briefing', href: '/executive', icon: 'auto_awesome' },
          ].map(({ label, href, icon }) => (
            <Link key={label} href={href}
              className="flex items-center gap-2 bg-white/[0.06] hover:bg-white/10 border border-white/[0.08] rounded-xl px-4 py-2.5 font-body text-[13px] text-white/70 hover:text-white transition-all">
              <span className="material-symbols-outlined text-[16px] text-primary-container">{icon}</span>
              {label}
            </Link>
          ))}
          <button onClick={() => setTaskModalOpen(true)}
            className="flex items-center gap-2 bg-primary-container/20 hover:bg-primary-container/30 border border-primary-container/30 rounded-xl px-4 py-2.5 font-body text-[13px] text-primary-container hover:text-white transition-all">
            <span className="material-symbols-outlined text-[16px]">smart_toy</span>
            New Agent Task
          </button>
        </div>
      </div>
    </div>
  )
}
