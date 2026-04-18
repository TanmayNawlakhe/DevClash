import { motion } from 'framer-motion'

export function ProgressRing({
  progress,
  size = 132,
  strokeWidth = 9,
  label,
}: {
  progress: number
  size?: number
  strokeWidth?: number
  label?: string
}) {
  const center = size / 2
  const radius = center - strokeWidth / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} stroke="var(--muted)" strokeWidth={strokeWidth} fill="none" />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          stroke="var(--primary)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - progress / 100) }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-mono text-2xl font-semibold">{Math.round(progress)}%</div>
        {label ? <div className="text-xs text-muted-foreground">{label}</div> : null}
      </div>
    </div>
  )
}
