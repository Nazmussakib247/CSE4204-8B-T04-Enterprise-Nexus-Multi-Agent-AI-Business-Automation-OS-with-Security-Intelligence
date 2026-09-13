'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getApiErrorMessage, jobsApi } from '@/lib/api'

interface Job { id: string; title: string; department?: string | null; status: string; job_applications?: { count: number }[] }
interface Application { id: string; ai_score: number | null; ai_recommendation: string | null; status: string; narrative_summary?: string | null; users?: { name: string; email: string } }

export default function JobApplicationsPanel({ refreshKey }: { refreshKey: number }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [notifying, setNotifying] = useState(false)

  const loadJobs = () => {
    setLoading(true)
    jobsApi.getAllForStaff().then(res => {
      const next = res.data.data ?? []
      setJobs(next)
      setSelectedJob(current => next.find((job: Job) => job.id === current?.id) ?? current)
    }).catch(() => setJobs([])).finally(() => setLoading(false))
  }
  const loadApplications = (job: Job) => {
    setSelectedJob(job); setSelected([])
    jobsApi.getApplications(job.id).then(res => setApplications(res.data.data ?? [])).catch(() => { setApplications([]); toast.error('Could not load applications') })
  }

  useEffect(loadJobs, [refreshKey])
  useEffect(() => { if (selectedJob) loadApplications(selectedJob) }, [selectedJob?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  const notify = async () => {
    if (!selectedJob || !selected.length) return
    setNotifying(true)
    try {
      const res = await jobsApi.confirmAndNotify(selectedJob.id, selected)
      toast.success(res.data.message)
      loadApplications(selectedJob); loadJobs()
    } catch (err) { toast.error(getApiErrorMessage(err, 'Could not notify applicants')) }
    finally { setNotifying(false) }
  }

  return <section className="bg-white rounded-2xl border border-outline-variant/50 overflow-hidden">
    <div className="px-6 py-4 border-b border-outline-variant/30 flex items-center justify-between">
      <div><h3 className="font-display text-[15px] font-semibold text-on-surface">Job postings & applications</h3><p className="font-body text-[12px] text-on-surface-variant mt-0.5">Select applicants to confirm their review and send an email update.</p></div>
      {selectedJob && <button onClick={notify} disabled={!selected.length || notifying} className="px-3 py-2 rounded-xl bg-primary text-on-primary font-mono text-[10px] uppercase tracking-wider disabled:opacity-50">{notifying ? 'Sending…' : `Confirm & Notify (${selected.length})`}</button>}
    </div>
    <div className="grid md:grid-cols-[280px_1fr] min-h-[210px]">
      <div className="border-r border-outline-variant/30 divide-y divide-outline-variant/20">
        {loading ? <p className="p-5 font-body text-[13px] text-on-surface-variant">Loading jobs…</p> : jobs.length ? jobs.map(job => <button key={job.id} onClick={() => loadApplications(job)} className={`w-full text-left p-4 hover:bg-surface-container-low ${selectedJob?.id === job.id ? 'bg-primary/5' : ''}`}><p className="font-body text-[13px] font-medium text-on-surface">{job.title}</p><p className="font-mono text-[10px] uppercase text-on-surface-variant mt-1">{job.status} · {job.job_applications?.[0]?.count ?? 0} applicants</p></button>) : <p className="p-5 font-body text-[13px] text-on-surface-variant">No jobs posted yet.</p>}
      </div>
      <div className="overflow-x-auto">
        {!selectedJob ? <p className="p-8 font-body text-[13px] text-on-surface-variant">Choose a job to view its applicants.</p> : !applications.length ? <p className="p-8 font-body text-[13px] text-on-surface-variant">No applications for this job yet.</p> : <table className="w-full min-w-[560px]"><thead><tr className="bg-surface-container-low">{['', 'Candidate', 'AI Score', 'Recommendation', 'Status'].map(label => <th key={label || 'select'} className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">{label}</th>)}</tr></thead><tbody className="divide-y divide-outline-variant/20">{applications.map(application => <tr key={application.id}><td className="px-4 py-3"><input type="checkbox" checked={selected.includes(application.id)} onChange={() => toggle(application.id)} aria-label={`Select ${application.users?.name ?? 'applicant'}`} /></td><td className="px-4 py-3"><p className="font-body text-[13px] text-on-surface">{application.users?.name ?? 'Applicant'}</p><p className="font-body text-[11px] text-on-surface-variant">{application.users?.email}</p></td><td className="px-4 py-3 font-mono text-[12px] text-on-surface">{application.ai_score ?? '—'}%</td><td className="px-4 py-3 font-mono text-[11px] uppercase text-on-surface-variant">{application.ai_recommendation ?? 'Pending'}</td><td className="px-4 py-3 font-mono text-[11px] uppercase text-on-surface-variant">{application.status}</td></tr>)}</tbody></table>}
      </div>
    </div>
  </section>
}
