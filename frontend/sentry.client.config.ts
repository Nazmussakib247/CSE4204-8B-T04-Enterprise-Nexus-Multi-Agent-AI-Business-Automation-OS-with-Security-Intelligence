// ── Sentry — Browser / Client-side ───────────────────────────
// This file is loaded by Next.js automatically via @sentry/nextjs.
// Do NOT import it manually.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust sample rates for production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  environment: process.env.NODE_ENV ?? 'development',

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Filter out noise
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ],

  beforeSend(event) {
    // Strip PII from breadcrumbs in production
    if (process.env.NODE_ENV === 'production') {
      event.breadcrumbs?.values?.forEach((b) => {
        if (b.data?.url) b.data.url = b.data.url.replace(/token=[^&]*/g, 'token=REDACTED')
      })
    }
    return event
  },
})
