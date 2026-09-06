'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/auth'
import { ordersApi, supportApi, getApiErrorMessage } from '@/lib/api'

interface OrderOption {
  id: string
  products?: { name: string }
}
interface CustomerTicket { id: string; query: string; status: string; ai_response?: string | null; human_response?: string | null; created_at: string }

function CustomerSupportContent() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [orderId, setOrderId] = useState(searchParams.get('order_id') || '')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ai_response: string; sentiment: string; urgency: string } | null>(null)
  const [tickets, setTickets] = useState<CustomerTicket[]>([])

  useEffect(() => {
    if (!user) { setTickets([]); return }
    ordersApi.getAll().then(r => setOrders(r.data.data ?? [])).catch(() => {})
    supportApi.getTickets({ limit: 20 }).then(r => setTickets(r.data.data ?? [])).catch(() => setTickets([]))
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) { toast.error('Describe your issue first'); return }
    setLoading(true)
    try {
      const { data } = await supportApi.createTicket({ query: message, order_id: orderId || undefined })
      setResult(data.ai_analysis || null)
      setTickets(current => [data.data as CustomerTicket, ...current])
      setMessage('')
      toast.success('Ticket submitted')
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not submit ticket'))
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return null

  if (!user) {
    return (
      <div className="max-w-[500px] mx-auto px-6 py-20 text-center">
        <span className="material-symbols-outlined text-[36px] text-on-surface-variant/40 mb-2">lock</span>
        <p className="font-body text-[15px] text-on-surface">Sign in to contact support</p>
        <Link href="/store/login" className="inline-block mt-4 h-11 px-6 leading-[44px] rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium">
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-[560px] mx-auto px-6 py-12">
      <h1 className="font-display text-display-lg text-on-surface mb-1">Contact support</h1>
      <p className="font-body text-[14px] text-on-surface-variant mb-8">Our AI reads every message — mention an order for faster, order-aware help.</p>

      {result && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-6">
          <p className="font-mono text-[10px] uppercase tracking-wider text-primary mb-1.5">AI reply</p>
          <p className="font-body text-[14px] text-on-surface">{result.ai_response}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-outline-variant/50 p-6">
        {orders.length > 0 && (
          <div className="mb-4">
            <label className="block font-mono text-[11px] uppercase tracking-wide text-on-surface-variant mb-1.5">Related order (optional)</label>
            <select
              value={orderId}
              onChange={e => setOrderId(e.target.value)}
              className="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 font-body text-[14px] text-on-surface focus:outline-none focus:border-primary-container"
            >
              <option value="">No specific order</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.products?.name || 'Product'} — #{o.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-5">
          <label className="block font-mono text-[11px] uppercase tracking-wide text-on-surface-variant mb-1.5">Describe your issue</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            placeholder="What's going on?"
            className="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 font-body text-[14px] text-on-surface resize-none focus:outline-none focus:border-primary-container"
          />
        </div>

        <button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
          {loading ? 'Analysing...' : 'Submit'}
        </button>
      </form>
      <section className="mt-8">
        <h2 className="font-display text-[18px] font-semibold text-on-surface mb-3">Your support requests</h2>
        {!tickets.length ? <p className="font-body text-[13px] text-on-surface-variant">No support requests yet.</p> : <div className="space-y-3">{tickets.map(ticket => <article key={ticket.id} className="bg-white rounded-2xl border border-outline-variant/50 p-5"><div className="flex items-center justify-between gap-3"><p className="font-body text-[14px] text-on-surface line-clamp-1">{ticket.query}</p><span className="font-mono text-[10px] uppercase tracking-wider text-primary">{ticket.status}</span></div>{ticket.ai_response && <p className="mt-3 font-body text-[13px] text-on-surface-variant"><span className="font-medium text-on-surface">AI: </span>{ticket.ai_response}</p>}{ticket.human_response && <div className="mt-3 rounded-xl bg-primary/5 border border-primary-container/20 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-primary mb-1">Support team reply</p><p className="font-body text-[13px] text-on-surface whitespace-pre-wrap">{ticket.human_response}</p></div>}</article>)}</div>}
      </section>
    </div>
  )
}

export default function CustomerSupportPage() {
  return (
    <Suspense fallback={<div className="max-w-[560px] mx-auto px-6 py-12 font-body text-[14px] text-on-surface-variant">Loading support form…</div>}>
      <CustomerSupportContent />
    </Suspense>
  )
}
