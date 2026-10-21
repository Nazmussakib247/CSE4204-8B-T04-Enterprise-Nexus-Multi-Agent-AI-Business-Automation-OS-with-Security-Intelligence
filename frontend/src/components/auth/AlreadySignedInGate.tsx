'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

/**
 * Wraps /login and /register (both internal and storefront). If the visitor
 * is already authenticated — e.g. they hit the browser Back button and
 * landed back on a login/register page while still signed in — take them to
 * the correct product surface without interrupting their workflow.
 */
export default function AlreadySignedInGate({
  children,
  dashboardPath = '/dashboard',
}: {
  children: React.ReactNode
  dashboardPath?: string
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.replace(dashboardPath)
  }, [dashboardPath, loading, router, user])

  // Never hide an auth page while the session check is pending. A cold Render
  // instance or a transient network delay used to leave `/login` completely
  // blank because this component returned null. If a valid session is found,
  // the effect above redirects immediately; otherwise the visitor can sign in.
  if (user) return null
  return <>{children}</>
}
