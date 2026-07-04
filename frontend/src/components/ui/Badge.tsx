import clsx from 'clsx'

type Variant = 'success' | 'warning' | 'error' | 'neutral' | 'purple' | 'info'

const variants: Record<Variant, string> = {
  success: 'bg-primary-container/20 text-primary',
  warning: 'bg-yellow-100 text-yellow-700',
  error:   'bg-error-container text-on-error-container',
  neutral: 'bg-surface-container text-on-surface-variant',
  purple:  'bg-tertiary-fixed text-on-tertiary-container',
  info:    'bg-blue-100 text-blue-700',
}

interface BadgeProps {
  label: string
  variant?: Variant
  className?: string
}

export default function Badge({ label, variant = 'neutral', className }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-full font-mono text-label-caps uppercase',
      variants[variant],
      className
    )}>
      {label}
    </span>
  )
}
