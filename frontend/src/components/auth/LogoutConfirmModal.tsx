'use client'

import { useEffect, useState } from 'react'

interface LogoutConfirmModalProps {
  open: boolean
  onCancel: () => void
  onConfirm: () => Promise<void> | void
}

export default function LogoutConfirmModal({ open, onCancel, onConfirm }: LogoutConfirmModalProps) {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, busy, onCancel])

  if (!open) return null

  const confirm = async () => {
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false) }
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="logout-dialog-title">
    <button type="button" aria-label="Close logout confirmation" className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm animate-fade-in" onClick={() => !busy && onCancel()} />
    <div className="relative w-full max-w-[390px] overflow-hidden rounded-2xl border border-outline-variant/50 bg-white shadow-2xl animate-modal-in">
      <div className="h-1 bg-gradient-to-r from-primary via-primary-container to-tertiary" />
      <div className="p-6">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><span className="material-symbols-outlined text-[23px]">logout</span></div>
          <div><h2 id="logout-dialog-title" className="font-display text-[19px] font-semibold text-on-surface">Sign out?</h2><p className="mt-1 font-body text-[13px] leading-5 text-on-surface-variant">Your session will end on this device. You can sign in again anytime.</p></div>
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-outline-variant px-4 py-2.5 font-body text-[13px] font-medium text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50">Stay signed in</button>
          <button type="button" disabled={busy} onClick={confirm} className="inline-flex min-w-[92px] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-body text-[13px] font-medium text-on-primary transition-all hover:bg-primary/90 disabled:opacity-60">{busy ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />Signing out…</> : 'Sign out'}</button>
        </div>
      </div>
    </div>
  </div>
}
