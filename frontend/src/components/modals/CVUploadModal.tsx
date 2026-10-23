'use client'

import { useEffect, useRef, useState } from 'react'
import { getApiErrorMessage, hrApi, hrUploadApi, jobsApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface Props { open: boolean; onClose: () => void; onCreated: () => void }
interface Job { id: string; title: string; department?: string | null; status?: string }
type InputMode = 'file' | 'text'
const allowedExtensions = ['pdf', 'docx', 'doc', 'txt']
const nameFromFile = (fileName: string) => fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b(cv|resume|curriculum vitae|final|updated|copy|v\d+)\b/gi, '').replace(/\s{2,}/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase()) || 'Candidate'

export default function CVUploadModal({ open, onClose, onCreated }: Props) {
  const [candidateName, setCandidateName] = useState('')
  const [jobId, setJobId] = useState('')
  const [cvText, setCvText] = useState('')
  const [mode, setMode] = useState<InputMode>('file')
  const [files, setFiles] = useState<File[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setLoadingJobs(true)
    jobsApi.getAllForStaff()
      .then(r => setJobs((r.data.data ?? []).filter((job: Job) => job.status === 'open')))
      .catch(() => toast.error('Could not load published jobs'))
      .finally(() => setLoadingJobs(false))
  }, [open])

  if (!open) return null
  const selectedJob = jobs.find(job => job.id === jobId)
  const reset = () => {
    setCandidateName(''); setJobId(''); setCvText(''); setFiles([]); setMode('file'); setProgress({ completed: 0, total: 0 })
    if (fileRef.current) fileRef.current.value = ''
    if (folderRef.current) folderRef.current.value = ''
  }
  const close = () => { if (!loading) { reset(); onClose() } }
  const queueFiles = (list: FileList | null) => {
    if (!list) return
    const accepted = Array.from(list).filter(file => allowedExtensions.includes(file.name.split('.').pop()?.toLowerCase() ?? '') && file.size <= 10 * 1024 * 1024)
    if (!accepted.length) return toast.error('Choose PDF, DOCX, DOC, or TXT CVs under 10 MB')
    if (accepted.length < list.length) toast.error('Unsupported or oversized files were skipped')
    setFiles(accepted)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedJob) return toast.error('Select an open job before screening')
    if (mode === 'text') {
      if (!candidateName.trim() || !cvText.trim()) return toast.error('Candidate name and CV text are required')
      setLoading(true)
      try { await hrApi.createReport({ candidate_name: candidateName.trim(), job_id: selectedJob.id, job_title: selectedJob.title, cv_text: cvText.trim() }); toast.success('Candidate screened with AI'); reset(); onCreated(); onClose() }
      catch (error) { toast.error(getApiErrorMessage(error, 'Failed to screen candidate')) }
      finally { setLoading(false) }
      return
    }
    if (!files.length) return toast.error('Choose at least one CV file')
    setLoading(true); setProgress({ completed: 0, total: files.length })
    let succeeded = 0; let failed = 0
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      try {
        const data = new FormData(); data.append('cv', file); data.append('candidate_name', nameFromFile(file.name)); data.append('job_title', selectedJob.title); data.append('job_id', selectedJob.id)
        await hrUploadApi.uploadCV(data); succeeded += 1
      } catch { failed += 1 } finally { setProgress({ completed: index + 1, total: files.length }) }
    }
    setLoading(false)
    if (succeeded) { onCreated(); toast.success(`${succeeded} candidate${succeeded === 1 ? '' : 's'} screened`) }
    if (failed) toast.error(`${failed} CV${failed === 1 ? '' : 's'} could not be screened`)
    if (!failed) { reset(); onClose() }
  }

  return <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cv-screening-title">
    <div className="modal-backdrop" onClick={close} />
    <div className="modal-panel max-w-2xl overflow-y-auto rounded-[24px] border-white/70 shadow-[0_28px_80px_rgba(15,23,42,0.32)]">
      <header className="relative overflow-hidden border-b border-outline-variant/30 bg-gradient-to-br from-slate-950 via-[#073c39] to-[#007c6b] px-7 py-6 text-white">
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary-container/20 blur-2xl" />
        <div className="relative flex items-start justify-between gap-5"><div className="flex gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><span className="material-symbols-outlined icon-filled">person_search</span></div><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary-fixed">Talent intelligence</p><h2 id="cv-screening-title" className="mt-1 font-display text-xl font-bold">AI candidate screening</h2><p className="mt-1 text-[13px] text-white/75">Match one or many CVs against a published role.</p></div></div><button type="button" onClick={close} disabled={loading} aria-label="Close dialog" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20 disabled:opacity-50"><span className="material-symbols-outlined">close</span></button></div>
      </header>
      <form onSubmit={submit} className="space-y-5 px-7 py-6">
        <section className="rounded-2xl border border-primary-container/20 bg-primary/5 p-4"><div className="mb-2 flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-primary">work</span><label htmlFor="screening-job" className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Published job <span className="text-error">*</span></label></div><select id="screening-job" value={jobId} onChange={e => setJobId(e.target.value)} disabled={loadingJobs || loading} className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-[14px] font-medium text-on-surface outline-none transition focus:border-primary-container disabled:opacity-60"><option value="">{loadingJobs ? 'Loading published jobs…' : jobs.length ? 'Select a job to screen against' : 'No open jobs available'}</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}{job.department ? ` — ${job.department}` : ''}</option>)}</select>{selectedJob && <p className="mt-2 flex items-center gap-1.5 text-xs text-on-surface-variant"><span className="material-symbols-outlined text-[15px] text-primary">verified</span>AI will use this job’s required skills and screening criteria.</p>}</section>
        <div className="grid grid-cols-2 rounded-xl bg-surface-container-low p-1">{([['file', 'Upload CVs', 'upload_file'], ['text', 'Paste profile', 'article']] as const).map(([value, label, icon]) => <button key={value} type="button" onClick={() => setMode(value)} disabled={loading} className={`flex items-center justify-center gap-2 rounded-lg py-2.5 font-mono text-[10px] font-bold uppercase tracking-wider transition ${mode === value ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}><span className="material-symbols-outlined text-[16px]">{icon}</span>{label}</button>)}</div>
        {mode === 'file' ? <>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" multiple className="hidden" onChange={e => queueFiles(e.target.files)} />
          <input ref={folderRef} type="file" accept=".pdf,.docx,.doc,.txt" multiple {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} className="hidden" onChange={e => queueFiles(e.target.files)} />
          <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => fileRef.current?.click()} disabled={loading} className="rounded-2xl border-2 border-dashed border-primary-container/45 bg-primary/5 p-5 text-left transition hover:border-primary hover:bg-primary/10 disabled:opacity-60"><span className="material-symbols-outlined mb-3 block text-3xl text-primary">upload_file</span><p className="font-display text-sm font-bold text-on-surface">Choose CV files</p><p className="mt-1 text-xs text-on-surface-variant">Select multiple PDF, DOCX or TXT files.</p></button><button type="button" onClick={() => folderRef.current?.click()} disabled={loading} className="rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low p-5 text-left transition hover:border-primary-container hover:bg-primary/5 disabled:opacity-60"><span className="material-symbols-outlined mb-3 block text-3xl text-on-surface-variant">drive_folder_upload</span><p className="font-display text-sm font-bold text-on-surface">Choose a folder</p><p className="mt-1 text-xs text-on-surface-variant">Every supported CV inside is queued for screening.</p></button></div>
          <section className="rounded-xl border border-outline-variant/60 bg-white"><div className="flex items-center justify-between border-b border-outline-variant/40 px-4 py-3"><p className="font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Screening queue</p><span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">{files.length} CV{files.length === 1 ? '' : 's'}</span></div>{files.length ? <div className="max-h-36 divide-y divide-outline-variant/25 overflow-y-auto">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 px-4 py-2.5"><span className="material-symbols-outlined text-[18px] text-primary">description</span><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium text-on-surface">{nameFromFile(file.name)}</p><p className="truncate font-mono text-[10px] text-on-surface-variant">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p></div><button type="button" onClick={() => setFiles(current => current.filter((_, i) => i !== index))} disabled={loading} aria-label={`Remove ${file.name}`} className="text-on-surface-variant hover:text-error"><span className="material-symbols-outlined text-[18px]">close</span></button></div>)}</div> : <div className="px-4 py-6 text-center"><span className="material-symbols-outlined text-2xl text-outline">folder_open</span><p className="mt-1 text-xs text-on-surface-variant">No CVs in the queue yet.</p></div>}</section>
        </> : <section className="space-y-3"><div><label htmlFor="candidate-name" className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Candidate name <span className="text-error">*</span></label><input id="candidate-name" value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder="e.g. Alex Morgan" className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary-container" /></div><div><label htmlFor="cv-text" className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">CV / profile text <span className="text-error">*</span></label><textarea id="cv-text" value={cvText} onChange={e => setCvText(e.target.value)} rows={7} placeholder="Paste the candidate’s CV, LinkedIn profile, or resume text…" className="w-full resize-none rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-[13px] text-on-surface outline-none transition focus:border-primary-container" /></div></section>}
        {loading && progress.total > 0 && <div className="rounded-xl bg-primary/5 px-4 py-3"><div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-primary"><span>AI screening in progress</span><span>{progress.completed}/{progress.total}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-primary/15"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(progress.completed / progress.total) * 100}%` }} /></div></div>}
        <footer className="flex items-center justify-between gap-4 border-t border-outline-variant/30 pt-5"><p className="max-w-[55%] text-[11px] leading-relaxed text-on-surface-variant">Names are detected from CV file names. Each file is securely processed and scored separately.</p><div className="flex shrink-0 gap-2"><button type="button" onClick={close} disabled={loading} className="rounded-xl border border-outline-variant px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant transition hover:bg-surface-container disabled:opacity-50">Cancel</button><button type="submit" disabled={loading || !jobId || (mode === 'file' && !files.length)} className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary-container to-primary px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_8px_20px_rgba(0,139,123,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"><span className="material-symbols-outlined text-[16px]">{loading ? 'hourglass_empty' : 'auto_awesome'}</span>{loading ? 'Screening…' : mode === 'file' && files.length > 1 ? `Screen ${files.length} CVs` : 'Screen with AI'}</button></div></footer>
      </form>
    </div>
  </div>
}
