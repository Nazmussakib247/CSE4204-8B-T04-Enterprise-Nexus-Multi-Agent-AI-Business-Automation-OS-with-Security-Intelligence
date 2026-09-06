'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuth } from '@/lib/auth'
import { ordersApi, getApiErrorMessage } from '@/lib/api'

export default function BuyButton({ productId }: { productId: string }) {
  const { user, loading: authLoading } = useAuth()
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const [placedOrder, setPlacedOrder] = useState<{ id: string } | null>(null)
  const router = useRouter()
  const storeLoginUrl = typeof window === 'undefined'
    ? '/store/login'
    : `/store/login?returnTo=${encodeURIComponent(window.location.pathname)}`

  const handleBuy = async () => {
    setLoading(true)
    try {
      const { data } = await ordersApi.create(productId, qty)
      setPlacedOrder(data.data)
      router.prefetch('/store/orders')
      router.refresh()
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        toast('Sign in to place an order', { icon: '🔒' })
        router.push(storeLoginUrl)
      } else {
        toast.error(getApiErrorMessage(err, 'Could not place order'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return <div className="h-11 mt-6" />

  // Order just placed — show a clear mock-checkout confirmation, not just a toast.
  if (placedOrder) {
    return (
      <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
          <span className="font-body text-[14px] font-medium text-on-surface">Order placed</span>
        </div>
        <p className="font-mono text-[11px] text-on-surface-variant">
          Order #{placedOrder.id.slice(0, 8)} · Mock checkout — no real payment was charged
        </p>
        <Link href="/store/orders" className="inline-block mt-2 font-body text-[13px] text-primary hover:underline">
          Track this order →
        </Link>
      </div>
    )
  }

  // Not signed in — require an account before checkout is even attempted,
  // rather than letting the click fail first.
  if (!user) {
    return (
      <div className="mt-6">
        <Link
          href={storeLoginUrl}
          className="flex items-center justify-center h-11 rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium hover:bg-primary/90 transition-colors"
        >
          Sign in to buy
        </Link>
        <p className="font-body text-[12px] text-on-surface-variant text-center mt-2">
          An account lets you track this order and get order-aware support later.
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 mt-6">
      <div className="flex items-center border border-outline-variant rounded-xl overflow-hidden">
        <button
          onClick={() => setQty(q => Math.max(1, q - 1))}
          className="w-9 h-11 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">remove</span>
        </button>
        <span className="w-8 text-center font-body text-[14px] text-on-surface">{qty}</span>
        <button
          onClick={() => setQty(q => q + 1)}
          className="w-9 h-11 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
        </button>
      </div>
      <button
        onClick={handleBuy}
        disabled={loading}
        className="flex-1 h-11 rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading ? 'Placing order...' : 'Buy now (mock checkout)'}
      </button>
    </div>
  )
}
