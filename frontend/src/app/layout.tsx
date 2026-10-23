import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Enterprise NeXus — Multi-Agent AI OS',
  description: 'Unified AI-powered business automation platform',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#2e3132',
                color: '#f0f1f2',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                borderRadius: '8px',
              },
              success: { iconTheme: { primary: '#00c2a8', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ba1a1a', secondary: '#fff' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
