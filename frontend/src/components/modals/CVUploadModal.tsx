'use client'

import { useState, useRef } from 'react'
import { hrApi, hrUploadApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

type InputMode = 'file' | 'text'

export default function CVUploadModal({ open, onClose, onCreated }: Props) {
  const [candidateName, setCandidateName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [cvText, setCvText] = useState('')
  const [mode, setMode] = useState<InputMode>('file')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const reset = () => {
    setCandidateName(''); setJobTitle(''); setCvText('')
    setFile(null); setMode('file')
  }

  const handleClose = () => { reset(); onClose() }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    if (!allowed.includes(f.type)) {
      toast.error('Only PDF, DOCX, or TXT files are supported')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10 MB')
      return
    }
    setFile(f)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!candidateName.trim() || !jobTitle.trim()) {
      toast.error('Candidate name and job title are required')
      return
    }

    setLoading(true)
    try {
      if (mode === 'file' && file) {
        const fd = new FormData()
        fd.append('cv', file)
        fd.append('candidate_name', candidateName)
        fd.append('job_title', jobTitle)
        await hrUploadApi.uploadCV(fd)
        toast.success('CV uploaded and screened by Gemini AI!')
      } else {
        await hrApi.createReport({ candidate_name: candidateName, job_title: jobTitle, cv_text: cvText })
        toast.success('CV screened by Gemini AI!')
      }
      reset()
      onCreated()
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to screen CV')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl border border-outline-variant/50 w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
          <div>
            <h2 className="font-display text-[16px] font-semibold text-on-surface">Screen New Candidate</h2>
            <p className="font-mono text-[10px] text-on-surface-variant mt-0.5 uppercase tracking-wider">Gemini AI will score the CV automatically</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-xl hover:bg-surface-container flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">
                Candidate Name <span className="text-error">*</span>
              </label>
              <input value={candidateName} onChange={e => setCandidateName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-[14px] text-on-surface focus:outline-none focus:border-primary-container transition-colors" />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">
                Job Title <span className="text-error">*</span>
              </label>
              <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                placeholder="Senior Engineer"
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-[14px] text-on-surface focus:outline-none focus:border-primary-container transition-colors" />
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['file', 'text'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-xl font-mono text-[10px] uppercase tracking-widest font-bold border transition-all ${
                  mode === m ? 'bg-primary text-white border-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
                }`}>
                {m === 'file' ? 'Upload File' : 'Paste Text'}
              </button>
            ))}
          </div>

          {mode === 'file' ? (
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                file ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary/50 hover:bg-surface-container'
              }`}
            >
              <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={handleFileChange} />
              <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2 block">
                {file ? 'check_circle' : 'upload_file'}
              </span>
              {file ? (
                <div>
                  <p className="font-mono text-[11px] font-bold text-primary">{file.name}</p>
                  <p className="font-mono text-[10px] text-on-surface-variant mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="font-mono text-[11px] text-on-surface-variant">Click to select PDF or DOCX</p>
                  <p className="font-mono text-[10px] text-on-surface-variant/60 mt-1">Max 10 MB</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">
                CV / Profile Text
              </label>
              <textarea value={cvText} onChange={e => setCvText(e.target.value)} rows={7}
                placeholder="Paste the candidate's CV, LinkedIn bio, or resume text here..."
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-[13px] text-on-surface focus:outline-none focus:border-primary-container transition-colors resize-none font-body" />
            </div>
          )}

          {/* AI banner */}
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-[18px] text-primary icon-filled">psychology</span>
            <p className="font-mono text-[10px] text-primary uppercase tracking-wider">
              Gemini AI generates score, confidence &amp; recommendation automatically
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={handleClose}
              className="font-mono text-[10px] uppercase tracking-wider px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading || (mode === 'file' && !file)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)', boxShadow: '0 4px 14px rgba(0,194,168,0.3)' }}>
              <span className="material-symbols-outlined text-[16px]">{loading ? 'hourglass_empty' : 'psychology'}</span>
              {loading ? 'Processing...' : 'Screen with AI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
