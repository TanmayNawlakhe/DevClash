import { useGraphStore } from '../../../store/graphStore'
import type { ViewMode } from '../../../types'
import { VIEW_MODES } from '../../../lib/constants'
import { cn } from '../../../lib/utils'

const labels: Record<ViewMode, string> = {
  dependency: 'Dependency',
  ownership: 'Ownership',
  priority: 'Priority',
}

export function GraphViewSwitcher() {
  const viewMode = useGraphStore((state) => state.viewMode)
  const setViewMode = useGraphStore((state) => state.setViewMode)

  return (
    <div className="flex rounded-lg bg-muted p-1">
      {VIEW_MODES.map((mode) => (
        <button
          key={mode}
          className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition', viewMode === mode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          onClick={() => setViewMode(mode)}
        >
          {labels[mode]}
        </button>
      ))}
    </div>
  )
}
