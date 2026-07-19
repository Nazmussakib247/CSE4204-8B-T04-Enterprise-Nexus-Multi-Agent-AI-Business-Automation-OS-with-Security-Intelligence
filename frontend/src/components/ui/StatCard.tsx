import clsx from 'clsx'

interface StatCardProps {
  label: string
  value: string | number
  icon: string
  iconColor?: string
  trend?: string
  trendUp?: boolean
  subtitle?: string
}

export default function StatCard({ label, value, icon, iconColor = 'text-primary-container', trend, trendUp, subtitle }: StatCardProps) {
  return (
    <div className="card flex flex-col gap-3 hover:shadow-card-hover transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-label-caps uppercase text-on-surface-variant/70 tracking-wider">{label}</p>
          <p className="font-display text-display-lg text-on-surface mt-1">{value}</p>
          {subtitle && <p className="font-body text-body-md text-on-surface-variant mt-0.5">{subtitle}</p>}
        </div>
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center bg-surface-container', iconColor)}>
          <span className={clsx('material-symbols-outlined', iconColor)}>{icon}</span>
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1">
          <span className={clsx('material-symbols-outlined text-sm', trendUp ? 'text-primary' : 'text-error')}>
            {trendUp ? 'trending_up' : 'trending_down'}
          </span>
          <span className={clsx('font-mono text-label-mono', trendUp ? 'text-primary' : 'text-error')}>{trend}</span>
        </div>
      )}
    </div>
  )
}
