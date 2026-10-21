'use client'

import { useEffect, useState } from 'react'
import { executiveApi } from '@/lib/api'
import PageHeader from '@/components/ui/PageHeader'
import ExecutiveChat from '@/components/ui/ExecutiveChat'
import toast from 'react-hot-toast'

interface BriefingHR { id: string; candidate_name: string; recommendation: string; ai_score: number }
interface BriefingFinance { id: string; category: string; amount: number; severity: string }
interface BriefingSupport { id: string; urgency: string; status: string }
interface Briefing {
  hr: { recent: BriefingHR[] }
  finance: { recent: BriefingFinance[] }
  support: { recent: BriefingSupport[] }
  analytics: { latest: { overall_score: number; performance_rating: string } | null }
}

type IntelligencePeriod = 'daily' | 'week' | 'month'
interface IntelligenceBriefing {
  performance_summary: string
  recommendations: string[]
  briefing_data: { alerts?: string[]; snapshot?: { sales?: { revenue?: number; orders?: number; change_percent?: number | null }; customers?: { sentiment?: Record<string, number>; open_tickets?: number }; finance?: { anomalies?: unknown[]; high_severity?: unknown[] } } }
  period_start: string
  period_end: string
}

const recBadge = (r: string) =>
  r === 'shortlist' ? 'bg-primary-container/10 text-primary' :
  r === 'reject' ? 'bg-error-container text-on-error-container' : 'bg-yellow-100 text-yellow-700'

const sevBadge = (s: string) =>
  s === 'critical' || s === 'high' ? 'bg-error-container text-on-error-container' :
  s === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-primary-container/10 text-primary'

const urgBadge = (u: string) =>
  u === 'high' ? 'bg-error-container text-on-error-container' :
  u === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-surface-container text-on-surface-variant'

export default function ExecutivePage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [period, setPeriod] = useState<IntelligencePeriod>('daily')
  const [intelligence, setIntelligence] = useState<IntelligenceBriefing | null>(null)
  const [intelligenceLoading, setIntelligenceLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      const res = await executiveApi.downloadBriefingPdf()
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `executive-briefing-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Briefing exported as PDF')
    } catch {
      toast.error('PDF export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    executiveApi.getDailyBriefing()
      .then(r => setBriefing(r.data.briefing ?? null))
      .catch(() => setBriefing(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setIntelligenceLoading(true)
    executiveApi.getIntelligenceBriefing(period)
      .then(r => setIntelligence(r.data.data ?? null))
      .catch(() => setIntelligence(null))
      .finally(() => setIntelligenceLoading(false))
  }, [period])

  const refreshIntelligence = async () => {
    setRefreshing(true)
    try {
      const result = await executiveApi.refreshIntelligenceBriefing(period)
      setIntelligence(result.data.data)
      toast.success('Executive briefing refreshed')
    } catch {
      toast.error('Could not refresh the briefing')
    } finally { setRefreshing(false) }
  }

  const SectionCard = ({ title, icon, iconColor, children }: {
    title: string; icon: string; iconColor: string; children: React.ReactNode
  }) => (
    <div className="bg-white rounded-2xl border border-outline-variant/50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className={`material-symbols-outlined text-[18px] icon-filled ${iconColor}`}>{icon}</span>
        <h3 className="font-display text-[14px] font-semibold text-on-surface">{title}</h3>
      </div>
      {children}
    </div>
  )

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Executive Agent"
        subtitle={`Daily Intelligence Briefing — ${today}`}
        action={
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-mono text-[11px] uppercase tracking-widest font-bold disabled:opacity-50 transition-all hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[16px]">
              {exporting ? 'hourglass_empty' : 'picture_as_pdf'}
            </span>
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        }
      />

      <ExecutiveChat />

      {/* Persistent AI intelligence briefing */}
      <section className="bg-[#16191a] rounded-2xl p-6 text-white overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary-container mb-1">Executive Intelligence</p>
            <h2 className="font-display text-[22px] font-bold">Business health, risks & next actions</h2>
            <p className="font-body text-[13px] text-white/50 mt-1">Saved Groq analysis from live sales, finance, customers, hiring and security data.</p>
          </div>
          <button onClick={refreshIntelligence} disabled={refreshing} className="self-start px-3 py-2 rounded-lg border border-primary-container/30 text-primary-container font-mono text-[10px] uppercase tracking-widest disabled:opacity-50">
            {refreshing ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-5">
          {([['daily', 'Today'], ['week', 'Last 7 days'], ['month', 'Last 30 days']] as [IntelligencePeriod, string][]).map(([value, label]) => (
            <button key={value} onClick={() => setPeriod(value)} className={`px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider ${period === value ? 'bg-primary-container text-[#052b27]' : 'bg-white/[0.06] text-white/55 hover:text-white'}`}>{label}</button>
          ))}
        </div>
        {intelligenceLoading ? <p className="font-mono text-[11px] text-white/45">Building intelligence briefing…</p> : intelligence ? (
          <div className="space-y-5">
            <p className="font-body text-[15px] leading-7 text-white/85 whitespace-pre-wrap">{intelligence.performance_summary}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-mono text-white/45 uppercase">Sales</p><p className="text-lg font-bold mt-1">${Number(intelligence.briefing_data?.snapshot?.sales?.revenue || 0).toLocaleString()}</p><p className="text-xs text-white/45">{intelligence.briefing_data?.snapshot?.sales?.orders || 0} booked orders</p></div>
              <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-mono text-white/45 uppercase">Customer sentiment</p><p className="text-lg font-bold mt-1">{intelligence.briefing_data?.snapshot?.customers?.sentiment?.positive || 0} positive</p><p className="text-xs text-white/45">{intelligence.briefing_data?.snapshot?.customers?.open_tickets || 0} open tickets</p></div>
              <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-mono text-white/45 uppercase">Anomalies</p><p className="text-lg font-bold mt-1">{intelligence.briefing_data?.snapshot?.finance?.anomalies?.length || 0}</p><p className="text-xs text-white/45">{intelligence.briefing_data?.snapshot?.finance?.high_severity?.length || 0} high severity</p></div>
              <div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[10px] font-mono text-white/45 uppercase">Range</p><p className="text-sm font-bold mt-1">{intelligence.period_start}</p><p className="text-xs text-white/45">to {intelligence.period_end}</p></div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div><p className="font-mono text-[10px] text-primary-container uppercase tracking-widest mb-2">Priority recommendations</p><ul className="space-y-2">{intelligence.recommendations?.map((item, i) => <li key={i} className="text-[13px] text-white/75 flex gap-2"><span className="text-primary-container">→</span>{item}</li>)}</ul></div>
              <div><p className="font-mono text-[10px] text-amber-300 uppercase tracking-widest mb-2">Alerts to review</p><ul className="space-y-2">{intelligence.briefing_data?.alerts?.length ? intelligence.briefing_data.alerts.map((item, i) => <li key={i} className="text-[13px] text-white/75 flex gap-2"><span className="text-amber-300">!</span>{item}</li>) : <li className="text-[13px] text-white/45">No material alerts for this period.</li>}</ul></div>
            </div>
          </div>
        ) : <p className="font-body text-[13px] text-white/55">No intelligence briefing is available yet.</p>}
      </section>

      {/* Briefing Sections */}
      {loading ? (
        <div className="py-16 text-center font-mono text-[11px] text-on-surface-variant uppercase tracking-widest">Loading briefing...</div>
      ) : !briefing ? (
        <div className="bg-white rounded-2xl border border-outline-variant/50 p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant/20 mb-3 block">auto_awesome</span>
          <p className="font-display text-[16px] font-semibold text-on-surface mb-1">No briefing data yet</p>
          <p className="font-body text-[13px] text-on-surface-variant">Add records across HR, Finance and Support — the briefing will update automatically.</p>
        </div>
      ) : (
        <>
          {/* Analytics KPI Banner */}
          {briefing.analytics?.latest && (
            <div className="bg-white rounded-2xl border border-outline-variant/50 px-6 py-4 flex items-center gap-6">
              <span className="material-symbols-outlined text-[24px] icon-filled text-primary">insights</span>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-0.5">Latest Performance Score</p>
                <p className="font-display text-[24px] font-bold text-on-surface">{briefing.analytics.latest.overall_score} <span className="text-[14px] text-on-surface-variant font-normal">{briefing.analytics.latest.performance_rating}</span></p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* HR */}
            <SectionCard title="HR — Recent Candidates" icon="groups" iconColor="text-primary">
              {briefing.hr?.recent?.length === 0 ? (
                <p className="font-body text-[13px] text-on-surface-variant">No candidates screened yet.</p>
              ) : (
                <div className="space-y-2">
                  {briefing.hr.recent.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
                      <span className="font-body text-[13px] text-on-surface truncate flex-1 mr-2">{c.candidate_name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[10px] text-on-surface-variant">{c.ai_score}%</span>
                        <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${recBadge(c.recommendation)}`}>{c.recommendation}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Finance */}
            <SectionCard title="Finance — Recent Transactions" icon="payments" iconColor="text-tertiary">
              {briefing.finance?.recent?.length === 0 ? (
                <p className="font-body text-[13px] text-on-surface-variant">No finance records yet.</p>
              ) : (
                <div className="space-y-2">
                  {briefing.finance.recent.map(f => (
                    <div key={f.id} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
                      <span className="font-body text-[13px] text-on-surface truncate flex-1 mr-2">{f.category}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] font-semibold text-on-surface">${Number(f.amount).toLocaleString()}</span>
                        <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${sevBadge(f.severity)}`}>{f.severity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Support */}
            <SectionCard title="Support — Recent Tickets" icon="support_agent" iconColor="text-secondary">
              {briefing.support?.recent?.length === 0 ? (
                <p className="font-body text-[13px] text-on-surface-variant">No support tickets yet.</p>
              ) : (
                <div className="space-y-2">
                  {briefing.support.recent.map((t, i) => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
                      <span className="font-body text-[13px] text-on-surface">Ticket #{i + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${urgBadge(t.urgency)}`}>{t.urgency}</span>
                        <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${t.status === 'resolved' ? 'bg-primary-container/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>{t.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  )
}
