'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getApiErrorMessage, reviewsApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'

interface Review { id: string; rating: number; comment: string; sentiment: string | null; urgency: string | null; ai_status?: 'completed' | 'pending'; support_reply?: string | null; support_replied_at?: string | null; created_at: string; users?: { name: string } }

export default function ReviewsSection({ productId }: { productId: string }) {
  const { user, loading: authLoading } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const load = useCallback(() => {
    reviewsApi.getForProduct(productId).then(res => setReviews(res.data.data ?? [])).catch(() => setReviews([]))
  }, [productId])
  useEffect(() => { load() }, [load])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      const res = await reviewsApi.create({ product_id: productId, rating, comment: comment.trim() })
      toast.success(res.data.message)
      setReviews(current => [res.data.data as Review, ...current])
      setComment(''); setRating(5)
    } catch (err) { toast.error(getApiErrorMessage(err, 'Sign in with a customer account to leave a review')) }
    finally { setSubmitting(false) }
  }

  return <div className="mt-14 pt-10 border-t border-outline-variant/50">
    <h2 className="font-display text-[18px] font-semibold text-on-surface mb-4">Reviews</h2>
    {authLoading ? <div className="h-28 bg-surface-container-low rounded-2xl animate-pulse mb-4" /> : !user ? <div className="bg-white rounded-2xl border border-outline-variant/50 p-5 mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="font-body text-[14px] font-medium text-on-surface">Share your experience</p><p className="font-body text-[12px] text-on-surface-variant mt-0.5">Sign in with your customer account to leave a review.</p></div><Link href="/store/login" className="px-4 py-2.5 rounded-xl bg-primary text-on-primary font-body text-[13px]">Sign in</Link></div> : user.role !== 'customer' ? <div className="bg-surface-container-low rounded-2xl p-5 mb-4 font-body text-[13px] text-on-surface-variant">Reviews can be submitted from a customer account.</div> : <form onSubmit={submit} className="bg-white rounded-2xl border border-outline-variant/50 p-5 mb-4">
      <div className="flex items-center gap-3 mb-3"><label className="font-body text-[13px] text-on-surface">Your rating</label><select value={rating} onChange={e => setRating(Number(e.target.value))} className="px-3 py-2 rounded-lg border border-outline-variant text-[13px]">{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>)}</select></div>
      <textarea required value={comment} onChange={e => setComment(e.target.value)} maxLength={2000} rows={3} placeholder="Share your experience with this product…" className="w-full px-3 py-2.5 rounded-xl border border-outline-variant text-[13px] resize-none" />
      <button disabled={submitting} className="mt-3 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-body text-[13px] disabled:opacity-60">{submitting ? 'Submitting…' : 'Submit review'}</button>
    </form>}
    {!reviews.length ? <div className="bg-white rounded-2xl border border-outline-variant/50 p-10 flex flex-col items-center text-center"><span className="material-symbols-outlined text-[36px] text-on-surface-variant/40 mb-2">rate_review</span><p className="font-body text-[14px] text-on-surface-variant">No reviews yet</p></div> : <div className="space-y-3">{reviews.map(review => <article key={review.id} className="bg-white rounded-2xl border border-outline-variant/50 p-5"><div className="flex items-center justify-between gap-3"><p className="font-body text-[13px] font-medium text-on-surface">{review.users?.name ?? 'Customer'}</p><span className="font-mono text-[11px] text-primary">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div><p className="font-body text-[14px] text-on-surface mt-2 whitespace-pre-wrap">{review.comment}</p><p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant mt-3">{review.ai_status === 'pending' ? 'AI analysis pending' : `${review.sentiment || 'unclassified'} · ${new Date(review.created_at).toLocaleDateString()}`}</p>{review.support_reply && <div className="mt-4 rounded-xl border border-primary-container/20 bg-primary/5 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-primary mb-1">Support reply</p><p className="font-body text-[13px] text-on-surface whitespace-pre-wrap">{review.support_reply}</p></div>}</article>)}</div>}
  </div>
}
