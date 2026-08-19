'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-error/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-2xl text-error">error</span>
        </div>
        <h1 className="font-display text-[22px] font-bold text-on-surface mb-2">
          Something went wrong
        </h1>
        <p className="font-body text-[14px] text-on-surface-variant mb-6">
          An unexpected error occurred. It has been reported — you can try again.
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 rounded-xl font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #00c2a8 0%, #006b5c 100%)' }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
