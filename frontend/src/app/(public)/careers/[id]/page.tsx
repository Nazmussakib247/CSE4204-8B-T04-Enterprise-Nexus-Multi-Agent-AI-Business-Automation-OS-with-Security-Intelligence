'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { jobsApi, getApiErrorMessage } from '@/lib/api'

interface JobPosting {
  id: string
  title: string
  department: string | null
  description: string
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<JobPosting | null | undefined>(undefined)
  const [file, setFile] = useState<File | null>(null)
  const [applicantName, setApplicantName] = useState('')
  const [applicantEmail, setApplicantEmail] = useState('')
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    jobsApi.get(id)
      .then(r => setJob(r.data.data))
      .catch(() => setJob(null))
  }, [id])

  const handleApply = async () => {
    if (!applicantName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail)) { toast.error('Enter your full name and a valid email'); return }
    if (!file) { toast.error('Attach your CV first'); return }
    setApplying(true)
    try {
      const formData = new FormData()
      formData.append('applicant_name', applicantName.trim())
      formData.append('applicant_email', applicantEmail.trim())
      formData.append('cv', file)
      await jobsApi.apply(id, formData)
      setApplied(true)
      setShowSuccess(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not submit application'))
    } finally {
      setApplying(false)
    }
  }

  if (job === undefined) return null

  if (job === null) {
    return (
      <div className="max-w-[700px] mx-auto px-6 py-16 text-center">
        <p className="font-body text-[15px] text-on-surface">This role is no longer available.</p>
        <Link href="/careers" className="font-body text-[13px] text-primary mt-2 inline-block">Back to careers</Link>
      </div>
    )
  }

  return (
    <>
    <div className="max-w-[700px] mx-auto px-6 py-10">
      <Link href="/careers" className="inline-flex items-center gap-1.5 font-body text-[13px] text-on-surface-variant hover:text-on-surface transition-colors mb-6">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Careers
      </Link>

      <h1 className="font-display text-display-lg text-on-surface">{job.title}</h1>
      {job.department && <p className="font-mono text-[12px] text-on-surface-variant mt-1.5 uppercase tracking-wide">{job.department}</p>}

      <p className="font-body text-[14px] text-on-surface leading-relaxed mt-5">{job.description}</p>

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
      ) : (
        <div className="mt-8 rounded-xl border border-outline-variant/60 p-5">
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <label className="font-body text-[13px] text-on-surface-variant">Full name<input value={applicantName} onChange={e => setApplicantName(e.target.value)} placeholder="Your full name" className="mt-1.5 w-full rounded-xl border border-outline-variant px-4 py-2.5 text-on-surface outline-none focus:border-primary" /></label>
            <label className="font-body text-[13px] text-on-surface-variant">Email<input type="email" value={applicantEmail} onChange={e => setApplicantEmail(e.target.value)} placeholder="you@example.com" className="mt-1.5 w-full rounded-xl border border-outline-variant px-4 py-2.5 text-on-surface outline-none focus:border-primary" /></label>
          </div>
          <label className="block font-mono text-[11px] uppercase tracking-wide text-on-surface-variant mb-2">Attach your CV (PDF or DOCX)</label>
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
            {applying ? 'Submitting...' : 'Apply for this role'}
          </button>
        </div>
      )}
    </div>
    {showSuccess && <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="application-success-title">
      <button type="button" aria-label="Close application confirmation" className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm animate-fade-in" onClick={() => setShowSuccess(false)} />
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-2xl animate-modal-in">
        <div className="h-1 bg-gradient-to-r from-primary via-primary-container to-tertiary" />
        <div className="p-7 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><span className="material-symbols-outlined text-[30px] icon-filled">check_circle</span></div>
          <h2 id="application-success-title" className="mt-4 font-display text-[22px] font-semibold text-on-surface">Thank you for applying!</h2>
          <p className="mt-2 font-body text-[14px] leading-6 text-on-surface-variant">Your application for <span className="font-medium text-on-surface">{job.title}</span> was submitted successfully. Our team will review your CV and contact you if there is a next step.</p>
          <button type="button" onClick={() => setShowSuccess(false)} className="mt-6 w-full rounded-xl bg-primary px-4 py-3 font-body text-[14px] font-medium text-on-primary transition-colors hover:bg-primary/90">OK</button>
        </div>
      </div>
    </div>}
    </>
  )
}
