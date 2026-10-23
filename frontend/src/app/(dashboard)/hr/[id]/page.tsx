'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { hrApi } from '@/lib/api'
import ConfirmModal from '@/components/ui/ConfirmModal'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface HRReport {
  id: string; candidate_name: string; job_title: string
  ai_score: number; confidence: number; recommendation: string
  cv_text?: string; extracted_profile?: string; ai_analysis?: string
  created_at: string; updated_at?: string
}

const recBadge = (r: string) =>
  r === 'shortlist' ? 'bg-primary-container/10 text-primary border-primary-container/30' :
  r === 'reject' ? 'bg-error-container text-on-error-container border-error/30' :
  'bg-yellow-100 text-yellow-700 border-yellow-300'

const recIcon = (r: string) => r === 'shortlist' ? 'check_circle' : r === 'reject' ? 'cancel' : 'pending'

export default function HRDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [report, setReport] = useState<HRReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    hrApi.getReport(id)
      .then(r => setReport(r.data.data))
      .catch(() => setError('Report not found'))
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await hrApi.deleteReport(id)
      toast.success('Report deleted')
      router.push('/hr')
    } catch {
      toast.error('Failed to delete')
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="max-w-[900px] space-y-4">
      <div className="h-6 w-32 bg-surface-container rounded-lg animate-pulse" />
      <div className="bg-white rounded-2xl border border-outline-variant/50 p-8 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`h-4 bg-surface-container rounded-lg animate-pulse ${i === 0 ? 'w-1/2' : 'w-3/4'}`} />
        ))}
      </div>
    </div>
  )

  if (error || !report) return (
    <div className="max-w-[900px]">
      <Link href="/hr" className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-on-surface-variant hover:text-on-surface mb-6 transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back to HR
      </Link>
      <div className="bg-white rounded-2xl border border-outline-variant/50 p-10 text-center">
        <span className="material-symbols-outlined text-[32px] text-on-surface-variant/30 block mb-3">person_search</span>
        <p className="font-body text-[14px] text-on-surface-variant">Report not found</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-[900px] space-y-6">
      <ConfirmModal
        open={confirmOpen}
        title="Delete HR Report"
        message={`Delete the screening report for ${report.candidate_name}? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link href="/hr" className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span> HR Agent
        </Link>
        <button onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-[10px] uppercase tracking-wider text-error border border-error/30 hover:bg-error-container/20 transition-colors">
          <span className="material-symbols-outlined text-[14px]">delete</span> Delete
        </button>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-[20px] font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #00c2a8, #006b5c)' }}>
              {report.candidate_name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="font-display text-[22px] font-bold text-on-surface">{report.candidate_name}</h1>
              <p className="font-body text-[14px] text-on-surface-variant mt-0.5">{report.job_title}</p>
              <p className="font-mono text-[10px] text-on-surface-variant/60 mt-1">{new Date(report.created_at).toLocaleString()}</p>
            </div>
          </div>
          <span className={`font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${recBadge(report.recommendation)}`}>
            <span className="material-symbols-outlined text-[14px] icon-filled">{recIcon(report.recommendation)}</span>
            {report.recommendation}
          </span>
        </div>

        {/* Score bars */}
        <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-outline-variant/30">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">AI Score</span>
              <span className="font-display text-[20px] font-bold text-on-surface">{report.ai_score ?? '—'}%</span>
            </div>
            <div className="h-2.5 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${report.ai_score ?? 0}%`, background: 'linear-gradient(90deg,#00c2a8,#006b5c)' }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">Confidence</span>
              <span className="font-display text-[20px] font-bold text-on-surface">
                {report.confidence ? `${Math.round(report.confidence * 100)}%` : '—'}
              </span>
            </div>
            <div className="h-2.5 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-700"
                style={{ width: `${report.confidence ? Math.round(report.confidence * 100) : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      {report.ai_analysis && (
        <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[18px] icon-filled text-primary-container">psychology</span>
            <h2 className="font-display text-[15px] font-semibold text-on-surface">AI Analysis</h2>
          </div>
          <p className="font-body text-[14px] text-on-surface leading-relaxed whitespace-pre-wrap">{report.ai_analysis}</p>
        </div>
      )}

      {/* Extracted Profile */}
      {report.extracted_profile && (
        <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[18px] icon-filled text-tertiary">contact_page</span>
            <h2 className="font-display text-[15px] font-semibold text-on-surface">Extracted Profile</h2>
          </div>
          <pre className="font-mono text-[12px] text-on-surface-variant whitespace-pre-wrap break-words leading-relaxed bg-surface-container rounded-xl p-4">
            {typeof report.extracted_profile === 'string'
              ? report.extracted_profile
              : JSON.stringify(report.extracted_profile, null, 2)}
          </pre>
        </div>
      )}

      {/* CV Text */}
      {report.cv_text && (
        <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[18px] icon-filled text-on-surface-variant">description</span>
            <h2 className="font-display text-[15px] font-semibold text-on-surface">CV Text</h2>
          </div>
          <p className="font-body text-[13px] text-on-surface-variant leading-relaxed whitespace-pre-wrap line-clamp-[20]">{report.cv_text}</p>
        </div>
      )}
    </div>
  )
}
