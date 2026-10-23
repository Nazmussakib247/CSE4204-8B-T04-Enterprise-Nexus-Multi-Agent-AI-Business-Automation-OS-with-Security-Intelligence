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

const statusStyle: Record<string, string> = {
  open: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-primary/10 text-primary border-primary-container/30',
  escalated: 'bg-error-container text-error border-error/20',
  resolved: 'bg-surface-container text-on-surface-variant border-outline-variant/50',
}

// Older AI replies may contain an unresolved template token. Never expose
// implementation placeholders to customers when the product price is absent.
const cleanReply = (body: string) => body.replace(/\[\$price\]|\$\[price\]|\[price\]|\$\{price\}|\{price\}/gi, 'the current listed price')

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
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null)

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

  return <div className="max-w-[760px] mx-auto px-5 sm:px-6 py-10 sm:py-14">
    <div className="mb-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary mb-2">Customer care</p>
      <h1 className="font-display text-[32px] sm:text-[40px] font-semibold tracking-tight text-on-surface">Contact support</h1>
      <p className="font-body text-[14px] leading-6 text-on-surface-variant mt-2 max-w-[620px]">Send a message and keep every reply in one secure conversation. Link an order when you need order-aware help.</p>
    </div>
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-outline-variant/60 p-5 sm:p-6 shadow-[0_8px_30px_rgba(25,28,29,0.04)]">
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
    <section className="mt-12">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-surface-variant/70 mb-1">Inbox</p><h2 className="font-display text-[21px] font-semibold text-on-surface">Your conversations</h2></div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">{tickets.length} {tickets.length === 1 ? 'request' : 'requests'}</span>
      </div>
      {!tickets.length ? <div className="bg-white border border-dashed border-outline-variant rounded-2xl p-8 text-center"><span className="material-symbols-outlined text-[28px] text-on-surface-variant/40">forum</span><p className="font-body text-[13px] text-on-surface-variant mt-2">No support requests yet.</p></div> : <div className="space-y-5">
        {tickets.map(ticket => {
          const storedMessages = ticket.support_messages ?? []
          const conversation = storedMessages.length ? storedMessages : [
            { id: `${ticket.id}-initial`, sender_type: 'customer' as const, body: ticket.query, created_at: ticket.created_at },
            ...(ticket.human_response ? [{ id: `${ticket.id}-reply`, sender_type: 'staff' as const, body: ticket.human_response, created_at: ticket.created_at }] : []),
          ]
          const expanded = expandedTicketId === ticket.id
          const statusIcon = ticket.status === 'resolved' ? 'check_circle' : ticket.status === 'escalated' ? 'priority_high' : ticket.status === 'in_progress' ? 'support_agent' : 'schedule'
          return <article key={ticket.id} className={`bg-white rounded-2xl border overflow-hidden transition-all duration-200 ${expanded ? 'border-primary/30 shadow-[0_12px_35px_rgba(25,28,29,0.08)]' : 'border-outline-variant/60 shadow-[0_8px_30px_rgba(25,28,29,0.035)]'}`}>
            <button type="button" onClick={() => setExpandedTicketId(expanded ? null : ticket.id)} aria-expanded={expanded} className="w-full text-left flex items-center gap-4 px-5 py-4 bg-surface-container-low/50 hover:bg-surface-container-low transition-colors">
              <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${ticket.status === 'resolved' ? 'bg-primary/10 text-primary' : ticket.status === 'escalated' ? 'bg-error-container text-error' : ticket.status === 'in_progress' ? 'bg-primary/10 text-primary' : 'bg-amber-50 text-amber-700'}`}><span className="material-symbols-outlined text-[19px] icon-filled">{statusIcon}</span></span>
              <span className="min-w-0 flex-1"><span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-on-surface-variant/75">Request #{ticket.id.slice(0, 8).toUpperCase()}</span><span className="block truncate font-body text-[14px] font-medium text-on-surface mt-1">{ticket.query}</span><span className="block font-mono text-[10px] text-on-surface-variant/55 mt-1">{new Date(ticket.created_at).toLocaleString()} · {conversation.length} {conversation.length === 1 ? 'message' : 'messages'}</span></span>
              <span className="flex shrink-0 items-center gap-2"><span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-full border ${statusStyle[ticket.status] || statusStyle.open}`}>{statusLabel[ticket.status] || 'Received'}</span><span className={`material-symbols-outlined text-[20px] text-on-surface-variant/60 transition-transform ${expanded ? 'rotate-180' : ''}`}>expand_more</span></span>
            </button>
            {expanded && <>
            <div className="p-5 space-y-3 border-t border-outline-variant/40">{conversation.map(item => <div key={item.id} className={`flex gap-3 ${item.sender_type === 'customer' ? '' : 'flex-row-reverse'}`}>
              <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${item.sender_type === 'customer' ? 'bg-surface-container text-on-surface-variant' : item.sender_type === 'staff' ? 'bg-primary text-white' : 'bg-tertiary-container text-tertiary'}`}><span className="material-symbols-outlined text-[16px]">{item.sender_type === 'customer' ? 'person' : item.sender_type === 'staff' ? 'support_agent' : 'auto_awesome'}</span></div>
              <div className={`max-w-[88%] rounded-2xl border px-4 py-3 ${item.sender_type === 'customer' ? 'bg-surface-container-low border-outline-variant/40' : item.sender_type === 'staff' ? 'bg-primary/5 border-primary-container/30' : 'bg-tertiary-container/20 border-tertiary/20'}`}><div className="flex items-center justify-between gap-4 mb-1.5"><p className="font-mono text-[10px] uppercase tracking-wider text-primary">{item.sender_type === 'customer' ? 'You' : item.sender_type === 'staff' ? 'Support team' : 'AI assistant'}</p><span className="font-mono text-[9px] text-on-surface-variant/50">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><p className="font-body text-[13px] leading-5 text-on-surface whitespace-pre-wrap">{cleanReply(item.body)}</p></div>
             </div>)}</div>
            {ticket.status !== 'resolved' ? <div className="px-5 pb-5 flex gap-2">
              <input value={drafts[ticket.id] ?? ''} onChange={e => setDrafts(current => ({ ...current, [ticket.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendFollowUp(ticket.id) } }} maxLength={2000} placeholder="Reply to support…" className="min-w-0 flex-1 border border-outline-variant rounded-xl px-3 py-2.5 font-body text-[13px] text-on-surface focus:outline-none focus:border-primary-container" />
              <button type="button" disabled={sendingTicketId === ticket.id} onClick={() => sendFollowUp(ticket.id)} className="shrink-0 rounded-xl bg-primary px-4 font-body text-[13px] font-medium text-on-primary disabled:opacity-60">{sendingTicketId === ticket.id ? 'Sending…' : 'Reply'}</button>
            </div> : <div className="px-5 pb-5"><div className="rounded-xl bg-surface-container-low border border-outline-variant/40 px-4 py-3 font-body text-[12px] text-on-surface-variant">This conversation is closed. Start a new request if you need more help.</div></div>}
            </>}
          </article>
        })}
      </div>}
    </section>
  </div>
}

export default function CustomerSupportPage() {
  return <Suspense fallback={<div className="max-w-[560px] mx-auto px-6 py-12 font-body text-[14px] text-on-surface-variant">Loading support form…</div>}><CustomerSupportContent /></Suspense>
}
