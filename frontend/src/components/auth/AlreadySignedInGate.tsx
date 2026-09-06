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

  if (loading) return null
  if (!user) return <>{children}</>
  return null
}
