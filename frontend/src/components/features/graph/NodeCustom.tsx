import { Handle, Position } from '@xyflow/react'
import { motion } from 'framer-motion'
import { AlertTriangle, FileCode2, Zap } from 'lucide-react'
import { LayerBadge } from '../../ui/Badge'
import { Tooltip } from '../../ui/Tooltip'
import { nodeFill, nodeLabel } from '../../../lib/graphUtils'
import { truncatePath } from '../../../lib/utils'
import { useGraphStore } from '../../../store/graphStore'
import type { FileNode } from '../../../types'

export function NodeCustom({ data, selected }: any) {
  const viewMode = useGraphStore((state) => state.viewMode)
  const highRisk = data.centrality >= 0.85
  const blastDepth = (data as FileNode & { blastDepth?: number }).blastDepth
  const priorityTop = viewMode === 'priority' && data.priorityRank <= 5
  const label = nodeLabel(data, viewMode)
  const size = viewMode === 'priority'
    ? 168 + data.priorityScore * 58
    : Math.min(220, Math.max(170, 132 + label.length * 3))
  const fill = nodeFill(data, viewMode)

  return (
    <Tooltip
      content={
        <div className="space-y-1">
          <p className="font-mono">{data.path}</p>
          <p className="max-w-xs whitespace-pre-line">{data.summary}</p>
          <p className="font-mono text-primary">centrality {Math.round(data.centrality * 100)}%</p>
        </div>
      }
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={`node-card relative rounded-lg border-2 bg-white p-2 shadow-lg ${priorityTop ? 'priority-shimmer' : ''} ${data.isOrphan ? 'border-dashed' : ''}`}
        style={{
          width: size,
          background: `linear-gradient(135deg, color-mix(in oklch, ${fill} 11%, white), white 58%)`,
          borderColor: selected ? 'var(--primary)' : highRisk ? 'var(--destructive)' : blastDepth ? 'var(--destructive)' : 'color-mix(in oklch, var(--foreground) 12%, white)',
          boxShadow: selected
            ? '0 0 0 3px color-mix(in oklch, var(--primary) 20%, transparent), 0 16px 42px color-mix(in oklch, var(--primary) 20%, transparent)'
            : blastDepth
              ? `0 0 0 ${6 - blastDepth}px color-mix(in oklch, var(--destructive) ${30 - blastDepth * 6}%, transparent)`
              : '0 10px 26px color-mix(in oklch, var(--foreground) 10%, transparent)',
        }}
      >
        <Handle type="target" position={Position.Top} className="opacity-0" />
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md shadow-sm" style={{ background: `color-mix(in oklch, ${fill} 18%, transparent)`, color: fill }}>
            <FileCode2 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-xs font-semibold">{label}</p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">{truncatePath(data.path, 28)}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <LayerBadge layer={data.layer} className="max-w-[112px] truncate" />
          <div className="flex items-center gap-1 text-primary">
            {data.isEntry ? <Zap className="size-3" /> : null}
            {data.isOrphan ? <AlertTriangle className="size-3 text-destructive" /> : null}
          </div>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${data.centrality * 100}%` }} />
        </div>
        {highRisk ? <span className="absolute -inset-1 -z-10 animate-pulse rounded-lg border border-destructive/40" /> : null}
        <Handle type="source" position={Position.Bottom} className="opacity-0" />
      </motion.div>
    </Tooltip>
  )
}
