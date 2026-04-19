import { Handle, Position } from '@xyflow/react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Database, FileCode2, Globe, Layers, Settings, TestTube2, Wrench, Zap } from 'lucide-react'
import type { Layer } from '../../../types'

const LAYER_ICONS: Record<Layer, React.ComponentType<{ className?: string }>> = {
  entry_point: Zap,
  api: Globe,
  business_logic: Layers,
  data: Database,
  util: Wrench,
  config: Settings,
  test: TestTube2,
}

const LAYER_DESCRIPTIONS: Record<Layer, string> = {
  entry_point: 'App entry & bootstrapping',
  api: 'Routes, controllers & handlers',
  business_logic: 'Core domain & services',
  data: 'Models, schemas & repos',
  util: 'Shared helpers & utilities',
  config: 'Config & environment',
  test: 'Test suites & fixtures',
}

export function GroupNode({ data }: any) {
  const Icon = LAYER_ICONS[data.layer as Layer] ?? FileCode2
  const isExpanded = data.isExpanded as boolean

  return (
    <>
      {/* Horizontal flow handles */}
      <Handle type="target" position={Position.Left} className="opacity-0" />

      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="group cursor-pointer select-none overflow-hidden rounded-xl bg-white shadow-md transition-shadow hover:shadow-lg"
        style={{
          width: 220,
          borderLeft: `5px solid ${data.color}`,
          border: `1.5px solid color-mix(in oklch, ${data.color} 28%, var(--border))`,
          borderLeftWidth: 5,
          borderLeftColor: data.color,
          boxShadow: isExpanded
            ? `0 6px 24px color-mix(in oklch, ${data.color} 20%, transparent), 0 0 0 1.5px color-mix(in oklch, ${data.color} 40%, transparent)`
            : `0 3px 12px color-mix(in oklch, ${data.color} 10%, transparent)`,
          background: isExpanded
            ? `linear-gradient(135deg, color-mix(in oklch, ${data.color} 6%, white), white 55%)`
            : 'white',
        }}
      >
        {/* Main row */}
        <div className="flex items-center gap-2.5 px-3 py-3">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: `color-mix(in oklch, ${data.color} 14%, white)`,
              color: data.color,
            }}
          >
            <Icon className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight text-foreground">{data.label}</p>
            <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
              {LAYER_DESCRIPTIONS[data.layer as Layer] ?? ''}
            </p>
          </div>

          <span
            className="flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white"
            style={{ background: data.color }}
          >
            {data.fileCount}
          </span>
        </div>

        {/* Expand / collapse footer */}
        <div
          className="flex items-center justify-center gap-1 border-t px-3 py-1.5 text-[10px] font-medium opacity-60 transition-opacity group-hover:opacity-100"
          style={{
            borderColor: `color-mix(in oklch, ${data.color} 18%, var(--border))`,
            color: data.color,
          }}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="size-3" />
              Collapse
            </>
          ) : (
            <>
              <ChevronDown className="size-3 transition-transform group-hover:translate-y-0.5" />
              Expand files
            </>
          )}
        </div>
      </motion.div>

      <Handle type="source" position={Position.Right} className="opacity-0" />
    </>
  )
}
