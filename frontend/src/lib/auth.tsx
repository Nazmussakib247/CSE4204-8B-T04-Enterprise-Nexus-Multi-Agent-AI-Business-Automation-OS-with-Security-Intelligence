'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from './api'

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: (redirectTo?: string) => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const authRequestId = useRef(0)

  useEffect(() => {
    const requestId = ++authRequestId.current
    let active = true
    const isCurrentRequest = () => active && authRequestId.current === requestId

    const restoreSession = async () => {
      try {
        const { data } = await authApi.me()
        if (isCurrentRequest()) setUser(data.user)
      } catch {
        // Access tokens are short lived. A page reload must recover an
        // otherwise valid storefront/office session using its refresh token.
        try {
          await authApi.refresh()
          const { data } = await authApi.me()
          if (isCurrentRequest()) setUser(data.user)
        } catch {
          if (isCurrentRequest()) setUser(null)
        }
      } finally {
        if (isCurrentRequest()) setLoading(false)
      }
    }

    void restoreSession()
    return () => { active = false }
  }, [])

  const login = async (email: string, password: string) => {
    const requestId = ++authRequestId.current
    setLoading(true)
    try {
      const { data } = await authApi.login(email, password)
      if (authRequestId.current === requestId) setUser(data.user)
      return data.user
    } finally {
      if (authRequestId.current === requestId) setLoading(false)
    }
  }

  const logout = async (redirectTo = '/login') => {
    const requestId = ++authRequestId.current
    try {
      await authApi.logout()
    } catch {
      // proceed to login even if request fails
    }
    setUser(null)
    if (authRequestId.current === requestId) setLoading(false)
    window.location.href = redirectTo
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
