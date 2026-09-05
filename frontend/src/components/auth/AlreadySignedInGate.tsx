'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

/**
 * Wraps /login and /register (both internal and storefront). If the visitor
 * is already authenticated — e.g. they hit the browser Back button and
 * landed back on a login page while still signed in — show an explicit
 * "sign out?" choice instead of silently rendering the login/register form
 * underneath an active session.
 */
export default function AlreadySignedInGate({
  children,
  dashboardPath = '/dashboard',
  loginPath = '/login',
}: {
  children: React.ReactNode
  dashboardPath?: string
  loginPath?: string
}) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  if (loading) return null
  if (!user) return <>{children}</>

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-6">
      <div className="w-full max-w-[380px] bg-white rounded-2xl border border-outline-variant/50 p-7 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-primary-container/15 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-[22px] text-primary">person</span>
        </div>
        <h2 className="font-display text-[18px] font-semibold text-on-surface">You&apos;re already signed in</h2>
        <p className="font-body text-[14px] text-on-surface-variant mt-1.5">as {user.name} ({user.email})</p>

        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={() => router.push(dashboardPath)}
            className="h-11 rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium hover:bg-primary/90 transition-colors"
          >
            Go to dashboard
          </button>
          <button
            onClick={() => logout(loginPath)}
            className="h-11 rounded-xl border border-outline-variant text-on-surface font-body text-[14px] font-medium hover:bg-surface-container-low transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
