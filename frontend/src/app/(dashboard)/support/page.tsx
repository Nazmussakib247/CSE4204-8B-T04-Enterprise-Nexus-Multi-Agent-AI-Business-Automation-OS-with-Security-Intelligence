'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supportApi } from '@/lib/api'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import TicketModal from '@/components/modals/TicketModal'
import Pagination from '@/components/ui/Pagination'
import { SkeletonCards, SkeletonTicketRows } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'

interface Ticket {
  id: string; query: string; ai_response: string; intent: string
  urgency: string; sentiment: string; confidence: number
  escalated: boolean; status: string; created_at: string
}
interface SentimentReport {
  total: number; by_sentiment: Record<string, number>
  by_urgency: Record<string, number>; escalated: number; open: number; resolved: number
}

const urgBadge = (u: string) =>
  u === 'high' ? 'bg-error-container text-on-error-container' :
  u === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-surface-container text-on-surface-variant'
const sentBadge = (s: string) =>
  s === 'positive' ? 'bg-primary-container/10 text-primary' :
  s === 'negative' ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-on-surface-variant'
const statusBadge = (s: string) =>
  s === 'resolved' ? 'bg-primary-container/10 text-primary' :
  s === 'escalated' ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-on-surface-variant'

const LIMIT = 10
const POLL_MS = 30_000

function exportCSV(tickets: Ticket[]) {
  const headers = ['ID', 'Query', 'Intent', 'Urgency', 'Sentiment', 'Confidence', 'Status', 'Escalated', 'Date']
  const rows = tickets.map(t => [
    t.id,
    `"${(t.query ?? '').replace(/"/g, '""')}"`,
    t.intent ?? '',
    t.urgency,
    t.sentiment,
    t.confidence ? Math.round(t.confidence * 100) + '%' : '',
    t.status,
    t.escalated ? 'Yes' : 'No',
    new Date(t.created_at).toLocaleDateString(),
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = `support-tickets-${new Date().toISOString().split('T')[0]}.csv`
  a.click(); URL.revokeObjectURL(url)
}

export default function SupportPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [report, setReport] = useState<SentimentReport | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTickets = useCallback((p: number, status: string) => {
    setLoading(true)
    const params: Record<string, unknown> = { page: p, limit: LIMIT }
    if (status) params.status = status
    supportApi.getTickets(params)
      .then(r => { setTickets(r.data.data ?? []); setTotal(r.data.total ?? 0) })
      .catch(() => setTickets([]))
      .finally(() => setLoading(false))
  }, [])

  const fetchReport = useCallback(() => {
    supportApi.getSentimentReport()
      .then(r => setReport(r.data.report ?? null))
      .catch(() => {})
      .finally(() => setReportLoading(false))
  }, [])

  useEffect(() => {
    setReportLoading(true)
    fetchReport()
  }, [fetchReport])

  useEffect(() => { fetchTickets(page, statusFilter) }, [page, statusFilter, fetchTickets])

  // 30s polling
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      fetchTickets(page, statusFilter)
      fetchReport()
    }, POLL_MS)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [page, statusFilter, fetchTickets, fetchReport])

  const handleFilter = (s: string) => { setStatusFilter(s); setPage(1) }

  const refresh = () => { fetchTickets(page, statusFilter); fetchReport() }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const r = await supportApi.getTickets({ limit: 1000 })
      exportCSV(r.data.data ?? [])
      toast.success('CSV exported')
    } catch {
      toast.error('Export failed')
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <TicketModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={refresh} />
      <PageHeader
        title="Support Agent"
        subtitle="AI-powered ticket analysis, sentiment detection, and escalation"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-medium border border-outline-variant text-on-surface-variant hover:border-primary-container/50 hover:text-on-surface transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[15px]">{exportLoading ? 'hourglass_empty' : 'download'}</span>
              CSV
            </button>
            <button onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)', boxShadow: '0 4px 14px rgba(0,194,168,0.3)' }}>
              <span className="material-symbols-outlined text-[16px]">confirmation_number</span> New Ticket
            </button>
          </div>
        }
      />

      {/* Sentiment summary */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {reportLoading ? (
          <SkeletonCards count={6} />
        ) : report ? (
          [
            { label: 'Total Tickets', value: report.total, icon: 'inbox', color: 'text-primary-container', bg: 'bg-primary-container/10' },
            { label: 'Open', value: report.open, icon: 'schedule', color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: 'Resolved', value: report.resolved, icon: 'check_circle', color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Escalated', value: report.escalated, icon: 'escalator_warning', color: 'text-error', bg: 'bg-error-container' },
            { label: 'Positive', value: report.by_sentiment?.positive ?? 0, icon: 'sentiment_satisfied', color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Negative', value: report.by_sentiment?.negative ?? 0, icon: 'sentiment_dissatisfied', color: 'text-error', bg: 'bg-error-container' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-outline-variant/50">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${s.bg}`}>
                <span className={`material-symbols-outlined text-[16px] icon-filled ${s.color}`}>{s.icon}</span>
              </div>
              <p className="font-display text-[22px] font-bold text-on-surface">{s.value}</p>
              <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-wider">{s.label}</p>
            </div>
          ))
        ) : null}
      </div>

      {/* Tickets */}
      <div className="bg-white rounded-2xl border border-outline-variant/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-[15px] font-semibold text-on-surface">Support Tickets</h3>
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-primary-container animate-pulse" />
              <span className="font-mono text-[9px] text-on-surface-variant/50 uppercase tracking-widest">Live</span>
            </span>
          </div>
          <div className="flex gap-2">
            {['', 'open', 'resolved', 'escalated'].map(s => (
              <button key={s} onClick={() => handleFilter(s)}
                className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all ${
                  statusFilter === s ? 'border-primary-container bg-primary-container/10 text-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary-container/40'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <SkeletonTicketRows rows={LIMIT} />
        ) : tickets.length === 0 ? (
          <div className="p-10">
            <EmptyState icon="inbox" title="No tickets yet" description="Create a support ticket to start AI analysis." />
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {tickets.map(t => (
              <div key={t.id}
                onClick={() => router.push(`/support/${t.id}`)}
                className="px-6 py-4 hover:bg-surface-container-low transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <p className="font-body text-[14px] text-on-surface flex-1 line-clamp-2">{t.query}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${urgBadge(t.urgency)}`}>{t.urgency}</span>
                    <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${sentBadge(t.sentiment)}`}>{t.sentiment}</span>
                    <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${statusBadge(t.status)}`}>{t.status}</span>
                  </div>
                </div>
                {t.ai_response && (
                  <p className="font-body text-[12px] text-on-surface-variant line-clamp-1">{t.ai_response}</p>
                )}
                <div className="flex items-center gap-4 mt-2">
                  <span className="font-mono text-[10px] text-on-surface-variant/60">{t.intent}</span>
                  <span className="font-mono text-[10px] text-on-surface-variant/60">{new Date(t.created_at).toLocaleDateString()}</span>
                  {t.escalated && (
                    <span className="flex items-center gap-1 font-mono text-[10px] text-error">
                      <span className="material-symbols-outlined text-[12px]">escalator_warning</span> Escalated
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />
      </div>
    </div>
  )
}
