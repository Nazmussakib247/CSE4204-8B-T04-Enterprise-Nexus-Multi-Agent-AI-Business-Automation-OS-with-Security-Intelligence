'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useSidebar } from '@/contexts/sidebar'
import clsx from 'clsx'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: 'grid_view', href: '/dashboard' },
    ],
  },
  {
    label: 'AI Agents',
    items: [
      { label: 'HR Agent',   icon: 'groups',           href: '/hr' },
      { label: 'Finance',    icon: 'payments',          href: '/finance' },
      { label: 'Support',    icon: 'support_agent',     href: '/support' },
      { label: 'Analytics',  icon: 'bar_chart_4_bars',  href: '/analytics' },
      { label: 'Executive',  icon: 'auto_awesome',      href: '/executive' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Security', icon: 'shield',   href: '/security' },
      { label: 'Settings', icon: 'settings', href: '/settings' },
    ],
  },
]

const adminGroup = {
  label: 'Admin',
  items: [
    { label: 'Admin Panel', icon: 'admin_panel_settings', href: '/admin' },
  ],
}

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const role = (user as { role?: string } | null)?.role
  const groups = role === 'admin' ? [...navGroups, adminGroup] : navGroups
  const { open, close } = useSidebar()

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  const SidebarContent = () => (
    <aside className="w-[240px] h-screen flex flex-col"
      style={{ background: '#16191a', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #00c2a8, #006b5c)' }}>
            <span className="material-symbols-outlined text-white text-[18px] icon-filled">hub</span>
          </div>
          <div>
            <p className="font-display text-[14px] font-bold text-white leading-tight tracking-tight">Enterprise NeXus</p>
            <p className="font-mono text-[9px] text-white/30 uppercase tracking-widest mt-0.5">Multi-Agent OS</p>
          </div>
        </div>
      </div>

      {/* Status pill */}
      <div className="px-5 mb-5">
        <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse flex-shrink-0" />
          <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest">All Systems Active</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="font-mono text-[10px] text-white/25 uppercase tracking-widest px-3 mb-1.5">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={close}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-body transition-all duration-150',
                      active ? 'text-white font-medium' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                    )}
                    style={active ? { background: 'rgba(0,194,168,0.12)', color: '#00c2a8' } : {}}
                  >
                    <span className={clsx('material-symbols-outlined text-[18px] flex-shrink-0', active ? 'icon-filled' : '')}>
                      {item.icon}
                    </span>
                    {item.label}
                    {active && <span className="ml-auto w-1 h-4 rounded-full bg-primary-container" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      {user && (
        <div className="px-3 pb-5 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-display text-[13px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #00c2a8, #006b5c)' }}>
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-white/80 truncate">{user.name}</p>
              <p className="font-mono text-[10px] text-white/30 uppercase tracking-wider">{(user as { role?: string })?.role ?? 'user'}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-white/25 hover:text-error hover:bg-white/[0.04] transition-all"
              title="Sign out"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar — always visible on md+ */}
      <div className="hidden md:block fixed left-0 top-0 h-screen z-50">
        <SidebarContent />
      </div>

      {/* Mobile sidebar — slide-in overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />
          {/* Drawer */}
          <div className="relative z-10 animate-slide-in-left">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  )
}
