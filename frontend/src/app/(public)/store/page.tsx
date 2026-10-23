'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { productsApi, type StoreProduct } from '@/lib/api'

const ACCENTS = [
  { bg: 'bg-primary-container/15', icon: 'text-primary' },
  { bg: 'bg-tertiary-container/25', icon: 'text-tertiary' },
  { bg: 'bg-secondary-container/50', icon: 'text-secondary' },
]

export default function StorePage() {
  const [products, setProducts] = useState<StoreProduct[] | null>(null)

  useEffect(() => {
    productsApi.list()
      .then(r => setProducts(r.data.data ?? []))
      .catch(() => setProducts([]))
  }, [])

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-14">
      <div className="max-w-[560px] mb-12">
        <span className="font-mono text-[11px] uppercase tracking-widest text-primary">Hardware</span>
        <h1 className="font-display text-display-lg text-on-surface mt-2">Bring your agents into the room</h1>
        <p className="font-body text-body-lg text-on-surface-variant mt-3">
          Devices that connect your office to the HR, Finance, Support and Executive agents already running in your workspace.
        </p>
      </div>

      {products === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-2xl border border-outline-variant/50 overflow-hidden animate-pulse">
              <div className="h-40 bg-surface-container-low" />
              <div className="p-5 space-y-2">
                <div className="h-4 w-2/3 bg-surface-container-low rounded" />
                <div className="h-3 w-full bg-surface-container-low rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-outline-variant/50 p-16 flex flex-col items-center text-center">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40 mb-3">inventory_2</span>
          <p className="font-body text-[15px] text-on-surface">No products available right now</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((product, i) => {
            const accent = ACCENTS[i % ACCENTS.length]
            return (
              <Link
                key={product.slug}
                href={`/store/${product.slug}`}
                className="group bg-white rounded-2xl border border-outline-variant/50 overflow-hidden hover:shadow-card-hover hover:border-outline-variant transition-all"
              >
                <div className={`h-40 flex items-center justify-center ${accent.bg}`}>
                  <span className={`material-symbols-outlined text-[56px] ${accent.icon}`}>{product.icon}</span>
                </div>
                <div className="p-5">
                  <h2 className="font-display text-[16px] font-semibold text-on-surface group-hover:text-primary transition-colors">
                    {product.name}
                  </h2>
                  <p className="font-body text-[13px] text-on-surface-variant mt-1 leading-snug">{product.tagline}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="font-display text-[18px] font-semibold text-on-surface">${product.price}</span>
                    <span className="font-body text-[13px] font-medium text-primary flex items-center gap-1">
                      View
                      <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
