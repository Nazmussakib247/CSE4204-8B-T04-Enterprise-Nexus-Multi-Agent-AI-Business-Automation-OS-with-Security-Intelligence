'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
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
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
              A critical error occurred. It has been reported.
            </p>
            <button
              onClick={reset}
              style={{ padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', background: '#00a892', color: '#fff', fontWeight: 700 }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
