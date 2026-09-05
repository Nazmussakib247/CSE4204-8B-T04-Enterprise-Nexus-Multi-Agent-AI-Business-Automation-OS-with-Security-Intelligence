'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { authApi, getApiErrorMessage, jobsApi } from '@/lib/api'

interface Job { id: string; title: string; department: string | null; description: string; required_skills: { skill: string; weight: number }[] }
interface User { id: string; name: string; email: string; role: string }

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<Job | null | undefined>(undefined)
  const [user, setUser] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cv, setCv] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    jobsApi.get(id).then(res => setJob(res.data.data)).catch(() => setJob(null))
    authApi.me().then(res => { setUser(res.data.user); setName(res.data.user.name); setEmail(res.data.user.email) }).catch(() => setUser(null))
  }, [id])

  const handleApply = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!cv) { toast.error('Please attach your CV'); return }
    setLoading(true)
    try {
      let applicant = user
      if (!applicant) {
        const response = await authApi.registerExternal(name, email, password, 'candidate')
        applicant = response.data.user
        setUser(applicant)
      }
      if (applicant.role !== 'candidate') {
        toast.error('This signed-in account is not a candidate account')
        return
      }
      const form = new FormData(); form.append('cv', cv)
      await jobsApi.apply(id, form)
      toast.success('Application submitted — your CV has been screened')
      setCv(null)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not submit application'))
    } finally { setLoading(false) }
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
          {job.required_skills.map(s => (
            <span key={s.skill} className="font-body text-[13px] px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface">
              {s.skill} <span className="text-on-surface-variant">· {s.weight}%</span>
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={handleApply} className="mt-8 rounded-2xl border border-outline-variant/50 bg-white p-5 space-y-3">
        <h2 className="font-display text-[16px] font-semibold text-on-surface">Apply for this role</h2>
        {!user && <><input required value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="w-full px-3 py-2.5 rounded-xl border border-outline-variant text-[14px]" />
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="w-full px-3 py-2.5 rounded-xl border border-outline-variant text-[14px]" />
          <input required type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a candidate password" className="w-full px-3 py-2.5 rounded-xl border border-outline-variant text-[14px]" />
          <p className="font-body text-[12px] text-on-surface-variant">New applicants get a candidate account before applying.</p></>}
        {user && <p className="font-body text-[13px] text-on-surface-variant">Applying as {user.name} ({user.email})</p>}
        <input required type="file" accept=".pdf,.doc,.docx,.txt,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => setCv(e.target.files?.[0] ?? null)} className="block w-full text-[13px]" />
        <button type="submit" disabled={loading} className="h-11 px-6 rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">{loading ? 'Submitting…' : 'Submit application'}</button>
      </form>

      <div className="mt-6 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
        <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
        <p className="font-body text-[12px] text-primary">Your CV will be screened by AI against this role's specific criteria the moment you apply.</p>
      </div>
    </div>
  )
}
