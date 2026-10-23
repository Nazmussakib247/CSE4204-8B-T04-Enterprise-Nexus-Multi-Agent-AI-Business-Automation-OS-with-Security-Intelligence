'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { authApi, aiProvidersApi } from '@/lib/api'
import type { AiProviderSetting } from '@/lib/api'
import PageHeader from '@/components/ui/PageHeader'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { user } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<'profile' | 'integrations' | 'notifications' | 'danger'>('profile')
  const isAdmin = (user as { role?: string })?.role === 'admin'
  const [providers, setProviders] = useState<AiProviderSetting[]>([
    { provider: 'gemini', enabled: true, priority: 1, model: 'gemini-3.7-flash', configured: false },
    { provider: 'grok', enabled: false, priority: 2, model: 'grok-4-fast-reasoning', configured: false },
  ])
  const [providerApiReady, setProviderApiReady] = useState(true)
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({})
  const [savingProviders, setSavingProviders] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    aiProvidersApi.get().then(r => { setProviders(r.data.data); setProviderApiReady(true) }).catch(() => {
      setProviderApiReady(false)
      toast.error('AI provider backend is not deployed yet')
    })
  }, [isAdmin])

  const updateProvider = (provider: 'gemini' | 'grok', patch: Partial<AiProviderSetting>) =>
    setProviders(current => current.map(p => p.provider === provider ? { ...p, ...patch } : p))

  const toggleProvider = (provider: 'gemini' | 'grok') => {
    const current = providers.find(p => p.provider === provider)
    if (!current) return
    if (current.enabled && providers.filter(p => p.enabled).length === 1) {
      toast.error('At least one AI provider must remain enabled')
      return
    }
    updateProvider(provider, { enabled: !current.enabled })
  }

  const saveProviders = async () => {
    if (providers.filter(p => p.enabled).length === 0) { toast.error('Enable at least one provider'); return }
    setSavingProviders(true)
    try {
      const response = await aiProvidersApi.save(providers.map(p => ({ ...p, api_key: providerKeys[p.provider] || undefined })))
      setProviders(response.data.data); setProviderKeys({}); toast.success('AI provider priority and keys saved')
    } catch (err) { toast.error('Provider settings could not be saved') } finally { setSavingProviders(false) }
  }

  const handleSave = async () => {
    if (password && password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setSaving(true)
    try {
      await authApi.updateMe({ name, ...(password ? { password } : {}) })
      toast.success('Profile updated')
      setPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const integrations = [
    { name: 'Gemini AI', icon: 'psychology', status: 'connected', desc: 'AI reasoning — CV screening, anomaly detection, sentiment analysis', color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Supabase', icon: 'storage', status: 'connected', desc: 'Primary PostgreSQL database with Row Level Security', color: 'text-primary', bg: 'bg-primary/10' },
    { name: 'n8n Workflows', icon: 'account_tree', status: 'connected', desc: 'Automation trigger engine for agent pipelines', color: 'text-primary', bg: 'bg-primary/10' },
    { name: 'Nodemailer (SMTP)', icon: 'email', status: 'connected', desc: 'Password reset and escalation email delivery', color: 'text-primary', bg: 'bg-primary/10' },
  ]

  const NOTIF_KEYS = ['security_alerts', 'agent_completions', 'weekly_digest', 'finance_anomalies'] as const
  type NotifKey = typeof NOTIF_KEYS[number]
  const defaultPrefs: Record<NotifKey, boolean> = {
    security_alerts: true, agent_completions: true, weekly_digest: false, finance_anomalies: true
  }
  const userPrefs = (user as unknown as { notification_prefs?: Record<NotifKey, boolean> })?.notification_prefs ?? {}
  const [notifState, setNotifState] = useState<Record<NotifKey, boolean>>({ ...defaultPrefs, ...userPrefs })
  const [savingNotifs, setSavingNotifs] = useState(false)

  const handleToggleNotif = useCallback(async (key: NotifKey) => {
    const next = { ...notifState, [key]: !notifState[key] }
    setNotifState(next)
    setSavingNotifs(true)
    try {
      await authApi.updateMe({ notification_prefs: next })
    } catch {
      // Revert on failure
      setNotifState(notifState)
      toast.error('Failed to save preference')
    } finally {
      setSavingNotifs(false)
    }
  }, [notifState])

  const notifications: { label: string; desc: string; key: NotifKey }[] = [
    { label: 'Security alerts', desc: 'Critical threats and failed login attempts', key: 'security_alerts' },
    { label: 'AI agent completions', desc: 'When CV screening or finance analysis finishes', key: 'agent_completions' },
    { label: 'Weekly digest', desc: 'Summary of all agent activity', key: 'weekly_digest' },
    { label: 'Finance anomalies', desc: 'High-severity transaction alerts via email', key: 'finance_anomalies' },
  ]

  const navItems = [
    { key: 'profile', label: 'Profile', icon: 'person' },
    { key: 'integrations', label: 'Integrations', icon: 'electrical_services' },
    { key: 'notifications', label: 'Notifications', icon: 'notifications' },
    { key: 'danger', label: 'Danger Zone', icon: 'warning' },
  ] as const

  return (
    <div className="space-y-6 max-w-[1100px]">
      <PageHeader title="Settings" subtitle="Manage your profile, integrations, and preferences" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Role', value: (user as { role?: string })?.role ?? '—', icon: 'shield_person', color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Integrations', value: `${integrations.filter(i => i.status === 'connected').length}/${integrations.length}`, icon: 'electrical_services', color: 'text-primary-container', bg: 'bg-primary-container/10' },
          { label: 'Notifications On', value: Object.values(notifState).filter(Boolean).length, icon: 'notifications_active', color: 'text-tertiary', bg: 'bg-tertiary-fixed/40' },
          { label: 'Account', value: 'Active', icon: 'verified_user', color: 'text-primary', bg: 'bg-primary/10' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-outline-variant/50">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.bg}`}>
              <span className={`material-symbols-outlined text-[18px] icon-filled ${s.color}`}>{s.icon}</span>
            </div>
            <p className="font-display text-[22px] font-bold text-on-surface capitalize">{s.value}</p>
            <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Nav */}
        <div className="w-44 flex-shrink-0 space-y-1">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all font-body text-[13px] ${
                activeSection === item.key ? 'bg-primary/10 text-primary font-medium' : 'text-on-surface-variant hover:bg-surface-container'
              } ${item.key === 'danger' && activeSection !== 'danger' ? '!text-error hover:!bg-error-container/20' : ''}`}
            >
              <span className={`material-symbols-outlined text-[18px] ${item.key === 'danger' ? 'text-error' : ''}`}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-2xl border border-outline-variant/50 overflow-hidden">
          {/* Profile */}
          {activeSection === 'profile' && (
            <div className="p-6 space-y-5">
              <h3 className="font-display text-[15px] font-semibold text-on-surface">Profile Settings</h3>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">Email</label>
                <div className="w-full px-4 py-3 bg-surface-container rounded-xl font-body text-[14px] text-on-surface-variant border border-outline-variant/50 cursor-not-allowed">
                  {user?.email ?? '—'}
                </div>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">Display Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-white rounded-xl font-body text-[14px] text-on-surface border border-outline-variant/50 focus:outline-none focus:border-primary-container transition-all"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  className="w-full px-4 py-3 bg-white rounded-xl font-body text-[14px] text-on-surface border border-outline-variant/50 focus:outline-none focus:border-primary-container transition-all"
                />
              </div>
              {password && (
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white rounded-xl font-body text-[14px] text-on-surface border border-outline-variant/50 focus:outline-none focus:border-primary-container transition-all"
                  />
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)' }}
              >
                <span className="material-symbols-outlined text-[16px]">{saving ? 'hourglass_empty' : 'save'}</span>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* Integrations */}
          {activeSection === 'integrations' && (
            <div className="p-6 space-y-5">
              <h3 className="font-display text-[15px] font-semibold text-on-surface">Integrations</h3>
              <div className="space-y-3">
                {integrations.map(int => (
                  <div key={int.name} className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/50 hover:border-primary-container/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${int.bg}`}>
                        <span className={`material-symbols-outlined text-[18px] icon-filled ${int.color}`}>{int.icon}</span>
                      </div>
                      <div>
                        <p className="font-body text-[14px] font-medium text-on-surface">{int.name}</p>
                        <p className="font-body text-[12px] text-on-surface-variant">{int.desc}</p>
                      </div>
                    </div>
                    <span className={`font-mono text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                      int.status === 'connected' ? 'bg-primary-container/10 text-primary border-primary-container/30' : 'bg-surface-container text-on-surface-variant border-outline-variant/50'
                    }`}>{int.status}</span>
                  </div>
                ))}
              </div>
              {isAdmin && (
                <div className="pt-5 border-t border-outline-variant/30 space-y-4">
                  <div><h4 className="font-display text-[15px] font-semibold text-on-surface">AI Provider Failover</h4><p className="font-body text-[12px] text-on-surface-variant mt-1">Priority 1 is called first. If it times out or fails, the next enabled provider is used automatically. Keys are encrypted server-side and never displayed again.</p></div>
                  {!providerApiReady && <p className="rounded-lg bg-error-container/20 px-3 py-2 font-body text-[12px] text-error">Backend update is pending. Deploy the latest Render backend, then reload before saving provider keys.</p>}
                  {providers.map(p => (
                    <div key={p.provider} className="rounded-xl border border-outline-variant/50 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-4"><div><p className="font-body text-[14px] font-semibold text-on-surface capitalize">{p.provider} AI</p><p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">{p.configured ? 'Key configured' : 'No key configured yet'}</p></div><button onClick={() => toggleProvider(p.provider)} className={`relative w-11 h-6 rounded-full ${p.enabled ? 'bg-primary-container' : 'bg-outline-variant'}`} aria-label={`Toggle ${p.provider}`}><span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${p.enabled ? 'translate-x-5' : ''}`} /></button></div>
                      <div className="grid md:grid-cols-2 gap-3"><input type="password" value={providerKeys[p.provider] || ''} onChange={e => setProviderKeys(k => ({ ...k, [p.provider]: e.target.value }))} placeholder={p.configured ? 'Leave blank to keep current key' : `Paste ${p.provider} API key`} className="px-3 py-2.5 rounded-lg border border-outline-variant/50 text-[13px]"/><input value={p.model} onChange={e => updateProvider(p.provider, { model: e.target.value })} placeholder="Model name" className="px-3 py-2.5 rounded-lg border border-outline-variant/50 text-[13px]"/></div>
                      <div className="flex gap-2 items-center"><span className="font-mono text-[10px] uppercase text-on-surface-variant">Priority</span>{([1,2] as const).map(n => <button key={n} onClick={() => { const other = providers.find(x => x.provider !== p.provider); updateProvider(p.provider, { priority: n }); if (other) updateProvider(other.provider, { priority: n === 1 ? 2 : 1 }) }} className={`w-8 h-7 rounded border font-mono text-[11px] ${p.priority === n ? 'bg-primary text-white border-primary' : 'border-outline-variant/50'}`}>{n}</button>)}</div>
                    </div>
                  ))}
                  <button onClick={saveProviders} disabled={savingProviders} className="px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#00c2a8,#006b5c)' }}>{savingProviders ? 'Saving...' : 'Save AI Providers'}</button>
                </div>
              )}
            </div>
          )}

          {/* Notifications */}
          {activeSection === 'notifications' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-[15px] font-semibold text-on-surface">Notification Preferences</h3>
                {savingNotifs && <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant animate-pulse">Saving…</span>}
              </div>
              <div className="space-y-2">
                {notifications.map(n => (
                  <div key={n.key} className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/50">
                    <div>
                      <p className="font-body text-[14px] font-medium text-on-surface">{n.label}</p>
                      <p className="font-body text-[12px] text-on-surface-variant">{n.desc}</p>
                    </div>
                    <button
                      onClick={() => handleToggleNotif(n.key)}
                      disabled={savingNotifs}
                      className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-60 ${notifState[n.key] ? 'bg-primary-container' : 'bg-outline-variant'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifState[n.key] ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danger Zone */}
          {activeSection === 'danger' && (
            <div className="p-6 space-y-4">
              <h3 className="font-display text-[15px] font-semibold text-error">Danger Zone</h3>
              <div className="border border-error/30 rounded-xl p-5 bg-error-container/10">
                <p className="font-body text-[14px] font-medium text-on-surface mb-1">Delete Account</p>
                <p className="font-body text-[13px] text-on-surface-variant mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
                <button
                  onClick={() => toast.error('Account deletion is disabled in this demo environment.')}
                  className="px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-error border border-error/40 hover:bg-error-container/20 transition-colors"
                >
                  Delete Account
                </button>
              </div>
              <div className="border border-outline-variant/50 rounded-xl p-5">
                <p className="font-body text-[14px] font-medium text-on-surface mb-1">Reset All Agent Data</p>
                <p className="font-body text-[13px] text-on-surface-variant mb-4">Clear all HR reports, finance records, support tickets, and analytics. Your account remains active.</p>
                <button
                  onClick={() => toast.error('Data reset is disabled in this demo environment.')}
                  className="px-4 py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold text-on-surface-variant border border-outline-variant/50 hover:bg-surface-container transition-colors"
                >
                  Reset Agent Data
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
