const data = [
  { day: 'Mon', repos: 2 },
  { day: 'Tue', repos: 4 },
  { day: 'Wed', repos: 3 },
  { day: 'Thu', repos: 6 },
  { day: 'Fri', repos: 8 },
  { day: 'Sat', repos: 5 },
  { day: 'Sun', repos: 9 },
]

const CHART_WIDTH = 620
const CHART_HEIGHT = 220
const PADDING_X = 34
const PADDING_TOP = 12
const PADDING_BOTTOM = 30
const MAX_REPOS = Math.max(...data.map((entry) => entry.repos), 1)

function pointX(index: number) {
  const innerWidth = CHART_WIDTH - PADDING_X * 2
  if (data.length <= 1) return PADDING_X
  return PADDING_X + (index / (data.length - 1)) * innerWidth
}

function pointY(value: number) {
  const innerHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const ratio = value / MAX_REPOS
  return PADDING_TOP + (1 - ratio) * innerHeight
}

function buildLinePath() {
  return data
    .map((entry, index) => `${index === 0 ? 'M' : 'L'} ${pointX(index)} ${pointY(entry.repos)}`)
    .join(' ')
}

function buildAreaPath() {
  const firstX = pointX(0)
  const lastX = pointX(data.length - 1)
  const baselineY = CHART_HEIGHT - PADDING_BOTTOM
  return `${buildLinePath()} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`
}

export function AnalysisStatsChart() {
  const linePath = buildLinePath()
  const areaPath = buildAreaPath()

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
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-full w-full" role="img" aria-label="Analysis velocity trend">
          <defs>
            <linearGradient id="gittsuriArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.50 0.22 265)" stopOpacity="0.30" />
              <stop offset="95%" stopColor="oklch(0.50 0.22 265)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((ratio) => {
            const y = PADDING_TOP + ratio * (CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM)
            return (
              <line
                key={ratio}
                x1={PADDING_X}
                y1={y}
                x2={CHART_WIDTH - PADDING_X}
                y2={y}
                stroke="color-mix(in oklch, var(--border) 70%, white)"
                strokeDasharray="4 6"
              />
            )
          })}

          <path d={areaPath} fill="url(#gittsuriArea)" />
          <path d={linePath} fill="none" stroke="oklch(0.50 0.22 265)" strokeWidth="2.5" strokeLinecap="round" />

          {data.map((entry, index) => (
            <g key={entry.day}>
              <circle cx={pointX(index)} cy={pointY(entry.repos)} r="3.5" fill="oklch(0.50 0.22 265)" />
              <text
                x={pointX(index)}
                y={CHART_HEIGHT - 10}
                textAnchor="middle"
                fontSize="11"
                fill="var(--muted-foreground)"
                fontFamily="var(--font-mono)"
              >
                {entry.day}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
