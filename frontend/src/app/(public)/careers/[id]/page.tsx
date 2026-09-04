'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { getMockJobs, type MockJob } from '@/lib/mockJobs'

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<MockJob | null | undefined>(undefined)

  useEffect(() => {
    setJob(getMockJobs().find(j => j.id === id) ?? null)
  }, [id])

  const handleApply = () => {
    toast('Candidate accounts are coming soon — check back shortly.', { icon: '🛠️' })
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
    <div className="max-w-[700px] mx-auto px-6 py-10">
      <Link href="/careers" className="inline-flex items-center gap-1.5 font-body text-[13px] text-on-surface-variant hover:text-on-surface transition-colors mb-6">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Careers
      </Link>

      <h1 className="font-display text-display-lg text-on-surface">{job.title}</h1>
      {job.department && <p className="font-mono text-[12px] text-on-surface-variant mt-1.5 uppercase tracking-wide">{job.department}</p>}

      <p className="font-body text-[14px] text-on-surface leading-relaxed mt-5">{job.description}</p>

      <div className="mt-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-on-surface-variant mb-2">What we'll evaluate</p>
        <div className="flex flex-wrap gap-2">
          {job.requiredSkills.map(s => (
            <span key={s.skill} className="font-body text-[13px] px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface">
              {s.skill} <span className="text-on-surface-variant">· {s.weight}%</span>
            </span>
          ))}
        </div>
      </div>

      <button onClick={handleApply}
        className="mt-8 h-11 px-6 rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium hover:bg-primary/90 transition-colors">
        Apply for this role
      </button>

      <div className="mt-6 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
        <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
        <p className="font-body text-[12px] text-primary">Your CV will be screened by AI against this role's specific criteria the moment you apply.</p>
      </div>
    </div>
  )
}
