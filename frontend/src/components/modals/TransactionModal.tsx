'use client'

import { useState, useEffect } from 'react'
import { financeApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface FinanceRecord {
  id: string; category: string; amount: number; expense_date: string; description: string
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
  const [loading, setLoading] = useState(false)

  // Pre-fill when editing
  useEffect(() => {
    if (editRecord) {
      setCategory(editRecord.category || '')
      setAmount(String(editRecord.amount || ''))
      setExpenseDate(editRecord.expense_date || new Date().toISOString().split('T')[0])
      setDescription(editRecord.description || '')
    } else {
      setCategory('')
      setAmount('')
      setExpenseDate(new Date().toISOString().split('T')[0])
      setDescription('')
    }
  }, [editRecord, open])

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
        await financeApi.updateRecord(editRecord.id, {
          category,
          amount: Number(amount),
          expense_date: expenseDate,
          description,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl border border-outline-variant/50 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
          <div>
            <h2 className="font-display text-[16px] font-semibold text-on-surface">
              {isEdit ? 'Edit Transaction' : 'Add Transaction'}
            </h2>
            <p className="font-mono text-[10px] text-on-surface-variant mt-0.5 uppercase tracking-wider">
              {isEdit ? 'Update record details' : 'AI will detect anomalies automatically'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-surface-container flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">close</span>
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
  )
}
