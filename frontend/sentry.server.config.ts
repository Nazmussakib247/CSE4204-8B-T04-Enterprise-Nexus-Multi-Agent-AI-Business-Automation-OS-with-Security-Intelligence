// ── Sentry — Server-side (Node.js / Edge) ────────────────────
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  environment: process.env.NODE_ENV ?? 'development',

  // Don't print source maps to logs
  debug: false,
})
