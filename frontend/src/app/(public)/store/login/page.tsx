'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { authApi, getApiErrorMessage } from '@/lib/api'

export default function StoreLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Enter your email and password'); return }

    setLoading(true)
    try {
      await authApi.login(email, password)
      toast.success('Signed in')
      router.push('/store')
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Invalid email or password'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-[380px] mx-auto px-6 py-16">
      <div className="text-center mb-8">
        <h1 className="font-display text-headline-md text-on-surface">Sign in</h1>
        <p className="font-body text-[14px] text-on-surface-variant mt-1.5">Track your orders and support tickets</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-outline-variant/50 p-6">
        <div className="mb-4">
          <label className="block font-mono text-[11px] uppercase tracking-wide text-on-surface-variant mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 font-body text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
          />
        </div>

        <div className="mb-5">
          <label className="block font-mono text-[11px] uppercase tracking-wide text-on-surface-variant mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 pr-11 font-body text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
            />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors p-1">
              <span className="material-symbols-outlined text-[18px]">{showPass ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="text-center font-body text-[13px] text-on-surface-variant mt-5">
        New here? <Link href="/store/register" className="text-primary font-medium">Create an account</Link>
      </p>
      <p className="text-center font-body text-[12px] text-on-surface-variant/60 mt-6">
        Are you a team member? <Link href="/login" className="underline">Staff sign in</Link>
      </p>
    </div>
  )
}
