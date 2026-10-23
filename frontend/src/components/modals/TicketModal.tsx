'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ordersApi, productsApi, supportApi, type StoreProduct } from '@/lib/api'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function TicketModal({ open, onClose, onCreated }: Props) {
  const [query, setQuery] = useState('')
  const [orderId, setOrderId] = useState('')
  const [productId, setProductId] = useState('')
  const [orders, setOrders] = useState<{ id: string; products?: { name: string } }[]>([])
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    ordersApi.getAll().then(res => setOrders(res.data.data ?? [])).catch(() => {})
    productsApi.list().then(res => setProducts(res.data.data ?? [])).catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !loading) onClose() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, loading, onClose])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) {
      toast.error('Please describe your issue')
      return
    }
    setLoading(true)
    try {
      const res = await supportApi.createTicket({ query, order_id: orderId || null, product_id: productId || null })
      const ai = res.data?.ai_analysis
      if (ai?.sentiment) {
        toast.success(`Ticket created — Gemini detected: ${ai.sentiment} sentiment, ${ai.urgency} urgency`)
      } else {
        toast.success('Ticket created with AI analysis')
      }
      setQuery('')
      setOrderId(''); setProductId('')
      onCreated()
      onClose()
    } catch {
      toast.error('Failed to create ticket')
    } finally {
      setLoading(false)
    }
  }

  const charCount = query.length
  const charLimit = 1000

  if (typeof document === 'undefined') return null

  return createPortal((
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ticket-modal-title">
      <div className="modal-backdrop" onClick={onClose} />

      <div className="modal-panel max-w-lg overflow-hidden">
        <div className="flex items-center justify-between gap-4 bg-gradient-to-br from-[#0b3440] via-[#006b5c] to-[#00a892] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <span className="material-symbols-outlined text-[21px] icon-filled">support_agent</span>
            </div>
            <div>
              <h2 id="ticket-modal-title" className="font-display text-[17px] font-semibold">New Support Ticket</h2>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-white/70">AI will analyse sentiment and urgency</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close support ticket dialog" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20">
            <span className="material-symbols-outlined text-[19px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">Related order <span className="normal-case tracking-normal">(optional)</span></label>
              <select value={orderId} onChange={e => setOrderId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-white text-[13px]"><option value="">No order selected</option>{orders.map(order => <option key={order.id} value={order.id} title={order.id}>{order.products?.name ?? 'Order'} · #{order.id.slice(0, 12).toUpperCase()}</option>)}</select>
            </div>
            <div><label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">Related product <span className="normal-case tracking-normal">(optional)</span></label>
              <select value={productId} onChange={e => setProductId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-white text-[13px]"><option value="">No product selected</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
            </div>
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1.5">
              Describe your issue <span className="text-error">*</span>
            </label>
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value.slice(0, charLimit))}
              rows={6}
              placeholder="What's the problem? Be as specific as possible — our AI will analyse urgency and suggest a response..."
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-[13px] text-on-surface focus:outline-none focus:border-primary-container transition-colors resize-none font-body"
            />
            <div className="flex justify-end mt-1">
              <span className={`font-mono text-[10px] ${charCount > charLimit * 0.9 ? 'text-error' : 'text-on-surface-variant'}`}>
                {charCount}/{charLimit}
              </span>
            </div>
          </div>

          {/* What AI does */}
          <div className="bg-surface-container rounded-xl p-4 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">What Gemini AI will do</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: 'mood', label: 'Sentiment', desc: 'positive / neutral / negative' },
                { icon: 'priority_high', label: 'Urgency', desc: 'low / medium / high' },
                { icon: 'chat', label: 'Auto Reply', desc: 'generates a response' },
              ].map(item => (
                <div key={item.label} className="flex flex-col items-center text-center gap-1 p-2 bg-white rounded-xl border border-outline-variant/30">
                  <span className="material-symbols-outlined text-[18px] text-primary">{item.icon}</span>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-on-surface font-bold">{item.label}</p>
                  <p className="font-mono text-[9px] text-on-surface-variant">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="font-mono text-[10px] uppercase tracking-wider px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-all">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)', boxShadow: '0 4px 14px rgba(0,194,168,0.3)' }}
            >
              <span className="material-symbols-outlined text-[16px]">{loading ? 'hourglass_empty' : 'support_agent'}</span>
              {loading ? 'AI Analysing...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ), document.body)
}
