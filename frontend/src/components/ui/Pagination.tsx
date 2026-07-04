'use client'

interface Props {
  page: number
  total: number
  limit: number
  onPage: (p: number) => void
}

export default function Pagination({ page, total, limit, onPage }: Props) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant/30">
      <span className="font-mono text-[11px] text-on-surface-variant">
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let p: number
          if (totalPages <= 5) p = i + 1
          else if (page <= 3) p = i + 1
          else if (page >= totalPages - 2) p = totalPages - 4 + i
          else p = page - 2 + i
          return (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg font-mono text-[12px] transition-colors ${
                p === page
                  ? 'bg-primary-container/20 text-primary border border-primary-container/50'
                  : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {p}
            </button>
          )
        })}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>
    </div>
  )
}
