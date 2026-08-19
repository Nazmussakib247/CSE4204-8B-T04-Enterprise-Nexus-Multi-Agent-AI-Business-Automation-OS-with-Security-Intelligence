export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex overflow-hidden bg-surface">
      {children}
    </div>
  )
}
