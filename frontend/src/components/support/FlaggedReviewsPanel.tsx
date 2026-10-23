'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getApiErrorMessage, reviewsApi } from '@/lib/api'

interface Review { id: string; rating: number; comment: string; sentiment: string; urgency: string; created_at: string; support_reply?: string | null; products?: { name: string }; users?: { name: string; email: string } }

export default function FlaggedReviewsPanel({ refreshKey }: { refreshKey: number }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<string | null>(null)
  useEffect(() => { reviewsApi.getFlagged().then(res => setReviews(res.data.data ?? [])).catch(() => setReviews([])) }, [refreshKey])
  const sendReply = async (review: Review) => {
    const response = (drafts[review.id] || '').trim()
    if (response.length < 3) { toast.error('Write a reply of at least 3 characters'); return }
    setSending(review.id)
    try {
      const { data } = await reviewsApi.reply(review.id, response)
      setReviews(current => current.map(item => item.id === review.id ? data.data : item))
      setDrafts(current => ({ ...current, [review.id]: '' }))
      toast.success('Reply published for the customer')
    } catch (error) { toast.error(getApiErrorMessage(error, 'Could not publish reply')) }
    finally { setSending(null) }
  }
  return <section className="bg-white rounded-2xl border border-error/20 overflow-hidden"><div className="px-6 py-4 border-b border-error/10"><h3 className="font-display text-[15px] font-semibold text-on-surface">Flagged product-review complaints</h3><p className="font-body text-[12px] text-on-surface-variant mt-0.5">Negative or high-urgency reviews detected by AI. Your reply is saved and displayed on the product.</p></div>{!reviews.length ? <p className="p-6 font-body text-[13px] text-on-surface-variant">No flagged product reviews.</p> : <div className="divide-y divide-outline-variant/20">{reviews.map(review => <div key={review.id} className="p-5"><div className="flex justify-between gap-3"><div><p className="font-body text-[13px] font-medium text-on-surface">{review.products?.name ?? 'Product'} · {review.users?.name ?? 'Customer'}</p><p className="font-body text-[13px] text-on-surface mt-1 whitespace-pre-wrap">{review.comment}</p></div><span className="shrink-0 font-mono text-[10px] uppercase text-error">{review.urgency}</span></div><p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant mt-2">{review.sentiment} · {new Date(review.created_at).toLocaleDateString()}</p>{review.support_reply ? <div className="mt-3 rounded-xl bg-primary/5 border border-primary-container/20 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-primary mb-1">Published support reply</p><p className="font-body text-[13px] text-on-surface whitespace-pre-wrap">{review.support_reply}</p></div> : <div className="mt-3"><textarea value={drafts[review.id] || ''} onChange={e => setDrafts(current => ({ ...current, [review.id]: e.target.value }))} rows={2} maxLength={2000} placeholder="Reply to this customer…" className="w-full rounded-xl border border-outline-variant px-3 py-2 font-body text-[13px] resize-none focus:outline-none focus:border-primary-container" /><button onClick={() => sendReply(review)} disabled={sending === review.id} className="mt-2 px-3 py-2 rounded-lg bg-primary text-on-primary font-body text-[12px] disabled:opacity-60">{sending === review.id ? 'Publishing…' : 'Publish reply'}</button></div>}</div>)}</div>}</section>
}
