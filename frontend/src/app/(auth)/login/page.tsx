'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'
import AlreadySignedInGate from '@/components/auth/AlreadySignedInGate'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Email and password required'); return }
    setLoading(true)
    try {
      const signedInUser = await login(email, password)
      router.push(['customer', 'candidate'].includes(signedInUser.role) ? '/store' : '/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlreadySignedInGate dashboardPath="/dashboard">
    <div className="min-h-screen w-full flex">
      {/* ── Left Panel ─────────────────────────────────── */}
      <div className="hidden lg:flex w-[480px] flex-shrink-0 flex-col bg-[#1a1d1e] relative overflow-hidden">
        {/* Grid pattern */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col h-full p-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="w-9 h-9 rounded-xl bg-primary-container/20 border border-primary-container/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl text-primary-container icon-filled">hub</span>
            </div>
            <span className="font-display text-[15px] font-semibold text-white/80 tracking-tight">Enterprise NeXus</span>
          </div>

          {/* Hero */}
          <div className="py-16">
            <div className="inline-flex items-center gap-2 bg-primary-container/10 border border-primary-container/20 rounded-full px-3 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
              <span className="font-mono text-[11px] text-primary-container uppercase tracking-widest">5 Agents Active</span>
            </div>
            <h1 className="font-display text-[40px] font-bold text-white leading-[1.15] tracking-tight mb-4">
              Your AI-Powered<br />
              <span className="text-gradient-primary">Business OS</span>
            </h1>
            <p className="font-body text-[15px] text-white/40 leading-relaxed max-w-xs">
              Automate HR screening, finance monitoring, customer support, and executive intelligence — all in one platform.
            </p>
          </div>

          {/* Agent chips */}
          <div className="grid grid-cols-2 gap-2 mb-10">
            {[
              { icon: 'groups', label: 'HR Agent', color: 'text-primary-container' },
              { icon: 'payments', label: 'Finance AI', color: 'text-tertiary-fixed-dim' },
              { icon: 'support_agent', label: 'Support Bot', color: 'text-primary-container' },
              { icon: 'analytics', label: 'Analytics', color: 'text-tertiary-fixed-dim' },
              { icon: 'auto_awesome', label: 'Executive', color: 'text-primary-container' },
              { icon: 'security', label: 'Security', color: 'text-error' },
            ].map(({ icon, label, color }) => (
              <div key={label} className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                <span className={`material-symbols-outlined text-base ${color}`}>{icon}</span>
                <span className="font-mono text-[11px] text-white/40 uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── Right Panel ────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-[#f8f9fa] px-6 py-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-primary-container/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg text-primary-container icon-filled">hub</span>
            </div>
            <span className="font-display text-[15px] font-semibold text-on-surface">Enterprise NeXus</span>
          </div>

          <h2 className="font-display text-[28px] font-bold text-on-surface mb-1 tracking-tight">Welcome back</h2>
          <p className="font-body text-[14px] text-on-surface-variant mb-8">Sign in to your dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-widest text-on-surface-variant mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                className="w-full bg-white border border-outline-variant rounded-xl px-4 py-3 font-body text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-mono text-[11px] uppercase tracking-widest text-on-surface-variant">
                  Password
                </label>
                <Link href="/forgot-password" className="font-body text-[13px] text-primary hover:text-primary-container transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-white border border-outline-variant rounded-xl px-4 py-3 pr-11 font-body text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors p-1"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPass ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60 mt-2"
              style={{ background: loading ? '#00a892' : 'linear-gradient(135deg, #00c2a8 0%, #006b5c 100%)', boxShadow: '0 4px 20px rgba(0,194,168,0.35)' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="font-body text-[14px] text-on-surface-variant">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-primary font-semibold hover:text-primary-container transition-colors">
                Create one
              </Link>
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-outline-variant/50 flex gap-5 justify-center">
            {['Privacy', 'Terms', 'Docs'].map(item => (
              <a key={item} href="#" className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/40 hover:text-on-surface-variant transition-colors">
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
    </AlreadySignedInGate>
  )
}
