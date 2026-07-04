'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend, Cell,
} from 'recharts'

interface SpendChartProps {
  byCategory: Record<string, number>
}

interface AnomalyTrendProps {
  records: { expense_date: string; severity: string; amount: number }[]
}

const COLORS = ['#00c2a8', '#006b5c', '#4ecdc4', '#1a9e90', '#00897b', '#26a69a', '#80cbc4', '#b2dfdb']

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#16191a] border border-white/10 rounded-xl px-4 py-3 shadow-xl">
      <p className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-display text-[14px] font-bold text-white">
          <span className="font-mono text-[10px] text-white/40 normal-case mr-2">{p.name}</span>
          ${Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export function SpendByCategoryChart({ byCategory }: SpendChartProps) {
  const data = Object.entries(byCategory)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  if (data.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="material-symbols-outlined text-[18px] icon-filled text-primary-container">bar_chart</span>
        <h3 className="font-display text-[15px] font-semibold text-on-surface">Spend by Category</h3>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,194,168,0.06)' }} />
          <Bar dataKey="value" name="Spend" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AnomalyTrendChart({ records }: AnomalyTrendProps) {
  // Group by date, count anomalies (high/critical) vs normal
  const byDate: Record<string, { date: string; anomalies: number; normal: number; spend: number }> = {}

  records.forEach(r => {
    const d = r.expense_date
    if (!byDate[d]) byDate[d] = { date: d, anomalies: 0, normal: 0, spend: 0 }
    byDate[d].spend += Number(r.amount)
    if (r.severity === 'high' || r.severity === 'critical') {
      byDate[d].anomalies++
    } else {
      byDate[d].normal++
    }
  })

  const data = Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map(d => ({ ...d, date: d.date.slice(5) })) // MM-DD

  if (data.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/50 p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="material-symbols-outlined text-[18px] icon-filled text-error">trending_up</span>
        <h3 className="font-display text-[15px] font-semibold text-on-surface">Anomaly Trend</h3>
        <span className="ml-auto font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Last 30 days</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <div className="bg-[#16191a] border border-white/10 rounded-xl px-4 py-3 shadow-xl">
                <p className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-2">{label}</p>
                {payload.map((p, i) => (
                  <p key={i} className="font-display text-[13px] font-bold" style={{ color: p.color }}>
                    {p.name}: {p.value}
                  </p>
                ))}
              </div>
            )
          }} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">{v}</span>}
          />
          <Line type="monotone" dataKey="anomalies" name="Anomalies" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="normal" name="Normal" stroke="#00c2a8" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
