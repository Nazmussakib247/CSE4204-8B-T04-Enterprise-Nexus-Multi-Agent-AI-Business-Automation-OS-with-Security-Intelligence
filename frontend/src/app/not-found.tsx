import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center max-w-md px-sm">
        <p className="font-mono text-label-caps uppercase tracking-widest text-on-surface-variant mb-md">Error 404</p>
        <h1 className="font-display text-display-lg text-on-surface mb-sm">Page not found</h1>
        <p className="font-body text-body-md text-on-surface-variant mb-lg">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/dashboard" className="btn-primary inline-block">
          Return to Dashboard
        </Link>
      </div>
    </div>
  )
}
