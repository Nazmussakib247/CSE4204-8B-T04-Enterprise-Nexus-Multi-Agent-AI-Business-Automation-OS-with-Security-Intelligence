'use client'

import { useEffect, useState } from 'react'
import { reviewsApi } from '@/lib/api'

interface Review { id: string; rating: number; comment: string; sentiment: string; urgency: string; created_at: string; products?: { name: string }; users?: { name: string; email: string } }

export default function FlaggedReviewsPanel({ refreshKey }: { refreshKey: number }) {
  const [reviews, setReviews] = useState<Review[]>([])
  useEffect(() => { reviewsApi.getFlagged().then(res => setReviews(res.data.data ?? [])).catch(() => setReviews([])) }, [refreshKey])
  return <section className="bg-white rounded-2xl border border-error/20 overflow-hidden"><div className="px-6 py-4 border-b border-error/10"><h3 className="font-display text-[15px] font-semibold text-on-surface">Flagged product-review complaints</h3><p className="font-body text-[12px] text-on-surface-variant mt-0.5">Negative or high-urgency reviews detected by AI.</p></div>{!reviews.length ? <p className="p-6 font-body text-[13px] text-on-surface-variant">No flagged product reviews.</p> : <div className="divide-y divide-outline-variant/20">{reviews.map(review => <div key={review.id} className="p-5"><div className="flex justify-between gap-3"><div><p className="font-body text-[13px] font-medium text-on-surface">{review.products?.name ?? 'Product'} · {review.users?.name ?? 'Customer'}</p><p className="font-body text-[13px] text-on-surface mt-1">{review.comment}</p></div><span className="shrink-0 font-mono text-[10px] uppercase text-error">{review.urgency}</span></div><p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant mt-2">{review.sentiment} · {new Date(review.created_at).toLocaleDateString()}</p></div>)}</div>}</section>
}
