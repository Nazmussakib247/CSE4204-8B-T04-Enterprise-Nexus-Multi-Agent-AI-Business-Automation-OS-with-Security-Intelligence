'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getApiErrorMessage, reviewsApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'

interface ReviewMessage { id: string; sender_id?: string | null; sender_type: 'customer' | 'staff' | 'ai'; body: string; created_at: string }
interface Review { id: string; customer_id: string; rating: number; comment: string; sentiment: string | null; urgency: string | null; ai_status?: 'completed' | 'pending'; support_reply?: string | null; support_replied_at?: string | null; created_at: string; users?: { name: string }; product_review_messages?: ReviewMessage[] }

const stars = [1, 2, 3, 4, 5]

export default function ReviewsSection({ productId }: { productId: string }) {
  const { user, loading: authLoading } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [reply, setReply] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [replying, setReplying] = useState<string | null>(null)
  const load = useCallback(() => { reviewsApi.getForProduct(productId).then(res => setReviews(res.data.data ?? [])).catch(() => setReviews([])) }, [productId])
  useEffect(() => { load() }, [load])

  const ownReview = user?.role === 'customer' ? reviews.find(review => review.customer_id === user.id) : undefined
  useEffect(() => { if (ownReview) { setRating(ownReview.rating); setComment(ownReview.comment) } }, [ownReview?.id])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!comment.trim()) return; setSubmitting(true)
    try {
      const res = ownReview ? await reviewsApi.update(ownReview.id, { rating, comment: comment.trim() }) : await reviewsApi.create({ product_id: productId, rating, comment: comment.trim() })
      toast.success(res.data.message); await load()
      if (!ownReview) { setComment(''); setRating(5) }
    } catch (err) { toast.error(getApiErrorMessage(err, 'Could not save your review')) } finally { setSubmitting(false) }
  }

  const submitReply = async (event: React.FormEvent, reviewId: string) => {
    event.preventDefault(); const body = reply[reviewId]?.trim(); if (!body) return; setReplying(reviewId)
    try { await reviewsApi.replyAsCustomer(reviewId, body); setReply(current => ({ ...current, [reviewId]: '' })); toast.success('Reply sent to support'); await load() }
    catch (err) { toast.error(getApiErrorMessage(err, 'Could not send reply')) } finally { setReplying(null) }
  }

  return <div className="mt-14 pt-10 border-t border-outline-variant/50">
    <h2 className="font-display text-[18px] font-semibold text-on-surface mb-4">Reviews</h2>
    {authLoading ? <div className="h-28 bg-surface-container-low rounded-2xl animate-pulse mb-4" /> : !user ? <div className="bg-white rounded-2xl border border-outline-variant/50 p-5 mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="font-body text-[14px] font-medium text-on-surface">Share your experience</p><p className="font-body text-[12px] text-on-surface-variant mt-0.5">Sign in with your customer account to leave a review.</p></div><Link href="/store/login" className="px-4 py-2.5 rounded-xl bg-primary text-on-primary font-body text-[13px]">Sign in</Link></div> : user.role !== 'customer' ? <div className="bg-surface-container-low rounded-2xl p-5 mb-4 font-body text-[13px] text-on-surface-variant">Reviews can be submitted from a customer account.</div> : <form onSubmit={submit} className="bg-white rounded-2xl border border-outline-variant/50 p-5 mb-4">
      <div className="flex items-center gap-3 mb-3"><label className="font-body text-[13px] text-on-surface">{ownReview ? 'Update your rating' : 'Your rating'}</label><div className="flex items-center" onMouseLeave={() => setHoverRating(0)}>{stars.map(value => <button type="button" key={value} aria-label={`${value} star${value > 1 ? 's' : ''}`} onMouseEnter={() => setHoverRating(value)} onClick={() => setRating(value)} className="text-2xl leading-none px-0.5 text-primary">{value <= (hoverRating || rating) ? '★' : '☆'}</button>)}</div><span className="font-mono text-[11px] text-on-surface-variant">{rating}/5</span></div>
      {ownReview && <p className="font-body text-[12px] text-on-surface-variant mb-2">You can keep one review per product and edit it any time.</p>}
      <textarea required value={comment} onChange={e => setComment(e.target.value)} maxLength={2000} rows={3} placeholder="Share your experience with this product…" className="w-full px-3 py-2.5 rounded-xl border border-outline-variant text-[13px] resize-none" />
      <button disabled={submitting} className="mt-3 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-body text-[13px] disabled:opacity-60">{submitting ? 'Saving…' : ownReview ? 'Update review' : 'Submit review'}</button>
    </form>}
    {!reviews.length ? <div className="bg-white rounded-2xl border border-outline-variant/50 p-10 flex flex-col items-center text-center"><span className="material-symbols-outlined text-[36px] text-on-surface-variant/40 mb-2">rate_review</span><p className="font-body text-[14px] text-on-surface-variant">No reviews yet</p></div> : <div className="space-y-3">{reviews.map(review => {
      const messages = review.product_review_messages?.length ? review.product_review_messages : review.support_reply ? [{ id: `legacy-${review.id}`, sender_type: 'staff' as const, body: review.support_reply, created_at: review.support_replied_at || review.created_at }] : []
      const canReply = user?.role === 'customer' && user.id === review.customer_id && messages.some(message => message.sender_type === 'staff' || message.sender_type === 'ai')
      return <article key={review.id} className="bg-white rounded-2xl border border-outline-variant/50 p-5"><div className="flex items-center justify-between gap-3"><p className="font-body text-[13px] font-medium text-on-surface">{review.users?.name ?? 'Customer'}</p><span className="font-mono text-[18px] tracking-tight text-primary" aria-label={`${review.rating} out of 5 stars`}>{stars.map(value => <span key={value}>{value <= review.rating ? '★' : '☆'}</span>)}</span></div><p className="font-body text-[14px] text-on-surface mt-2 whitespace-pre-wrap">{review.comment}</p><p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant mt-3">{review.ai_status === 'pending' ? 'AI analysis pending' : `${review.sentiment || 'unclassified'} · ${new Date(review.created_at).toLocaleDateString()}`}</p>
        {messages.length > 0 && <div className="mt-4 space-y-2 border-l-2 border-primary/20 pl-3">{messages.map(message => <div key={message.id} className="rounded-xl border border-outline-variant/50 bg-surface-container-low/40 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-primary mb-1">{message.sender_type === 'ai' ? 'Support assistant' : message.sender_type === 'staff' ? 'Support team' : 'You'}</p><p className="font-body text-[13px] text-on-surface whitespace-pre-wrap">{message.body}</p></div>)}</div>}
        {canReply && <form onSubmit={event => submitReply(event, review.id)} className="mt-3 flex gap-2"><input value={reply[review.id] || ''} onChange={event => setReply(current => ({ ...current, [review.id]: event.target.value }))} maxLength={2000} placeholder="Reply to support…" className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-outline-variant text-[13px]" /><button disabled={replying === review.id} className="px-3 py-2 rounded-xl bg-primary text-on-primary text-[13px] disabled:opacity-60">{replying === review.id ? 'Sending…' : 'Reply'}</button></form>}
      </article>
    })}</div>}
  </div>
}
