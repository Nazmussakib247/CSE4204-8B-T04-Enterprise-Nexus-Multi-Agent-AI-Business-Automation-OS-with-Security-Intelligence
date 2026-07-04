'use client'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ open, title, message, confirmLabel = 'Delete', danger = true, onConfirm, onCancel }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${danger ? 'bg-error-container' : 'bg-surface-container'}`}>
          <span className={`material-symbols-outlined text-[20px] icon-filled ${danger ? 'text-error' : 'text-on-surface-variant'}`}>
            {danger ? 'delete_forever' : 'help'}
          </span>
        </div>
        <div>
          <h2 className="font-display text-[16px] font-semibold text-on-surface">{title}</h2>
          <p className="font-body text-[13px] text-on-surface-variant mt-1">{message}</p>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white transition-colors ${
              danger ? 'bg-error hover:bg-error/90' : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
