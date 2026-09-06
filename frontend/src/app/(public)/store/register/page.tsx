'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { authApi, getApiErrorMessage } from '@/lib/api'
import AlreadySignedInGate from '@/components/auth/AlreadySignedInGate'
import { useAuth } from '@/lib/auth'

export default function StoreRegisterPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
  const passwordValid = Object.values(passwordChecks).every(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) { toast.error('All fields required'); return }
    if (!passwordValid) { toast.error('Password does not meet the requirements below'); return }

    setLoading(true)
    try {
      await authApi.registerExternal(name, email, password, 'customer')
      await login(email, password)
      toast.success('Customer account created')
      router.push('/store')
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlreadySignedInGate dashboardPath="/store" loginPath="/store/login">
    <div className="max-w-[380px] mx-auto px-6 py-16">
      <div className="text-center mb-8">
        <h1 className="font-display text-headline-md text-on-surface">Create an account</h1>
        <p className="font-body text-[14px] text-on-surface-variant mt-1.5">Order NeXus hardware and track delivery</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-outline-variant/50 p-6">
        <div className="mb-4">
          <label className="block font-mono text-[11px] uppercase tracking-wide text-on-surface-variant mb-1.5">Full name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            className="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 font-body text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
          />
        </div>

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
              placeholder="Min. 8 characters"
              className="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 pr-11 font-body text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
            />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors p-1">
              <span className="material-symbols-outlined text-[18px]">{showPass ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          {password.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {[
                { ok: passwordChecks.length, text: '8+ characters' },
                { ok: passwordChecks.upper, text: '1 uppercase letter' },
                { ok: passwordChecks.number, text: '1 number' },
                { ok: passwordChecks.special, text: '1 special character' },
              ].map(({ ok, text }) => (
                <div key={text} className={`flex items-center gap-1.5 font-body text-[12px] ${ok ? 'text-primary-container' : 'text-on-surface-variant/60'}`}>
                  <span className="material-symbols-outlined text-[14px]">{ok ? 'check_circle' : 'radio_button_unchecked'}</span>
                  {text}
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="text-center font-body text-[13px] text-on-surface-variant mt-5">
        Already have an account? <Link href="/store/login" className="text-primary font-medium">Sign in</Link>
      </p>
    </div>
    </AlreadySignedInGate>
  )
}
