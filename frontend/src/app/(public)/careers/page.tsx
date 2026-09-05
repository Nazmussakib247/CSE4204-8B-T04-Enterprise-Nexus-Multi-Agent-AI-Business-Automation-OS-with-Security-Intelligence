'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { jobsApi } from '@/lib/api'

interface JobPosting {
  id: string
  title: string
  department: string | null
  description: string
  required_skills: { skill: string; weight: number }[]
}

export default function CareersPage() {
  const [jobs, setJobs] = useState<JobPosting[] | null>(null)

  useEffect(() => {
    jobsApi.getOpen()
      .then(r => setJobs(r.data.data ?? []))
      .catch(() => setJobs([]))
  }, [])

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-14">
      <div className="max-w-[560px] mb-12">
        <span className="font-mono text-[11px] uppercase tracking-widest text-primary">Careers</span>
        <h1 className="font-display text-display-lg text-on-surface mt-2">Build the agents with us</h1>
        <p className="font-body text-body-lg text-on-surface-variant mt-3">
          Open roles posted by our HR team appear here — apply directly, and our AI will screen your CV against the role the moment you submit it.
        </p>
      </div>

      {jobs === null ? (
        <div className="space-y-3">
          {[0, 1].map(i => <div key={i} className="h-28 rounded-2xl bg-surface-container-low animate-pulse" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-outline-variant/50 p-16 flex flex-col items-center text-center">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40 mb-3">work_outline</span>
          <p className="font-body text-[15px] text-on-surface">No open positions right now</p>
          <p className="font-body text-[13px] text-on-surface-variant mt-1 max-w-[360px]">
            Check back soon — new roles are posted here as soon as HR opens them.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <Link key={job.id} href={`/careers/${job.id}`}
              className="group block bg-white rounded-2xl border border-outline-variant/50 p-6 hover:border-outline-variant hover:shadow-card-hover transition-all">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-[16px] font-semibold text-on-surface group-hover:text-primary transition-colors">{job.title}</h2>
                  {job.department && <p className="font-mono text-[11px] text-on-surface-variant mt-1 uppercase tracking-wide">{job.department}</p>}
                  <p className="font-body text-[13px] text-on-surface-variant mt-2 line-clamp-2">{job.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(job.required_skills || []).map(s => (
                      <span key={s.skill} className="font-mono text-[10px] px-2 py-1 rounded-lg bg-surface-container-low text-on-surface-variant">
                        {s.skill}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0 group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
