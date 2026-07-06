'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { financeApi } from '@/lib/api'
import ConfirmModal from '@/components/ui/ConfirmModal'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface FinanceRecord {
  id: string; category: string; amount: number; expense_date: string
  description: string; severity: string; ai_analysis: string; created_at: string
}

const sevBadge = (s: string) =>
  s === 'critical' ? 'bg-error-container text-on-error-container border-error/30' :
  s === 'high' ? 'bg-error-container/70 text-on-error-container border-error/20' :
  s === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
  'bg-primary-container/10 text-primary border-primary-container/30'

const sevIcon = (s: string) =>
  s === 'critical' || s === 'high' ? 'warning' : s === 'medium' ? 'info' : 'check_circle'

export default function FinanceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [record, setRecord] = useState<FinanceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    financeApi.getRecord(id)
      .then(r => setRecord(r.data.data))
      .catch(() => setError('Record not found'))
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await financeApi.deleteRecord(id)
      toast.success('Record deleted')
      router.push('/finance')
    } catch {
      toast.error('Failed to delete')
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="max-w-[900px] space-y-4">
      <div className="h-6 w-32 bg-surface-container rounded-lg animate-pulse" />
      <div className="bg-white rounded-2xl border border-outline-variant/50 p-8 space-y-4">
        {[...Array(5)].map((_, i) => <div key={i} className={`h-4 bg-surface-container rounded-lg animate-pulse ${i === 0 ? 'w-1/2' : 'w-3/4'}`} />)}
      </div>
    </div>
  )

  if (error || !record) return (
    <div className="max-w-[900px]">
      <Link href="/finance" className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-on-surface-variant hover:text-on-surface mb-6 transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back to Finance
      </Link>
      <div className="bg-white rounded-2xl border border-outline-variant/50 p-10 text-center">
        <p className="font-body text-[14px] text-on-surface-variant">Record not found</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-[900px] space-y-6">
      <ConfirmModal
        open={confirmOpen}
        title="Delete Finance Record"
        message={`Delete this ${record.category} record of $${Number(record.amount).toLocaleString()}? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />

      <div className="flex items-center justify-between">
        <Link href="/finance" className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span> Finance Agent
        </Link>
        <button onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-[10px] uppercase tracking-wider text-error border border-error/30 hover:bg-error-container/20 transition-colors">
          <span className="material-symbols-outlined text-[14px]">delete</span> Delete
        </button>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-tertiary-fixed/40 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[28px] icon-filled text-tertiary">payments</span>
            </div>
            <div>
              <h1 className="font-display text-[22px] font-bold text-on-surface capitalize">{record.category}</h1>
              <p className="font-display text-[28px] font-bold text-on-surface mt-0.5">${Number(record.amount).toLocaleString()}</p>
              <p className="font-mono text-[10px] text-on-surface-variant/60 mt-1">{record.expense_date} · logged {new Date(record.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <span className={`font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${sevBadge(record.severity)}`}>
            <span className="material-symbols-outlined text-[14px] icon-filled">{sevIcon(record.severity)}</span>
            {record.severity}
          </span>
        </div>
      </div>

      {/* Description */}
      {record.description && (
        <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[18px] icon-filled text-on-surface-variant">description</span>
            <h2 className="font-display text-[15px] font-semibold text-on-surface">Description</h2>
          </div>
          <p className="font-body text-[14px] text-on-surface leading-relaxed">{record.description}</p>
        </div>
      )}

      {/* AI Analysis */}
      {record.ai_analysis && (
        <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[18px] icon-filled text-primary-container">psychology</span>
            <h2 className="font-display text-[15px] font-semibold text-on-surface">AI Anomaly Analysis</h2>
          </div>
          <p className="font-body text-[14px] text-on-surface leading-relaxed whitespace-pre-wrap">{record.ai_analysis}</p>
        </div>
      )}

      {/* Meta */}
      <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
        <h2 className="font-display text-[15px] font-semibold text-on-surface mb-4">Record Details</h2>
        <dl className="grid grid-cols-2 gap-4">
          {[
            { label: 'Record ID', value: record.id },
            { label: 'Category', value: record.category },
            { label: 'Amount', value: `$${Number(record.amount).toLocaleString()}` },
            { label: 'Date', value: record.expense_date },
            { label: 'Severity', value: record.severity },
            { label: 'Created', value: new Date(record.created_at).toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 bg-surface-container-low rounded-xl">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">{label}</dt>
              <dd className="font-body text-[13px] text-on-surface capitalize truncate">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
