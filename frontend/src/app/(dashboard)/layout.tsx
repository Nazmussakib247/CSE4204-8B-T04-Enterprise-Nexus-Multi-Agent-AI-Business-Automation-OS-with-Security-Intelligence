'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { SidebarProvider } from '@/contexts/sidebar'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import WelcomeTour from '@/components/onboarding/WelcomeTour'

function DashboardInner({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/login')
  }, [isAuthenticated, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
          <p className="font-mono text-[11px] text-on-surface-variant uppercase tracking-widest">Loading Nexus...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-[#f4f5f6]">
      <Sidebar />
      <TopBar />
      {/* ml-[240px] on md+, no margin on mobile (sidebar is overlay) */}
      <main className="md:ml-[240px] pt-14 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8 animate-fade-in">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
      <WelcomeTour />
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardInner>{children}</DashboardInner>
    </SidebarProvider>
  )
}
