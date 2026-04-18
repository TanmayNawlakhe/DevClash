import { MiniMap } from '@xyflow/react'
import { useGraphStore } from '../../../store/graphStore'

export function GraphMinimap() {
  const viewMode = useGraphStore((state) => state.viewMode)
  return (
    <MiniMap
      pannable
      zoomable
      className="!rounded-lg !border !border-border !bg-card !shadow-lg"
      maskColor="color-mix(in oklch, var(--background) 76%, transparent)"
      nodeColor={(node) => {
        if (viewMode === 'ownership') return String((node.style as any)?.['--node-owner'] ?? 'var(--primary)')
        if (viewMode === 'priority') return 'var(--primary)'
        return String((node.style as any)?.['--node-layer'] ?? 'var(--primary)')
      }}
    />
  )
}
