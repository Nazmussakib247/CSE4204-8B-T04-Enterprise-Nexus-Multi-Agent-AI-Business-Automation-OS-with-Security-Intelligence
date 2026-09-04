import Link from 'next/link'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="border-b border-outline-variant/50 bg-white sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/store" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-on-primary">hub</span>
            </div>
            <span className="font-display text-[16px] font-semibold text-on-surface">Enterprise NeXus</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            <Link href="/store" className="px-3 py-2 rounded-lg font-body text-[14px] text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors">
              Store
            </Link>
            <Link href="/careers" className="px-3 py-2 rounded-lg font-body text-[14px] text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors">
              Careers
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/store/login" className="px-4 py-2 rounded-xl font-body text-[14px] font-medium text-on-surface hover:bg-surface-container-low transition-colors">
              Sign in
            </Link>
            <Link href="/store/register" className="px-4 py-2 rounded-xl bg-primary text-on-primary font-body text-[14px] font-medium hover:bg-primary/90 transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-outline-variant/50 bg-white">
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-mono text-[11px] text-on-surface-variant">Enterprise NeXus · Multi-Agent AI Business Automation OS</span>
          <div className="flex items-center gap-4">
            <Link href="/store" className="font-mono text-[11px] text-on-surface-variant hover:text-on-surface">Store</Link>
            <Link href="/careers" className="font-mono text-[11px] text-on-surface-variant hover:text-on-surface">Careers</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
