import { Maximize2, Radar, Search, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { Button } from '../../ui/Button'
import { SearchInput } from '../../ui/SearchInput'
import { Select } from '../../ui/Select'
import { GraphFilterPanel } from './GraphFilterPanel'
import { GraphViewSwitcher } from './GraphViewSwitcher'
import { useGraphStore } from '../../../store/graphStore'

export function GraphToolbar({ onOpenQuery }: { onOpenQuery: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const filters = useGraphStore((state) => state.filters)
  const setFilters = useGraphStore((state) => state.setFilters)
  const layoutMode = useGraphStore((state) => state.layoutMode)
  const setLayoutMode = useGraphStore((state) => state.setLayoutMode)
  const blastRadiusEnabled = useGraphStore((state) => state.blastRadiusEnabled)
  const toggleBlastRadius = useGraphStore((state) => state.toggleBlastRadius)

  return (
    <div className="glass-panel flex flex-wrap items-center justify-center gap-2 rounded-lg p-2 shadow-xl shadow-primary/10">
      <GraphViewSwitcher />
      <div className="h-6 w-px bg-border" />
      <Button variant="ghost" size="icon" onClick={() => zoomIn({ duration: 260 })} aria-label="Zoom in">
        <ZoomIn className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => zoomOut({ duration: 260 })} aria-label="Zoom out">
        <ZoomOut className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => fitView({ padding: 0.24, duration: 620 })} aria-label="Fit view">
        <Maximize2 className="size-4" />
      </Button>
      <Button variant={blastRadiusEnabled ? 'primary' : 'outline'} size="sm" onClick={toggleBlastRadius}>
        <Radar className="size-4" />
        Blast
      </Button>
      <GraphFilterPanel />
      <Select
        ariaLabel="Layout mode"
        value={layoutMode}
        onValueChange={(value) => setLayoutMode(value as any)}
        options={[
          { value: 'force', label: 'Force-directed' },
          { value: 'hierarchical', label: 'Hierarchical' },
          { value: 'radial', label: 'Radial' },
        ]}
      />
      <SearchInput className="w-56" value={filters.search} onChange={(search) => setFilters({ search })} placeholder="Search files" />
      <Button variant="outline" size="sm" onClick={onOpenQuery}>
        <Search className="size-4" />
        Ask
        <span className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline-flex">Ctrl K</span>
      </Button>
      <div className="hidden items-center gap-1 rounded-md bg-accent/70 px-2 py-1 font-mono text-[10px] text-accent-foreground xl:flex">
        <Sparkles className="size-3" />
        Shift drag to lasso
      </div>
    </div>
  )
}
