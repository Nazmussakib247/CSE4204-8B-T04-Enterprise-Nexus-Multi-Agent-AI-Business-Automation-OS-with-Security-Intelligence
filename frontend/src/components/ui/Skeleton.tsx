export function SkeletonLine({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-surface-container rounded-lg animate-pulse`} />
}

export function SkeletonTableRows({ cols = 5, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-outline-variant/20">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-5 py-4">
              <div className={`h-4 bg-surface-container rounded-lg animate-pulse ${j === 0 ? 'w-3/4' : 'w-1/2'}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-outline-variant/50 space-y-3">
          <div className="w-9 h-9 bg-surface-container rounded-xl animate-pulse" />
          <div className="h-8 w-16 bg-surface-container rounded-lg animate-pulse" />
          <div className="h-3 w-24 bg-surface-container rounded-lg animate-pulse" />
        </div>
      ))}
    </>
  )
}

export function SkeletonTicketRows({ rows = 4 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-6 py-4 border-b border-outline-variant/20 space-y-2">
          <div className="flex gap-3">
            <div className="h-4 flex-1 bg-surface-container rounded-lg animate-pulse" />
            <div className="h-5 w-14 bg-surface-container rounded-full animate-pulse" />
            <div className="h-5 w-14 bg-surface-container rounded-full animate-pulse" />
          </div>
          <div className="h-3 w-2/3 bg-surface-container rounded-lg animate-pulse" />
          <div className="h-3 w-24 bg-surface-container rounded-lg animate-pulse" />
        </div>
      ))}
    </>
  )
}
