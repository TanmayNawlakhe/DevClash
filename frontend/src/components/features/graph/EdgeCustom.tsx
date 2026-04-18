import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import { useState } from 'react'

export function EdgeCustom(props: any) {
  const [hovered, setHovered] = useState(false)
  const [path, labelX, labelY] = getBezierPath(props)

  return (
    <>
      {/* Wider invisible hit area for easier hovering */}
      <path
        d={path}
        fill="none"
        strokeWidth={12}
        stroke="transparent"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge
        path={path}
        markerEnd={props.markerEnd}
        style={{
          stroke: hovered
            ? 'var(--primary)'
            : 'color-mix(in oklch, var(--primary) 45%, var(--border))',
          strokeWidth: hovered ? 2.5 : 1.8,
          strokeDasharray: hovered ? '6 5' : undefined,
          animation: hovered ? 'dash 1.1s linear infinite' : undefined,
          opacity: hovered ? 1 : 0.72,
          transition: 'stroke 160ms ease, stroke-width 160ms ease, opacity 160ms ease',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan rounded-md border border-border bg-popover px-2 py-0.5 font-mono text-[10px] text-popover-foreground shadow-md"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            {props.data?.importType ?? 'direct'}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
