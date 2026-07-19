interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-lg">
      <div>
        <h1 className="font-display text-display-lg text-on-surface">{title}</h1>
        {subtitle && (
          <p className="font-body text-body-md text-on-surface-variant mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-sm">{action}</div>}
    </div>
  )
}
