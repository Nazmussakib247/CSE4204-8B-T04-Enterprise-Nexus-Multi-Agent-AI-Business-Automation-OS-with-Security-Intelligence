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
