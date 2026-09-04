'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { addMockJob, type RequiredSkill } from '@/lib/mockJobs'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function PostJobModal({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [description, setDescription] = useState('')
  const [screeningCriteria, setScreeningCriteria] = useState('')
  const [skills, setSkills] = useState<RequiredSkill[]>([{ skill: '', weight: 100 }])
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const totalWeight = skills.reduce((sum, s) => sum + (Number(s.weight) || 0), 0)
  const weightOk = totalWeight === 100

  const reset = () => {
    setTitle(''); setDepartment(''); setDescription(''); setScreeningCriteria('')
    setSkills([{ skill: '', weight: 100 }])
  }
  const handleClose = () => { reset(); onClose() }

  const updateSkill = (i: number, field: 'skill' | 'weight', value: string) => {
    setSkills(prev => prev.map((s, idx) => idx === i
      ? { ...s, [field]: field === 'weight' ? Math.max(0, Math.min(100, Number(value) || 0)) : value }
      : s))
  }
  const addSkillRow = () => setSkills(prev => [...prev, { skill: '', weight: 0 }])
  const removeSkillRow = (i: number) => setSkills(prev => prev.filter((_, idx) => idx !== i))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !screeningCriteria.trim()) {
      toast.error('Title, description and screening criteria are required')
      return
    }
    const cleanSkills = skills.filter(s => s.skill.trim())
    if (cleanSkills.length === 0) {
      toast.error('Add at least one required skill')
      return
    }
    if (!weightOk) {
      toast.error(`Skill weights must add up to 100 (currently ${totalWeight})`)
      return
    }

    setLoading(true)
    addMockJob({
      title: title.trim(),
      department: department.trim(),
      description: description.trim(),
      screeningCriteria: screeningCriteria.trim(),
      requiredSkills: cleanSkills,
    })
    toast.success('Job posted — now live on the careers page')
    setLoading(false)
    reset()
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl border border-outline-variant/50 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
          <div>
            <h2 className="font-display text-[16px] font-semibold text-on-surface">Post a Job</h2>
            <p className="font-mono text-[10px] text-on-surface-variant mt-0.5 uppercase tracking-wider">Goes live on the public careers page instantly</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-xl hover:bg-surface-container flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">
                Job Title <span className="text-error">*</span>
              </label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Senior Backend Engineer"
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-[14px] text-on-surface focus:outline-none focus:border-primary-container transition-colors" />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">Department</label>
              <input value={department} onChange={e => setDepartment(e.target.value)}
                placeholder="Engineering"
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-[14px] text-on-surface focus:outline-none focus:border-primary-container transition-colors" />
            </div>
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">
              Description <span className="text-error">*</span>
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="What this role owns, day to day..."
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-[13px] text-on-surface focus:outline-none focus:border-primary-container transition-colors resize-none font-body" />
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">
              Screening Criteria <span className="text-error">*</span>
            </label>
            <textarea value={screeningCriteria} onChange={e => setScreeningCriteria(e.target.value)} rows={2}
              placeholder="What the AI should look for when scoring CVs against this role..."
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-[13px] text-on-surface focus:outline-none focus:border-primary-container transition-colors resize-none font-body" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                Required Skills &amp; Weights <span className="text-error">*</span>
              </label>
              <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${weightOk ? 'bg-primary/10 text-primary' : 'bg-error-container text-on-error-container'}`}>
                {totalWeight}/100
              </span>
            </div>
            <div className="space-y-2">
              {skills.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={s.skill} onChange={e => updateSkill(i, 'skill', e.target.value)}
                    placeholder="e.g. React"
                    className="flex-1 px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-[13px] text-on-surface focus:outline-none focus:border-primary-container transition-colors" />
                  <input type="number" min={0} max={100} value={s.weight}
                    onChange={e => updateSkill(i, 'weight', e.target.value)}
                    className="w-16 px-2 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-[13px] text-on-surface text-center focus:outline-none focus:border-primary-container transition-colors" />
                  <span className="font-mono text-[11px] text-on-surface-variant">%</span>
                  <button type="button" onClick={() => removeSkillRow(i)} disabled={skills.length === 1}
                    className="w-7 h-7 rounded-lg hover:bg-surface-container flex items-center justify-center transition-colors disabled:opacity-30">
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">close</span>
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addSkillRow}
              className="mt-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-primary hover:text-primary/80 transition-colors">
              <span className="material-symbols-outlined text-[14px]">add</span> Add skill
            </button>
          </div>

          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-[18px] text-primary icon-filled">psychology</span>
            <p className="font-mono text-[10px] text-primary uppercase tracking-wider">
              AI scores each applicant per skill, then computes a weighted total
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={handleClose}
              className="font-mono text-[10px] uppercase tracking-wider px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)', boxShadow: '0 4px 14px rgba(0,194,168,0.3)' }}>
              <span className="material-symbols-outlined text-[16px]">{loading ? 'hourglass_empty' : 'work'}</span>
              {loading ? 'Posting...' : 'Post Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
