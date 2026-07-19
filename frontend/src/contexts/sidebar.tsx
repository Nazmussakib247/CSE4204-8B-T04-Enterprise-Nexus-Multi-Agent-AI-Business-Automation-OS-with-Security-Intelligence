'use client'

import { createContext, useContext, useState } from 'react'

interface SidebarCtx { open: boolean; toggle: () => void; close: () => void }
const Ctx = createContext<SidebarCtx>({ open: false, toggle: () => {}, close: () => {} })

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Ctx.Provider value={{ open, toggle: () => setOpen(v => !v), close: () => setOpen(false) }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSidebar = () => useContext(Ctx)
