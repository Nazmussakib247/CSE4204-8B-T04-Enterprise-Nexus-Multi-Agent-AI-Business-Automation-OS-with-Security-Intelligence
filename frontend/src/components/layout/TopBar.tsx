'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useSidebar } from '@/contexts/sidebar'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { searchApi, notificationsApi } from '@/lib/api'

const pageLabels: Record<string, { title: string; icon: string }> = {
  '/dashboard': { title: 'Dashboard',             icon: 'grid_view' },
  '/hr':        { title: 'HR Agent',              icon: 'groups' },
  '/finance':   { title: 'Finance Agent',         icon: 'payments' },
  '/support':   { title: 'Support Agent',         icon: 'support_agent' },
  '/analytics': { title: 'Analytics',             icon: 'bar_chart_4_bars' },
  '/executive': { title: 'Executive Agent',       icon: 'auto_awesome' },
  '/security':  { title: 'Security Intelligence', icon: 'shield' },
  '/settings':  { title: 'Settings',              icon: 'settings' },
  '/admin':     { title: 'Admin Panel',           icon: 'admin_panel_settings' },
}

interface SearchResult {
  type: 'hr' | 'finance' | 'support'
  id: string; title: string; subtitle: string; meta: string; link: string
}
interface Notification {
  id: string; type: string; title: string; message: string
  link?: string; read: boolean; created_at: string
}

const typeIcon: Record<string, string> = { hr: 'groups', finance: 'payments', support: 'support_agent' }
const typeColor: Record<string, string> = { hr: 'text-primary-container', finance: 'text-tertiary', support: 'text-primary' }
const notifTypeIcon: Record<string, string> = { info: 'info', success: 'check_circle', warning: 'warning', error: 'error' }
const notifTypeCls: Record<string, string> = {
  info: 'text-primary bg-primary/10',
  success: 'text-primary-container bg-primary-container/10',
  warning: 'text-yellow-600 bg-yellow-50',
  error: 'text-error bg-error-container',
}

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value)
  useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t) }, [value, delay])
  return d
}

export default function TopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { toggle } = useSidebar()

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const debouncedSearch = useDebounce(search, 300)
  const searchRef = useRef<HTMLDivElement>(null)

  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)

  const current = Object.entries(pageLabels).find(([key]) =>
    key === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(key)
  )?.[1] ?? { title: 'Dashboard', icon: 'grid_view' }

  // Search
  useEffect(() => {
    if (debouncedSearch.length < 2) { setSearchResults([]); setSearchOpen(false); return }
    setSearchLoading(true)
    searchApi.search(debouncedSearch)
      .then(r => { setSearchResults(r.data.results ?? []); setSearchOpen(true) })
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false))
  }, [debouncedSearch])

  // Notifications
  const fetchNotifs = useCallback(() => {
    notificationsApi.getAll({ limit: 15 })
      .then(r => { setNotifications(r.data.data ?? []); setUnreadCount(r.data.unread_count ?? 0) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchNotifs()
    const t = setInterval(fetchNotifs, 30_000)
    return () => clearInterval(t)
  }, [fetchNotifs])

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleMarkRead = async (id: string) => {
    await notificationsApi.markRead(id).catch(() => {})
    setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead().catch(() => {})
    setNotifications(n => n.map(x => ({ ...x, read: true })))
    setUnreadCount(0)
  }

  return (
    <header
      className="h-14 fixed top-0 right-0 left-0 md:left-[240px] z-40 bg-[#f8f9fa]/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors" aria-label="Open menu">
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant hidden sm:block">{current.icon}</span>
          <h1 className="font-display text-[15px] font-semibold text-on-surface tracking-tight">{current.title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Search */}
        <div className="relative hidden md:block" ref={searchRef}>
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
            {searchLoading ? 'hourglass_empty' : 'search'}
          </span>
          <input
            type="text"
            placeholder="Search all modules..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
            className="pl-9 pr-4 py-2 bg-white border border-outline-variant rounded-lg font-body text-[13px] text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container/20 transition-all w-56"
          />
          {searchOpen && (
            <div className="absolute top-full mt-2 left-0 w-80 bg-white rounded-xl border border-outline-variant shadow-lg overflow-hidden z-50">
              {searchResults.length === 0 ? (
                <div className="px-4 py-3 font-body text-[13px] text-on-surface-variant">No results found</div>
              ) : (
                <>
                  <div className="px-4 py-2 border-b border-outline-variant/30">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">{searchResults.length} results</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-outline-variant/10">
                    {searchResults.map(r => (
                      <button key={`${r.type}-${r.id}`}
                        onClick={() => { setSearch(''); setSearchOpen(false); router.push(r.link) }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors text-left"
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-surface-container">
                          <span className={`material-symbols-outlined text-[14px] icon-filled ${typeColor[r.type]}`}>{typeIcon[r.type]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-[13px] font-medium text-on-surface truncate">{r.title}</p>
                          <p className="font-mono text-[10px] text-on-surface-variant truncate">{r.subtitle}</p>
                        </div>
                        <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant flex-shrink-0">{r.meta}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Notifications bell */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => setNotifOpen(o => !o)}
            className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-error rounded-full flex items-center justify-center font-mono text-[9px] text-white font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute top-full mt-2 right-0 w-80 bg-white rounded-xl border border-outline-variant shadow-lg overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/30">
                <span className="font-display text-[14px] font-semibold text-on-surface">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="font-mono text-[10px] uppercase tracking-wider text-primary hover:text-primary/80 transition-colors">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <span className="material-symbols-outlined text-[28px] text-on-surface-variant/30 block mb-2">notifications_none</span>
                    <p className="font-body text-[13px] text-on-surface-variant">No notifications yet</p>
                  </div>
                ) : notifications.map(n => (
                  <div key={n.id} className={`px-4 py-3 border-b border-outline-variant/10 last:border-0 ${!n.read ? 'bg-primary-container/5' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${notifTypeCls[n.type] ?? notifTypeCls.info}`}>
                        <span className="material-symbols-outlined text-[13px] icon-filled">{notifTypeIcon[n.type] ?? 'info'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-body text-[13px] ${!n.read ? 'font-semibold' : ''} text-on-surface`}>{n.title}</p>
                          {!n.read && (
                            <button onClick={() => handleMarkRead(n.id)} className="flex-shrink-0 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors">
                              <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                          )}
                        </div>
                        <p className="font-body text-[12px] text-on-surface-variant mt-0.5 line-clamp-2">{n.message}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-mono text-[10px] text-on-surface-variant/50">{new Date(n.created_at).toLocaleDateString()}</span>
                          {n.link && (
                            <Link href={n.link} onClick={() => setNotifOpen(false)} className="font-mono text-[10px] text-primary hover:underline">View →</Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        {user && (
          <Link href="/settings" className="flex items-center gap-2 bg-white border border-outline-variant rounded-lg px-2.5 py-1.5 hover:border-primary-container/50 transition-all">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #00c2a8, #006b5c)' }}>
              {user.name?.[0]?.toUpperCase()}
            </div>
            <span className="font-body text-[13px] text-on-surface font-medium hidden sm:block">{user.name?.split(' ')[0]}</span>
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant hidden sm:block">expand_more</span>
          </Link>
        )}
      </div>
    </header>
  )
}
