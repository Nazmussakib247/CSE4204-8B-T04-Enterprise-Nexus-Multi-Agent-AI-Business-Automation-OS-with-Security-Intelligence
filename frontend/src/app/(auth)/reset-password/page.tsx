'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { authApi, getApiErrorMessage } from '@/lib/api'

function ResetPasswordForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (!token) {
      toast.error('Invalid reset link')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
      toast.success('Password reset! Redirecting to login...')
      setTimeout(() => router.push('/login'), 2000)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Reset failed. Link may have expired.'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="card text-center">
        <span className="material-symbols-outlined text-4xl text-error mb-4 block">error</span>
        <p className="text-on-surface-variant">Invalid or missing reset token.</p>
        <Link href="/forgot-password" className="btn-primary mt-4 inline-block">Request new link</Link>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center mb-md">
        <span className="material-symbols-outlined text-primary-container">lock_reset</span>
      </div>
      <h2 className="font-display text-headline-md text-on-surface font-bold mb-xs">Set New Password</h2>
      <p className="font-body text-body-md text-on-surface-variant mb-lg">
        {done ? 'Password updated. Redirecting to sign in...' : 'Choose a strong password for your account.'}
      </p>

      {!done && (
        <form onSubmit={handleSubmit} className="space-y-sm">
          <div>
            <label className="font-mono text-label-caps uppercase tracking-wider text-on-surface-variant block mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="input-field"
            />
          </div>
          <div>
            <label className="font-mono text-label-caps uppercase tracking-wider text-on-surface-variant block mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className="input-field"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="w-full flex items-center justify-center min-h-screen bg-surface px-sm">
      <div className="w-full max-w-md">
        <Link href="/login" className="flex items-center gap-2 font-mono text-label-mono text-on-surface-variant hover:text-on-surface mb-lg transition-colors">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to sign in
        </Link>
        <Suspense fallback={<div className="card">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  )
}
