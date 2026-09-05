'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getApiErrorMessage, ordersApi } from '@/lib/api'

interface Order { id: string; quantity: number; total: number; status: string; created_at: string; products?: { name: string; icon: string; slug: string } }
const statusStyle: Record<string, string> = { paid: 'bg-primary/10 text-primary', shipped: 'bg-yellow-100 text-yellow-700', delivered: 'bg-primary-container/15 text-primary', cancelled: 'bg-error-container text-on-error-container', pending: 'bg-surface-container text-on-surface-variant' }

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { ordersApi.getAll().then(res => setOrders(res.data.data ?? [])).catch(err => { setError(getApiErrorMessage(err, 'Please sign in to view your orders')); setOrders([]) }) }, [])
  return <div className="max-w-[900px] mx-auto px-6 py-14"><div className="flex items-end justify-between gap-4 mb-9"><div><span className="font-mono text-[11px] uppercase tracking-widest text-primary">Customer portal</span><h1 className="font-display text-display-lg text-on-surface mt-2">My orders</h1><p className="font-body text-[14px] text-on-surface-variant mt-2">Track purchases placed through the Enterprise NeXus store.</p></div><Link href="/store" className="font-body text-[13px] text-primary">Continue shopping</Link></div>
    {orders === null ? <p className="font-body text-[14px] text-on-surface-variant">Loading orders…</p> : error ? <div className="bg-white border border-outline-variant/50 rounded-2xl p-8"><p className="font-body text-[14px] text-on-surface">{error}</p><Link href="/store/login" className="inline-block mt-3 font-body text-[13px] text-primary">Sign in</Link></div> : !orders.length ? <div className="bg-white border border-outline-variant/50 rounded-2xl p-10 text-center"><span className="material-symbols-outlined text-[36px] text-on-surface-variant/40">local_mall</span><p className="font-body text-[14px] text-on-surface-variant mt-2">You have not placed any orders yet.</p></div> : <div className="space-y-3">{orders.map(order => <article key={order.id} className="bg-white rounded-2xl border border-outline-variant/50 p-5 flex items-center gap-4"><div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center"><span className="material-symbols-outlined text-primary">{order.products?.icon ?? 'inventory_2'}</span></div><div className="flex-1 min-w-0"><p className="font-body text-[14px] font-medium text-on-surface">{order.products?.name ?? 'Product'}</p><p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant mt-1">Order {order.id.slice(0, 8)} · {new Date(order.created_at).toLocaleDateString()} · Qty {order.quantity}</p></div><div className="text-right"><p className="font-display text-[16px] text-on-surface">${order.total}</p><span className={`inline-block mt-1 font-mono text-[9px] uppercase tracking-wider px-2 py-1 rounded-full ${statusStyle[order.status] ?? statusStyle.pending}`}>{order.status}</span></div></article>)}</div>}
  </div>
}
