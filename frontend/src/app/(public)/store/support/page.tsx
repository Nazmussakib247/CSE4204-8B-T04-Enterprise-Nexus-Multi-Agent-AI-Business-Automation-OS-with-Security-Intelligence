'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/auth'
import { ordersApi, supportApi, getApiErrorMessage } from '@/lib/api'

interface OrderOption { id: string; products?: { name: string } }
interface SupportMessage { id: string; sender_type: 'customer' | 'staff' | 'ai'; body: string; created_at: string }
interface CustomerTicket { id: string; query: string; status: string; human_response?: string | null; created_at: string; support_messages?: SupportMessage[] }

const statusLabel: Record<string, string> = {
  open: 'Awaiting support', in_progress: 'Support is working on it', escalated: 'Priority support', resolved: 'Resolved',
}

function CustomerSupportContent() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [orderId, setOrderId] = useState(searchParams.get('order_id') || '')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tickets, setTickets] = useState<CustomerTicket[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [sendingTicketId, setSendingTicketId] = useState<string | null>(null)

  const loadTickets = useCallback(async () => {
    if (!user) { setTickets([]); return }
    try {
      const response = await supportApi.getTickets({ limit: 20 })
      setTickets(response.data.data ?? [])
    } catch { setTickets([]) }
  }, [user])

  useEffect(() => {
    if (!user) { setTickets([]); return }
    ordersApi.getAll().then(r => setOrders(r.data.data ?? [])).catch(() => {})
    loadTickets()
    const interval = window.setInterval(loadTickets, 20_000)
    return () => window.clearInterval(interval)
  }, [user, loadTickets])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) { toast.error('Describe your issue first'); return }
    setSubmitting(true)
    try {
      const { data } = await supportApi.createTicket({ query: message.trim(), order_id: orderId || undefined })
      setTickets(current => [data.data as CustomerTicket, ...current])
      setMessage('')
      setOrderId('')
      toast.success('Request sent — our support team will reply here.')
    } catch (err) { toast.error(getApiErrorMessage(err, 'Could not send request')) } finally { setSubmitting(false) }
  }

  const sendFollowUp = async (ticketId: string) => {
    const body = drafts[ticketId]?.trim()
    if (!body) { toast.error('Write a message first'); return }
    setSendingTicketId(ticketId)
    try {
      const { data } = await supportApi.createMessage(ticketId, body)
      setTickets(current => current.map(ticket => ticket.id === ticketId ? {
        ...ticket, status: 'open', support_messages: [...(ticket.support_messages ?? []), data.data as SupportMessage],
      } : ticket))
      setDrafts(current => ({ ...current, [ticketId]: '' }))
      toast.success('Follow-up sent to support')
    } catch (err) { toast.error(getApiErrorMessage(err, 'Could not send message')) } finally { setSendingTicketId(null) }
  }

  if (authLoading) return null
  if (!user) return <div className="max-w-[500px] mx-auto px-6 py-20 text-center">
    <span className="material-symbols-outlined text-[36px] text-on-surface-variant/40 mb-2">lock</span>
    <p className="font-body text-[15px] text-on-surface">Sign in to contact support</p>
    <Link href="/store/login" className="inline-block mt-4 h-11 px-6 leading-[44px] rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium">Sign in</Link>
  </div>

  return <div className="max-w-[560px] mx-auto px-6 py-12">
    <h1 className="font-display text-display-lg text-on-surface mb-1">Contact support</h1>
    <p className="font-body text-[14px] text-on-surface-variant mb-8">Send us a message and continue the conversation here. Add an order for faster, order-aware help.</p>
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-outline-variant/50 p-6">
      {orders.length > 0 && <div className="mb-4">
        <label className="block font-mono text-[11px] uppercase tracking-wide text-on-surface-variant mb-1.5">Related order (optional)</label>
        <select value={orderId} onChange={e => setOrderId(e.target.value)} className="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 font-body text-[14px] text-on-surface focus:outline-none focus:border-primary-container">
          <option value="">No specific order</option>
          {orders.map(o => <option key={o.id} value={o.id}>{o.products?.name || 'Product'} — #{o.id.slice(0, 8)}</option>)}
        </select>
      </div>}
      <div className="mb-5">
        <label className="block font-mono text-[11px] uppercase tracking-wide text-on-surface-variant mb-1.5">Describe your issue</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="What's going on?" className="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 font-body text-[14px] text-on-surface resize-none focus:outline-none focus:border-primary-container" />
      </div>
      <button type="submit" disabled={submitting} className="w-full h-11 rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">{submitting ? 'Sending request…' : 'Send request'}</button>
    </form>
    <section className="mt-8">
      <h2 className="font-display text-[18px] font-semibold text-on-surface mb-3">Your support requests</h2>
      {!tickets.length ? <p className="font-body text-[13px] text-on-surface-variant">No support requests yet.</p> : <div className="space-y-4">
        {tickets.map(ticket => {
          const storedMessages = ticket.support_messages ?? []
          const conversation = storedMessages.length ? storedMessages : [
            { id: `${ticket.id}-initial`, sender_type: 'customer' as const, body: ticket.query, created_at: ticket.created_at },
            ...(ticket.human_response ? [{ id: `${ticket.id}-reply`, sender_type: 'staff' as const, body: ticket.human_response, created_at: ticket.created_at }] : []),
          ]
          return <article key={ticket.id} className="bg-white rounded-2xl border border-outline-variant/50 p-5">
            <div className="flex items-center justify-between gap-3 mb-4"><p className="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">Request #{ticket.id.slice(0, 8)}</p><span className="font-mono text-[10px] uppercase tracking-wider text-primary">{statusLabel[ticket.status] || 'Received'}</span></div>
            <div className="space-y-3">{conversation.map(item => <div key={item.id} className={`rounded-xl border p-3 ${item.sender_type === 'customer' ? 'bg-surface border-outline-variant/40' : item.sender_type === 'staff' ? 'bg-primary/5 border-primary-container/30' : 'bg-tertiary-container/25 border-tertiary/20'}`}>
              <p className="font-mono text-[10px] uppercase tracking-wider text-primary mb-1">{item.sender_type === 'customer' ? 'You' : item.sender_type === 'staff' ? 'Support team' : 'Support assistant'}</p><p className="font-body text-[13px] text-on-surface whitespace-pre-wrap">{item.body}</p>
            </div>)}</div>
            {ticket.status !== 'resolved' && <div className="mt-4 flex gap-2">
              <input value={drafts[ticket.id] ?? ''} onChange={e => setDrafts(current => ({ ...current, [ticket.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendFollowUp(ticket.id) } }} maxLength={2000} placeholder="Reply to support…" className="min-w-0 flex-1 border border-outline-variant rounded-xl px-3 py-2.5 font-body text-[13px] text-on-surface focus:outline-none focus:border-primary-container" />
              <button type="button" disabled={sendingTicketId === ticket.id} onClick={() => sendFollowUp(ticket.id)} className="shrink-0 rounded-xl bg-primary px-4 font-body text-[13px] font-medium text-on-primary disabled:opacity-60">{sendingTicketId === ticket.id ? 'Sending…' : 'Reply'}</button>
            </div>}
          </article>
        })}
      </div>}
    </section>
  </div>
}

export default function CustomerSupportPage() {
  return <Suspense fallback={<div className="max-w-[560px] mx-auto px-6 py-12 font-body text-[14px] text-on-surface-variant">Loading support form…</div>}><CustomerSupportContent /></Suspense>
}
