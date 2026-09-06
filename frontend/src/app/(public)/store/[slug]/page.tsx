'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { productsApi, type StoreProduct } from '@/lib/api'
import BuyButton from './BuyButton'
import ReviewsSection from '@/components/store/ReviewsSection'

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const [product, setProduct] = useState<StoreProduct | null | undefined>(undefined)

  useEffect(() => {
    productsApi.getBySlug(slug)
      .then(r => setProduct(r.data.data))
      .catch(() => setProduct(null))
  }, [slug])

  if (product === undefined) return null

  if (product === null) {
    return (
      <div className="max-w-[700px] mx-auto px-6 py-16 text-center">
        <p className="font-body text-[15px] text-on-surface">This product isn&apos;t available.</p>
        <Link href="/store" className="font-body text-[13px] text-primary mt-2 inline-block">Back to store</Link>
      </div>
    )
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-10">
      <Link href="/store" className="inline-flex items-center gap-1.5 font-body text-[13px] text-on-surface-variant hover:text-on-surface transition-colors mb-6">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Store
      </Link>

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10">
        <div className="rounded-2xl h-80 lg:h-full flex items-center justify-center bg-primary-container/15">
          <span className="material-symbols-outlined text-[120px] text-primary">{product.icon}</span>
        </div>

        <div>
          <h1 className="font-display text-display-lg text-on-surface">{product.name}</h1>
          <p className="font-body text-body-lg text-on-surface-variant mt-2">{product.tagline}</p>
          <div className="font-display text-[28px] font-semibold text-on-surface mt-5">${product.price}</div>

          <p className="font-body text-[14px] text-on-surface leading-relaxed mt-5">{product.description}</p>

          <ul className="mt-5 space-y-2.5">
            {product.highlights.map(h => (
              <li key={h} className="flex items-start gap-2.5 font-body text-[13px] text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-primary mt-0.5">check_circle</span>
                {h}
              </li>
            ))}
          </ul>

          <BuyButton productId={product.id} />

          <div className="mt-8 rounded-xl border border-outline-variant/60 divide-y divide-outline-variant/60">
            {product.specs.map(s => (
              <div key={s.label} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-mono text-[11px] uppercase tracking-wide text-on-surface-variant">{s.label}</span>
                <span className="font-body text-[13px] text-on-surface">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ReviewsSection productId={product.id} />
    </div>
  )
}
