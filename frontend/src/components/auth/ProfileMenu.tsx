'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function ProfileMenu() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!user) return null
  const initial = user.name.trim().charAt(0).toUpperCase()

  const go = (path: string) => { setOpen(false); router.push(path) }
  const handleSignOut = () => { setOpen(false); logout('/store') }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border border-outline-variant hover:bg-surface-container-low transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center font-body text-[12px] font-semibold">
          {initial}
        </span>
        <span className="font-body text-[13px] text-on-surface">{user.name.split(' ')[0]}</span>
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">expand_more</span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-56 bg-white rounded-xl border border-outline-variant/50 shadow-lg py-1.5 z-20">
          <div className="px-3.5 py-2 border-b border-outline-variant/30">
            <p className="font-body text-[13px] font-medium text-on-surface truncate">{user.name}</p>
            <p className="font-mono text-[10px] text-on-surface-variant truncate mt-0.5">{user.email}</p>
          </div>
          <button onClick={() => go('/store/orders')} className="w-full flex items-center gap-2.5 px-3.5 py-2 font-body text-[13px] text-on-surface hover:bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined text-[17px] text-on-surface-variant">inventory_2</span>
            My orders
          </button>
          <button onClick={() => go('/store/support')} className="w-full flex items-center gap-2.5 px-3.5 py-2 font-body text-[13px] text-on-surface hover:bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined text-[17px] text-on-surface-variant">support_agent</span>
            Support
          </button>
          <div className="border-t border-outline-variant/30 mt-1 pt-1">
            <button onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-3.5 py-2 font-body text-[13px] text-on-surface hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined text-[17px] text-on-surface-variant">logout</span>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
