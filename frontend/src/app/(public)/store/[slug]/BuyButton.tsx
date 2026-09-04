'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ordersApi, getApiErrorMessage } from '@/lib/api'

export default function BuyButton({ productId }: { productId: string }) {
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleBuy = async () => {
    setLoading(true)
    try {
      await ordersApi.create(productId, qty)
      toast.success('Order placed — mock checkout, marked as paid instantly')
    } catch (err: any) {
      if (err?.response?.status === 401) {
        toast('Sign in to place an order', { icon: '🔒' })
        router.push('/store/login')
      } else {
        toast.error(getApiErrorMessage(err, 'Could not place order'))
      }
    } finally {
      setLoading(false)
    }
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
        {loading ? 'Placing order...' : 'Buy now'}
      </button>
    </div>
  )
}
