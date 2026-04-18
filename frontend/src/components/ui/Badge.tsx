import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { LAYER_COLORS, STATUS_LABELS } from '../../lib/constants'
import type { AnalysisStatus, Layer } from '../../types'

export function Badge({
  children,
  className,
  tone = 'default',
}: {
  children: React.ReactNode
  className?: string
  tone?: 'default' | 'success' | 'warning' | 'destructive'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        tone === 'default' && 'border-border bg-muted text-muted-foreground',
        tone === 'success' && 'border-chart-4/40 bg-chart-4/15 text-chart-4',
        tone === 'warning' && 'border-primary/40 bg-primary/10 text-primary',
        tone === 'destructive' && 'border-destructive/40 bg-destructive/10 text-destructive',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function LayerBadge({ layer, className }: { layer: Layer; className?: string }) {
  const color = LAYER_COLORS[layer]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', color.bg, color.text, className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {color.label}
    </span>
  )
}

export function StatusBadge({ status }: { status: AnalysisStatus }) {
  const isActive = ['pending', 'cloning', 'parsing', 'analyzing', 'ai_processing', 'cancelling'].includes(status)
  if (status === 'complete') {
    return (
      <Badge tone="success">
        <CheckCircle2 className="size-3" />
        {STATUS_LABELS[status]}
      </Badge>
    )
  }

  if (status === 'failed') {
    return (
      <Badge tone="destructive">
        <XCircle className="size-3" />
        {STATUS_LABELS[status]}
      </Badge>
    )
  }

  if (status === 'cancelled') {
    return (
      <Badge tone="destructive">
        <XCircle className="size-3" />
        {STATUS_LABELS[status]}
      </Badge>
    )
  }

  return (
    <Badge tone="warning" className={isActive ? 'animate-pulse' : ''}>
      {isActive ? <Loader2 className="size-3 animate-spin" /> : null}
      {STATUS_LABELS[status]}
    </Badge>
  )
}
