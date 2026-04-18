import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import { formatNumber } from '../../../lib/utils'

const colorMap = {
  indigo: {
    bg: 'bg-indigo-50',
    icon: 'bg-indigo-100 text-indigo-600',
    glow: 'shadow-indigo-100',
    trend: 'text-emerald-600 bg-emerald-50',
  },
  violet: {
    bg: 'bg-violet-50',
    icon: 'bg-violet-100 text-violet-600',
    glow: 'shadow-violet-100',
    trend: 'text-emerald-600 bg-emerald-50',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'bg-purple-100 text-purple-600',
    glow: 'shadow-purple-100',
    trend: 'text-emerald-600 bg-emerald-50',
  },
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-600',
    glow: 'shadow-blue-100',
    trend: 'text-emerald-600 bg-emerald-50',
  },
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  color = 'indigo',
}: {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: { direction: 'up' | 'down'; percent: number }
  color?: keyof typeof colorMap
}) {
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/\D/g, ''))
  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => formatNumber(Math.round(latest)))
  const c = colorMap[color]

  useEffect(() => {
    if (!Number.isNaN(numeric)) {
      const controls = animate(count, numeric, { duration: 1.4, ease: 'easeOut' })
      return controls.stop
    }
  }, [count, numeric])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className={`relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-lg ${c.glow}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className={`flex size-11 items-center justify-center rounded-xl ${c.icon}`}>
          <Icon className="size-5" />
        </div>
        {trend ? (
          <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${c.trend}`}>
            {trend.direction === 'up' ? '↑' : '↓'} {trend.percent}%
          </span>
        ) : null}
      </div>

      {/* Value */}
      <div className="mt-4 font-mono text-3xl font-bold tracking-tight text-foreground">
        {Number.isNaN(numeric) ? value : <motion.span>{rounded}</motion.span>}
      </div>

      {/* Label */}
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>

      {/* Bottom accent line */}
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent`} />
    </motion.div>
  )
}
