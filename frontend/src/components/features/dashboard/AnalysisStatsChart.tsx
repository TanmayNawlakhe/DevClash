import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const data = [
  { day: 'Mon', repos: 2 },
  { day: 'Tue', repos: 4 },
  { day: 'Wed', repos: 3 },
  { day: 'Thu', repos: 6 },
  { day: 'Fri', repos: 8 },
  { day: 'Sat', repos: 5 },
  { day: 'Sun', repos: 9 },
]

export function AnalysisStatsChart() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="font-heading font-bold">Analysis Velocity</h3>
          <p className="text-sm text-muted-foreground">Repos mapped this week</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-600">
          ↑ 28%
        </span>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="GittsuriArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.50 0.22 265)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="oklch(0.50 0.22 265)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                fontSize: 12,
              }}
              cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone"
              dataKey="repos"
              stroke="oklch(0.50 0.22 265)"
              fill="url(#GittsuriArea)"
              strokeWidth={2.5}
              dot={{ fill: 'oklch(0.50 0.22 265)', r: 3 }}
              activeDot={{ r: 5, fill: 'oklch(0.50 0.22 265)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
