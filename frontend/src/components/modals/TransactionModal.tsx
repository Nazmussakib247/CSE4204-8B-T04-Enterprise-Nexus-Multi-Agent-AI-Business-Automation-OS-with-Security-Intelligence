'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { financeApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface FinanceRecord {
  id: string; category: string; amount: number; expense_date: string; description: string
  severity?: string; is_anomaly?: boolean; ai_analysis?: string
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  editRecord?: FinanceRecord | null
}

const CATEGORIES = ['Payroll', 'Operations', 'Marketing', 'IT & Software', 'Travel', 'Office Supplies', 'Utilities', 'Legal', 'Other']

export default function TransactionModal({ open, onClose, onCreated, editRecord }: Props) {
  const isEdit = !!editRecord

  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [reviewDecision, setReviewDecision] = useState<'confirmed' | 'cleared'>('confirmed')
  const [reviewNote, setReviewNote] = useState('')
  const [loading, setLoading] = useState(false)

  // Pre-fill when editing
  useEffect(() => {
    if (editRecord) {
      setCategory(editRecord.category || '')
      setAmount(String(editRecord.amount || ''))
      setExpenseDate(editRecord.expense_date || new Date().toISOString().split('T')[0])
      setDescription(editRecord.description || '')
      setReviewDecision(editRecord.is_anomaly === false || editRecord.severity !== 'high' ? 'cleared' : 'confirmed')
      setReviewNote('')
    } else {
      setCategory('')
      setAmount('')
      setExpenseDate(new Date().toISOString().split('T')[0])
      setDescription('')
      setReviewDecision('confirmed')
      setReviewNote('')
    }
  }, [editRecord, open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !loading) onClose() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, loading, onClose])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category || !amount || !expenseDate) {
      toast.error('Category, amount, and date are required')
      return
    }
    setLoading(true)
    try {
      if (isEdit && editRecord) {
        const isHighAnomaly = editRecord.severity === 'high' || editRecord.is_anomaly === true
        const reviewUpdate = isHighAnomaly ? {
          severity: reviewDecision === 'cleared' ? 'low' : 'high',
          is_anomaly: reviewDecision === 'confirmed',
          ...(reviewNote.trim() ? { ai_analysis: `${editRecord.ai_analysis || ''}\n\nHuman review: ${reviewNote.trim()}`.trim() } : {}),
        } : {}
        await financeApi.updateRecord(editRecord.id, {
          category,
          amount: Number(amount),
          expense_date: expenseDate,
          description,
          ...reviewUpdate,
        })
        toast.success('Transaction updated')
      } else {
        await financeApi.createRecord({ category, amount: Number(amount), expense_date: expenseDate, description })
        toast.success('Transaction added — Gemini analysed for anomalies')
      }
      onCreated()
      onClose()
    } catch {
      toast.error(isEdit ? 'Failed to update transaction' : 'Failed to add transaction')
    } finally {
      setLoading(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal((
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title">
      <div className="modal-backdrop" onClick={onClose} />

      <div className="modal-panel max-w-md">
        <div className="flex items-center justify-between gap-4 bg-gradient-to-br from-[#123b4a] via-[#126b71] to-[#00a892] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <span className="material-symbols-outlined text-[21px] icon-filled">payments</span>
            </div>
            <div>
            <h2 id="transaction-modal-title" className="font-display text-[17px] font-semibold">
              {isEdit ? 'Edit Transaction' : 'Add Transaction'}
            </h2>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-white/70">
              {isEdit ? 'Update record details' : 'AI will detect anomalies automatically'}
            </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close transaction dialog" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20">
            <span className="material-symbols-outlined text-[19px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">
              Category <span className="text-error">*</span>
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-[14px] text-on-surface focus:outline-none focus:border-primary-container transition-colors"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {isEdit && (editRecord?.severity === 'high' || editRecord?.is_anomaly === true) && (
            <div className="rounded-xl border border-error/20 bg-error-container/30 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-error text-[18px] icon-filled">fact_check</span>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-error">Human review required</p>
                  <p className="text-[12px] text-on-surface-variant mt-1">Confirm the anomaly or clear it as a false positive.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setReviewDecision('confirmed')} className={`rounded-lg border px-3 py-2 text-[11px] font-medium ${reviewDecision === 'confirmed' ? 'border-error bg-error/10 text-error' : 'border-outline-variant text-on-surface-variant'}`}>Keep anomaly</button>
                <button type="button" onClick={() => setReviewDecision('cleared')} className={`rounded-lg border px-3 py-2 text-[11px] font-medium ${reviewDecision === 'cleared' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant'}`}>Clear as reviewed</button>
              </div>
              <input value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Optional review note" className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-white text-[12px] text-on-surface focus:outline-none focus:border-primary-container" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">
                Amount ($) <span className="text-error">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-[14px] text-on-surface focus:outline-none focus:border-primary-container transition-colors"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">
                Date <span className="text-error">*</span>
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-[14px] text-on-surface focus:outline-none focus:border-primary-container transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">
              Description <span className="text-on-surface-variant/50 normal-case">(optional)</span>
            </label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief note about this transaction"
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-[14px] text-on-surface focus:outline-none focus:border-primary-container transition-colors"
            />
          </div>

          {!isEdit && (
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-[18px] text-primary icon-filled">analytics</span>
              <p className="font-mono text-[10px] text-primary uppercase tracking-wider">
                Gemini AI will detect anomalies and assign severity
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="font-mono text-[10px] uppercase tracking-wider px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-all">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)', boxShadow: '0 4px 14px rgba(0,194,168,0.3)' }}
            >
              <span className="material-symbols-outlined text-[16px]">
                {loading ? 'hourglass_empty' : isEdit ? 'save' : 'add'}
              </span>
              {loading ? (isEdit ? 'Saving...' : 'Analysing...') : isEdit ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ), document.body)
}
