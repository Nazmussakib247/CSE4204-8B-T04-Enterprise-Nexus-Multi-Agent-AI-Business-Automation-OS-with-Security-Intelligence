'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { hrApi } from '@/lib/api'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import CVUploadModal from '@/components/modals/CVUploadModal'
import Pagination from '@/components/ui/Pagination'
import { SkeletonCards, SkeletonTableRows } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'

interface HRReport {
  id: string; candidate_name: string; job_title: string
  ai_score: number; confidence: number; recommendation: string; created_at: string
}
interface HRStats { total: number; shortlisted: number; rejected: number; review: number; avg_score: number }

const recBadge = (r: string) =>
  r === 'shortlist' ? 'bg-primary-container/10 text-primary' :
  r === 'reject' ? 'bg-error-container text-on-error-container' : 'bg-yellow-100 text-yellow-700'

const LIMIT = 10
const POLL_MS = 30_000

function exportCSV(reports: HRReport[]) {
  const headers = ['ID', 'Candidate Name', 'Job Title', 'AI Score (%)', 'Confidence (%)', 'Recommendation', 'Date']
  const rows = reports.map(r => [
    r.id,
    `"${(r.candidate_name ?? '').replace(/"/g, '""')}"`,
    `"${(r.job_title ?? '').replace(/"/g, '""')}"`,
    r.ai_score ?? '',
    r.confidence ? Math.round(r.confidence * 100) : '',
    r.recommendation,
    new Date(r.created_at).toLocaleDateString(),
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = `hr-candidates-${new Date().toISOString().split('T')[0]}.csv`
  a.click(); URL.revokeObjectURL(url)
}

export default function HRPage() {
  const router = useRouter()
  const [reports, setReports] = useState<HRReport[]>([])
  const [stats, setStats] = useState<HRStats | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchReports = useCallback((p: number, rec: string) => {
    setLoading(true)
    const params: Record<string, unknown> = { page: p, limit: LIMIT }
    if (rec) params.recommendation = rec
    hrApi.getReports(params)
      .then(r => { setReports(r.data.data ?? []); setTotal(r.data.total ?? 0) })
      .catch(() => setReports([]))
      .finally(() => setLoading(false))
  }, [])

  const fetchStats = useCallback(() => {
    hrApi.getStats()
      .then(r => setStats(r.data.stats ?? null))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [])

  useEffect(() => {
    setStatsLoading(true)
    fetchStats()
  }, [fetchStats])

  useEffect(() => { fetchReports(page, filter) }, [page, filter, fetchReports])

  // 30s polling — picks up n8n-triggered updates
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      fetchReports(page, filter)
      fetchStats()
    }, POLL_MS)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [page, filter, fetchReports, fetchStats])

  const handleFilter = (f: string) => { setFilter(f); setPage(1) }

  const refresh = () => { fetchReports(page, filter); fetchStats() }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const r = await hrApi.getReports({ limit: 1000 })
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
      <CVUploadModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={refresh} />
      <PageHeader
        title="HR Agent"
        subtitle="AI-powered CV screening and candidate intelligence"
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
              <span className="material-symbols-outlined text-[16px]">upload_file</span> Upload CV
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statsLoading ? (
          <SkeletonCards count={5} />
        ) : stats ? (
          [
            { label: 'Total Screened', value: stats.total, icon: 'groups', color: 'text-primary-container', bg: 'bg-primary-container/10' },
            { label: 'Shortlisted', value: stats.shortlisted, icon: 'check_circle', color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Rejected', value: stats.rejected, icon: 'cancel', color: 'text-error', bg: 'bg-error-container' },
            { label: 'Under Review', value: stats.review, icon: 'pending', color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: 'Avg AI Score', value: `${stats.avg_score}%`, icon: 'psychology', color: 'text-tertiary', bg: 'bg-tertiary-fixed/40' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-outline-variant/50">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.bg}`}>
                <span className={`material-symbols-outlined text-[18px] icon-filled ${s.color}`}>{s.icon}</span>
              </div>
              <p className="font-display text-[26px] font-bold text-on-surface">{s.value}</p>
              <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
          ))
        ) : null}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-outline-variant/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-[15px] font-semibold text-on-surface">Candidate Reports</h3>
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-primary-container animate-pulse" />
              <span className="font-mono text-[9px] text-on-surface-variant/50 uppercase tracking-widest">Live</span>
            </span>
          </div>
          <div className="flex gap-2">
            {['', 'shortlist', 'review', 'reject'].map(f => (
              <button key={f} onClick={() => handleFilter(f)}
                className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all ${
                  filter === f ? 'border-primary-container bg-primary-container/10 text-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary-container/40'}`}>
                {f || 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-surface-container-low">
                {['Candidate', 'Job Title', 'AI Score', 'Confidence', 'Recommendation', 'Date'].map(h => (
                  <th key={h} className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <SkeletonTableRows cols={6} rows={LIMIT} />
              ) : reports.length === 0 ? (
                <tr><td colSpan={6} className="p-10">
                  <EmptyState icon="person_search" title="No candidates yet" description="Upload CVs to start AI screening." />
                </td></tr>
              ) : reports.map(r => (
                <tr key={r.id}
                  onClick={() => router.push(`/hr/${r.id}`)}
                  className="hover:bg-surface-container-low transition-colors cursor-pointer">
                  <td className="px-5 py-4 font-body text-[14px] font-medium text-on-surface">{r.candidate_name}</td>
                  <td className="px-5 py-4 font-body text-[13px] text-on-surface-variant">{r.job_title}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full bg-primary-container rounded-full" style={{ width: `${r.ai_score ?? 0}%` }} />
                      </div>
                      <span className="font-mono text-[11px] text-on-surface-variant">{r.ai_score ?? '—'}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-[11px] text-on-surface-variant">
                    {r.confidence ? `${Math.round(r.confidence * 100)}%` : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full ${recBadge(r.recommendation)}`}>
                      {r.recommendation}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-[11px] text-on-surface-variant">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />
      </div>
    </div>
  )
}
