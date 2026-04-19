import { BaseEdge, getBezierPath } from '@xyflow/react'

export function EdgeCustom(props: any) {
  const [path] = getBezierPath(props)
  const pathDepth = props.data?.pathDepth as number | undefined
  const isGroupEdge = props.data?.isGroupEdge as boolean | undefined
  const pathHighlighted = pathDepth !== undefined
  const effectiveDepth = pathDepth ?? 0

  const strokeColor = pathHighlighted
    ? `color-mix(in oklch, var(--primary) ${Math.max(42, 88 - effectiveDepth * 18)}%, white)`
    : isGroupEdge
      ? 'color-mix(in oklch, var(--primary) 58%, var(--border))'
      : 'color-mix(in oklch, var(--primary) 45%, var(--border))'

  const strokeWidth = pathHighlighted
    ? Math.max(1.9, 2.7 - effectiveDepth * 0.35)
    : isGroupEdge
      ? 2.5
      : 1.8

  return (
    <BaseEdge
      path={path}
      markerEnd={props.markerEnd}
      style={{
        stroke: strokeColor,
        strokeWidth,
        strokeDasharray: pathHighlighted ? '6 5' : undefined,
        opacity: pathHighlighted ? Math.max(0.72, 0.96 - effectiveDepth * 0.1) : isGroupEdge ? 0.85 : 0.72,
        transition: 'stroke 160ms ease, stroke-width 160ms ease, opacity 160ms ease',
      }}
    />
  )
}
