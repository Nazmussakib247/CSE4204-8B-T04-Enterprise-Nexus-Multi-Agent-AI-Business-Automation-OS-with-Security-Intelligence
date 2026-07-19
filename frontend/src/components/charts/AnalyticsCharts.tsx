'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from 'recharts'

interface KPIHistoryProps {
  reports: { created_at: string; overall_score: number; performance_rating: string }[]
}

interface HRDonutProps {
  shortlisted: number
  review: number
  rejected: number
}

interface SupportFunnelProps {
  total: number
  open: number
  resolved: number
  escalated: number
  by_urgency: { low: number; medium: number; high: number }
}

const ratingColor = (r: string) =>
  r === 'excellent' ? '#00c2a8' : r === 'good' ? '#4ecdc4' : r === 'average' ? '#f59e0b' : '#ef4444'

const CustomDot = (props: { cx?: number; cy?: number; payload?: { performance_rating: string } }) => {
  const { cx = 0, cy = 0, payload } = props
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={ratingColor(payload?.performance_rating ?? '')}
      stroke="#fff"
      strokeWidth={2}
    />
  )
}

export function KPIHistoryChart({ reports }: KPIHistoryProps) {
  const data = [...reports]
    .reverse()
    .slice(-12)
    .map(r => ({
      date: new Date(r.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      score: r.overall_score,
      performance_rating: r.performance_rating,
    }))

  if (data.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="material-symbols-outlined text-[18px] icon-filled text-primary-container">insights</span>
        <h3 className="font-display text-[15px] font-semibold text-on-surface">KPI Score History</h3>
        <span className="ml-auto font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Last {data.length} reports</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const item = payload[0]
              return (
                <div className="bg-[#16191a] border border-white/10 rounded-xl px-4 py-3 shadow-xl">
                  <p className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-1">{label}</p>
                  <p className="font-display text-[20px] font-bold" style={{ color: ratingColor((item.payload as { performance_rating: string })?.performance_rating) }}>
                    {item.value}
                  </p>
                  <p className="font-mono text-[10px] capitalize" style={{ color: ratingColor((item.payload as { performance_rating: string })?.performance_rating) }}>
                    {(item.payload as { performance_rating: string })?.performance_rating}
                  </p>
                </div>
              )
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#00c2a8"
            strokeWidth={2.5}
            dot={<CustomDot />}
            activeDot={{ r: 6, fill: '#00c2a8', stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function HRDonutChart({ shortlisted, review, rejected }: HRDonutProps) {
  const total = shortlisted + review + rejected
  if (total === 0) return null

  const data = [
    { name: 'Shortlisted', value: shortlisted, color: '#00c2a8' },
    { name: 'Under Review', value: review, color: '#f59e0b' },
    { name: 'Rejected', value: rejected, color: '#ef4444' },
  ].filter(d => d.value > 0)

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="material-symbols-outlined text-[18px] icon-filled text-primary-container">groups</span>
        <h3 className="font-display text-[15px] font-semibold text-on-surface">HR Shortlist Breakdown</h3>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <PieChart width={160} height={160}>
            <Pie
              data={data}
              cx={75}
              cy={75}
              innerRadius={48}
              outerRadius={72}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} stroke="none" />
              ))}
            </Pie>
          </PieChart>
        </div>
        <div className="flex-1 space-y-3">
          {data.map(d => (
            <div key={d.name} className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-on-surface-variant">{d.name}</span>
                  <span className="font-display text-[14px] font-bold text-on-surface">{d.value}</span>
                </div>
                <div className="mt-1 h-1 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(d.value / total) * 100}%`, background: d.color }} />
                </div>
              </div>
            </div>
          ))}
          <p className="font-mono text-[10px] text-on-surface-variant/50 uppercase tracking-wider pt-1">{total} total candidates</p>
        </div>
      </div>
    </div>
  )
}

export function SupportFunnelChart({ total, open, resolved, escalated, by_urgency }: SupportFunnelProps) {
  const statusData = [
    { name: 'Open', value: open, color: '#94a3b8' },
    { name: 'Resolved', value: resolved, color: '#00c2a8' },
    { name: 'Escalated', value: escalated, color: '#ef4444' },
  ]

  const urgencyData = [
    { name: 'Low', value: by_urgency?.low ?? 0 },
    { name: 'Medium', value: by_urgency?.medium ?? 0 },
    { name: 'High', value: by_urgency?.high ?? 0 },
  ]

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="material-symbols-outlined text-[18px] icon-filled text-primary">support_agent</span>
        <h3 className="font-display text-[15px] font-semibold text-on-surface">Support Funnel</h3>
        <span className="ml-auto font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">{total} tickets</span>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {/* Status donut */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant mb-3">By Status</p>
          <div className="flex items-center gap-3">
            <PieChart width={100} height={100}>
              <Pie data={statusData} cx={45} cy={45} innerRadius={28} outerRadius={44} paddingAngle={3} dataKey="value">
                {statusData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
              </Pie>
            </PieChart>
            <div className="space-y-1.5">
              {statusData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="font-mono text-[10px] text-on-surface-variant">{d.name}</span>
                  <span className="font-display text-[12px] font-bold text-on-surface ml-auto pl-2">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Urgency bars */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant mb-3">By Urgency</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={urgencyData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,194,168,0.06)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="bg-[#16191a] border border-white/10 rounded-xl px-3 py-2 shadow-xl">
                      <p className="font-mono text-[10px] text-white/40">{label}</p>
                      <p className="font-display text-[14px] font-bold text-white">{payload[0].value}</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                <Cell fill="#94a3b8" />
                <Cell fill="#f59e0b" />
                <Cell fill="#ef4444" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
