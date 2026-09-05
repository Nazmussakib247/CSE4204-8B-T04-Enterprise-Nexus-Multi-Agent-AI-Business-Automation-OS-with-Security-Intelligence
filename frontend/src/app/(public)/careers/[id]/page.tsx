'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/auth'
import { jobsApi, getApiErrorMessage } from '@/lib/api'

interface JobPosting {
  id: string
  title: string
  department: string | null
  description: string
  required_skills: { skill: string; weight: number }[]
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [job, setJob] = useState<JobPosting | null | undefined>(undefined)
  const [file, setFile] = useState<File | null>(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    jobsApi.get(id)
      .then(r => setJob(r.data.data))
      .catch(() => setJob(null))
  }, [id])

  const handleApply = async () => {
    if (!file) { toast.error('Attach your CV first'); return }
    setApplying(true)
    try {
      const formData = new FormData()
      formData.append('cv', file)
      await jobsApi.apply(id, formData)
      setApplied(true)
      toast.success('Application submitted — your CV is being screened')
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not submit application'))
    } finally {
      setApplying(false)
    }
  }

  if (job === undefined || authLoading) return null

  if (job === null) {
    return (
      <div className="max-w-[700px] mx-auto px-6 py-16 text-center">
        <p className="font-body text-[15px] text-on-surface">This role is no longer available.</p>
        <Link href="/careers" className="font-body text-[13px] text-primary mt-2 inline-block">Back to careers</Link>
      </div>
    )
  }

  return (
    <div className="max-w-[700px] mx-auto px-6 py-10">
      <Link href="/careers" className="inline-flex items-center gap-1.5 font-body text-[13px] text-on-surface-variant hover:text-on-surface transition-colors mb-6">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Careers
      </Link>

      <h1 className="font-display text-display-lg text-on-surface">{job.title}</h1>
      {job.department && <p className="font-mono text-[12px] text-on-surface-variant mt-1.5 uppercase tracking-wide">{job.department}</p>}

      <p className="font-body text-[14px] text-on-surface leading-relaxed mt-5">{job.description}</p>

      <div className="mt-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-on-surface-variant mb-2">What we&apos;ll evaluate</p>
        <div className="flex flex-wrap gap-2">
          {(job.required_skills || []).map(s => (
            <span key={s.skill} className="font-body text-[13px] px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface">
              {s.skill} <span className="text-on-surface-variant">· {s.weight}%</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
        <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
        <p className="font-body text-[12px] text-primary">Your CV will be screened by AI against this role&apos;s specific criteria the moment you apply.</p>
      </div>

      {/* Apply section — behaviour depends on auth state */}
      {applied ? (
        <div className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-primary">check_circle</span>
          <p className="font-body text-[14px] text-on-surface">Application submitted. You can check its status any time.</p>
        </div>
      ) : !user ? (
        <div className="mt-8">
          <Link
            href={`/careers/register?redirect=/careers/${id}`}
            className="flex items-center justify-center h-11 px-6 rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium hover:bg-primary/90 transition-colors"
          >
            Create a candidate account to apply
          </Link>
          <p className="text-center font-body text-[12px] text-on-surface-variant mt-2">
            Already have one? <Link href="/store/login" className="text-primary">Sign in</Link>
          </p>
        </div>
      ) : user.role !== 'candidate' ? (
        <div className="mt-8 rounded-xl border border-outline-variant/60 p-5 text-center">
          <p className="font-body text-[14px] text-on-surface">You&apos;re signed in as a {user.role}.</p>
          <p className="font-body text-[13px] text-on-surface-variant mt-1">A candidate account is required to apply for roles.</p>
          <Link href={`/careers/register?redirect=/careers/${id}`} className="inline-block mt-3 font-body text-[13px] text-primary font-medium">
            Create a candidate account →
          </Link>
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-outline-variant/60 p-5">
          <label className="block font-mono text-[11px] uppercase tracking-wide text-on-surface-variant mb-2">Attach your CV (PDF)</label>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full font-body text-[13px] text-on-surface file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-primary-container/15 file:text-primary file:font-medium"
          />
          <button
            onClick={handleApply}
            disabled={applying}
            className="w-full mt-4 h-11 rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {applying ? 'Submitting & screening...' : 'Apply for this role'}
          </button>
        </div>
      )}
    </div>
  )
}
