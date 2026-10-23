'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supportApi } from '@/lib/api'
import ConfirmModal from '@/components/ui/ConfirmModal'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface Ticket {
  id: string; query: string; ai_response: string; intent: string
  urgency: string; sentiment: string; confidence: number
  escalated: boolean; status: string; created_at: string; updated_at?: string
}

const urgBadge = (u: string) =>
  u === 'high' ? 'bg-error-container text-on-error-container border-error/30' :
  u === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
  'bg-surface-container text-on-surface-variant border-outline-variant/50'

const sentBadge = (s: string) =>
  s === 'positive' ? 'bg-primary-container/10 text-primary border-primary-container/30' :
  s === 'negative' ? 'bg-error-container text-on-error-container border-error/30' :
  'bg-surface-container text-on-surface-variant border-outline-variant/50'

const statusBadge = (s: string) =>
  s === 'resolved' ? 'bg-primary-container/10 text-primary border-primary-container/30' :
  s === 'escalated' ? 'bg-error-container text-on-error-container border-error/30' :
  'bg-surface-container text-on-surface-variant border-outline-variant/50'

const POLL_MS = 30_000

export default function SupportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmAction, setConfirmAction] = useState<'escalate' | 'resolve' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTicket = () => {
    supportApi.getTicket(id)
      .then(r => setTicket(r.data.data))
      .catch(() => setError('Ticket not found'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTicket()
    // Poll only when ticket is open/processing
    pollingRef.current = setInterval(fetchTicket, POLL_MS)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEscalate = async () => {
    setActionLoading(true)
    try {
      await supportApi.escalateTicket(id)
      toast.success('Ticket escalated to human agent')
      setTicket(t => t ? { ...t, escalated: true, status: 'escalated' } : t)
    } catch {
      toast.error('Failed to escalate')
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
    }
  }

  const handleResolve = async () => {
    setActionLoading(true)
    try {
      await supportApi.resolveTicket(id)
      toast.success('Ticket marked as resolved')
      setTicket(t => t ? { ...t, status: 'resolved' } : t)
    } catch {
      toast.error('Failed to resolve')
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
    }
  }

  const handleConfirm = () => {
    if (confirmAction === 'escalate') handleEscalate()
    else if (confirmAction === 'resolve') handleResolve()
  }

  if (loading) return (
    <div className="max-w-[900px] space-y-4">
      <div className="h-6 w-32 bg-surface-container rounded-lg animate-pulse" />
      <div className="bg-white rounded-2xl border border-outline-variant/50 p-8 space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className={`h-4 bg-surface-container rounded-lg animate-pulse ${i === 0 ? 'w-3/4' : 'w-full'}`} />)}
      </div>
    </div>
  )

  if (error || !ticket) return (
    <div className="max-w-[900px]">
      <Link href="/support" className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-on-surface-variant hover:text-on-surface mb-6 transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back to Support
      </Link>
      <div className="bg-white rounded-2xl border border-outline-variant/50 p-10 text-center">
        <p className="font-body text-[14px] text-on-surface-variant">Ticket not found</p>
      </div>
    </div>
  )

  const isOpen = ticket.status === 'open'

  return (
    <div className="max-w-[900px] space-y-6">
      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction === 'escalate' ? 'Escalate Ticket' : 'Resolve Ticket'}
        message={
          confirmAction === 'escalate'
            ? 'Escalate this ticket to a human agent? An email notification will be sent.'
            : 'Mark this ticket as resolved? This cannot be undone.'
        }
        confirmLabel={actionLoading ? 'Processing…' : confirmAction === 'escalate' ? 'Escalate' : 'Resolve'}
        danger={confirmAction === 'escalate'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Nav + Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link href="/support" className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span> Support Agent
        </Link>

        {isOpen && (
          <div className="flex items-center gap-2">
            <button onClick={() => setConfirmAction('resolve')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-[10px] uppercase tracking-wider text-primary border border-primary-container/40 hover:bg-primary-container/10 transition-colors">
              <span className="material-symbols-outlined text-[14px]">check_circle</span> Resolve
            </button>
            {!ticket.escalated && (
              <button onClick={() => setConfirmAction('escalate')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-[10px] uppercase tracking-wider text-error border border-error/30 hover:bg-error-container/20 transition-colors">
                <span className="material-symbols-outlined text-[14px]">escalator_warning</span> Escalate
              </button>
            )}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[20px] icon-filled text-primary">support_agent</span>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Ticket #{ticket.id.slice(0, 8).toUpperCase()}</p>
              <p className="font-mono text-[10px] text-on-surface-variant/60 mt-0.5">{new Date(ticket.created_at).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border ${urgBadge(ticket.urgency)}`}>{ticket.urgency}</span>
            <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border ${sentBadge(ticket.sentiment)}`}>{ticket.sentiment}</span>
            <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusBadge(ticket.status)}`}>{ticket.status}</span>
          </div>
        </div>

        {/* Conversation thread */}
        <div className="space-y-4">
          {/* User message */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">person</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[10px] font-semibold text-on-surface uppercase tracking-wider">User</span>
                <span className="font-mono text-[10px] text-on-surface-variant/50">{new Date(ticket.created_at).toLocaleTimeString()}</span>
              </div>
              <div className="bg-surface-container-low rounded-xl px-4 py-3">
                <p className="font-body text-[14px] text-on-surface leading-relaxed">{ticket.query}</p>
              </div>
            </div>
          </div>

          {/* AI response */}
          {ticket.ai_response && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'linear-gradient(135deg, #00c2a8, #006b5c)' }}>
                <span className="material-symbols-outlined text-[15px] text-white icon-filled">psychology</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-[10px] font-semibold text-primary-container uppercase tracking-wider">AI Agent</span>
                  <span className="font-mono text-[10px] text-on-surface-variant/50">{new Date(ticket.created_at).toLocaleTimeString()}</span>
                  {ticket.confidence && (
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-primary-container/10 text-primary-container uppercase tracking-wider">
                      {Math.round(ticket.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
                <div className="rounded-xl px-4 py-3 border border-primary-container/20"
                  style={{ background: 'linear-gradient(135deg, rgba(0,194,168,0.04), rgba(0,107,92,0.04))' }}>
                  <p className="font-body text-[14px] text-on-surface leading-relaxed whitespace-pre-wrap">{ticket.ai_response}</p>
                </div>
              </div>
            </div>
          )}

          {/* Status update if resolved/escalated */}
          {(ticket.status === 'resolved' || ticket.status === 'escalated') && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-surface-container">
                <span className={`material-symbols-outlined text-[16px] icon-filled ${ticket.status === 'resolved' ? 'text-primary-container' : 'text-error'}`}>
                  {ticket.status === 'resolved' ? 'check_circle' : 'escalator_warning'}
                </span>
              </div>
              <div className="flex-1 flex items-center">
                <div className={`px-4 py-2.5 rounded-xl border font-mono text-[11px] uppercase tracking-wider ${ticket.status === 'resolved' ? 'bg-primary-container/10 text-primary border-primary-container/20' : 'bg-error-container/50 text-error border-error/20'}`}>
                  Ticket {ticket.status}
                  {ticket.updated_at && ` · ${new Date(ticket.updated_at).toLocaleString()}`}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
        <h2 className="font-display text-[15px] font-semibold text-on-surface mb-4">Ticket Details</h2>
        <dl className="grid grid-cols-2 gap-4">
          {[
            { label: 'Ticket ID', value: ticket.id.slice(0, 16) + '…' },
            { label: 'Intent', value: ticket.intent || '—' },
            { label: 'Urgency', value: ticket.urgency },
            { label: 'Sentiment', value: ticket.sentiment },
            { label: 'Confidence', value: ticket.confidence ? `${Math.round(ticket.confidence * 100)}%` : '—' },
            { label: 'Escalated', value: ticket.escalated ? 'Yes' : 'No' },
            { label: 'Status', value: ticket.status },
            { label: 'Created', value: new Date(ticket.created_at).toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 bg-surface-container-low rounded-xl">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">{label}</dt>
              <dd className="font-body text-[13px] text-on-surface capitalize truncate">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
