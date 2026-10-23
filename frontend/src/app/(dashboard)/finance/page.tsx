'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { financeApi } from '@/lib/api'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import TransactionModal from '@/components/modals/TransactionModal'
import FinanceUploadModal from '@/components/modals/FinanceUploadModal'
import Pagination from '@/components/ui/Pagination'
import { SkeletonCards, SkeletonTableRows } from '@/components/ui/Skeleton'
import { SpendByCategoryChart, AnomalyTrendChart } from '@/components/charts/FinanceCharts'
import toast from 'react-hot-toast'

interface FinanceRecord {
  id: string; category: string; amount: number; expense_date: string
  description: string; severity: string; ai_analysis: string; created_at: string
}
interface FinanceSummary {
  total_spend: number; by_category: Record<string, number>
  anomaly_count: number; record_count: number
}

const sevBadge = (s: string) =>
  s === 'critical' || s === 'high' ? 'bg-error-container text-on-error-container' :
  s === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-primary-container/10 text-primary'

const LIMIT = 10
const POLL_MS = 30_000

function exportCSV(records: FinanceRecord[]) {
  const headers = ['ID', 'Category', 'Amount', 'Date', 'Severity', 'Description', 'AI Analysis']
  const rows = records.map(r => [
    r.id, r.category, r.amount, r.expense_date, r.severity,
    `"${(r.description ?? '').replace(/"/g, '""')}"`,
    `"${(r.ai_analysis ?? '').replace(/"/g, '""')}"`,
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = `finance-records-${new Date().toISOString().split('T')[0]}.csv`
  a.click(); URL.revokeObjectURL(url)
}

export default function FinancePage() {
  const router = useRouter()
  const [records, setRecords] = useState<FinanceRecord[]>([])
  const [allRecords, setAllRecords] = useState<FinanceRecord[]>([])
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<'all' | 'anomalies'>('all')
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<FinanceRecord | null>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchRecords = useCallback((p: number, anomaliesOnly: boolean) => {
    setLoading(true)
    const params: Record<string, unknown> = { page: p, limit: LIMIT }
    if (anomaliesOnly) params.severity = 'high,critical'
    financeApi.getRecords(params)
      .then(r => { setRecords(r.data.data ?? []); setTotal(r.data.total ?? 0) })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  }, [])

  const fetchSummary = useCallback(() => {
    financeApi.getSummary()
      .then(r => setSummary(r.data ?? null))
      .catch(() => {})
      .finally(() => setSummaryLoading(false))
  }, [])

  // Fetch all records for charts (no pagination)
  const fetchAllForCharts = useCallback(() => {
    financeApi.getRecords({ limit: 500 })
      .then(r => setAllRecords(r.data.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setSummaryLoading(true)
    fetchSummary()
    fetchAllForCharts()
  }, [fetchSummary, fetchAllForCharts])

  useEffect(() => { fetchRecords(page, tab === 'anomalies') }, [page, tab, fetchRecords])

  // 30s polling
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      fetchRecords(page, tab === 'anomalies')
      fetchSummary()
      fetchAllForCharts()
    }, POLL_MS)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [page, tab, fetchRecords, fetchSummary, fetchAllForCharts])

  const handleTab = (t: 'all' | 'anomalies') => { setTab(t); setPage(1) }

  const refresh = () => {
    fetchRecords(page, tab === 'anomalies')
    fetchSummary()
    fetchAllForCharts()
  }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const r = await financeApi.getRecords({ limit: 1000 })
      exportCSV(r.data.data ?? [])
      toast.success('CSV exported')
    } catch {
      toast.error('Export failed')
    } finally {
      setExportLoading(false)
    }
  }

  const handleEdit = (e: React.MouseEvent, record: FinanceRecord) => {
    e.stopPropagation()
    setEditRecord(record)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <TransactionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditRecord(null) }}
        onCreated={refresh}
        editRecord={editRecord}
      />
      <FinanceUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onCreated={refresh}
      />
      <PageHeader
        title="Finance Agent"
        subtitle="AI-powered anomaly detection and financial intelligence"
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
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-medium border border-outline-variant text-on-surface-variant hover:border-primary-container/50 hover:text-on-surface transition-all"
            >
              <span className="material-symbols-outlined text-[15px]">upload_file</span>
              Import
            </button>
            <button onClick={() => { setEditRecord(null); setModalOpen(true) }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)', boxShadow: '0 4px 14px rgba(0,194,168,0.3)' }}>
              <span className="material-symbols-outlined text-[16px]">add_card</span> Log Transaction
            </button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          <SkeletonCards count={4} />
        ) : summary ? (
          [
            { label: 'Total Records', value: summary.record_count, icon: 'receipt_long', color: 'text-primary-container', bg: 'bg-primary-container/10' },
            { label: 'Total Spend', value: `$${Number(summary.total_spend).toLocaleString()}`, icon: 'payments', color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Anomalies', value: summary.anomaly_count, icon: 'warning', color: 'text-error', bg: 'bg-error-container' },
            { label: 'Categories', value: Object.keys(summary.by_category).length, icon: 'category', color: 'text-tertiary', bg: 'bg-tertiary-fixed/40' },
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

      {/* Charts */}
      {summary && Object.keys(summary.by_category).length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SpendByCategoryChart byCategory={summary.by_category} />
          {allRecords.length > 0 && <AnomalyTrendChart records={allRecords} />}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-outline-variant/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30 flex-wrap gap-3">
          <h3 className="font-display text-[15px] font-semibold text-on-surface">Transaction Records</h3>
          <div className="flex gap-2">
            {(['all', 'anomalies'] as const).map(t => (
              <button key={t} onClick={() => handleTab(t)}
                className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all ${
                  tab === t ? 'border-primary-container bg-primary-container/10 text-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary-container/40'}`}>
                {t === 'all' ? 'All' : `Anomalies${summary ? ` (${summary.anomaly_count})` : ''}`}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-surface-container-low">
                {['Category', 'Amount', 'Date', 'Severity', 'AI Analysis', ''].map((h, i) => (
                  <th key={i} className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <SkeletonTableRows cols={6} rows={LIMIT} />
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="p-10">
                  <EmptyState icon="receipt_long" title="No records yet" description="Log a transaction to start AI anomaly detection." />
                </td></tr>
              ) : records.map(r => (
                <tr key={r.id}
                  onClick={() => router.push(`/finance/${r.id}`)}
                  className="hover:bg-surface-container-low transition-colors cursor-pointer group">
                  <td className="px-5 py-4 font-body text-[14px] font-medium text-on-surface capitalize">{r.category}</td>
                  <td className="px-5 py-4 font-mono text-[13px] font-semibold text-on-surface">${Number(r.amount).toLocaleString()}</td>
                  <td className="px-5 py-4 font-mono text-[11px] text-on-surface-variant">{r.expense_date}</td>
                  <td className="px-5 py-4">
                    <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full ${sevBadge(r.severity)}`}>{r.severity}</span>
                  </td>
                  <td className="px-5 py-4 font-body text-[12px] text-on-surface-variant max-w-xs truncate">{r.ai_analysis}</td>
                  <td className="px-3 py-4">
                    <button
                      onClick={(e) => handleEdit(e, r)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
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
