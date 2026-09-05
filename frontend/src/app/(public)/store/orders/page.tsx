'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { ordersApi } from '@/lib/api'

interface OrderRow {
  id: string
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
  quantity: number
  total: number
  created_at: string
  products?: { name: string; icon: string; slug: string }
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-surface-container-low text-on-surface-variant',
  paid: 'bg-primary-container/15 text-primary',
  shipped: 'bg-tertiary-container/25 text-tertiary',
  delivered: 'bg-primary-container/25 text-primary',
  cancelled: 'bg-error-container text-on-error-container',
}

export default function CustomerOrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<OrderRow[] | null>(null)

  useEffect(() => {
    if (!user) return
    ordersApi.getAll()
      .then(r => setOrders(r.data.data ?? []))
      .catch(() => setOrders([]))
  }, [user])

  if (authLoading) return null

  if (!user) {
    return (
      <div className="max-w-[500px] mx-auto px-6 py-20 text-center">
        <span className="material-symbols-outlined text-[36px] text-on-surface-variant/40 mb-2">lock</span>
        <p className="font-body text-[15px] text-on-surface">Sign in to see your orders</p>
        <Link href="/store/login" className="inline-block mt-4 h-11 px-6 leading-[44px] rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium">
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <h1 className="font-display text-display-lg text-on-surface mb-1">Your orders</h1>
      <p className="font-body text-[14px] text-on-surface-variant mb-8">Mock checkout — these are test orders, no real payment was charged.</p>

      {orders === null ? (
        <div className="space-y-3">
          {[0, 1].map(i => <div key={i} className="h-20 rounded-2xl bg-surface-container-low animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-outline-variant/50 p-14 flex flex-col items-center text-center">
          <span className="material-symbols-outlined text-[36px] text-on-surface-variant/40 mb-2">inventory_2</span>
          <p className="font-body text-[14px] text-on-surface-variant">No orders yet</p>
          <Link href="/store" className="font-body text-[13px] text-primary mt-2">Browse the store</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <div key={o.id} className="bg-white rounded-2xl border border-outline-variant/50 p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-primary-container/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px] text-primary">{o.products?.icon || 'inventory_2'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-[14px] font-medium text-on-surface truncate">{o.products?.name || 'Product'}</p>
                <p className="font-mono text-[11px] text-on-surface-variant mt-0.5">
                  Order #{o.id.slice(0, 8)} · Qty {o.quantity} · ${o.total} · {new Date(o.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLE[o.status]}`}>
                {o.status}
              </span>
              <Link
                href={`/store/support?order_id=${o.id}`}
                className="font-body text-[12px] text-primary shrink-0 hover:underline"
              >
                Get help
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
