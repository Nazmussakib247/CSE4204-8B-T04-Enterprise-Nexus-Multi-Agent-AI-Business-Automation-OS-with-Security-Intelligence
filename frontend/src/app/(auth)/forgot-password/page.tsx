'use client'

import { useState } from 'react'
import { authApi } from '@/lib/api'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
      toast.success('Reset link sent if that email is registered')
    } catch {
      toast.error('Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen w-full bg-[#f4f5f6] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-outline-variant/50 shadow-sm overflow-hidden">
          <div className="px-8 pt-8 pb-6 border-b border-outline-variant/30" style={{ background: '#16191a' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00c2a8, #006b5c)' }}>
                <span className="material-symbols-outlined text-white text-[18px] icon-filled">lock_reset</span>
              </div>
              <div>
                <p className="font-display text-[14px] font-bold text-white">Enterprise NeXus</p>
                <p className="font-mono text-[9px] text-white/30 uppercase tracking-widest">Reset Password</p>
              </div>
            </div>
            <h1 className="font-display text-[22px] font-bold text-white mb-1">Forgot your password?</h1>
            <p className="font-body text-[13px] text-white/50">
              {sent ? 'Check your inbox — we sent a reset link.' : "Enter your email and we'll send a reset link."}
            </p>
          </div>

          <div className="px-8 py-6">
            {sent ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[24px] text-primary icon-filled">mark_email_read</span>
                </div>
                <p className="font-body text-[14px] text-on-surface-variant">Check your inbox for a password reset link. It expires in 1 hour.</p>
                <Link href="/login" className="block font-mono text-[11px] uppercase tracking-widest text-primary hover:underline">
                  Back to login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@company.com"
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-low font-body text-[14px] text-on-surface focus:outline-none focus:border-primary-container transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #00c2a8, #006b5c)', boxShadow: '0 4px 14px rgba(0,194,168,0.3)' }}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <div className="text-center pt-1">
                  <Link href="/login" className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">
                    Back to login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
