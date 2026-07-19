interface EmptyStateProps {
  icon: string
  title: string
  description: string
  action?: React.ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-xl text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mb-md">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant">{icon}</span>
      </div>
      <h3 className="font-display text-headline-sm text-on-surface mb-xs">{title}</h3>
      <p className="font-body text-body-md text-on-surface-variant max-w-sm">{description}</p>
      {action && <div className="mt-md">{action}</div>}
    </div>
  )
}
