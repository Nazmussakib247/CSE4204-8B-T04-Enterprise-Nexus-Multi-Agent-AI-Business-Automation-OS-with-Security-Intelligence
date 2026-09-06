'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import AlreadySignedInGate from '@/components/auth/AlreadySignedInGate'
import { authApi, getApiErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'

export default function RegisterPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [role, setRole] = useState<'employee' | 'customer' | 'candidate' | ''>('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
  const passwordValid = Object.values(passwordChecks).every(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password || !role) { toast.error('Complete all fields, including account type'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    if (!passwordValid) { toast.error('Password does not meet the requirements below'); return }
    setLoading(true)
    try {
      const { data } = await authApi.register(name, email, password, role)
      if (data.pending_approval) {
        toast.success('Account request sent. An admin must approve it before you can sign in.')
        router.push(role === 'employee' ? '/login' : '/store/login')
      } else {
        await login(email, password)
        toast.success('Customer account created')
        router.push('/store')
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlreadySignedInGate dashboardPath="/dashboard">
    <div className="min-h-screen w-full flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-[480px] flex-shrink-0 flex-col bg-[#1a1d1e] relative overflow-hidden">
        <div className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col h-full p-10">
          <div className="flex items-center gap-3 mb-auto">
            <div className="w-9 h-9 rounded-xl bg-primary-container/20 border border-primary-container/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl text-primary-container icon-filled">hub</span>
            </div>
            <span className="font-display text-[15px] font-semibold text-white/80 tracking-tight">Enterprise NeXus</span>
          </div>
          <div className="py-16">
            <h1 className="font-display text-[40px] font-bold text-white leading-[1.15] tracking-tight mb-4">
              Join your team&apos;s<br />
              <span className="text-gradient-primary">AI workspace</span>
            </h1>
            <p className="font-body text-[15px] text-white/40 leading-relaxed max-w-xs">
              Get access to five specialized AI agents that automate your daily business operations.
            </p>
          </div>
          <div className="space-y-3 mb-10">
            {[
              { icon: 'check_circle', text: 'AI-powered CV screening & hiring' },
              { icon: 'check_circle', text: 'Financial anomaly detection' },
              { icon: 'check_circle', text: 'Automated customer support' },
              { icon: 'check_circle', text: 'Real-time KPI dashboards' },
              { icon: 'check_circle', text: 'Executive intelligence briefings' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="material-symbols-outlined text-base text-primary-container icon-filled">{icon}</span>
                <span className="font-body text-[14px] text-white/50">{text}</span>
              </div>
            ))}

            <div>
              <label className="block font-mono text-[11px] uppercase tracking-widest text-on-surface-variant mb-2">Account Type</label>
              <select
                value={role}
                required
                onChange={e => setRole(e.target.value as typeof role)}
                className="w-full bg-white border border-outline-variant rounded-xl px-4 py-3 font-body text-[14px] text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
              >
                <option value="" disabled>Select account type</option>
                <option value="employee">Employee — request office access</option>
                <option value="customer">Customer — buy products and track orders</option>
                <option value="candidate">Candidate — apply for careers</option>
              </select>
              <p className="font-body text-[12px] text-on-surface-variant mt-1.5">Customer accounts activate immediately. Employee and candidate requests need admin approval. Admin and manager roles cannot be requested publicly.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-[#f8f9fa] px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-primary-container/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg text-primary-container icon-filled">hub</span>
            </div>
            <span className="font-display text-[15px] font-semibold text-on-surface">Enterprise NeXus</span>
          </div>

          <h2 className="font-display text-[28px] font-bold text-on-surface mb-1 tracking-tight">Create account</h2>
          <p className="font-body text-[14px] text-on-surface-variant mb-8">Set up your access to the platform</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: 'Full Name', type: 'text', value: name, setter: setName, placeholder: 'Nazmus Sakib', auto: 'name' },
              { label: 'Email', type: 'email', value: email, setter: setEmail, placeholder: 'you@company.com', auto: 'email' },
            ].map(({ label, type, value, setter, placeholder, auto }) => (
              <div key={label}>
                <label className="block font-mono text-[11px] uppercase tracking-widest text-on-surface-variant mb-2">{label}</label>
                <input
                  type={type}
                  value={value}
                  onChange={e => setter(e.target.value)}
                  placeholder={placeholder}
                  autoComplete={auto}
                  className="w-full bg-white border border-outline-variant rounded-xl px-4 py-3 font-body text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
                />
              </div>
            ))}

            <div>
              <label className="block font-mono text-[11px] uppercase tracking-widest text-on-surface-variant mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  className="w-full bg-white border border-outline-variant rounded-xl px-4 py-3 pr-11 font-body text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
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

            <div>
              <label className="block font-mono text-[11px] uppercase tracking-widest text-on-surface-variant mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full bg-white border border-outline-variant rounded-xl px-4 py-3 font-body text-[14px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60 mt-2"
              style={{ background: 'linear-gradient(135deg, #00c2a8 0%, #006b5c 100%)', boxShadow: '0 4px 20px rgba(0,194,168,0.35)' }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="font-body text-[14px] text-on-surface-variant">
              Already have an account?{' '}
              <Link href="/login" className="text-primary font-semibold hover:text-primary-container transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
    </AlreadySignedInGate>
  )
}
