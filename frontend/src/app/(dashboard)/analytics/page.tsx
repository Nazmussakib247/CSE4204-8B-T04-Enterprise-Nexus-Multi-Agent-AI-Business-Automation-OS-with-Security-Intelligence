'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { analyticsApi, hrApi, supportApi } from '@/lib/api'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import toast from 'react-hot-toast'
import { KPIHistoryChart, HRDonutChart, SupportFunnelChart } from '@/components/charts/AnalyticsCharts'

interface AnalyticsReport {
  id: string
  performance_rating: string
  overall_score: number
  ai_insights: string
  action_items: string[]
  kpi_snapshot: Record<string, number>
  created_at: string
}

interface HRStats { total: number; shortlisted: number; rejected: number; review: number; avg_score: number }
interface SupportReport {
  total: number; open: number; resolved: number; escalated: number
  by_urgency: { low: number; medium: number; high: number }
  by_sentiment: { positive: number; neutral: number; negative: number }
}

const ratingBg = (r: string) =>
  r === 'excellent' ? 'bg-primary/10 text-primary' :
  r === 'good' ? 'bg-primary-container/10 text-primary' :
  r === 'average' ? 'bg-yellow-100 text-yellow-700' : 'bg-error-container text-on-error-container'

const ratingColor = (r: string) =>
  r === 'excellent' ? 'text-primary' :
  r === 'good' ? 'text-primary-container' :
  r === 'average' ? 'text-yellow-600' : 'text-error'

const POLL_MS = 30_000

export default function AnalyticsPage() {
  const [reports, setReports] = useState<AnalyticsReport[]>([])
  const [latestKPI, setLatestKPI] = useState<AnalyticsReport | null>(null)
  const [hrStats, setHRStats] = useState<HRStats | null>(null)
  const [supportReport, setSupportReport] = useState<SupportReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(() => {
    analyticsApi.getReports()
      .then(r => {
        const data = r.data.data ?? []
        setReports(data)
        if (data.length > 0) setLatestKPI(data[0])
      })
      .catch(() => setReports([]))
      .finally(() => setLoading(false))
  }, [])

  const fetchSideData = useCallback(() => {
    hrApi.getStats().then(r => setHRStats(r.data.stats ?? null)).catch(() => {})
    supportApi.getSentimentReport().then(r => setSupportReport(r.data.report ?? null)).catch(() => {})
  }, [])

  useEffect(() => {
    fetchData()
    fetchSideData()
  }, [fetchData, fetchSideData])

  // 30s polling for n8n results
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      fetchData()
      fetchSideData()
    }, POLL_MS)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [fetchData, fetchSideData])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await analyticsApi.generateReport()
      toast.success('AI KPI report generated successfully!')
      fetchData()
    } catch {
      toast.error('Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Analytics Agent"
        subtitle="AI-driven KPI monitoring and cross-module performance insights"
        action={
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)', boxShadow: '0 4px 14px rgba(0,194,168,0.3)' }}
          >
            <span className="material-symbols-outlined text-[16px]">{generating ? 'hourglass_empty' : 'insights'}</span>
            {generating ? 'Generating...' : 'Generate AI Report'}
          </button>
        }
      />

      {/* KPI Snapshot */}
      {latestKPI ? (
        <div className="rounded-2xl p-6 text-white" style={{ background: '#16191a' }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container icon-filled">insights</span>
              <h3 className="font-display text-[16px] font-semibold text-white">Latest KPI Snapshot</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
                <span className="font-mono text-[10px] text-white/30 uppercase tracking-widest">Live · 30s</span>
              </span>
              <span className="font-mono text-[10px] text-white/30">{timeAgo(latestKPI.created_at)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {Object.entries(latestKPI.kpi_snapshot || {}).map(([key, val]) => (
              <div key={key} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-2">{key.replace(/_/g, ' ')}</p>
                <p className="font-display text-[24px] font-bold text-white">{val}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6 pt-4 border-t border-white/[0.06]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">Overall Score</p>
              <p className="font-display text-[32px] font-bold text-primary-container">{latestKPI.overall_score}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">Rating</p>
              <span className={`font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-full ${ratingBg(latestKPI.performance_rating)}`}>
                {latestKPI.performance_rating}
              </span>
            </div>
            {latestKPI.ai_insights && (
              <div className="flex-1">
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">AI Insight</p>
                <p className="font-body text-[13px] text-white/60 leading-relaxed line-clamp-2">{latestKPI.ai_insights}</p>
              </div>
            )}
          </div>
        </div>
      ) : !loading && (
        <div className="bg-white rounded-2xl border border-outline-variant/50 p-10">
          <EmptyState icon="analytics" title="No KPI data yet" description="Click Generate AI Report to analyse your data across all modules." />
        </div>
      )}

      {/* Charts row */}
      {(reports.length > 0 || hrStats || supportReport) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {reports.length > 1 && <KPIHistoryChart reports={reports} />}
          {hrStats && hrStats.total > 0 && (
            <HRDonutChart
              shortlisted={hrStats.shortlisted}
              review={hrStats.review}
              rejected={hrStats.rejected}
            />
          )}
          {supportReport && supportReport.total > 0 && (
            <SupportFunnelChart
              total={supportReport.total}
              open={supportReport.open}
              resolved={supportReport.resolved}
              escalated={supportReport.escalated}
              by_urgency={supportReport.by_urgency}
            />
          )}
        </div>
      )}

      {/* Reports List */}
      <div className="bg-white rounded-2xl border border-outline-variant/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/30 flex items-center justify-between">
          <h3 className="font-display text-[15px] font-semibold text-on-surface">Report History</h3>
          <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">{reports.length} reports</span>
        </div>

        {loading ? (
          <div className="py-16 text-center font-mono text-[11px] text-on-surface-variant uppercase tracking-widest">Loading...</div>
        ) : reports.length === 0 ? (
          <div className="p-8">
            <EmptyState icon="bar_chart" title="No reports yet" description="Generate your first AI report to see insights here." />
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/30">
            {reports.map((r) => (
              <div key={r.id} className="px-6 py-5 hover:bg-surface-container-low transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-[11px] uppercase tracking-wider px-3 py-1 rounded-full ${ratingBg(r.performance_rating)}`}>
                      {r.performance_rating}
                    </span>
                    <span className={`font-display text-[20px] font-bold ${ratingColor(r.performance_rating)}`}>
                      Score: {r.overall_score}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-on-surface-variant">{timeAgo(r.created_at)}</span>
                </div>
                {r.ai_insights && (
                  <p className="font-body text-[13px] text-on-surface-variant leading-relaxed mb-3 line-clamp-2">{r.ai_insights}</p>
                )}
                {r.action_items?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {r.action_items.slice(0, 3).map((item, i) => (
                      <span key={i} className="font-mono text-[10px] text-primary bg-primary-container/10 px-2.5 py-1 rounded-lg">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
