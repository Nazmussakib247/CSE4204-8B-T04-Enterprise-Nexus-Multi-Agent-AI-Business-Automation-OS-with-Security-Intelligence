'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { authApi, getApiErrorMessage } from '@/lib/api'

export default function VerifyOfficeEmailPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [purpose, setPurpose] = useState('office_registration')
  const [nextPath, setNextPath] = useState('/login')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  useEffect(() => { const params = new URLSearchParams(window.location.search); setEmail(params.get('email') || ''); setPurpose(params.get('purpose') === 'customer_registration' ? 'customer_registration' : 'office_registration'); setNextPath(params.get('next') === '/store/login' ? '/store/login' : '/login') }, [])

  const verify = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email || !/^\d{6}$/.test(code)) { toast.error('Enter your email and six-digit verification code'); return }
    setLoading(true)
    try {
      await authApi.verifyOfficeEmail(email, code, purpose)
      toast.success(purpose === 'customer_registration' ? 'Email verified. You can now sign in.' : 'Email verified. Your access will be approved shortly.')
      router.push(nextPath)
    } catch (error) { toast.error(getApiErrorMessage(error, 'Verification failed')) } finally { setLoading(false) }
  }

  const resend = async () => {
    if (!email) { toast.error('Enter your email first'); return }
    setResending(true)
    try { await authApi.resendOfficeVerification(email, purpose); toast.success('If eligible, a new code was sent.') } catch { toast.error('Could not resend the code') } finally { setResending(false) }
  }

  return <main className="w-full min-h-[100dvh] bg-[#f4f5f6] flex items-center justify-center px-4 py-6 sm:p-8"><div className="w-full max-w-md bg-white rounded-2xl border border-outline-variant/50 shadow-sm p-6 sm:p-8">
    <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center mb-5"><span className="material-symbols-outlined text-primary text-[25px]">mark_email_read</span></div>
    <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">{purpose === 'customer_registration' ? 'Customer account verification' : 'Office account verification'}</p>
    <h1 className="font-display text-[25px] font-bold text-on-surface">Verify your email</h1>
    <p className="font-body text-[14px] text-on-surface-variant mt-2 mb-6">Enter the six-digit code sent to your email to continue.</p>
    <form onSubmit={verify} className="space-y-4">
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="w-full border border-outline-variant rounded-xl px-4 py-3 font-body focus:outline-none focus:border-primary" />
      <input inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="w-full border border-outline-variant rounded-xl px-4 py-3 text-center font-mono text-xl tracking-[0.35em] focus:outline-none focus:border-primary" />
      <button disabled={loading} className="w-full rounded-xl bg-primary py-3 text-white font-mono text-[11px] uppercase tracking-widest font-bold disabled:opacity-60">{loading ? 'Verifying…' : 'Verify email'}</button>
    </form>
    <button onClick={resend} disabled={resending} className="mt-4 w-full font-mono text-[10px] uppercase tracking-widest text-primary hover:underline disabled:opacity-60">{resending ? 'Sending…' : 'Resend code'}</button>
    <Link href="/login" className="block mt-6 text-center font-mono text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-primary">Back to sign in</Link>
  </div></main>
}
