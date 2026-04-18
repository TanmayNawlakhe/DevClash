import * as Checkbox from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { LayerBadge } from '../../ui/Badge'
import { useGraphStore } from '../../../store/graphStore'
import { usePriorityStore } from '../../../store/priorityStore'
import { truncatePath } from '../../../lib/utils'

export function PriorityChecklist() {
  const rankings = usePriorityStore((state) => state.rankings)
  const checked = usePriorityStore((state) => state.checkedFileIds)
  const toggleChecked = usePriorityStore((state) => state.toggleChecked)
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode)

  return (
    <div className="space-y-2">
      {rankings.map((entry) => (
        <button
          key={entry.fileId}
          className="w-full rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/50 hover:bg-accent/60"
          onClick={() => setSelectedNode(entry.fileId)}
        >
          <div className="flex items-start gap-3">
            <Checkbox.Root
              checked={checked.has(entry.fileId)}
              onClick={(event) => event.stopPropagation()}
              onCheckedChange={() => toggleChecked(entry.fileId)}
              className="mt-0.5 flex size-4 items-center justify-center rounded border border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            >
              <Checkbox.Indicator>
                <Check className="size-3" />
              </Checkbox.Indicator>
            </Checkbox.Root>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-primary">#{entry.rank}</span>
                <span className="truncate font-mono text-xs font-semibold">{truncatePath(entry.path, 32)}</span>
              </div>
              <div className="mt-2">
                <LayerBadge layer={entry.layer} />
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{entry.reason}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
