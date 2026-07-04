'use client'

import { useState, useRef } from 'react'
import { financeApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

type Mode = 'invoice' | 'bulk'

const INVOICE_EXT = '.pdf'
const BULK_EXT = '.csv,.xls,.xlsx'

export default function FinanceUploadModal({ open, onClose, onCreated }: Props) {
  const [mode, setMode] = useState<Mode>('invoice')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const reset = () => { setFile(null); setResult(null) }
  const handleClose = () => { reset(); setMode('invoice'); onClose() }

  const switchMode = (m: Mode) => { setMode(m); setFile(null); setResult(null) }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 10 * 1024 * 1024) { toast.error('File must be under 10 MB'); return }
    setFile(f); setResult(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { toast.error('Please choose a file'); return }

    setLoading(true)
    setResult(null)
    try {
      const fd = new FormData()
      if (mode === 'invoice') {
        fd.append('invoice', file)
        const res = await financeApi.uploadInvoice(fd)
        const p = res.data?.parsed
        toast.success('Invoice parsed and recorded!')
        setResult(p ? `Recorded ${p.category} — $${Number(p.amount).toLocaleString()} (${p.expense_date})` : 'Invoice recorded.')
      } else {
        fd.append('file', file)
        const res = await financeApi.bulkUpload(fd)
        const { inserted_count = 0, failed_count = 0 } = res.data || {}
        toast.success(`Imported ${inserted_count} expense${inserted_count === 1 ? '' : 's'}`)
        setResult(`Imported ${inserted_count} row${inserted_count === 1 ? '' : 's'}` + (failed_count ? `, ${failed_count} skipped (check columns: category, amount, date).` : '.'))
      }
      onCreated()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Upload failed')
      setResult(err?.response?.data?.error || 'Upload failed. Please try again.')
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
            <h2 className="font-display text-[16px] font-semibold text-on-surface">Import Expenses</h2>
            <p className="font-mono text-[10px] text-on-surface-variant mt-0.5 uppercase tracking-wider">Gemini AI extracts and analyses each expense</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-xl hover:bg-surface-container flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['invoice', 'bulk'] as const).map(m => (
              <button key={m} type="button" onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-xl font-mono text-[10px] uppercase tracking-widest font-bold border transition-all ${
                  mode === m ? 'bg-primary text-white border-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
                }`}>
                {m === 'invoice' ? 'PDF Invoice' : 'CSV / Excel'}
              </button>
            ))}
          </div>

          {/* Dropzone */}
          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              file ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary/50 hover:bg-surface-container'
            }`}
          >
            <input ref={fileRef} type="file" accept={mode === 'invoice' ? INVOICE_EXT : BULK_EXT} className="hidden" onChange={handleFileChange} />
            <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2 block">
              {file ? 'check_circle' : mode === 'invoice' ? 'receipt_long' : 'table_view'}
            </span>
            {file ? (
              <div>
                <p className="font-mono text-[11px] font-bold text-primary">{file.name}</p>
                <p className="font-mono text-[10px] text-on-surface-variant mt-1">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-mono text-[11px] text-on-surface-variant">
                  {mode === 'invoice' ? 'Click to select a PDF invoice or receipt' : 'Click to select a CSV or Excel file'}
                </p>
                <p className="font-mono text-[10px] text-on-surface-variant/60 mt-1">
                  {mode === 'invoice' ? 'Max 10 MB' : 'Columns: category, amount, date, description'}
                </p>
              </div>
            )}
          </div>

          {/* AI banner */}
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-[18px] text-primary icon-filled">psychology</span>
            <p className="font-mono text-[10px] text-primary uppercase tracking-wider">
              {mode === 'invoice'
                ? 'Gemini reads the invoice and extracts amount, category & date'
                : 'Each row is analysed for anomalies automatically'}
            </p>
          </div>

          {result && (
            <div className="bg-surface-container rounded-xl px-4 py-3 font-body text-[12px] text-on-surface">{result}</div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={handleClose}
              className="font-mono text-[10px] uppercase tracking-wider px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-all">
              Close
            </button>
            <button type="submit" disabled={loading || !file}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)', boxShadow: '0 4px 14px rgba(0,194,168,0.3)' }}>
              <span className="material-symbols-outlined text-[16px]">{loading ? 'hourglass_empty' : 'upload'}</span>
              {loading ? 'Processing...' : mode === 'invoice' ? 'Parse Invoice' : 'Import File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
